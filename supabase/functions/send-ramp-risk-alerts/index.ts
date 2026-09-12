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

interface LeaderPayload {
  leader_id: string;
  leader_name: string;
  leader_email: string;
  risk_factor: number;
  basis_sellers: number;
  basis_leavers: number;
  basis_campaign_label: string;
  sellers: Seller[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  return `
    <p>Hej ${escapeHtml(payload.leader_name)},</p>
    <p><strong>Sælgere i denne liste har ca. ${payload.risk_factor} gange større risiko for at stoppe
    inden dag 40 end de øvrige nye. Baseret på ${payload.basis_sellers} sælgere og
    ${payload.basis_leavers} afgange på ${escapeHtml(payload.basis_campaign_label)}.</strong></p>
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
      <a href="${APP_URL}/opstart-risiko"
         style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
        Åbn listen i Stork
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
