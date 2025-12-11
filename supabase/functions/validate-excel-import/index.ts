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
  customer_name: string | null;
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

// Normalize any ID for comparison (case-insensitive, trimmed)
function normalizeId(id: string | null): string {
  if (!id) return "";
  return id.trim().toLowerCase();
}

// Normalize OPP number (remove common prefixes)
function normalizeOpp(opp: string | null): string {
  if (!opp) return "";
  return opp.trim().toLowerCase().replace(/^(opp-?|ord-?|order-?)/i, "");
}

// Parse date from various formats
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  
  // Try various formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // ISO: YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
    /^(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
  ];
  
  for (const fmt of formats) {
    const match = dateStr.match(fmt);
    if (match) {
      if (fmt === formats[0] || fmt === formats[4]) {
        // ISO or YYYY/MM/DD
        return new Date(dateStr);
      } else {
        // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
        return new Date(`${match[3]}-${match[2]}-${match[1]}`);
      }
    }
  }
  
  // Try native parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Extended list of cancellation keywords (multi-language support)
const CANCELLATION_KEYWORDS = [
  // Danish
  "annuller", "annulleret", "annullering", "opsagt", "opsigelse", "retur", "rettelse", "nedlagt", "aflyst", "afvist",
  // English
  "cancel", "cancelled", "canceled", "cancellation", "refund", "refunded", "returned", "voided", "void", "rejected",
  // German
  "storniert", "stornierung", "abgebrochen",
  // Spanish
  "cancelado", "cancelación", "anulado",
  // Generic status words
  "churn", "churned", "lost", "failed", "declined", "reversed"
];

// Check if action indicates cancellation - more flexible
function isCancellation(actionType: string | null, status: string | null): boolean {
  // If no action type provided, check status
  const textToCheck = [actionType, status].filter(Boolean).join(" ").toLowerCase();
  
  // If nothing to check, default to cancellation (assume import is for cancellations)
  if (!textToCheck) return true;
  
  return CANCELLATION_KEYWORDS.some(keyword => textToCheck.includes(keyword));
}

// Extract numeric amount from various formats
function extractAmount(amountStr: string | null): number {
  if (!amountStr) return 0;
  
  // Handle different number formats: 1.234,56 (EU) or 1,234.56 (US) or plain
  let cleaned = amountStr.toString();
  
  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[^\d.,\-]/g, "");
  
  // Detect format and normalize
  const hasCommaDecimal = /,\d{2}$/.test(cleaned); // EU format: 1.234,56
  const hasDotDecimal = /\.\d{2}$/.test(cleaned);   // US format: 1,234.56
  
  if (hasCommaDecimal) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasDotDecimal) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Ambiguous - try to parse as-is
    cleaned = cleaned.replace(/,/g, "");
  }
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
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
        raw_custom_fields: row.raw_data ? {
          _custom_match_1: row.raw_data._custom_match_1,
          _custom_match_2: row.raw_data._custom_match_2,
        } : null,
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

    // Get sales for this client's campaigns (last 365 days for broader matching)
    let salesData: Sale[] = [];
    if (campaignIds.length > 0) {
      const dateFilter = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
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

    // Create flexible lookup maps
    const salesByExternalId = new Map<string, Sale>();
    const salesByOpp = new Map<string, Sale>();
    const salesByPhone = new Map<string, Sale[]>();

    for (const sale of salesData) {
      // External ID lookup
      if (sale.adversus_external_id) {
        const key = normalizeId(sale.adversus_external_id);
        salesByExternalId.set(key, sale);
      }
      
      // OPP number lookup
      if (sale.adversus_opp_number) {
        const normalizedOpp = normalizeOpp(sale.adversus_opp_number);
        salesByOpp.set(normalizedOpp, sale);
      }
      
      // Phone lookup
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

      // Get custom match fields from raw_data
      const customMatch1 = row.raw_data?._custom_match_1 as string | null;
      const customMatch2 = row.raw_data?._custom_match_2 as string | null;
      console.log(`  custom_match_1: "${customMatch1}"`);
      console.log(`  custom_match_2: "${customMatch2}"`);

      // === MATCHING STRATEGY (Priority Order) ===

      // Attempt 1: Match by External ID
      if (!matchedSale && row.external_id) {
        const normalizedId = normalizeId(row.external_id);
        console.log(`  Attempt 1 - external_id lookup: "${normalizedId}"`);
        matchedSale = salesByExternalId.get(normalizedId) || null;
        if (matchedSale) {
          matchMethod = "external_id";
          console.log(`  ✓ MATCHED via external_id: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for external_id`);
        }
      }

      // Attempt 2: Match by ordre_id (also check in external ID map)
      if (!matchedSale && row.ordre_id) {
        const normalizedId = normalizeId(row.ordre_id);
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
        const normalizedOpp = normalizeOpp(row.opp_number);
        console.log(`  Attempt 3 - opp_number lookup: "${normalizedOpp}"`);
        matchedSale = salesByOpp.get(normalizedOpp) || null;
        if (matchedSale) {
          matchMethod = "opp_number";
          console.log(`  ✓ MATCHED via opp_number: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for opp_number`);
        }
      }

      // Attempt 4: Match by Custom Field 1 (try as external ID and OPP)
      if (!matchedSale && customMatch1) {
        const normalizedCustom = normalizeId(customMatch1);
        const normalizedAsOpp = normalizeOpp(customMatch1);
        console.log(`  Attempt 4 - custom_match_1 lookup: "${normalizedCustom}" / "${normalizedAsOpp}"`);
        
        matchedSale = salesByExternalId.get(normalizedCustom) || salesByOpp.get(normalizedAsOpp) || null;
        if (matchedSale) {
          matchMethod = "custom_field_1";
          console.log(`  ✓ MATCHED via custom_field_1: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for custom_match_1`);
        }
      }

      // Attempt 5: Match by Custom Field 2
      if (!matchedSale && customMatch2) {
        const normalizedCustom = normalizeId(customMatch2);
        const normalizedAsOpp = normalizeOpp(customMatch2);
        console.log(`  Attempt 5 - custom_match_2 lookup: "${normalizedCustom}" / "${normalizedAsOpp}"`);
        
        matchedSale = salesByExternalId.get(normalizedCustom) || salesByOpp.get(normalizedAsOpp) || null;
        if (matchedSale) {
          matchMethod = "custom_field_2";
          console.log(`  ✓ MATCHED via custom_field_2: sale ${matchedSale.id}`);
        } else {
          console.log(`  ✗ No match for custom_match_2`);
        }
      }

      // Attempt 6: Match by Phone + Date (fuzzy)
      if (!matchedSale && row.phone_number) {
        const normalizedPhone = normalizePhone(row.phone_number);
        console.log(`  Attempt 6 - phone lookup: "${normalizedPhone}" (original: "${row.phone_number}")`);
        
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
                  
                  // Increased tolerance to 30 days for flexibility
                  if (daysDiff <= 30 && diff < bestDiff) {
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
                console.log(`  ✗ No match within 30 days date range`);
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

      // Note: Customer name matching removed - sales table doesn't have customer_name column

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

        // Check if this is a cancellation using flexible detection
        const isCancellationAction = isCancellation(row.action_type, row.status);
        console.log(`  Is cancellation? ${isCancellationAction} (action_type: "${row.action_type}", status: "${row.status}")`);
        
        if (isCancellationAction) {
          cancelledCount++;

          // Update sale status
          const { error: saleUpdateError } = await supabase
            .from("sales")
            .update({ validation_status: "cancelled" })
            .eq("id", matchedSale.id);
          
          console.log(`  Updated sale validation_status to "cancelled": ${saleUpdateError ? `Error: ${saleUpdateError.message}` : "OK"}`);

          // Calculate clawback amount using flexible extraction
          let clawbackAmount = 0;

          if (row.amount_deduct) {
            const amount = extractAmount(row.amount_deduct);
            console.log(`  amount_deduct provided: "${row.amount_deduct}" -> extracted: ${amount}`);
            if (amount !== 0) {
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
                reason: `Cancellation via Excel import (${matchMethod})`,
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
    console.error("=== VALIDATION ERROR ===");
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
