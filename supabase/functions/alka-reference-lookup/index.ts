/**
 * Alka Reference Lookup / Sample Dump
 *
 * Mode 1 (default): Søger efter referencer i Alka /simpleleads
 * Mode 2 (sampleCampaign): Henter ét enkelt success-salg fra angivet kampagne
 *                          og dumper ALT vi kan trække ud (lead + users + closure data)
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
    const sampleCampaign: string | null = body.sampleCampaign || null;
    const days: number = body.days || 14;

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
    const orgCodeMap = new Map<string, any>();
    for (const u of usersArr) {
      if (u.orgCode) orgCodeMap.set(u.orgCode, u);
    }

    // ---------------- SAMPLE MODE ----------------
    if (sampleCampaign) {
      // Discover all available campaigns first
      let campaignsList: any[] = [];
      try {
        const cRes = await fetch(`${baseUrl}/campaigns?Limit=500`, { headers });
        const cJson = await cRes.json().catch(() => []);
        campaignsList = Array.isArray(cJson) ? cJson : (cJson.Results || cJson.results || []);
      } catch { /* ignore */ }

      const matchedCampaigns = campaignsList.filter((c: any) => {
        const name = String(c.name || c.Name || "").toLowerCase();
        return name.includes(sampleCampaign.toLowerCase());
      });

      // Discover projects too
      let projectsList: any[] = [];
      try {
        const pRes = await fetch(`${baseUrl}/projects?Limit=500`, { headers });
        const pJson = await pRes.json().catch(() => []);
        projectsList = Array.isArray(pJson) ? pJson : (pJson.Results || pJson.results || []);
      } catch { /* ignore */ }

      // Walk windows from today and back, find first success lead in matching campaign
      let sampleLead: any = null;
      let scannedTotal = 0;
      let usedWindow: any = null;
      let usedCampaignFilter: string | null = null;
      const closuresSeen = new Map<string, number>();
      const campaignNamesSeen = new Map<string, number>();
      const campaignIds = matchedCampaigns.map((c: any) => c.id || c.Id).filter(Boolean);
      const matchedCampaignNames = matchedCampaigns.map((c: any) => String(c.name || c.Name || ""));

      for (let offset = 0; offset < days && !sampleLead; offset += 3) {
        const from = isoDaysAgo(offset + 3);
        const to = isoDaysAgo(offset);

        const projectName = projectsList[0]?.name || projectsList[0]?.Name || "Alka - Mødebooking";
        const projectEnc = encodeURIComponent(projectName);
        const campIds = matchedCampaigns.map((c: any) => c.uniqueId || c.id || c.Id).filter(Boolean);

        // Try multiple endpoint strategies
        const eps: { ep: string; tag: string }[] = [
          { ep: `${baseUrl}/simpleleads?Projects=${projectEnc}&ModifiedFrom=${from}&ModifiedTo=${to}&AllClosedStatuses=true&take=2000`, tag: `simpleleads-Project=${projectName}` },
          { ep: `${baseUrl}/leads?Projects=${projectEnc}&ModifiedFrom=${from}&ModifiedTo=${to}&AllClosedStatuses=true&IncludeAnswers=true&take=2000`, tag: `leads-Project=${projectName}` },
        ];
        if (campIds.length > 0) {
          eps.push({ ep: `${baseUrl}/simpleleads?Projects=${projectEnc}&Campaigns=${campIds.join(",")}&ModifiedFrom=${from}&ModifiedTo=${to}&AllClosedStatuses=true&take=500`, tag: `simpleleads-Campaigns=${campIds.join(",")}` });
          eps.push({ ep: `${baseUrl}/leads?Projects=${projectEnc}&Campaigns=${campIds.join(",")}&ModifiedFrom=${from}&ModifiedTo=${to}&AllClosedStatuses=true&IncludeAnswers=true&take=500`, tag: `leads-Campaigns=${campIds.join(",")}` });
        }

        for (const { ep, tag } of eps) {
          if (sampleLead) break;
          const r = await fetch(ep, { headers });
          const j = await r.json().catch(() => []);
          const arr: any[] = Array.isArray(j) ? j : (j.Results || j.results || j.Leads || []);
          scannedTotal += arr.length;

          // Track ALL distinct campaign names we see (try multiple shapes)
          for (const lead of arr) {
            const campObj = lead.campaign;
            let campName = "";
            if (typeof campObj === "string") campName = campObj;
            else if (campObj && typeof campObj === "object") campName = String(campObj.name || campObj.Name || campObj.uniqueId || "");
            if (!campName) campName = String(lead.campaignName || lead.campaignId || "");
            if (campName) campaignNamesSeen.set(campName, (campaignNamesSeen.get(campName) || 0) + 1);
          }

          // First filter to leads in matching permission campaigns
          const campIdSet = new Set(campIds);
          const inCampaign = arr.filter((lead) => {
            const campObj = lead.campaign;
            const campId = typeof campObj === "string" ? campObj : (campObj?.uniqueId || campObj?.id || "");
            const campName = (typeof campObj === "object" ? String(campObj?.name || "") : "").toLowerCase();
            return campIdSet.has(campId) || campName.includes(sampleCampaign.toLowerCase());
          });

          // Track distinct closures seen so we know what "sale" looks like
          for (const lead of inCampaign) {
            const closure = String(lead.closure || lead.Closure || "");
            const status = String(lead.status || lead.Status || "");
            const key = `${status}|${closure}`;
            closuresSeen.set(key, (closuresSeen.get(key) || 0) + 1);
          }

          // Pick first lead that looks like a sale (success or contains 'salg')
          for (const lead of inCampaign) {
            const status = String(lead.status || lead.Status || "").toLowerCase();
            const closure = String(lead.closure || lead.Closure || "").toLowerCase();
            const isSuccess = status === "success" || closure.includes("salg") || closure.includes("success") || closure.includes("sale") || closure.includes("solgt");
            if (!isSuccess) continue;
            sampleLead = lead;
            usedWindow = { from, to };
            usedCampaignFilter = tag;
            break;
          }

          // Fallback: if no "success" found but we DID find leads in matching campaigns, take first one anyway
          if (!sampleLead && inCampaign.length > 0 && offset >= days - 3) {
            sampleLead = inCampaign[0];
            usedWindow = { from, to };
            usedCampaignFilter = `${tag} (fallback-first-in-campaign)`;
          }
        }
      }

      if (!sampleLead) {
        return json({
          mode: "sample",
          requestedCampaign: sampleCampaign,
          matchingCampaignsFound: matchedCampaigns.map((c: any) => ({ id: c.id || c.Id, name: c.name || c.Name, raw: c })),
          totalCampaignsAvailable: campaignsList.length,
          totalProjectsAvailable: projectsList.length,
          projectsList: projectsList.map((p: any) => ({ id: p.id || p.Id, name: p.name || p.Name })),
          scannedLeads: scannedTotal,
          windowDays: days,
          closuresSeenInMatchingCampaigns: Array.from(closuresSeen.entries()).map(([k, v]) => ({ statusAndClosure: k, count: v })),
          allCampaignNamesInScannedLeads: Array.from(campaignNamesSeen.entries()).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count),
          error: "No lead found for that campaign in the given window",
        });
      }

      // Try to fetch the full /leads/{id} endpoint for richer data
      const leadId = sampleLead.uniqueId || sampleLead.UniqueId;
      let fullLead: any = null;
      try {
        const fRes = await fetch(`${baseUrl}/leads/${leadId}`, { headers });
        if (fRes.ok) fullLead = await fRes.json();
      } catch { /* ignore */ }

      // Resolve user emails
      const fpu = sampleLead.firstProcessedByUser || sampleLead.FirstProcessedByUser || {};
      const lmu = sampleLead.lastModifiedByUser || sampleLead.LastModifiedByUser || {};
      const ubu = sampleLead.uploadedByUser || sampleLead.UploadedByUser || {};
      const fpuFull = orgCodeMap.get(fpu.orgCode);
      const lmuFull = orgCodeMap.get(lmu.orgCode);

      return json({
        mode: "sample",
        requestedCampaign: sampleCampaign,
        usedWindow,
        usedCampaignFilter,
        scannedLeads: scannedTotal,
        matchingCampaignsFound: matchedCampaigns.map((c: any) => ({ id: c.id || c.Id, name: c.name || c.Name })),
        leadId,
        extracted: {
          uniqueId: leadId,
          campaign: sampleLead.campaign,
          status: sampleLead.status,
          closure: sampleLead.closure,
          closureData: sampleLead.closureData,
          firstProcessedTime: sampleLead.firstProcessedTime,
          lastModifiedTime: sampleLead.lastModifiedTime,
          uploadTime: sampleLead.uploadTime,
          ownerOrgUnit: sampleLead.ownerOrgUnit,
          firstProcessedByUser: { ...fpu, resolved: fpuFull || null },
          lastModifiedByUser: { ...lmu, resolved: lmuFull || null },
          uploadedByUser: ubu,
          dataFields: sampleLead.data || null,
        },
        rawSimpleLead: sampleLead,
        rawSimpleLeadKeys: Object.keys(sampleLead),
        fullLeadEndpoint: fullLead,
        fullLeadKeys: fullLead ? Object.keys(fullLead) : null,
      });
    }

    return json({ error: "Pass {sampleCampaign: 'permission'} to get a sample dump" });
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
