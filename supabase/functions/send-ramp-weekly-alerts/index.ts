import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

/**
 * Fredagens paamindelse om ugens faste forloeb for nye saelgere.
 *
 * Serveren indeholder INGEN forretningsregler: hvem der mangler hvad kommer
 * udelukkende fra `ramp_weekly_missing_payload()`. Her bygges kun mailen,
 * og der sendes maks. en mail pr. modtager pr. ISO-uge.
 */

const APP_URL = "https://stork.copenhagensales.dk";
const TEMPLATE_KEY = "ramp_weekly_program";

interface MissingSeller {
  employee_name: string;
  team_name: string | null;
  leader_name: string | null;
  day_no: number;
  missing_coaching: boolean;
  missing_listen: boolean;
}

interface RecipientPayload {
  recipient_id: string;
  recipient_name: string;
  recipient_email: string | null;
  is_escalation: boolean;
  sellers: MissingSeller[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mandag i den indevaerende ISO-uge, dansk tid. */
function mondayOfCurrentWeek(): Date {
  const nowCph = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }),
  );
  const day = nowCph.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(nowCph);
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function buildContent(payload: RecipientPayload, week: number): string {
  const rows = payload.sellers
    .slice()
    .sort((a, b) => a.day_no - b.day_no)
    .map((s) => {
      const missing = [
        s.missing_coaching ? "1-1 coaching" : null,
        s.missing_listen ? "1-1 lyt" : null,
      ]
        .filter(Boolean)
        .join(" og ");
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e7eeeb;">${escapeHtml(s.employee_name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e7eeeb;">${escapeHtml(s.team_name ?? "-")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e7eeeb;">${escapeHtml(s.leader_name ?? "-")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e7eeeb;">Dag ${s.day_no} af 40</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e7eeeb;">Mangler ${escapeHtml(missing)}</td>
        </tr>`;
    })
    .join("");

  const intro = payload.is_escalation
    ? `<p>Her er status på ugens faste forløb for nye sælgere i uge ${week}.</p>`
    : `<p>Hej ${escapeHtml(payload.recipient_name)}, her er de nye sælgere, der mangler ugens faste forløb i uge ${week}.</p>`;

  return `
    ${intro}
    <p>Alle i deres første 40 arbejdsdage skal have både en 1-1 coaching og en 1-1 lyt med
    feedback hver uge. Mandag til torsdag er den normale periode — <strong>I har i dag til at
    nå det.</strong></p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;color:#1b1f1d;">
      <thead>
        <tr style="text-align:left;background:#e7f4ed;">
          <th style="padding:8px 12px;">Sælger</th>
          <th style="padding:8px 12px;">Team</th>
          <th style="padding:8px 12px;">Leder</th>
          <th style="padding:8px 12px;">Opstart</th>
          <th style="padding:8px 12px;">Mangler</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#57635e;">Har sælgeren været væk hele ugen, registrér "fravær hele ugen" —
    så falder påmindelsen væk.</p>
    <p style="margin-top:24px;">
      <a href="${APP_URL}/opstartshold"
         style="background:#177a4d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
        Åbn Opstartshold i Stork
      </a>
    </p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: sharedCorsHeaders });
  }

  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("ramp_weekly_missing_payload");
    if (error) throw error;

    const recipients = (Array.isArray(data) ? data : []) as RecipientPayload[];
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ queued: 0, skipped: 0, recipients: 0 }), {
        headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
      });
    }

    const monday = mondayOfCurrentWeek();
    const week = isoWeekNumber(monday);

    const { data: template } = await supabase
      .from("email_templates")
      .select("subject")
      .eq("template_key", TEMPLATE_KEY)
      .maybeSingle();

    let queued = 0;
    let skipped = 0;

    for (const recipient of recipients) {
      if (!recipient.recipient_email || recipient.sellers.length === 0) continue;

      // Maks. en mail pr. modtager pr. ISO-uge
      const { count } = await supabase
        .from("scheduled_emails")
        .select("id", { count: "exact", head: true })
        .eq("template_key", TEMPLATE_KEY)
        .eq("recipient_email", recipient.recipient_email)
        .gte("created_at", monday.toISOString());

      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      const subject =
        template?.subject ??
        `Ugens faste forløb mangler for ${recipient.sellers.length} nye sælgere (uge ${week})`;

      const { error: insertError } = await supabase.from("scheduled_emails").insert({
        employee_id: recipient.recipient_id,
        recipient_email: recipient.recipient_email,
        recipient_name: recipient.recipient_name,
        subject,
        content: buildContent(recipient, week),
        template_key: TEMPLATE_KEY,
        scheduled_at: new Date().toISOString(),
        status: "pending",
      });
      if (insertError) throw insertError;
      queued++;
    }

    return new Response(
      JSON.stringify({ queued, skipped, recipients: recipients.length, week }),
      { headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
    });
  }
});
