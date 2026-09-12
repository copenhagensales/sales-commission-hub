import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const APP_URL = "https://stork.copenhagensales.dk";
const TEMPLATE_KEY = "ramp_risk_flag";

interface Seller {
  employee_name: string;
  campaign_name: string | null;
  day_no: number;
  cum_sales: number;
  threshold_value: number;
  created_at: string;
}

interface RiskStat {
  day_no: number;
  campaign_name: string | null;
  n_below: number;
  n_below_stopped: number;
  n_above: number;
  n_above_stopped: number;
}

interface LeaderPayload {
  leader_id: string;
  leader_name: string;
  leader_email: string;
  stats: RiskStat[];
  sellers: Seller[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Observeret gruppefrekvens med de raa antal altid synlige.
 * Procent uden de raa tal er forbudt, og der maa aldrig staa en personlig
 * sandsynlighed for en navngiven saelger.
 */
function buildStatSentence(stat: RiskStat): string {
  const campaign = escapeHtml(stat.campaign_name ?? "kampagnen");
  const parts: string[] = [];
  if (stat.n_below > 0) {
    const pct = Math.round((stat.n_below_stopped / stat.n_below) * 100);
    parts.push(
      `Blandt nye sælgere på ${campaign} stoppede ${pct} % af dem, der lå under det typiske på dag ${stat.day_no}, inden dag 40 (${stat.n_below_stopped} af ${stat.n_below}).`,
    );
  }
  if (stat.n_above > 0) {
    const pct = Math.round((stat.n_above_stopped / stat.n_above) * 100);
    parts.push(
      `Blandt dem på eller over lå tallet på ${pct} % (${stat.n_above_stopped} af ${stat.n_above}).`,
    );
  }
  return parts.join(" ");
}

function buildContent(payload: LeaderPayload): string {
  const rows = payload.sellers
    .sort((a, b) => a.day_no - b.day_no)
    .map(
      (s) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(s.employee_name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(s.campaign_name ?? "-")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">Dag ${s.day_no}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.cum_sales} salg</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">Typisk fra ${Math.round(Number(s.threshold_value))}</td>
        </tr>`,
    )
    .join("");

  const stats = (payload.stats ?? [])
    .map((stat) => `<p><strong>${buildStatSentence(stat)}</strong></p>`)
    .join("");

  return `
    <p>Hej ${escapeHtml(payload.leader_name)},</p>
    ${stats}
    <p>Grundlaget er lille, så tallene kan flytte sig. Tallene gælder grupper, ikke enkeltpersoner.</p>
    <p>Det er en samtale, der mangler — ikke en vurdering af sælgeren. Tag fat i dem, mens der stadig
    kan gøres noget, og registrér hvad du gjorde.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead>
        <tr style="text-align:left;background:#f5f5f5;">
          <th style="padding:8px 12px;">Sælger</th>
          <th style="padding:8px 12px;">Kampagne</th>
          <th style="padding:8px 12px;">Måledag</th>
          <th style="padding:8px 12px;">Egne salg</th>
          <th style="padding:8px 12px;">Typisk niveau</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:24px;">
      <a href="${APP_URL}/opstartshold"
         style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
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

    const { data: payload, error } = await supabase.rpc("ramp_risk_mail_payload");
    if (error) throw error;

    const leaders = (Array.isArray(payload) ? payload : []) as LeaderPayload[];
    if (leaders.length === 0) {
      return new Response(JSON.stringify({ queued: 0, skipped: 0, leaders: 0 }), {
        headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: template } = await supabase
      .from("email_templates")
      .select("subject")
      .eq("template_key", TEMPLATE_KEY)
      .maybeSingle();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let queued = 0;
    let skipped = 0;

    for (const leader of leaders) {
      if (!leader.leader_email || leader.sellers.length === 0) continue;

      // Maks. én mail pr. dag pr. leder
      const { count } = await supabase
        .from("scheduled_emails")
        .select("id", { count: "exact", head: true })
        .eq("template_key", TEMPLATE_KEY)
        .eq("recipient_email", leader.leader_email)
        .gte("created_at", since);

      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      const subject =
        template?.subject ??
        `Nye sælgere der har brug for en hånd (${leader.sellers.length})`;

      const { error: insertError } = await supabase.from("scheduled_emails").insert({
        employee_id: leader.leader_id,
        recipient_email: leader.leader_email,
        recipient_name: leader.leader_name,
        subject,
        content: buildContent(leader),
        template_key: TEMPLATE_KEY,
        scheduled_at: new Date().toISOString(),
        status: "pending",
      });
      if (insertError) throw insertError;
      queued++;
    }

    return new Response(
      JSON.stringify({ queued, skipped, leaders: leaders.length }),
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
