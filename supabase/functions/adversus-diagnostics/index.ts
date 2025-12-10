import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const baseUrl = 'https://api.adversus.io/v1';

    const body = await req.json().catch(() => ({}));
    const days = body.days || 7;
    const sampleSize = body.sampleSize || 50;

    // 1. Fetch recent sales using same format as integration-engine
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }));

    console.log(`[DIAG] Fetching sales from last ${days} days, sample size: ${sampleSize}`);

    const salesUrl = `${baseUrl}/sales?pageSize=${sampleSize}&page=1&filters=${filterStr}`;
    console.log(`[DIAG] Sales URL: ${salesUrl}`);
    
    const salesRes = await fetch(salesUrl, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
    });

    console.log(`[DIAG] Sales response status: ${salesRes.status}`);
    
    if (!salesRes.ok) {
      const errorText = await salesRes.text();
      console.log(`[DIAG] Sales API error body: ${errorText}`);
      throw new Error(`Sales API error: ${salesRes.status} - ${errorText}`);
    }

    const salesData = await salesRes.json();
    const sales = salesData.sales || salesData || [];

    console.log(`[DIAG] Got ${sales.length} sales from API`);

    // 2. Analyze each sale's data structure
    const analysis = {
      totalSales: sales.length,
      withResultData: 0,
      withResultDataArray: 0,
      withLeadId: 0,
      oppFieldStats: {
        found: 0,
        notFound: 0,
        fieldIds: {} as Record<string, number>,
      },
      sampleSales: [] as any[],
      leadDataSamples: [] as any[],
      rawSaleStructure: null as any, // Full structure of first sale
      rawLeadStructure: null as any, // Full structure of first lead
    };

    // Known OPP field IDs to check
    const knownOppFieldIds = ['80862', '80863', '80864'];

    // Show full structure of first sale
    if (sales.length > 0) {
      analysis.rawSaleStructure = {
        keys: Object.keys(sales[0]),
        sample: sales[0],
      };
    }

    for (const sale of sales.slice(0, 10)) {
      const sampleInfo: any = {
        saleId: sale.id,
        hasResultData: !!sale.resultData,
        resultDataType: typeof sale.resultData,
        resultDataLength: Array.isArray(sale.resultData) ? sale.resultData.length : null,
        leadId: sale.lead?.id || sale.leadId || null,
        campaignId: sale.campaign?.id,
        campaignName: sale.campaign?.name,
      };

      if (sale.resultData) {
        analysis.withResultData++;
        if (Array.isArray(sale.resultData)) {
          analysis.withResultDataArray++;
          
          // Check for OPP in resultData
          for (const field of sale.resultData) {
            const fieldId = String(field.id || field.fieldId);
            if (!analysis.oppFieldStats.fieldIds[fieldId]) {
              analysis.oppFieldStats.fieldIds[fieldId] = 0;
            }
            analysis.oppFieldStats.fieldIds[fieldId]++;
            
            if (knownOppFieldIds.includes(fieldId)) {
              sampleInfo.oppFieldId = fieldId;
              sampleInfo.oppValue = field.value;
              analysis.oppFieldStats.found++;
            }
          }

          // Show first 5 fields as sample
          sampleInfo.resultDataSample = sale.resultData.slice(0, 5).map((f: any) => ({
            id: f.id,
            label: f.label,
            value: f.value
          }));
        }
      }

      if (sale.lead?.id || sale.leadId) {
        analysis.withLeadId++;
      }

      analysis.sampleSales.push(sampleInfo);
    }

    // 3. For ALL sales with leadId, fetch lead data and check for OPP
    const leadsToCheck = Math.min(sales.length, 30); // Check up to 30 leads
    console.log(`[DIAG] Fetching lead data for ${leadsToCheck} samples...`);
    
    let oppFoundCount = 0;
    let oppMissingCount = 0;
    let leadFetchErrors = 0;
    
    for (const sale of sales.slice(0, leadsToCheck)) {
      const leadId = sale.leadId || sale.lead?.id;
      if (!leadId) {
        console.log(`[DIAG] Sale ${sale.id} has no leadId`);
        continue;
      }

      try {
        const leadUrl = `${baseUrl}/leads/${leadId}`;
        const leadRes = await fetch(leadUrl, {
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
        });

        console.log(`[DIAG] Lead ${leadId} response status: ${leadRes.status}`);

        if (leadRes.ok) {
          const leadData = await leadRes.json();
          console.log(`[DIAG] Lead ${leadId} response keys: ${Object.keys(leadData).join(', ')}`);
          
          // Store full structure of first lead
          if (!analysis.rawLeadStructure) {
            analysis.rawLeadStructure = {
              keys: Object.keys(leadData),
              hasLeads: !!leadData.leads,
              leadsCount: leadData.leads?.length,
              firstLeadKeys: leadData.leads?.[0] ? Object.keys(leadData.leads[0]) : null,
              sample: leadData,
            };
          }
          
          // Check both root and leads[0]
          const lead = leadData.leads?.[0] || leadData;
          
          const leadSample: any = {
            leadId,
            saleId: sale.id,
            responseKeys: Object.keys(leadData),
            leadObjectKeys: Object.keys(lead),
            hasResultData: !!lead.resultData,
            resultDataType: typeof lead.resultData,
            oppFound: false,
            oppValue: null,
            oppFieldId: null,
          };

          if (lead.resultData) {
            if (Array.isArray(lead.resultData)) {
              leadSample.resultDataLength = lead.resultData.length;
              leadSample.sampleFields = lead.resultData.slice(0, 10).map((f: any) => ({
                id: f.id,
                label: f.label,
                value: f.value
              }));

              // Check for OPP in field 80862 or by label
              for (const field of lead.resultData) {
                const fieldId = String(field.id || field.fieldId);
                if (knownOppFieldIds.includes(fieldId)) {
                  leadSample.oppFound = true;
                  leadSample.oppValue = field.value;
                  leadSample.oppFieldId = fieldId;
                  break;
                }
                // Also check by label
                const label = String(field.label || '').toLowerCase();
                if (label.includes('opp') && !leadSample.oppFound) {
                  leadSample.oppFound = true;
                  leadSample.oppValue = field.value;
                  leadSample.oppFieldId = fieldId;
                  leadSample.oppLabel = field.label;
                }
              }
            }
          }

          // Track OPP stats
          if (leadSample.oppFound && leadSample.oppValue) {
            oppFoundCount++;
          } else {
            oppMissingCount++;
          }

          analysis.leadDataSamples.push(leadSample);
        } else {
          leadFetchErrors++;
        }
      } catch (e) {
        console.log(`[DIAG] Error fetching lead ${leadId}:`, e);
        leadFetchErrors++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
    }

    // Add OPP stats to analysis
    analysis.oppFieldStats.found = oppFoundCount;
    analysis.oppFieldStats.notFound = oppMissingCount;

    // 4. Summary with percentages
    const leadsChecked = oppFoundCount + oppMissingCount;
    const oppPercentage = leadsChecked > 0 ? Math.round((oppFoundCount / leadsChecked) * 100) : 0;
    
    const summary = {
      message: 'Adversus Data Diagnostics Complete',
      salesAnalyzed: sales.length,
      leadsChecked: leadsChecked,
      leadFetchErrors: leadFetchErrors,
      oppStats: {
        found: oppFoundCount,
        missing: oppMissingCount,
        percentage: `${oppPercentage}%`,
      },
      conclusion: '',
    };

    if (oppFoundCount > 0 && oppMissingCount === 0) {
      summary.conclusion = `✅ 100% de leads tienen OPP (${oppFoundCount}/${leadsChecked})`;
    } else if (oppFoundCount > 0) {
      summary.conclusion = `⚠️ Solo ${oppPercentage}% tienen OPP (${oppFoundCount}/${leadsChecked}). ${oppMissingCount} sin OPP.`;
    } else {
      summary.conclusion = `❌ Ningún lead tiene OPP en field 80862. Verificar configuración.`;
    }

    console.log(`[DIAG] Summary:`, JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify({
      summary,
      analysis,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[DIAG] Error:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
