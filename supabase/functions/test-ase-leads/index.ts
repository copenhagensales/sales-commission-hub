import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const integrationId = "a76cf63a-4b02-4d99-b6b5-20a8e4552ba5";
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");

    const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integrationId,
      p_encryption_key: encryptionKey,
    });

    const baseUrl = "https://wshero01.herobase.com/api";
    const username = credentials?.username?.trim();
    const password = credentials?.password?.trim();
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;

    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

    // Step 1: Fetch list with Include=data
    const listUrl = `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${threeDaysAgo}&Include=data,campaign,lastModifiedByUser,firstProcessedByUser`;
    console.log(`[TestASE] List: ${listUrl}`);
    const listResp = await fetch(listUrl, { headers: { Authorization: authHeader, Accept: "application/json" } });
    const listText = await listResp.text();
    const leads = JSON.parse(listText);

    const successLeads = leads.filter((l: any) => l.closure === "Success");
    const firstSuccess = successLeads[0];

    const result: Record<string, unknown> = {
      totalLeads: leads.length,
      successCount: successLeads.length,
      firstSuccessFromList: firstSuccess ? {
        uniqueId: firstSuccess.uniqueId,
        closure: firstSuccess.closure,
        data: firstSuccess.data,
        dataKeys: firstSuccess.data ? Object.keys(firstSuccess.data) : null,
        campaign: firstSuccess.campaign,
      } : null,
    };

    // Step 2: Fetch single lead detail
    if (firstSuccess?.uniqueId) {
      const detailUrl = `${baseUrl}/leads/${firstSuccess.uniqueId}?Include=data,campaign,lastModifiedByUser,firstProcessedByUser`;
      console.log(`[TestASE] Detail: ${detailUrl}`);
      const detailResp = await fetch(detailUrl, { headers: { Authorization: authHeader, Accept: "application/json" } });
      const detailText = await detailResp.text();

      if (detailResp.status === 200) {
        const detail = JSON.parse(detailText);
        result.singleLeadDetail = {
          status: detailResp.status,
          allKeys: Object.keys(detail),
          uniqueId: detail.uniqueId,
          closure: detail.closure,
          dataKeys: detail.data ? Object.keys(detail.data) : null,
          dataFull: detail.data,
          campaign: detail.campaign,
          lastModifiedByUser: detail.lastModifiedByUser,
          firstProcessedByUser: detail.firstProcessedByUser,
        };
      } else {
        result.singleLeadDetail = { status: detailResp.status, body: detailText.slice(0, 500) };
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
