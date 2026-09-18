// MIDLERTIDIG read-only probe: hvilke felt- og udfaldsværdier findes på
// Tryg-kanvas-kampagnerne i Enreach? Returnerer KUN feltnavne og
// optællinger — aldrig lead-indhold. Slettes når kortlægningen er bekræftet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

function asArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    for (const k of ["Results", "results", "Leads", "leads", "Data", "data"]) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sharedCorsHeaders });
  try {
    const guard = await requireCronOrOwner(req);
    if (!guard.ok) return json(guard.status, { error: guard.error });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const days = Number(body.days ?? 14);
    const pageSize = Number(body.page_size ?? 500);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integration } = await svc
      .from("dialer_integrations")
      .select("id, api_url")
      .eq("name", "tryg")
      .eq("provider", "enreach")
      .single();
    if (!integration) return json(400, { error: "Enreach-integrationen 'tryg' findes ikke" });

    const { data: creds, error: credErr } = await svc.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY"),
    });
    if (credErr || !creds) return json(400, { error: "Kunne ikke læse legitimation" });

    let baseUrl: string = (creds.api_url || integration.api_url || "https://wshero01.herobase.com/api")
      .replace(/^(Web|URL|API|Endpoint):\s*/i, "")
      .trim();
    if (!/^https?:\/\//.test(baseUrl)) baseUrl = `https://${baseUrl}`;
    if (!baseUrl.endsWith("/api")) baseUrl = baseUrl.replace(/\/$/, "") + "/api";

    const auth = creds.username && creds.password
      ? `Basic ${btoa(`${creds.username}:${creds.password}`)}`
      : `Bearer ${creds.api_token}`;
    const headers = { Authorization: auth, Accept: "application/json" };

    const { data: mapRows } = await svc
      .from("weekly_lead_report_campaign_map")
      .select("adversus_campaign_id, adversus_campaign_name")
      .eq("report_line", "Kanvas");

    const from = new Date();
    from.setDate(from.getDate() - days);
    const modifiedFrom = from.toISOString().slice(0, 10);

    const out: Record<string, unknown> = { baseUrl, modifiedFrom, campaigns: [] };
    const fieldNames = new Set<string>();

    for (const row of mapRows ?? []) {
      const id = String(row.adversus_campaign_id);
      const url =
        `${baseUrl}/simpleleads?Campaigns=${encodeURIComponent(id)}&ModifiedFrom=${modifiedFrom}&PageSize=${pageSize}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        (out.campaigns as unknown[]).push({
          campaignId: id,
          name: row.adversus_campaign_name,
          httpStatus: res.status,
        });
        continue;
      }
      const leads = asArray(await res.json());
      const closures = new Map<string, number>();
      const statuses = new Map<string, number>();
      const userFields = new Map<string, number>();
      for (const lead of leads) {
        for (const k of Object.keys(lead)) fieldNames.add(k);
        const closure = String(lead.LeadClosure ?? lead.leadClosure ?? lead.Closure ?? "(mangler)");
        closures.set(closure, (closures.get(closure) ?? 0) + 1);
        const status = String(lead.Status ?? lead.status ?? "(mangler)");
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
        for (const k of ["User", "user", "UserName", "userName", "Agent", "agent", "ProcessedBy"]) {
          if (lead[k] !== undefined && lead[k] !== null && lead[k] !== "") {
            userFields.set(k, (userFields.get(k) ?? 0) + 1);
          }
        }
      }
      (out.campaigns as unknown[]).push({
        campaignId: id,
        name: row.adversus_campaign_name,
        httpStatus: 200,
        leads: leads.length,
        closures: Object.fromEntries(closures),
        statuses: Object.fromEntries(statuses),
        userFieldsPresent: Object.fromEntries(userFields),
      });
    }

    out.fieldNames = [...fieldNames].sort();
    return json(200, out);
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
