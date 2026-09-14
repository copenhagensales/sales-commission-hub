import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sharedCorsHeaders } from "../_shared/auth.ts";
import {
  renderRejectionMail,
  renderTeamSummaryMail,
  renderManagementMail,
  RESULT_LABEL,
  pct,
  rate,
  trendArrow,
} from "../_shared/quality-mail.ts";

/**
 * Mails for kvalitetsmodulet.
 *
 * action = "rejected_review": straks-mail til teamleder og assisterende ved Afvist.
 * action = "daily_summary": "Færdig for i dag" — sammenfatning pr. team og samlet
 *   ledelsesmail. Kan kun køres én gang pr. dag (quality_daily_completions).
 *
 * Mails lægges i scheduled_emails og sendes af process-scheduled-emails.
 * Alle udsendelser logges i quality_mail_log. Intet i lønnen berøres.
 */

const APP_URL = "https://stork.copenhagensales.dk";
const MANAGEMENT_EMAILS = ["km@copenhagensales.dk", "mg@copenhagensales.dk"];

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

type Client = ReturnType<typeof svc>;

async function resolveCaller(req: Request, db: Client) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data, error } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !data?.user) return null;

  const email = data.user.email?.toLowerCase() ?? "";
  const { data: employee } = await db
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, private_email")
    .or(
      `auth_user_id.eq.${data.user.id},private_email.ilike.${email},work_email.ilike.${email}`,
    )
    .maybeSingle();

  const { data: superadmin } = await db
    .from("superadmins")
    .select("id")
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();

  let isController = false;
  if (employee?.id) {
    const { data: controller } = await db
      .from("quality_controllers")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("is_active", true)
      .maybeSingle();
    isController = !!controller;
  }

  if (!isController && !superadmin) return null;
  return { employeeId: employee?.id ?? null, isController, isSuperadmin: !!superadmin };
}

async function leaderRecipients(
  db: Client,
  teamId: string | null,
): Promise<Array<{ email: string; name: string; employeeId: string }>> {
  if (!teamId) return [];
  const { data: team } = await db
    .from("teams")
    .select("id, team_leader_id, assistant_team_leader_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return [];

  const { data: assistants } = await db
    .from("team_assistant_leaders")
    .select("employee_id")
    .eq("team_id", teamId);

  const ids = [
    team.team_leader_id,
    team.assistant_team_leader_id,
    ...(assistants ?? []).map((a) => a.employee_id),
  ].filter((id): id is string => !!id);

  if (ids.length === 0) return [];

  const { data: employees } = await db
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, private_email, is_active")
    .in("id", Array.from(new Set(ids)));

  const out = new Map<string, { email: string; name: string; employeeId: string }>();
  for (const e of employees ?? []) {
    const email = (e.work_email || e.private_email || "").trim();
    if (!email || e.is_active === false) continue;
    out.set(email.toLowerCase(), {
      email,
      name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
      employeeId: e.id,
    });
  }
  return Array.from(out.values());
}

async function queueMail(
  db: Client,
  args: {
    mailType: string;
    recipient: { email: string; name: string; employeeId?: string | null };
    subject: string;
    html: string;
    reviewId?: string | null;
    saleId?: string | null;
    teamId?: string | null;
  },
) {
  const { error } = await db.from("scheduled_emails").insert({
    employee_id: args.recipient.employeeId ?? null,
    recipient_email: args.recipient.email,
    recipient_name: args.recipient.name || null,
    subject: args.subject,
    content: args.html,
    template_key: args.mailType,
    scheduled_at: new Date().toISOString(),
    status: "pending",
  });

  await db.from("quality_mail_log").insert({
    mail_type: args.mailType,
    review_id: args.reviewId ?? null,
    sale_id: args.saleId ?? null,
    team_id: args.teamId ?? null,
    recipient_email: args.recipient.email,
    recipient_name: args.recipient.name || null,
    subject: args.subject,
    status: error ? "failed" : "queued",
    error_message: error?.message ?? null,
  });

  if (error) throw error;
}

async function handleRejectedReview(db: Client, reviewId: string) {
  const { data: review, error } = await db
    .from("quality_reviews")
    .select(
      "id, sale_id, sale_datetime, seller_name, team_id, team_name, comment, search_key, result, client_campaign_id",
    )
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw error;
  if (!review) return { queued: 0, reason: "review_not_found" };
  if (review.result !== "afvist") return { queued: 0, reason: "not_rejected" };

  const { data: campaign } = review.client_campaign_id
    ? await db
        .from("client_campaigns")
        .select("name")
        .eq("id", review.client_campaign_id)
        .maybeSingle()
    : { data: null };

  const { data: codes } = await db
    .from("quality_review_error_codes")
    .select("quality_error_codes(label)")
    .eq("review_id", review.id);

  const errorCodes = (codes ?? [])
    .map((c: Record<string, unknown>) => (c.quality_error_codes as { label?: string } | null)?.label)
    .filter((l): l is string => !!l);

  const recipients = await leaderRecipients(db, review.team_id);
  const { subject, html } = renderRejectionMail({
    sellerName: review.seller_name ?? "Ukendt sælger",
    teamName: review.team_name ?? "Uden team",
    campaignName: campaign?.name ?? "Ukendt kampagne",
    saleDateTime: review.sale_datetime,
    searchKey: review.search_key,
    errorCodes,
    comment: review.comment,
    saleLink: `${APP_URL}/kvalitetskontrol?sale=${review.sale_id}`,
  });

  for (const recipient of recipients) {
    await queueMail(db, {
      mailType: "quality_rejected",
      recipient,
      subject,
      html,
      reviewId: review.id,
      saleId: review.sale_id,
      teamId: review.team_id,
    });
  }

  return { queued: recipients.length };
}

interface Counters {
  totalSales: number;
  reviewed: number;
  rejected: number;
  remarked: number;
}

const emptyCounters = (): Counters => ({ totalSales: 0, reviewed: 0, rejected: 0, remarked: 0 });

async function handleDailySummary(
  db: Client,
  date: string,
  reviewerEmployeeId: string | null,
) {
  const { data: existing } = await db
    .from("quality_daily_completions")
    .select("id")
    .eq("completion_date", date)
    .maybeSingle();
  if (existing) return { already_done: true, leaders: 0, management: 0 };

  const from30 = new Date(`${date}T12:00:00Z`);
  from30.setUTCDate(from30.getUTCDate() - 29);
  const from30Str = from30.toISOString().slice(0, 10);

  const { data: reviews, error } = await db
    .from("quality_reviews")
    .select(
      "id, sale_id, sale_date, seller_name, team_id, team_name, result, search_key, client_campaign_id",
    )
    .gte("sale_date", from30Str)
    .lte("sale_date", date);
  if (error) throw error;

  const { data: campaigns } = await db.from("client_campaigns").select("id, name");
  const campaignName = new Map((campaigns ?? []).map((c) => [c.id, c.name as string]));

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const codeByReview = new Map<string, string[]>();
  if (reviewIds.length > 0) {
    const { data: codes } = await db
      .from("quality_review_error_codes")
      .select("review_id, quality_error_codes(label)")
      .in("review_id", reviewIds);
    for (const row of codes ?? []) {
      const label = (row.quality_error_codes as { label?: string } | null)?.label;
      if (!label) continue;
      const list = codeByReview.get(row.review_id as string) ?? [];
      list.push(label);
      codeByReview.set(row.review_id as string, list);
    }
  }

  // Salg i alt pr. team for dagen og for 30 dage, til dækningsgrad.
  const { data: scopeDay } = await db.rpc("quality_sales_scope", {
    p_from: date,
    p_to: date,
  });
  const { data: scope30 } = await db.rpc("quality_sales_scope", {
    p_from: from30Str,
    p_to: date,
  });

  const teamNames = new Map<string, string>();
  const dayCounters = new Map<string, Counters>();
  const d30Counters = new Map<string, Counters>();
  const keyOf = (teamId: string | null) => teamId ?? "uden_team";

  const bump = (map: Map<string, Counters>, teamId: string | null): Counters => {
    const key = keyOf(teamId);
    if (!map.has(key)) map.set(key, emptyCounters());
    return map.get(key)!;
  };

  for (const row of (scopeDay ?? []) as Array<Record<string, unknown>>) {
    const teamId = (row.team_id as string) ?? null;
    if (teamId && row.team_name) teamNames.set(teamId, row.team_name as string);
    bump(dayCounters, teamId).totalSales++;
  }
  for (const row of (scope30 ?? []) as Array<Record<string, unknown>>) {
    const teamId = (row.team_id as string) ?? null;
    if (teamId && row.team_name) teamNames.set(teamId, row.team_name as string);
    bump(d30Counters, teamId).totalSales++;
  }

  const codeCount30 = new Map<string, number>();
  let reviewed30Total = 0;

  for (const review of reviews ?? []) {
    if (review.team_id && review.team_name) {
      teamNames.set(review.team_id, review.team_name);
    }
    const c30 = bump(d30Counters, review.team_id);
    c30.reviewed++;
    if (review.result === "afvist") c30.rejected++;
    if (review.result === "godkendt_med_bemaerkning") c30.remarked++;
    reviewed30Total++;
    for (const label of codeByReview.get(review.id) ?? []) {
      codeCount30.set(label, (codeCount30.get(label) ?? 0) + 1);
    }

    if (review.sale_date === date) {
      const cDay = bump(dayCounters, review.team_id);
      cDay.reviewed++;
      if (review.result === "afvist") cDay.rejected++;
      if (review.result === "godkendt_med_bemaerkning") cDay.remarked++;
    }
  }

  const todaysReviews = (reviews ?? []).filter((r) => r.sale_date === date);

  // Sammenfatning pr. team med kontroller i dag.
  let leaderMails = 0;
  const teamsWithReviewsToday = Array.from(
    new Set(todaysReviews.map((r) => r.team_id).filter((t): t is string => !!t)),
  );

  for (const teamId of teamsWithReviewsToday) {
    const teamReviews = todaysReviews.filter((r) => r.team_id === teamId);
    const sellers = new Map<string, { sellerName: string; sales: Array<{ result: string; campaignName: string; searchKey: string | null; errorCodes: string[] }> }>();
    for (const r of teamReviews) {
      const key = r.seller_name ?? "Ukendt";
      if (!sellers.has(key)) sellers.set(key, { sellerName: key, sales: [] });
      sellers.get(key)!.sales.push({
        result: r.result,
        campaignName: r.client_campaign_id
          ? campaignName.get(r.client_campaign_id) ?? "Ukendt kampagne"
          : "Ukendt kampagne",
        searchKey: r.search_key,
        errorCodes: codeByReview.get(r.id) ?? [],
      });
    }

    const day = dayCounters.get(keyOf(teamId)) ?? emptyCounters();
    const d30 = d30Counters.get(keyOf(teamId)) ?? emptyCounters();

    const { subject, html } = renderTeamSummaryMail({
      teamName: teamNames.get(teamId) ?? "Team",
      date,
      sellers: Array.from(sellers.values()),
      dayRejectedRate: rate(day.rejected, day.reviewed),
      dayRemarkRate: rate(day.remarked, day.reviewed),
      d30RejectedRate: rate(d30.rejected, d30.reviewed),
      d30RemarkRate: rate(d30.remarked, d30.reviewed),
      coverageDay: pct(day.reviewed, day.totalSales),
      coverage30: pct(d30.reviewed, d30.totalSales),
      reviewedDay: day.reviewed,
    });

    for (const recipient of await leaderRecipients(db, teamId)) {
      await queueMail(db, {
        mailType: "quality_team_summary",
        recipient,
        subject,
        html,
        teamId,
      });
      leaderMails++;
    }
  }

  // Ledelsesmail: alle teams med salg i perioden, også dem uden kontrol i dag.
  const allTeamKeys = Array.from(
    new Set([...dayCounters.keys(), ...d30Counters.keys()]),
  );
  const teamRows = allTeamKeys
    .map((key) => {
      const day = dayCounters.get(key) ?? emptyCounters();
      const d30 = d30Counters.get(key) ?? emptyCounters();
      const dayRejected = rate(day.rejected, day.reviewed);
      const dayRemark = rate(day.remarked, day.reviewed);
      const d30Rejected = rate(d30.rejected, d30.reviewed);
      const d30Remark = rate(d30.remarked, d30.reviewed);
      return {
        teamName: key === "uden_team" ? "Uden team" : teamNames.get(key) ?? "Team",
        reviewed: day.reviewed,
        coverage: pct(day.reviewed, day.totalSales),
        rejectedDay: dayRejected === null ? "–" : pct(dayRejected, 100),
        remarkDay: dayRemark === null ? "–" : pct(dayRemark, 100),
        rejected30:
          d30Rejected === null ? "–" : `${pct(d30Rejected, 100)}${trendArrow(d30Rejected, dayRejected)}`,
        remark30:
          d30Remark === null ? "–" : `${pct(d30Remark, 100)}${trendArrow(d30Remark, dayRemark)}`,
      };
    })
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "da"));

  const rejectedSales = todaysReviews
    .filter((r) => r.result === "afvist")
    .map((r) => ({
      sellerName: r.seller_name ?? "Ukendt",
      teamName: r.team_name ?? "Uden team",
      campaignName: r.client_campaign_id
        ? campaignName.get(r.client_campaign_id) ?? "Ukendt kampagne"
        : "Ukendt kampagne",
      errorCodes: codeByReview.get(r.id) ?? [],
    }));

  const topCodes = Array.from(codeCount30.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, share: pct(count, reviewed30Total) }));

  const management = renderManagementMail({ date, teams: teamRows, rejectedSales, topCodes });

  const { data: managementEmployees } = await db
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email")
    .in("work_email", MANAGEMENT_EMAILS);

  let managementMails = 0;
  for (const email of MANAGEMENT_EMAILS) {
    const employee = (managementEmployees ?? []).find(
      (e) => (e.work_email ?? "").toLowerCase() === email,
    );
    await queueMail(db, {
      mailType: "quality_management_summary",
      recipient: {
        email,
        name: employee ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() : "",
        employeeId: employee?.id ?? null,
      },
      subject: management.subject,
      html: management.html,
    });
    managementMails++;
  }

  await db.from("quality_daily_completions").insert({
    completion_date: date,
    reviewer_employee_id: reviewerEmployeeId,
    reviewed_count: todaysReviews.length,
  });

  return { already_done: false, leaders: leaderMails, management: managementMails };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: sharedCorsHeaders });
  }

  try {
    const db = svc();
    const caller = await resolveCaller(req, db);
    if (!caller) return json(403, { error: "Ingen adgang til kvalitetsmodulet" });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "rejected_review") {
      if (typeof body.review_id !== "string") {
        return json(400, { error: "review_id mangler" });
      }
      const result = await handleRejectedReview(db, body.review_id);
      return json(200, { action, ...result });
    }

    if (action === "daily_summary") {
      const date =
        typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : new Date().toISOString().slice(0, 10);
      const result = await handleDailySummary(db, date, caller.employeeId);
      return json(200, { action, date, ...result });
    }

    return json(400, { error: "Ukendt action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return json(500, { error: message });
  }
});
