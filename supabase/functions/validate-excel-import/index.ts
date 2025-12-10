import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRow {
  id: string;
  ordre_id: string | null;
  opp_number: string | null;
  external_id: string | null;
  phone_number: string | null;
  date: string | null;
  status: string | null;
  action_type: string | null;
  amount_deduct: string | null;
  raw_data: Record<string, unknown> | null;
}

interface Sale {
  id: string;
  adversus_external_id: string | null;
  adversus_opp_number: string | null;
  customer_phone: string | null;
  sale_datetime: string | null;
  agent_name: string | null;
}

interface SaleItem {
  commission_dkk: number | null;
  quantity: number | null;
}

// Normalize phone numbers for comparison
function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/[\s\-\+\(\)]/g, "").replace(/^(45|0045)/, "");
}

// Parse date from various formats
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  
  // Try various formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // ISO
    /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];
  
  for (const fmt of formats) {
    const match = dateStr.match(fmt);
    if (match) {
      if (fmt === formats[0]) {
        return new Date(dateStr);
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        return new Date(`${match[3]}-${match[2]}-${match[1]}`);
      }
    }
  }
  
  // Try native parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Check if action indicates cancellation
function isCancellation(actionType: string | null): boolean {
  if (!actionType) return true; // Default: assume cancellation import
  const lower = actionType.toLowerCase();
  return (
    lower.includes("annuller") ||
    lower.includes("cancel") ||
    lower.includes("opsagt") ||
    lower.includes("retur") ||
    lower.includes("rettelse")
  );
}

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

    // Get import rows with extended fields
    const { data: rows, error: rowsError } = await supabase
      .from("crm_excel_import_rows")
      .select("*")
      .eq("import_id", import_id);

    if (rowsError) throw rowsError;

    const importRows = (rows || []) as ImportRow[];
    console.log(`[validate-excel-import] Found ${importRows.length} rows to validate`);

    // Get campaign IDs for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from("client_campaigns")
      .select("id")
      .eq("client_id", client_id);

    if (campaignsError) throw campaignsError;

    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
    console.log(`[validate-excel-import] Found ${campaignIds.length} campaigns for client`);

    // Get sales for this client's campaigns (last 180 days for phone matching)
    let salesData: Sale[] = [];
    if (campaignIds.length > 0) {
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, adversus_external_id, adversus_opp_number, customer_phone, sale_datetime, agent_name")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      if (salesError) throw salesError;
      salesData = (sales || []) as Sale[];
    }
    console.log(`[validate-excel-import] Found ${salesData.length} sales to match against`);

    // Create lookup maps
    const salesByExternalId = new Map<string, Sale>();
    const salesByOpp = new Map<string, Sale>();
    const salesByPhone = new Map<string, Sale[]>();

    for (const sale of salesData) {
      if (sale.adversus_external_id) {
        salesByExternalId.set(sale.adversus_external_id.trim().toLowerCase(), sale);
      }
      if (sale.adversus_opp_number) {
        const normalizedOpp = sale.adversus_opp_number.trim().toLowerCase().replace(/^opp-?/i, "");
        salesByOpp.set(normalizedOpp, sale);
      }
      if (sale.customer_phone) {
        const normalizedPhone = normalizePhone(sale.customer_phone);
        if (normalizedPhone.length >= 8) {
          const existing = salesByPhone.get(normalizedPhone) || [];
          existing.push(sale);
          salesByPhone.set(normalizedPhone, existing);
        }
      }
    }

    let matchedCount = 0;
    let cancelledCount = 0;
    let clawbacksCreated = 0;

    // Process each row
    for (const row of importRows) {
      let matchedSale: Sale | null = null;
      let matchMethod = "";

      // Attempt 1: Match by External ID
      if (!matchedSale && row.external_id) {
        const normalizedId = row.external_id.trim().toLowerCase();
        matchedSale = salesByExternalId.get(normalizedId) || null;
        if (matchedSale) matchMethod = "external_id";
      }

      // Attempt 2: Match by ordre_id (also external ID)
      if (!matchedSale && row.ordre_id) {
        const normalizedId = row.ordre_id.trim().toLowerCase();
        matchedSale = salesByExternalId.get(normalizedId) || null;
        if (matchedSale) matchMethod = "ordre_id";
      }

      // Attempt 3: Match by OPP number
      if (!matchedSale && row.opp_number) {
        const normalizedOpp = row.opp_number.trim().toLowerCase().replace(/^opp-?/i, "");
        matchedSale = salesByOpp.get(normalizedOpp) || null;
        if (matchedSale) matchMethod = "opp_number";
      }

      // Attempt 4: Match by Phone + Date (fuzzy)
      if (!matchedSale && row.phone_number) {
        const normalizedPhone = normalizePhone(row.phone_number);
        if (normalizedPhone.length >= 8) {
          const candidates = salesByPhone.get(normalizedPhone) || [];
          
          if (candidates.length === 1) {
            matchedSale = candidates[0];
            matchMethod = "phone_single";
          } else if (candidates.length > 1 && row.date) {
            // Multiple candidates - use date to disambiguate
            const rowDate = parseDate(row.date);
            if (rowDate) {
              let bestMatch: Sale | null = null;
              let bestDiff = Infinity;
              
              for (const candidate of candidates) {
                if (candidate.sale_datetime) {
                  const saleDate = new Date(candidate.sale_datetime);
                  const diff = Math.abs(saleDate.getTime() - rowDate.getTime());
                  const daysDiff = diff / (1000 * 60 * 60 * 24);
                  
                  if (daysDiff <= 5 && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = candidate;
                  }
                }
              }
              
              if (bestMatch) {
                matchedSale = bestMatch;
                matchMethod = "phone_date";
              }
            }
          }
        }
      }

      // Update row with match result
      await supabase
        .from("crm_excel_import_rows")
        .update({
          matched_sale_id: matchedSale?.id || null,
          is_matched: !!matchedSale,
        })
        .eq("id", row.id);

      if (matchedSale) {
        matchedCount++;
        console.log(`[validate-excel-import] Matched sale ${matchedSale.id} via ${matchMethod}`);

        // Check if this is a cancellation
        if (isCancellation(row.action_type)) {
          cancelledCount++;

          // Update sale status
          await supabase
            .from("sales")
            .update({ validation_status: "cancelled" })
            .eq("id", matchedSale.id);

          // Calculate clawback amount
          let clawbackAmount = 0;

          if (row.amount_deduct) {
            // Use provided amount (make it negative if positive)
            const amount = parseFloat(row.amount_deduct.replace(/[^\d.-]/g, ""));
            if (!isNaN(amount)) {
              clawbackAmount = Math.abs(amount) * -1;
            }
          }

          if (clawbackAmount === 0) {
            // Calculate from sale items
            const { data: saleItems } = await supabase
              .from("sale_items")
              .select("commission_dkk, quantity")
              .eq("sale_id", matchedSale.id);

            if (saleItems && saleItems.length > 0) {
              const items = saleItems as SaleItem[];
              for (const item of items) {
                const commission = item.commission_dkk || 0;
                const qty = item.quantity || 1;
                clawbackAmount -= commission * qty;
              }
            }
          }

          // Create clawback transaction if we have an amount
          if (clawbackAmount !== 0) {
            const { error: clawbackError } = await supabase
              .from("commission_transactions")
              .insert({
                sale_id: matchedSale.id,
                agent_name: matchedSale.agent_name || "Unknown",
                amount: clawbackAmount,
                transaction_type: "clawback",
                source: "excel_import",
                source_reference: import_id,
                reason: `Annullering via Excel import (${matchMethod})`,
              });

            if (!clawbackError) {
              clawbacksCreated++;
              console.log(`[validate-excel-import] Created clawback of ${clawbackAmount} for sale ${matchedSale.id}`);
            } else {
              console.error(`[validate-excel-import] Failed to create clawback:`, clawbackError);
            }
          }
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

    console.log(`[validate-excel-import] Completed. Matched: ${matchedCount}, Cancelled: ${cancelledCount}, Clawbacks: ${clawbacksCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        matched: matchedCount,
        cancelled: cancelledCount,
        clawbacks_created: clawbacksCreated,
        total_rows: importRows.length,
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
