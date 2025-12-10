import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OPP pattern: OPP- followed by 5+ digits
const OPP_PATTERN = /OPP-\d{5,}/gi;

// Find ALL occurrences of OPP pattern in any value, tracking the path
function findOppInValue(value: unknown, path: string, results: Map<string, string[]>): void {
  if (value === null || value === undefined) return;
  
  if (typeof value === 'string') {
    const matches = value.match(OPP_PATTERN);
    if (matches) {
      if (!results.has(path)) {
        results.set(path, []);
      }
      matches.forEach(m => {
        if (!results.get(path)!.includes(m)) {
          results.get(path)!.push(m);
        }
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findOppInValue(item, `${path}[${index}]`, results);
    });
  } else if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      findOppInValue(val, path ? `${path}.${key}` : key, results);
    }
  }
}

// Flatten object to show all paths and values
function flattenObject(obj: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (obj === null || obj === undefined) return result;
  
  if (typeof obj !== 'object') {
    result[prefix] = String(obj);
    return result;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      Object.assign(result, flattenObject(item, `${prefix}[${idx}]`));
    });
  } else {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = String(value);
      }
    }
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const username = Deno.env.get('ADVERSUS_API_USERNAME');
    const password = Deno.env.get('ADVERSUS_API_PASSWORD');
    
    if (!username || !password) {
      throw new Error('Missing Adversus credentials');
    }

    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    const baseUrl = 'https://api.adversus.io';

    const body = await req.json().catch(() => ({}));
    const days = body.days || 7;
    const sampleSize = body.sampleSize || 50;
    const deepLeadScan = body.deepLeadScan !== false; // Default true

    // 1. Fetch recent sales
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }));

    console.log(`[DEEP-DIAG] Analyzing last ${days} days, sample: ${sampleSize}, deepLeadScan: ${deepLeadScan}`);

    const salesUrl = `${baseUrl}/sales?pageSize=${sampleSize}&page=1&filters=${filterStr}`;
    const salesRes = await fetch(salesUrl, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
    });

    if (!salesRes.ok) {
      const errorText = await salesRes.text();
      throw new Error(`Sales API error: ${salesRes.status} - ${errorText}`);
    }

    const salesData = await salesRes.json();
    const sales = salesData.sales || salesData || [];
    console.log(`[DEEP-DIAG] Fetched ${sales.length} sales`);

    // Results structure
    const results = {
      summary: {
        salesFetched: sales.length,
        salesWithOppInData: 0,
        leadsChecked: 0,
        leadsWithOpp: 0,
        oppPercentage: 0,
        uniqueOppPaths: [] as string[],
      },
      oppLocations: [] as { path: string; count: number; samples: string[] }[],
      salesAnalysis: [] as any[],
      leadsAnalysis: [] as any[],
      allFieldsFound: {} as Record<string, number>,
      sampleSaleFlattened: null as Record<string, string> | null,
      sampleLeadFlattened: null as Record<string, string> | null,
    };

    // 2. Deep scan each sale for OPP patterns
    const oppPathCounts = new Map<string, string[]>();
    
    for (const sale of sales) {
      const saleOpp = new Map<string, string[]>();
      findOppInValue(sale, 'sale', saleOpp);
      
      if (saleOpp.size > 0) {
        results.summary.salesWithOppInData++;
        saleOpp.forEach((values, path) => {
          if (!oppPathCounts.has(path)) {
            oppPathCounts.set(path, []);
          }
          values.forEach(v => {
            if (!oppPathCounts.get(path)!.includes(v)) {
              oppPathCounts.get(path)!.push(v);
            }
          });
        });

        results.salesAnalysis.push({
          saleId: sale.id,
          leadId: sale.leadId,
          oppPaths: Array.from(saleOpp.keys()),
          oppValues: Array.from(saleOpp.values()).flat(),
        });
      }

      // Track all field paths
      const flat = flattenObject(sale, 'sale');
      for (const key of Object.keys(flat)) {
        results.allFieldsFound[key] = (results.allFieldsFound[key] || 0) + 1;
      }
    }

    // Flatten first sale for inspection
    if (sales.length > 0) {
      results.sampleSaleFlattened = flattenObject(sales[0], 'sale');
    }

    // 3. Deep scan leads if enabled
    if (deepLeadScan && sales.length > 0) {
      const leadsToCheck = sales.slice(0, Math.min(30, sales.length));
      console.log(`[DEEP-DIAG] Scanning ${leadsToCheck.length} leads...`);

      for (const sale of leadsToCheck) {
        const leadId = sale.leadId || sale.lead?.id;
        const campaignId = sale.campaignId || sale.campaign?.id;
        
        if (!leadId) continue;

        results.summary.leadsChecked++;

        try {
          // Try different lead endpoints
          let leadData = null;
          const leadUrls = [
            `${baseUrl}/leads/${leadId}`,
            campaignId ? `${baseUrl}/campaigns/${campaignId}/leads/${leadId}` : null,
          ].filter(Boolean);

          for (const url of leadUrls) {
            try {
              console.log(`[DEEP-DIAG] Trying: ${url}`);
              const res = await fetch(url!, {
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
              });
              if (res.ok) {
                leadData = await res.json();
                console.log(`[DEEP-DIAG] Success from ${url}`);
                break;
              }
            } catch (e) {
              console.log(`[DEEP-DIAG] Failed ${url}: ${e}`);
            }
          }

          if (!leadData) {
            results.leadsAnalysis.push({ leadId, error: 'Failed to fetch' });
            continue;
          }

          // Get the actual lead object (might be wrapped in leads array)
          const lead = leadData.leads?.[0] || leadData.lead || leadData;

          // Flatten for inspection (only first one)
          if (!results.sampleLeadFlattened) {
            results.sampleLeadFlattened = flattenObject(lead, 'lead');
          }

          // Find OPP patterns
          const leadOpp = new Map<string, string[]>();
          findOppInValue(lead, 'lead', leadOpp);

          // Track all field paths from leads
          const flat = flattenObject(lead, 'lead');
          for (const key of Object.keys(flat)) {
            results.allFieldsFound[key] = (results.allFieldsFound[key] || 0) + 1;
          }

          if (leadOpp.size > 0) {
            results.summary.leadsWithOpp++;
            leadOpp.forEach((values, path) => {
              if (!oppPathCounts.has(path)) {
                oppPathCounts.set(path, []);
              }
              values.forEach(v => {
                if (!oppPathCounts.get(path)!.includes(v)) {
                  oppPathCounts.get(path)!.push(v);
                }
              });
            });

            results.leadsAnalysis.push({
              leadId,
              saleId: sale.id,
              hasOpp: true,
              oppPaths: Array.from(leadOpp.keys()),
              oppValues: Array.from(leadOpp.values()).flat(),
            });
          } else {
            results.leadsAnalysis.push({
              leadId,
              saleId: sale.id,
              hasOpp: false,
              resultDataExists: !!lead.resultData,
              resultDataType: Array.isArray(lead.resultData) ? 'array' : typeof lead.resultData,
              resultDataLength: Array.isArray(lead.resultData) ? lead.resultData.length : null,
            });
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          console.log(`[DEEP-DIAG] Error on lead ${leadId}: ${e}`);
        }
      }
    }

    // 4. Compile OPP location summary
    oppPathCounts.forEach((values, path) => {
      results.oppLocations.push({
        path,
        count: values.length,
        samples: values.slice(0, 5),
      });
    });
    results.oppLocations.sort((a, b) => b.count - a.count);
    results.summary.uniqueOppPaths = results.oppLocations.map(l => l.path);

    // Calculate percentage
    if (results.summary.leadsChecked > 0) {
      results.summary.oppPercentage = Math.round(
        (100 * results.summary.leadsWithOpp) / results.summary.leadsChecked
      );
    }

    // 5. Find fields that might contain OPP (check for any field containing "opp" in name)
    const potentialOppFields: string[] = [];
    for (const key of Object.keys(results.allFieldsFound)) {
      if (key.toLowerCase().includes('opp') || key.includes('80862')) {
        potentialOppFields.push(key);
      }
    }

    console.log(`[DEEP-DIAG] Complete. OPP found in ${results.summary.leadsWithOpp}/${results.summary.leadsChecked} leads`);

    return new Response(JSON.stringify({
      success: true,
      summary: results.summary,
      oppLocations: results.oppLocations,
      potentialOppFields,
      salesWithOpp: results.salesAnalysis.slice(0, 10),
      leadsAnalysis: results.leadsAnalysis.slice(0, 20),
      sampleSaleFlattened: results.sampleSaleFlattened,
      sampleLeadFlattened: results.sampleLeadFlattened,
      totalFieldsDiscovered: Object.keys(results.allFieldsFound).length,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[DEEP-DIAG] Error:', err);
    return new Response(JSON.stringify({ 
      success: false,
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
