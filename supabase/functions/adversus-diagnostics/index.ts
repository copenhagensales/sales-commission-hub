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

    // Fetch raw sales data - just 3 sales to see the structure
    const salesUrl = `${baseUrl}/sales?pageSize=3&page=1`;
    console.log(`[Diagnostics] Calling: ${salesUrl}`);
    
    const salesRes = await fetch(salesUrl, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    if (!salesRes.ok) {
      return new Response(JSON.stringify({ 
        error: `Adversus API error: ${salesRes.status}`,
        statusText: salesRes.statusText 
      }), {
        status: salesRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const salesData = await salesRes.json();
    
    // Return the RAW response - no processing
    return new Response(JSON.stringify({
      endpoint: "/v1/sales?pageSize=3&page=1",
      rawResponseKeys: Object.keys(salesData),
      rawResponse: salesData,
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
