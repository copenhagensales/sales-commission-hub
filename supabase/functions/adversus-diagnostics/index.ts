const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = Deno.env.get("ADVERSUS_API_USERNAME");
    const pass = Deno.env.get("ADVERSUS_API_PASSWORD");

    if (!user || !pass) {
      return new Response(JSON.stringify({ error: "Credenciales Adversus no configuradas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
    const baseUrl = "https://api.adversus.io/v1";

    // Fetch leads in bulk - max 3000
    const pageSize = 1000;
    const maxPages = 3;
    const allLeads: any[] = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const leadsUrl = `${baseUrl}/leads?pageSize=${pageSize}&page=${page}`;
      console.log(`[Diagnostics] Fetching page ${page}: ${leadsUrl}`);
      
      const leadsRes = await fetch(leadsUrl, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });

      if (!leadsRes.ok) {
        console.error(`[Diagnostics] API error on page ${page}: ${leadsRes.status}`);
        break;
      }

      const data = await leadsRes.json();
      const leads = data.leads || [];
      
      if (leads.length === 0) {
        console.log(`[Diagnostics] No more leads on page ${page}`);
        break;
      }
      
      allLeads.push(...leads);
      console.log(`[Diagnostics] Page ${page}: ${leads.length} leads, total: ${allLeads.length}`);
    }

    // Extract OPP numbers from resultData
    const oppPattern = /OPP-\d{4,6}/;
    const leadsWithOpp: { leadId: number; opp: string; fieldId: number }[] = [];
    
    for (const lead of allLeads) {
      const resultData = lead.resultData || [];
      for (const field of resultData) {
        const value = String(field.value || '');
        const match = value.match(oppPattern);
        if (match) {
          leadsWithOpp.push({
            leadId: lead.id,
            opp: match[0],
            fieldId: field.id,
          });
          break; // Only count once per lead
        }
      }
    }

    // Get unique OPP numbers
    const uniqueOpps = [...new Set(leadsWithOpp.map(l => l.opp))];
    
    // Get field IDs used for OPP
    const fieldIdCounts: Record<number, number> = {};
    for (const l of leadsWithOpp) {
      fieldIdCounts[l.fieldId] = (fieldIdCounts[l.fieldId] || 0) + 1;
    }

    return new Response(JSON.stringify({
      totalLeadsFetched: allLeads.length,
      leadsWithOpp: leadsWithOpp.length,
      uniqueOppNumbers: uniqueOpps.length,
      oppFieldIds: fieldIdCounts,
      sampleOpps: uniqueOpps.slice(0, 20),
      sampleLeadsWithOpp: leadsWithOpp.slice(0, 10),
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Diagnostics] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
