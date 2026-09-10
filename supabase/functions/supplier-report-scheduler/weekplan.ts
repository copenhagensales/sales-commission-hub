// Ugeplan til kunder (report_type = 'client_week_plan').
// Samme abonnement-/dispatch-tabel, samme mailskabelon og samme afsendelsesvej
// som leverandørrapporten. Ingen godkendelse, ingen beløb, ingen sælgernavne.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendM365Mail } from "../_shared/m365-mail.ts";
import {
  buildClientWeekPlanEmail,
  buildWeekPlanEmptyWarningEmail,
  type WeekPlanLocation,
} from "../_shared/supplier-report-mail.ts";

type Svc = SupabaseClient;

interface BookingRow {
  id: string;
  start_date: string;
  end_date: string;
  booked_days: number[] | null;
  location_id: string;
  location: { name: string | null; type: string | null } | null;
}

interface AssignmentRow {
  booking_id: string;
  employee_id: string;
}

interface WeekPlanSubscriptionRow {
  id: string;
  name: string | null;
  client_id: string;
  weekday: number | null;
  send_hour: number;
  is_active: boolean;
  recipient_email: string | null;
  cc_emails: string[] | null;
  approver_employee_id: string | null;
  clients: { id: string; name: string | null } | null;
}

export interface WeekPlanResult {
  subscription: string;
  clientName: string;
  isoWeek: number;
  weekStart: string;
  weekEnd: string;
  locations: WeekPlanLocation[];
  totalDays: number;
  action: "sent" | "skipped_empty" | "already_handled" | "not_due" | "dry_run" | "test_mail";
  detail?: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mandagen i den ISO-uge datoen ligger i. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return addDays(iso, 1 - isoDow);
}

/** ISO-ugenummer (mandag som ugens første dag). */
export function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - isoDow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/**
 * Beregner ugeplanen pr. lokation for én kunde.
 * Dage: booked_days er ugedagsindeks med 0 = mandag; tom/null = alle dage i intervallet.
 * Sælgere: antal DISTINCT employee_id i booking_assignment inden for ugen.
 */
export async function computeWeekPlan(
  svc: Svc,
  clientId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeekPlanLocation[]> {
  const { data: bookings, error } = await svc
    .from("booking")
    .select(
      "id, start_date, end_date, booked_days, location_id, location:location(name, type)",
    )
    .eq("client_id", clientId)
    .eq("status", "confirmed")
    .lte("start_date", weekEnd)
    .gte("end_date", weekStart);
  if (error) throw new Error(error.message);

  const rows = (bookings ?? []) as unknown as BookingRow[];
  if (rows.length === 0) return [];

  const { data: assignments, error: aError } = await svc
    .from("booking_assignment")
    .select("booking_id, employee_id")
    .in("booking_id", rows.map((b) => b.id))
    .gte("date", weekStart)
    .lte("date", weekEnd);
  if (aError) throw new Error(aError.message);

  const employeesByBooking = new Map<string, Set<string>>();
  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    const set = employeesByBooking.get(a.booking_id) ?? new Set<string>();
    set.add(a.employee_id);
    employeesByBooking.set(a.booking_id, set);
  }

  const byLocation = new Map<
    string,
    { name: string; type: string; days: number; employees: Set<string> }
  >();

  for (const b of rows) {
    const bookedDays = b.booked_days ?? null;
    const start = b.start_date > weekStart ? b.start_date : weekStart;
    const end = b.end_date < weekEnd ? b.end_date : weekEnd;
    let days = 0;
    for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
      const d = new Date(`${iso}T00:00:00Z`);
      const index = (d.getUTCDay() === 0 ? 7 : d.getUTCDay()) - 1; // 0 = mandag
      if (!bookedDays || bookedDays.length === 0 || bookedDays.includes(index)) days++;
    }
    if (days === 0) continue;

    const key = b.location_id;
    const entry = byLocation.get(key) ?? {
      name: b.location?.name ?? "Ukendt lokation",
      type: b.location?.type ?? "Ukendt type",
      days: 0,
      employees: new Set<string>(),
    };
    entry.days += days;
    for (const e of employeesByBooking.get(b.id) ?? []) entry.employees.add(e);
    byLocation.set(key, entry);
  }

  return [...byLocation.values()]
    .map((v) => ({
      locationName: v.name,
      locationType: v.type,
      days: v.days,
      sellers: v.employees.size,
    }))
    .sort(
      (a, b) =>
        a.locationType.localeCompare(b.locationType, "da") ||
        a.locationName.localeCompare(b.locationName, "da"),
    );
}

async function internalAlertRecipient(
  svc: Svc,
  approverEmployeeId: string | null,
): Promise<string | null> {
  if (approverEmployeeId) {
    const { data } = await svc
      .from("employee_master_data")
      .select("work_email, private_email")
      .eq("id", approverEmployeeId)
      .maybeSingle();
    const email = (data?.work_email || data?.private_email || null) as string | null;
    if (email) return email;
  }
  return Deno.env.get("WEEKPLAN_ALERT_EMAIL") ||
    Deno.env.get("M365_SENDER_EMAIL") ||
    null;
}

/**
 * Kører ugeplanerne. Kun abonnementer med report_type 'client_week_plan'.
 * dryRun beregner uden at oprette dispatches eller sende mail.
 * testEmail sender den beregnede plan til én intern adresse uden at gemme noget.
 */
export async function runWeekPlans(
  svc: Svc,
  opts: {
    local: { year: number; month: number; day: number; hour: number };
    force: boolean;
    dryRun: boolean;
    weekStartOverride?: string;
    subscriptionId?: string;
    testEmail?: string;
  },
): Promise<WeekPlanResult[]> {
  const results: WeekPlanResult[] = [];

  let query = svc
    .from("supplier_report_subscriptions")
    .select("*, clients:client_id(id, name)")
    .eq("report_type", "client_week_plan");
  if (opts.subscriptionId) query = query.eq("id", opts.subscriptionId);
  const { data: subs, error } = await query;
  if (error) throw new Error(error.message);

  const todayLocal = `${opts.local.year}-${String(opts.local.month).padStart(2, "0")}-${
    String(opts.local.day).padStart(2, "0")
  }`;
  const localIsoDow = (() => {
    const d = new Date(`${todayLocal}T00:00:00Z`);
    return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  })();

  for (const sub of (subs ?? []) as unknown as WeekPlanSubscriptionRow[]) {
    const clientName = sub.clients?.name ?? "Ukendt kunde";
    const weekStart = opts.weekStartOverride
      ? mondayOf(opts.weekStartOverride)
      : mondayOf(todayLocal);
    const weekEnd = addDays(weekStart, 6);
    const isoWeek = isoWeekNumber(weekStart);

    const base = { subscription: sub.name ?? sub.id, clientName, isoWeek, weekStart, weekEnd };

    const isDue =
      opts.force ||
      opts.dryRun ||
      !!opts.testEmail ||
      (localIsoDow === sub.weekday && opts.local.hour === sub.send_hour);

    const liveRun = !opts.dryRun && !opts.testEmail;

    if (liveRun && (!isDue || !sub.is_active || !String(sub.recipient_email ?? "").trim())) {
      results.push({
        ...base,
        locations: [],
        totalDays: 0,
        action: "not_due",
        detail: !isDue
          ? "ikke sendetidspunkt"
          : !sub.is_active
            ? "inaktiv"
            : "ingen modtager",
      });
      continue;
    }

    const locations = await computeWeekPlan(svc, sub.client_id, weekStart, weekEnd);
    const totalDays = locations.reduce((s, l) => s + l.days, 0);

    if (opts.dryRun) {
      results.push({ ...base, locations, totalDays, action: "dry_run" });
      continue;
    }

    const mail = buildClientWeekPlanEmail({
      clientName,
      isoWeek,
      weekStart,
      weekEnd,
      locations,
    });

    if (opts.testEmail) {
      if (locations.length === 0) {
        results.push({
          ...base,
          locations,
          totalDays,
          action: "skipped_empty",
          detail: "testmail ikke sendt: ugen er tom",
        });
        continue;
      }
      await sendM365Mail({
        to: [opts.testEmail],
        subject: `[TEST] ${mail.subject}`,
        html: mail.html,
      });
      results.push({ ...base, locations, totalDays, action: "test_mail" });
      continue;
    }

    // UNIQUE (subscription_id, period_start) sikrer at en uge kun sendes én gang.
    const { data: inserted, error: insertError } = await svc
      .from("supplier_report_dispatches")
      .insert({
        subscription_id: sub.id,
        period_start: weekStart,
        period_end: weekEnd,
        status: locations.length === 0 ? "skipped" : "approved",
        error_message:
          locations.length === 0
            ? `Ugeplanen for ${clientName} i uge ${isoWeek} er tom - intet er sendt til kunden.`
            : null,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      results.push({
        ...base,
        locations,
        totalDays,
        action: "already_handled",
        detail: insertError?.message ?? "udsendelsen findes allerede",
      });
      continue;
    }

    if (locations.length === 0) {
      const to = await internalAlertRecipient(svc, sub.approver_employee_id);
      if (to) {
        const warn = buildWeekPlanEmptyWarningEmail({
          clientName,
          isoWeek,
          weekStart,
          weekEnd,
        });
        await sendM365Mail({ to: [to], subject: warn.subject, html: warn.html });
      }
      results.push({
        ...base,
        locations,
        totalDays,
        action: "skipped_empty",
        detail: to ? `intern advarsel sendt til ${to}` : "ingen intern modtager fundet",
      });
      continue;
    }

    const cc = (sub.cc_emails ?? []).filter((e) => !!e?.trim());
    const recipient = String(sub.recipient_email).trim();
    try {
      await sendM365Mail({
        to: [recipient],
        cc,
        subject: mail.subject,
        html: mail.html,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await svc
        .from("supplier_report_dispatches")
        .update({ status: "failed", error_message: msg })
        .eq("id", inserted.id);
      results.push({ ...base, locations, totalDays, action: "already_handled", detail: msg });
      continue;
    }

    await svc
      .from("supplier_report_dispatches")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to: [recipient, ...cc],
        error_message: null,
      })
      .eq("id", inserted.id);
    await svc
      .from("supplier_report_subscriptions")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", sub.id);

    results.push({ ...base, locations, totalDays, action: "sent" });
  }

  return results;
}
