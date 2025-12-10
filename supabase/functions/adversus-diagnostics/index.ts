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

    // Fetch raw leads data - bulk endpoint
    const leadsUrl = `${baseUrl}/leads?pageSize=5`;
    console.log(`[Diagnostics] Calling: ${leadsUrl}`);
    
    const leadsRes = await fetch(leadsUrl, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    if (!leadsRes.ok) {
      return new Response(JSON.stringify({ 
        error: `Adversus API error: ${leadsRes.status}`,
        statusText: leadsRes.statusText 
      }), {
        status: leadsRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadsData = await leadsRes.json();
    
    // Return raw structure to see format
    return new Response(JSON.stringify({
      endpoint: "/v1/leads?pageSize=5",
      responseType: typeof leadsData,
      isArray: Array.isArray(leadsData),
      keys: Object.keys(leadsData),
      rawResponse: leadsData,
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
