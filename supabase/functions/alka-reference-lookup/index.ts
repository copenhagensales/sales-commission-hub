/**
 * Alka Reference Lookup
 *
 * Søger efter specifikke permission/police-numre i Alka /simpleleads payloads
 * over et bredt tidsvindue og returnerer den fulde rå payload + alle felter
 * vi ville kunne udtrække ved import.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALKA_INTEGRATION_ID = "48d8bd23-df14-41fe-b000-abb8a4d6cd1d";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const refs: string[] = (body.references || [
      "22799970", "23301572", "28558184", "42327696"
    ]).map((r: string) => String(r).trim());
    const days: number = body.days || 60;

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

    // Fetch users for orgCode→email mapping
    const usersRes = await fetch(`${baseUrl}/users?Limit=2000`, { headers });
    const usersJson = await usersRes.json().catch(() => []);
    const usersArr: any[] = Array.isArray(usersJson) ? usersJson : (usersJson.Results || usersJson.results || []);
    const orgCodeMap = new Map<string, { email: string; name: string }>();
    for (const u of usersArr) {
      if (u.orgCode && u.email) orgCodeMap.set(u.orgCode, { email: u.email, name: u.name || u.username || "" });
    }

    // Normalise refs (strip +45 / 45 prefix, spaces, dashes)
    const normalize = (s: string) => String(s || "").replace(/[^0-9]/g, "").replace(/^45(?=\d{8}$)/, "");
    const refNorms = refs.map(r => ({ raw: r, norm: normalize(r) }));

    // Walk windows of 3 days back to `days` ago, fetch all leads, scan
    const matches: any[] = [];
    const windows: { from: string; to: string }[] = [];
    for (let offset = 0; offset < days; offset += 3) {
      windows.push({ from: isoDaysAgo(offset + 3), to: isoDaysAgo(offset) });
    }

    let totalScanned = 0;
    let firstSampleLead: any = null;
    for (const w of windows) {
      const ep = `${baseUrl}/simpleleads?Projects=*&ModifiedFrom=${w.from}&ModifiedTo=${w.to}&AllClosedStatuses=true&take=2000`;
      const r = await fetch(ep, { headers });
      const j = await r.json().catch(() => []);
      const arr: any[] = Array.isArray(j) ? j : (j.Results || j.results || j.Leads || []);
      totalScanned += arr.length;
      if (!firstSampleLead && arr.length > 0) firstSampleLead = arr[0];

      for (const lead of arr) {
        // Build a normalised digit-blob from all string values in the lead
        const digitBlob = JSON.stringify(lead).replace(/[^0-9]/g, "");
        let matched = "";
        for (const { raw, norm } of refNorms) {
          if (!norm) continue;
          if (digitBlob.includes(norm)) { matched = raw; break; }
        }
        if (!matched) continue;

        const fpu = lead.firstProcessedByUser || lead.FirstProcessedByUser;
        const lmu = lead.lastModifiedByUser || lead.LastModifiedByUser;
        const fOrg = fpu?.orgCode;
        const lOrg = lmu?.orgCode;
        const fEmailResolved = (fpu?.email && fpu.email.includes("@")) ? fpu.email : (orgCodeMap.get(fOrg || "")?.email || null);
        const lEmailResolved = (lmu?.email && lmu.email.includes("@")) ? lmu.email : (orgCodeMap.get(lOrg || "")?.email || null);

        matches.push({
          matchedReference: matched,
          window: w,
          extracted: {
            uniqueId: lead.uniqueId || lead.UniqueId,
            campaignId: lead.campaignId,
            campaignName: lead.campaignName,
            closure: lead.closure || lead.Closure,
            createdTime: lead.createdTime,
            lastModifiedTime: lead.lastModifiedTime,
            customerName: lead.masterData?.name || lead.contact?.name,
            phone: lead.masterData?.phone || lead.contact?.phone,
            email: lead.masterData?.email || lead.contact?.email,
            address: lead.masterData?.address,
            zipCode: lead.masterData?.zipCode,
            city: lead.masterData?.city,
            firstProcessedByUser: { orgCode: fOrg, email: fpu?.email, resolvedEmail: fEmailResolved },
            lastModifiedByUser: { orgCode: lOrg, email: lmu?.email, resolvedEmail: lEmailResolved },
            externalRef: lead.externalRef,
            note: lead.note,
            products: lead.products || lead.Products,
            answersCount: Array.isArray(lead.answers) ? lead.answers.length : 0,
            answersSample: Array.isArray(lead.answers) ? lead.answers.slice(0, 30) : null,
          },
          fullPayloadKeys: Object.keys(lead),
          fullPayload: lead,
        });
      }
    }

    return json({
      searched: refs,
      windowDays: days,
      totalLeadsScanned: totalScanned,
      windowsScanned: windows.length,
      matchesFound: matches.length,
      matches,
    });
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
