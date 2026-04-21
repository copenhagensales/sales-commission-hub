/**
 * Alka Attribution Probe
 *
 * Fetches /users for Alka, builds orgCode→email map, then fetches
 * /simpleleads for the configured time window and reports per
 * success-lead:
 *   - firstProcessedByUser.orgCode + email + resolvedEmail
 *   - lastModifiedByUser.orgCode  + email + resolvedEmail
 *   - which one is chosen as agentEmail
 *   - whether it passes the @copenhagensales.dk whitelist
 *
 * No DB writes, read-only.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALKA_INTEGRATION_ID = "48d8bd23-df14-41fe-b000-abb8a4d6cd1d";
const ALLOWED_DOMAINS = ["@copenhagensales.dk"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const fromDate: string = body.from || isoDaysAgo(1); // default = yesterday
    const toDate: string = body.to || isoDaysAgo(0);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    if (!encryptionKey) return json({ error: "DB_ENCRYPTION_KEY missing" }, 500);

    const { data: creds, error: decErr } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: ALKA_INTEGRATION_ID,
      p_encryption_key: encryptionKey,
    });
    if (decErr || !creds) return json({ error: "decrypt failed", details: decErr?.message }, 400);

    let baseUrl = (creds.api_url || "https://wshero01.herobase.com/api").trim();
    if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;
    if (!baseUrl.endsWith("/api")) baseUrl = baseUrl.replace(/\/$/, "") + "/api";

    let authHeader: string;
    if (creds.username && creds.password) {
      authHeader = "Basic " + btoa(`${creds.username}:${creds.password}`);
    } else if (creds.api_token) {
      authHeader = creds.api_token.includes(":")
        ? "Basic " + btoa(creds.api_token)
        : "Bearer " + creds.api_token;
    } else {
      return json({ error: "no credentials" }, 400);
    }

    const headers = { Authorization: authHeader, Accept: "application/json" };

    // 1. Fetch /users
    const usersRes = await fetch(`${baseUrl}/users?Limit=2000`, { headers });
    const usersJson = await usersRes.json().catch(() => []);
    const usersArr: any[] = Array.isArray(usersJson) ? usersJson : (usersJson.Results || usersJson.results || []);
    const orgCodeMap = new Map<string, { email: string; name: string }>();
    let cphMappings = 0;
    for (const u of usersArr) {
      const orgCode = u.orgCode || "";
      const email = u.email || "";
      const name = u.name || u.username || "";
      if (orgCode && email) {
        orgCodeMap.set(orgCode, { email, name });
        if (email.toLowerCase().endsWith("@copenhagensales.dk")) cphMappings++;
      }
    }

    // 2. Fetch /simpleleads for the window
    const ep = `${baseUrl}/simpleleads?Projects=*&ModifiedFrom=${fromDate}&ModifiedTo=${toDate}&AllClosedStatuses=true&take=2000`;
    const leadsRes = await fetch(ep, { headers });
    const leadsJson = await leadsRes.json().catch(() => []);
    const leadsArr: any[] = Array.isArray(leadsJson)
      ? leadsJson
      : (leadsJson.Results || leadsJson.results || leadsJson.Leads || []);

    const enrich = (orgCode?: string, fallback?: string) => {
      if (fallback && fallback.includes("@")) return fallback;
      if (orgCode && orgCodeMap.has(orgCode)) return orgCodeMap.get(orgCode)!.email;
      return orgCode || "";
    };
    const passesWhitelist = (email: string) =>
      !!email && ALLOWED_DOMAINS.some(d => email.toLowerCase().endsWith(d));

    let totalLeads = leadsArr.length;
    let successLeads = 0;
    let resolvedToCph = 0;
    const samples: any[] = [];
    const orgCodeFreq = new Map<string, number>();

    for (const lead of leadsArr) {
      const closure = (lead.closure || lead.Closure || "").toLowerCase();
      if (closure !== "success") continue;
      successLeads++;

      const fpu = lead.firstProcessedByUser || lead.FirstProcessedByUser;
      const lmu = lead.lastModifiedByUser || lead.LastModifiedByUser;
      const fOrg = fpu?.orgCode;
      const lOrg = lmu?.orgCode;
      const fResolved = enrich(fOrg, fpu?.email);
      const lResolved = enrich(lOrg, lmu?.email);

      let chosen = "";
      let chosenSrc = "none";
      if (passesWhitelist(fResolved)) { chosen = fResolved; chosenSrc = "first"; }
      else if (passesWhitelist(lResolved)) { chosen = lResolved; chosenSrc = "last"; }
      else { chosen = fResolved || lResolved; chosenSrc = "fallback-no-whitelist"; }

      const passes = passesWhitelist(chosen);
      if (passes) resolvedToCph++;

      // Track orgCode frequencies for un-resolved success leads
      if (!passes) {
        if (fOrg) orgCodeFreq.set(fOrg, (orgCodeFreq.get(fOrg) || 0) + 1);
        if (lOrg) orgCodeFreq.set(lOrg, (orgCodeFreq.get(lOrg) || 0) + 1);
      }

      if (samples.length < 10) {
        samples.push({
          uniqueId: lead.uniqueId || lead.UniqueId,
          campaignId: lead.campaignId,
          firstProcessedByUser: { orgCode: fOrg, email: fpu?.email, mappedTo: orgCodeMap.get(fOrg || "")?.email || null },
          lastModifiedByUser: { orgCode: lOrg, email: lmu?.email, mappedTo: orgCodeMap.get(lOrg || "")?.email || null },
          chosenAgentEmail: chosen,
          chosenFrom: chosenSrc,
          passesWhitelist: passes,
        });
      }
    }

    const topUnresolvedOrgCodes = Array.from(orgCodeFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([orgCode, count]) => ({
        orgCode,
        count,
        inUserMap: orgCodeMap.has(orgCode),
        mappedEmail: orgCodeMap.get(orgCode)?.email || null,
      }));

    return json({
      window: { from: fromDate, to: toDate },
      users: { total: usersArr.length, withOrgCodeAndEmail: orgCodeMap.size, cphDomainMappings: cphMappings },
      leads: { total: totalLeads, success: successLeads, resolvedToCphWhitelist: resolvedToCph },
      sampleSuccessLeads: samples,
      topUnresolvedOrgCodes,
    }, 200);
  } catch (e) {
    return json({ error: String(e), stack: (e as Error).stack }, 500);
  }
});

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0];
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
