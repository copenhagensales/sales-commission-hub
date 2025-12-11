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

    const body = await req.json();
    const { import_id, client_id } = body;

    console.log("=== VALIDATE EXCEL IMPORT START ===");
    console.log("Request body:", JSON.stringify(body));
    console.log("import_id:", import_id);
    console.log("client_id:", client_id);

    if (!import_id || !client_id) {
      console.log("ERROR: Missing import_id or client_id");
      return new Response(
        JSON.stringify({ error: "Missing import_id or client_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    const { error: updateError } = await supabase
      .from("crm_excel_imports")
      .update({ validation_status: "processing" })
      .eq("id", import_id);
    
    console.log("Mark as processing result:", updateError ? `Error: ${updateError.message}` : "OK");

    // Get import rows with extended fields
    const { data: rows, error: rowsError } = await supabase
      .from("crm_excel_import_rows")
      .select("*")
      .eq("import_id", import_id);

    if (rowsError) {
      console.log("ERROR fetching rows:", rowsError.message);
      throw rowsError;
    }

    const importRows = (rows || []) as ImportRow[];
    console.log(`Found ${importRows.length} rows to validate`);
    
    // Log first 5 rows for debugging
    console.log("Sample rows (first 5):");
    importRows.slice(0, 5).forEach((row, idx) => {
      console.log(`  Row ${idx + 1}:`, JSON.stringify({
        id: row.id,
        ordre_id: row.ordre_id,
        opp_number: row.opp_number,
        external_id: row.external_id,
        phone_number: row.phone_number,
        date: row.date,
        action_type: row.action_type,
        amount_deduct: row.amount_deduct,
      }));
    });

    // Get campaign IDs for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from("client_campaigns")
      .select("id, name")
      .eq("client_id", client_id);

    if (campaignsError) {
      console.log("ERROR fetching campaigns:", campaignsError.message);
      throw campaignsError;
    }

    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
    console.log(`Found ${campaignIds.length} campaigns for client`);
    console.log("Campaign IDs:", JSON.stringify(campaignIds));
    console.log("Campaigns:", JSON.stringify(campaigns));

    // Get sales for this client's campaigns (last 180 days for phone matching)
    let salesData: Sale[] = [];
    if (campaignIds.length > 0) {
      const dateFilter = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`Fetching sales from: ${dateFilter}`);
      
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, adversus_external_id, adversus_opp_number, customer_phone, sale_datetime, agent_name")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", dateFilter);

      if (salesError) {
        console.log("ERROR fetching sales:", salesError.message);
        throw salesError;
      }
      salesData = (sales || []) as Sale[];
    }
    console.log(`Found ${salesData.length} sales to match against`);
    
    // Log sample sales
    console.log("Sample sales (first 5):");
    salesData.slice(0, 5).forEach((sale, idx) => {
      console.log(`  Sale ${idx + 1}:`, JSON.stringify({
        id: sale.id,
        adversus_external_id: sale.adversus_external_id,
        adversus_opp_number: sale.adversus_opp_number,
        customer_phone: sale.customer_phone,
        sale_datetime: sale.sale_datetime,
      }));
    });

    // Create lookup maps
    const salesByExternalId = new Map<string, Sale>();
    const salesByOpp = new Map<string, Sale>();
    const salesByPhone = new Map<string, Sale[]>();

    for (const sale of salesData) {
      if (sale.adversus_external_id) {
        const key = sale.adversus_external_id.trim().toLowerCase();
        salesByExternalId.set(key, sale);
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

    console.log("Lookup maps created:");
    console.log(`  - salesByExternalId: ${salesByExternalId.size} entries`);
    console.log(`  - salesByOpp: ${salesByOpp.size} entries`);
    console.log(`  - salesByPhone: ${salesByPhone.size} entries`);

    let matchedCount = 0;
    let cancelledCount = 0;
    let clawbacksCreated = 0;
    const unmatchedRows: string[] = [];

    // Process each row
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      let matchedSale: Sale | null = null;
      let matchMethod = "";

      console.log(`\n--- Processing row ${i + 1}/${importRows.length} (id: ${row.id}) ---`);
      console.log(`  ordre_id: "${row.ordre_id}"`);
      console.log(`  opp_number: "${row.opp_number}"`);
      console.log(`  external_id: "${row.external_id}"`);
      console.log(`  phone_number: "${row.phone_number}"`);
      console.log(`  date: "${row.date}"`);
      console.log(`  action_type: "${row.action_type}"`);
      console.log(`  amount_deduct: "${row.amount_deduct}"`);

      // Attempt 1: Match by External ID
      if (!matchedSale && row.external_id) {
        const normalizedId = row.external_id.trim().toLowerCase();
        console.log(`  Attempt 1 - external_id lookup: "${normalizedId}"`);
        matchedSale = salesByExternalId.get(normalizedId) || null;
        if (matchedSale) {
          matchMethod = "external_id";
          console.log(`  ✓ MATCHED via external_id: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for external_id`);
        }
      }

      // Attempt 2: Match by ordre_id (also external ID)
      if (!matchedSale && row.ordre_id) {
        const normalizedId = row.ordre_id.trim().toLowerCase();
        console.log(`  Attempt 2 - ordre_id lookup: "${normalizedId}"`);
        matchedSale = salesByExternalId.get(normalizedId) || null;
        if (matchedSale) {
          matchMethod = "ordre_id";
          console.log(`  ✓ MATCHED via ordre_id: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for ordre_id`);
        }
      }

      // Attempt 3: Match by OPP number
      if (!matchedSale && row.opp_number) {
        const normalizedOpp = row.opp_number.trim().toLowerCase().replace(/^opp-?/i, "");
        console.log(`  Attempt 3 - opp_number lookup: "${normalizedOpp}"`);
        matchedSale = salesByOpp.get(normalizedOpp) || null;
        if (matchedSale) {
          matchMethod = "opp_number";
          console.log(`  ✓ MATCHED via opp_number: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for opp_number`);
        }
      }

      // Attempt 4: Match by Phone + Date (fuzzy)
      if (!matchedSale && row.phone_number) {
        const normalizedPhone = normalizePhone(row.phone_number);
        console.log(`  Attempt 4 - phone lookup: "${normalizedPhone}" (original: "${row.phone_number}")`);
        
        if (normalizedPhone.length >= 8) {
          const candidates = salesByPhone.get(normalizedPhone) || [];
          console.log(`  Found ${candidates.length} candidates with matching phone`);
          
          if (candidates.length === 1) {
            matchedSale = candidates[0];
            matchMethod = "phone_single";
            console.log(`  ✓ MATCHED via phone (single match): sale ${matchedSale.id}`);
          } else if (candidates.length > 1 && row.date) {
            // Multiple candidates - use date to disambiguate
            const rowDate = parseDate(row.date);
            console.log(`  Multiple candidates, using date to disambiguate. Row date: ${rowDate?.toISOString() || 'null'}`);
            
            if (rowDate) {
              let bestMatch: Sale | null = null;
              let bestDiff = Infinity;
              
              for (const candidate of candidates) {
                if (candidate.sale_datetime) {
                  const saleDate = new Date(candidate.sale_datetime);
                  const diff = Math.abs(saleDate.getTime() - rowDate.getTime());
                  const daysDiff = diff / (1000 * 60 * 60 * 24);
                  console.log(`    Candidate ${candidate.id}: sale_date=${saleDate.toISOString()}, daysDiff=${daysDiff.toFixed(2)}`);
                  
                  if (daysDiff <= 5 && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = candidate;
                  }
                }
              }
              
              if (bestMatch) {
                matchedSale = bestMatch;
                matchMethod = "phone_date";
                console.log(`  ✓ MATCHED via phone+date: sale ${matchedSale.id}`);
              } else {
                console.log(`  ✗ No match within 5 days date range`);
              }
            } else {
              console.log(`  ✗ Could not parse date for disambiguation`);
            }
          } else if (candidates.length > 1) {
            console.log(`  ✗ Multiple candidates but no date for disambiguation`);
          }
        } else {
          console.log(`  ✗ Phone too short: ${normalizedPhone.length} chars (need 8+)`);
        }
      }

      if (!matchedSale) {
        console.log(`  ✗ NO MATCH FOUND for row ${row.id}`);
        unmatchedRows.push(row.id);
      }

      // Update row with match result
      const { error: rowUpdateError } = await supabase
        .from("crm_excel_import_rows")
        .update({
          matched_sale_id: matchedSale?.id || null,
          is_matched: !!matchedSale,
        })
        .eq("id", row.id);
      
      if (rowUpdateError) {
        console.log(`  ERROR updating row: ${rowUpdateError.message}`);
      }

      if (matchedSale) {
        matchedCount++;

        // Check if this is a cancellation
        const isCancellationAction = isCancellation(row.action_type);
        console.log(`  Is cancellation? ${isCancellationAction} (action_type: "${row.action_type}")`);
        
        if (isCancellationAction) {
          cancelledCount++;

          // Update sale status
          const { error: saleUpdateError } = await supabase
            .from("sales")
            .update({ validation_status: "cancelled" })
            .eq("id", matchedSale.id);
          
          console.log(`  Updated sale validation_status to "cancelled": ${saleUpdateError ? `Error: ${saleUpdateError.message}` : "OK"}`);

          // Calculate clawback amount
          let clawbackAmount = 0;

          if (row.amount_deduct) {
            // Use provided amount (make it negative if positive)
            const cleanedAmount = row.amount_deduct.replace(/[^\d.-]/g, "");
            const amount = parseFloat(cleanedAmount);
            console.log(`  amount_deduct provided: "${row.amount_deduct}" -> cleaned: "${cleanedAmount}" -> parsed: ${amount}`);
            if (!isNaN(amount)) {
              clawbackAmount = Math.abs(amount) * -1;
              console.log(`  Clawback from amount_deduct: ${clawbackAmount}`);
            }
          }

          if (clawbackAmount === 0) {
            // Calculate from sale items
            console.log(`  Calculating clawback from sale_items...`);
            const { data: saleItems, error: itemsError } = await supabase
              .from("sale_items")
              .select("commission_dkk, quantity")
              .eq("sale_id", matchedSale.id);

            if (itemsError) {
              console.log(`  ERROR fetching sale_items: ${itemsError.message}`);
            } else if (saleItems && saleItems.length > 0) {
              const items = saleItems as SaleItem[];
              console.log(`  Found ${items.length} sale_items`);
              for (const item of items) {
                const commission = item.commission_dkk || 0;
                const qty = item.quantity || 1;
                const itemClawback = commission * qty;
                console.log(`    Item: commission=${commission}, qty=${qty}, total=${itemClawback}`);
                clawbackAmount -= itemClawback;
              }
              console.log(`  Total clawback from items: ${clawbackAmount}`);
            } else {
              console.log(`  No sale_items found for sale ${matchedSale.id}`);
            }
          }

          // Create clawback transaction if we have an amount
          if (clawbackAmount !== 0) {
            console.log(`  Creating clawback transaction: amount=${clawbackAmount}, agent=${matchedSale.agent_name}`);
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
              console.log(`  ✓ Clawback created successfully`);
            } else {
              console.log(`  ✗ Failed to create clawback: ${clawbackError.message}`);
            }
          } else {
            console.log(`  No clawback created (amount is 0)`);
          }
        }
      }
    }

    // Update import with results
    const { error: finalUpdateError } = await supabase
      .from("crm_excel_imports")
      .update({
        validation_status: "completed",
        matched_count: matchedCount,
        cancelled_count: cancelledCount,
        validated_at: new Date().toISOString(),
      })
      .eq("id", import_id);

    console.log("\n=== VALIDATION SUMMARY ===");
    console.log(`Total rows: ${importRows.length}`);
    console.log(`Matched: ${matchedCount}`);
    console.log(`Cancelled: ${cancelledCount}`);
    console.log(`Clawbacks created: ${clawbacksCreated}`);
    console.log(`Unmatched rows: ${unmatchedRows.length}`);
    if (unmatchedRows.length > 0 && unmatchedRows.length <= 20) {
      console.log(`Unmatched row IDs: ${JSON.stringify(unmatchedRows)}`);
    }
    console.log(`Final update result: ${finalUpdateError ? `Error: ${finalUpdateError.message}` : "OK"}`);
    console.log("=== VALIDATE EXCEL IMPORT END ===");

    return new Response(
      JSON.stringify({
        success: true,
        matched: matchedCount,
        cancelled: cancelledCount,
        clawbacks_created: clawbacksCreated,
        total_rows: importRows.length,
        unmatched_count: unmatchedRows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("=== VALIDATE EXCEL IMPORT ERROR ===");
    console.error("Error:", message);
    console.error("Stack:", error instanceof Error ? error.stack : "N/A");
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
