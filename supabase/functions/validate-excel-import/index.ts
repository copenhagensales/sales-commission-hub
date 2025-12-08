import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { import_id, client_id } = await req.json();

    if (!import_id || !client_id) {
      return new Response(
        JSON.stringify({ error: "Missing import_id or client_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-excel-import] Starting validation for import: ${import_id}`);

    // Mark as processing
    await supabase
      .from("crm_excel_imports")
      .update({ validation_status: "processing" })
      .eq("id", import_id);

    // Get import rows
    const { data: rows, error: rowsError } = await supabase
      .from("crm_excel_import_rows")
      .select("*")
      .eq("import_id", import_id);

    if (rowsError) throw rowsError;

    console.log(`[validate-excel-import] Found ${rows?.length || 0} rows to validate`);

    // Get sales for this client (last 90 days)
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("id, adversus_external_id, adversus_opp_number")
      .eq("client_campaign_id", client_id)
      .gte("sale_datetime", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (salesError) throw salesError;

    console.log(`[validate-excel-import] Found ${sales?.length || 0} sales to match against`);

    let matchedCount = 0;
    let cancelledCount = 0;

    // Create lookup maps for faster matching
    const salesByExternalId = new Map<string, string>();
    const salesByOpp = new Map<string, string>();

    for (const sale of sales || []) {
      if (sale.adversus_external_id) {
        salesByExternalId.set(sale.adversus_external_id.trim().toLowerCase(), sale.id);
      }
      if (sale.adversus_opp_number) {
        const normalizedOpp = sale.adversus_opp_number.trim().toLowerCase().replace(/^opp-?/i, "");
        salesByOpp.set(normalizedOpp, sale.id);
      }
    }

    // Match each row
    for (const row of rows || []) {
      let matchedSaleId: string | null = null;

      // Try matching by ordre_id
      if (row.ordre_id) {
        const normalizedId = row.ordre_id.trim().toLowerCase();
        matchedSaleId = salesByExternalId.get(normalizedId) || null;
      }

      // Try matching by opp_number
      if (!matchedSaleId && row.opp_number) {
        const normalizedOpp = row.opp_number.trim().toLowerCase().replace(/^opp-?/i, "");
        matchedSaleId = salesByOpp.get(normalizedOpp) || null;
      }

      // Update row with match result
      await supabase
        .from("crm_excel_import_rows")
        .update({
          matched_sale_id: matchedSaleId,
          is_matched: !!matchedSaleId,
        })
        .eq("id", row.id);

      if (matchedSaleId) {
        matchedCount++;
        
        // Check if this is a cancellation (status contains cancel-related terms)
        const statusLower = (row.status || "").toLowerCase();
        const isCancellation = 
          statusLower.includes("annuller") ||
          statusLower.includes("cancel") ||
          statusLower.includes("opsagt") ||
          statusLower.includes("rettelse");

        if (isCancellation) {
          cancelledCount++;
          console.log(`[validate-excel-import] Sale ${matchedSaleId} marked as cancelled`);
        }
      }
    }

    // Update import with results
    await supabase
      .from("crm_excel_imports")
      .update({
        validation_status: "completed",
        matched_count: matchedCount,
        cancelled_count: cancelledCount,
        validated_at: new Date().toISOString(),
      })
      .eq("id", import_id);

    console.log(`[validate-excel-import] Completed. Matched: ${matchedCount}, Cancelled: ${cancelledCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        matched: matchedCount,
        cancelled: cancelledCount,
        total_rows: rows?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[validate-excel-import] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
