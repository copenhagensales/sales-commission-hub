import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

/**
 * Feedback fra ugens faste forloeb (1-1 coaching / 1-1 lyt).
 *
 * Serveren indeholder INGEN forretningsregler om hvem der er i farezonen.
 * Modtagerne hentes udelukkende via `ramp_session_recipients()` med kalderens
 * eget JWT, saa en leder kun kan sende for de saelgere han i forvejen kan se.
 * Rekkefolge: modtagere -> mails i koen -> registrering af handlingen.
 * Fejler mailen, oprettes registreringen ikke.
 */

const APP_URL = "https://stork.copenhagensales.dk";
const TEMPLATE_KEY = "ramp_session_feedback";

type Kind = "coaching" | "listen";

const ACTION_TYPE: Record<Kind, string> = {
  coaching: "1-1 samtale",
  listen: "medlyt med feedback",
};

const KIND_LABEL: Record<Kind, string> = {
  coaching: "1-1 coaching",
  listen: "1-1 lyt",
};

interface Person {
  employee_id: string;
  name: string;
  email: string | null;
}

interface RecipientInfo {
  performed_by: string;
  performed_by_name: string | null;
  seller: Person & { campaign_name: string | null; day_no: number | null };
  leaders: Person[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function noteHtml(note: string): string {
  return `<div style="background:#f6f9f8;border:1px solid #e7eeeb;border-radius:12px;padding:16px;
      white-space:pre-wrap;font-size:14px;color:#1b1f1d;">${escapeHtml(note)}</div>`;
}

function sellerContent(info: RecipientInfo, kind: Kind, note: string, week: number): string {
  return `
    <p>Hej ${escapeHtml(info.seller.name)},</p>
    <p>Her er noterne fra vores ${escapeHtml(KIND_LABEL[kind])} i uge ${week}.</p>
    ${noteHtml(note)}`;
}


function leaderContent(
  info: RecipientInfo,
  leader: Person,
  kind: Kind,
  note: string,
  week: number,
): string {
  return `
    <p>Hej ${escapeHtml(leader.name)},</p>
    <p><strong>${escapeHtml(info.seller.name)}</strong> har haft
    ${escapeHtml(KIND_LABEL[kind])} i uge ${week} med
    ${escapeHtml(info.performed_by_name ?? "en leder")}.</p>
    <table style="border-collapse:collapse;font-size:14px;color:#1b1f1d;margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0;color:#57635e;">Kampagne</td>
          <td style="padding:4px 0;">${escapeHtml(info.seller.campaign_name ?? "-")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#57635e;">Opstart</td>
          <td style="padding:4px 0;">Arbejdsdag ${info.seller.day_no ?? "-"} af 40</td></tr>
    </table>
    ${noteHtml(note)}
    <p style="margin-top:24px;">
      <a href="${APP_URL}/opstartshold"
         style="background:#177a4d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
        Åbn Opstartshold i Stork
      </a>
    </p>`;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: sharedCorsHeaders });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as {
      employeeId?: string;
      kind?: Kind;
      note?: string;
      flagId?: string | null;
    };

    const kind = body.kind;
    const note = (body.note ?? "").trim();
    if (!body.employeeId || (kind !== "coaching" && kind !== "listen")) {
      return json(400, { error: "Ugyldig forespørgsel" });
    }
    if (note.length < 10) {
      return json(400, { error: "Skriv feedback før du sender (mindst 10 tegn)" });
    }

    // Kalderens eget JWT: adgangen afgoeres i databasen.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const { data: infoRaw, error: infoError } = await userClient.rpc("ramp_session_recipients", {
      p_employee_id: body.employeeId,
    });
    if (infoError) throw infoError;
    if (!infoRaw) return json(403, { error: "Du har ikke adgang til denne sælger" });

    const info = infoRaw as RecipientInfo;
    const week = isoWeekNumber(new Date());

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const mails: { employeeId: string; email: string; name: string; subject: string; content: string }[] = [];

    if (info.seller.email) {
      mails.push({
        employeeId: info.seller.employee_id,
        email: info.seller.email,
        name: info.seller.name,
        subject: `${KIND_LABEL[kind]} med ${info.performed_by_name ?? "din leder"} · uge ${week}`,
        content: sellerContent(info, kind, note, week),
      });
    }

    for (const leader of info.leaders ?? []) {
      if (!leader.email) continue;
      if (leader.employee_id === info.performed_by) continue;
      mails.push({
        employeeId: leader.employee_id,
        email: leader.email,
        name: leader.name,
        subject: `${info.seller.name} · ${KIND_LABEL[kind]} afholdt i uge ${week}`,
        content: leaderContent(info, leader, kind, note, week),
      });
    }

    if (mails.length === 0) {
      return json(400, { error: "Ingen modtagere har en e-mailadresse" });
    }

    for (const mail of mails) {
      const { error } = await svc.from("scheduled_emails").insert({
        employee_id: mail.employeeId,
        recipient_email: mail.email,
        recipient_name: mail.name,
        subject: mail.subject,
        content: mail.content,
        template_key: TEMPLATE_KEY,
        scheduled_at: new Date().toISOString(),
        status: "pending",
      });
      if (error) throw error;
    }

    const { error: actionError } = await svc.from("ramp_flag_action").insert({
      employee_id: body.employeeId,
      flag_id: body.flagId ?? null,
      action_type: ACTION_TYPE[kind],
      performed_by: info.performed_by,
      note,
      recipients: mails.map((m) => m.email),
    });
    if (actionError) throw actionError;

    return json(200, { ok: true, recipients: mails.map((m) => m.email) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return json(500, { error: message });
  }
});
