// Read-only diagnostic: fetch raw Adversus /sales for a given integration
// over the last N days WITHOUT any state filter, and return matches against
// optional leadId / phone / campaignId. Also fetches the lead detail per match.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const integrationName: string | undefined = body.integration_name;
    const days: number = Number(body.days ?? 3);
    const leadId: string | undefined = body.lead_id ? String(body.lead_id) : undefined;
    const phone: string | undefined = body.phone ? String(body.phone).replace(/[^0-9]/g, "") : undefined;
    const campaignId: string | undefined = body.campaign_id ? String(body.campaign_id) : undefined;
    const maxPages: number = Number(body.max_pages ?? 20);

    if (!integrationName) {
      return json({ error: "integration_name is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integration, error: intErr } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider")
      .ilike("name", integrationName)
      .single();
    if (intErr || !integration) return json({ error: `Integration not found: ${integrationName}`, details: intErr?.message }, 404);

    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    if (!encryptionKey) return json({ error: "DB_ENCRYPTION_KEY not configured" }, 500);

    const { data: creds, error: credErr } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey,
    });
    if (credErr || !creds) return json({ error: "Could not decrypt credentials", details: credErr?.message }, 500);

    const username = (creds as any).username || (creds as any).ADVERSUS_API_USERNAME;
    const password = (creds as any).password || (creds as any).ADVERSUS_API_PASSWORD;
    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    const baseUrl = "https://api.adversus.io";

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const filterStr = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: startDate.toISOString() } }));

    // Fetch all sales (paginated)
    const allSales: any[] = [];
    const pageSize = 1000;
    let page = 1;
    let hasMore = true;
    const pageStats: { page: number; count: number; status: number }[] = [];

    let debugFirstUrl = "";
    let debugFirstBody = "";
    while (hasMore && page <= maxPages) {
      const url = `${baseUrl}/sales?pageSize=${pageSize}&page=${page}&filters=${filterStr}`;
      if (page === 1) debugFirstUrl = url;
      const res = await fetch(url, { headers: { Authorization: auth, "Content-Type": "application/json" } });
      pageStats.push({ page, count: 0, status: res.status });
      if (!res.ok) {
        const t = await res.text();
        if (page === 1) debugFirstBody = t.slice(0, 500);
        pageStats[pageStats.length - 1].count = -1;
        break;
      }
      const data = await res.json();
      const sales = data.sales || [];
      if (page === 1) debugFirstBody = JSON.stringify(data).slice(0, 500);
      pageStats[pageStats.length - 1].count = sales.length;
      allSales.push(...sales);
      if (sales.length < pageSize) hasMore = false;
      else page++;
      await new Promise((r) => setTimeout(r, 200));
    }


    // Build per-campaign counts (overall + by state)
    const byCampaign: Record<string, { total: number; states: Record<string, number> }> = {};
    for (const s of allSales) {
      const cid = s.campaignId ? String(s.campaignId) : "unknown";
      const st = String(s.state || "").toLowerCase() || "(empty)";
      if (!byCampaign[cid]) byCampaign[cid] = { total: 0, states: {} };
      byCampaign[cid].total++;
      byCampaign[cid].states[st] = (byCampaign[cid].states[st] || 0) + 1;
    }

    // Filter to matches
    const matches: any[] = [];
    for (const s of allSales) {
      const sLeadId = s.leadId ? String(s.leadId) : "";
      const sCampaign = s.campaignId ? String(s.campaignId) : "";
      const sPhoneRaw = (s.lead?.phone || s.lead?.mobile || "").toString().replace(/[^0-9]/g, "");
      const leadMatch = leadId ? sLeadId === leadId : false;
      const phoneMatch = phone ? sPhoneRaw.includes(phone) : false;
      const campaignMatch = campaignId ? sCampaign === campaignId : false;

      if (
        (leadId && leadMatch) ||
        (phone && phoneMatch) ||
        (campaignId && campaignMatch && !leadId && !phone)
      ) {
        matches.push({
          saleId: s.id,
          leadId: sLeadId,
          campaignId: sCampaign,
          state: s.state,
          createdTime: s.createdTime,
          closedTime: s.closedTime,
          ownedBy: s.ownedBy,
          createdBy: s.createdBy,
          leadPhone: s.lead?.phone,
          leadCompany: s.lead?.company,
          leadName: s.lead?.name,
          matchType: [
            leadMatch ? "leadId" : null,
            phoneMatch ? "phone" : null,
            campaignMatch ? "campaign" : null,
          ].filter(Boolean),
        });
      }
    }

    // Try to fetch the lead detail for each match (optional, capped to 5)
    const leadDetails: Record<string, any> = {};
    for (const m of matches.slice(0, 5)) {
      if (!m.leadId) continue;
      try {
        const res = await fetch(`${baseUrl}/v1/leads/${m.leadId}`, { headers: { Authorization: auth } });
        leadDetails[m.leadId] = res.ok ? await res.json() : { error: res.status, body: await res.text() };
      } catch (e) {
        leadDetails[m.leadId] = { error: String(e) };
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return json({
      success: true,
      integration: { id: integration.id, name: integration.name },
      filter: { days, leadId, phone, campaignId },
      totals: { rawSalesFetched: allSales.length, pages: pageStats },
      byCampaign,
      matches,
      leadDetails,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
