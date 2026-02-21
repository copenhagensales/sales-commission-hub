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
    const body = await req.json().catch(() => ({}));
    const integrationName = body.integration_name || "tryg";
    const sampleSize = body.sample_size || 10;
    const days = body.days || 7;
    
    console.log(`[Enreach-Diagnostics] Starting with integration: ${integrationName}, days: ${days}, sampleSize: ${sampleSize}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the integration by name
    const { data: integration, error: intError } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, api_url, encrypted_credentials")
      .ilike("name", integrationName)
      .eq("provider", "enreach")
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ 
        error: `No se encontró integración Enreach: ${integrationName}`,
        details: intError?.message,
        hint: "Prueba con 'tryg' o 'try enreach'"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Enreach-Diagnostics] Found integration: ${integration.name}, api_url: ${integration.api_url}`);

    // Decrypt credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "DB_ENCRYPTION_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creds, error: decryptError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey
    });

    if (decryptError || !creds) {
      return new Response(JSON.stringify({ 
        error: `No se pudieron descifrar credenciales`,
        details: decryptError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build base URL
    let baseUrl = creds.api_url || integration.api_url || "https://wshero01.herobase.com/api";
    // Sanitize URL: remove common prefixes like "Web: ", "URL: " that users may accidentally include
    baseUrl = baseUrl.replace(/^(Web|URL|API|Endpoint):\s*/i, '').trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    if (!baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.endsWith('/') ? baseUrl + 'api' : baseUrl + '/api';
    }
    
    console.log(`[Enreach-Diagnostics] Base URL: ${baseUrl}`);

    // Build auth header
    let authHeader: string;
    if (creds.username && creds.password) {
      authHeader = `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
      console.log(`[Enreach-Diagnostics] Using Basic Auth for user: ${creds.username}`);
    } else if (creds.api_token) {
      authHeader = `Bearer ${creds.api_token}`;
      console.log("[Enreach-Diagnostics] Using Bearer Token Auth");
    } else {
      return new Response(JSON.stringify({ error: "No valid credentials found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const results: Record<string, unknown> = {
      integrationName: integration.name,
      baseUrl,
      credentialsFound: true,
      timestamp: new Date().toISOString(),
    };

    // Calculate date filter
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const modifiedFrom = cutoffDate.toISOString().split('T')[0];

    // ============ TEST 1: Fetch simpleleads (main sales endpoint) ============
    console.log("[Enreach-Diagnostics] TEST 1: Fetching /simpleleads...");
    try {
      const simpleLeadsUrl = `${baseUrl}/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&Statuses=UserProcessed&LeadClosures=Success`;
      console.log(`[Enreach-Diagnostics] URL: ${simpleLeadsUrl}`);
      
      const res1 = await fetch(simpleLeadsUrl, { headers });
      const status1 = res1.status;
      
      if (res1.ok) {
        const data1 = await res1.json();
        const isArray = Array.isArray(data1);
        const dataArray = isArray ? data1 : (data1.Results || data1.results || data1.Leads || data1.leads || data1.Data || data1.data || []);
        
        results.simpleleads = {
          status: status1,
          success: true,
          isArray,
          totalRecords: dataArray.length,
          responseType: typeof data1,
          topLevelKeys: Object.keys(data1 || {}),
          sampleRecords: dataArray.slice(0, sampleSize),
          // Analyze field structure
          fieldAnalysis: analyzeFieldStructure(dataArray.slice(0, 50)),
        };
        console.log(`[Enreach-Diagnostics] /simpleleads returned ${dataArray.length} records`);
      } else {
        const errorText = await res1.text();
        results.simpleleads = {
          status: status1,
          success: false,
          error: errorText.substring(0, 500),
        };
        console.log(`[Enreach-Diagnostics] /simpleleads failed: ${status1}`);
      }
    } catch (e) {
      results.simpleleads = { error: (e as Error).message };
      console.error("[Enreach-Diagnostics] /simpleleads exception:", e);
    }

    // ============ TEST 2: Fetch simpleleads without status filters ============
    console.log("[Enreach-Diagnostics] TEST 2: Fetching /simpleleads (no filters)...");
    try {
      const simpleLeadsUrl2 = `${baseUrl}/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}`;
      console.log(`[Enreach-Diagnostics] URL: ${simpleLeadsUrl2}`);
      
      const res2 = await fetch(simpleLeadsUrl2, { headers });
      
      if (res2.ok) {
        const data2 = await res2.json();
        const isArray = Array.isArray(data2);
        const dataArray = isArray ? data2 : (data2.Results || data2.results || data2.Leads || data2.leads || data2.Data || data2.data || []);
        
        results.simpleleads_unfiltered = {
          status: res2.status,
          success: true,
          totalRecords: dataArray.length,
          sampleRecords: dataArray.slice(0, sampleSize),
        };
        console.log(`[Enreach-Diagnostics] /simpleleads (unfiltered) returned ${dataArray.length} records`);
      } else {
        results.simpleleads_unfiltered = {
          status: res2.status,
          error: (await res2.text()).substring(0, 300),
        };
      }
    } catch (e) {
      results.simpleleads_unfiltered = { error: (e as Error).message };
    }

    // ============ TEST 3: Try /leads with MANY different parameter combos ============
    console.log("[Enreach-Diagnostics] TEST 3: Testing /leads with multiple parameter combinations...");
    const leadsVariants: Record<string, string> = {
      "leads_bare": `${baseUrl}/leads`,
      "leads_modifiedFrom": `${baseUrl}/leads?ModifiedFrom=${modifiedFrom}`,
      "leads_modifiedFrom_pageSize": `${baseUrl}/leads?ModifiedFrom=${modifiedFrom}&PageSize=50`,
      "leads_searchName_cphsales2": `${baseUrl}/leads?searchName=cphsales2`,
      "leads_searchName_cphsales": `${baseUrl}/leads?searchName=cphsales`,
      "leads_searchName_CPH_API": `${baseUrl}/leads?searchName=CPH_API`,
      "leads_project_id": `${baseUrl}/leads?Projects=PRJ2340S3012`,
      "leads_project_star": `${baseUrl}/leads?Projects=*`,
      "leads_project_name": `${baseUrl}/leads?Projects=Nysalg - Eksterne`,
      "leads_campaign": `${baseUrl}/leads?Campaigns=CAMP5396S3012`,
      "leads_dialTimeFrom": `${baseUrl}/leads?DialTimeFrom=${modifiedFrom}`,
      "leads_statuses": `${baseUrl}/leads?Statuses=UserProcessed`,
      "leads_closures": `${baseUrl}/leads?LeadClosures=Success`,
      "leads_pageSize_only": `${baseUrl}/leads?PageSize=10`,
      "leads_project_modifiedFrom": `${baseUrl}/leads?Projects=PRJ2340S3012&ModifiedFrom=${modifiedFrom}`,
      "leads_searchName_star": `${baseUrl}/leads?searchName=*`,
    };

    results.leadsVariants = {};
    for (const [variantName, url] of Object.entries(leadsVariants)) {
      console.log(`[Enreach-Diagnostics] Testing variant: ${variantName} -> ${url}`);
      try {
        const res = await fetch(url, { headers });
        const status = res.status;
        if (res.ok) {
          const data = await res.json();
          const isArray = Array.isArray(data);
          const dataArray = isArray ? data : (data.Results || data.results || data.Leads || data.leads || data.Data || data.data || []);
          (results.leadsVariants as Record<string, unknown>)[variantName] = {
            status,
            success: true,
            totalRecords: isArray ? dataArray.length : `keys: ${Object.keys(data).join(',')}`,
            recordCount: dataArray.length,
            sampleRecord: dataArray.length > 0 ? dataArray[0] : null,
            topLevelKeys: isArray ? null : Object.keys(data),
          };
          console.log(`[Enreach-Diagnostics] ✅ ${variantName}: ${status} - ${dataArray.length} records`);
        } else {
          const errorText = await res.text();
          (results.leadsVariants as Record<string, unknown>)[variantName] = {
            status,
            success: false,
            error: errorText.substring(0, 200),
          };
          console.log(`[Enreach-Diagnostics] ❌ ${variantName}: ${status}`);
        }
      } catch (e) {
        (results.leadsVariants as Record<string, unknown>)[variantName] = { error: (e as Error).message };
        console.log(`[Enreach-Diagnostics] ❌ ${variantName}: exception`);
      }
    }

    // ============ TEST 4: Fetch campaigns ============
    console.log("[Enreach-Diagnostics] TEST 4: Fetching /campaigns...");
    try {
      const campaignsUrl = `${baseUrl}/campaigns`;
      const res4 = await fetch(campaignsUrl, { headers });
      
      if (res4.ok) {
        const data4 = await res4.json();
        const dataArray = Array.isArray(data4) ? data4 : (data4.campaigns || data4.Campaigns || data4.Results || []);
        
        results.campaigns = {
          status: res4.status,
          success: true,
          totalRecords: dataArray.length,
          sampleRecords: dataArray.slice(0, 10),
        };
        console.log(`[Enreach-Diagnostics] /campaigns returned ${dataArray.length} records`);
      } else {
        results.campaigns = {
          status: res4.status,
          error: (await res4.text()).substring(0, 300),
        };
      }
    } catch (e) {
      results.campaigns = { error: (e as Error).message };
    }

    // ============ TEST 5: Fetch users ============
    console.log("[Enreach-Diagnostics] TEST 5: Fetching /users...");
    try {
      const usersUrl = `${baseUrl}/users`;
      const res5 = await fetch(usersUrl, { headers });
      
      if (res5.ok) {
        const data5 = await res5.json();
        const dataArray = Array.isArray(data5) ? data5 : (data5.users || data5.Users || data5.Results || []);
        
        results.users = {
          status: res5.status,
          success: true,
          totalRecords: dataArray.length,
          sampleRecords: dataArray.slice(0, 5),
        };
        console.log(`[Enreach-Diagnostics] /users returned ${dataArray.length} records`);
      } else {
        results.users = {
          status: res5.status,
          error: (await res5.text()).substring(0, 300),
        };
      }
    } catch (e) {
      results.users = { error: (e as Error).message };
    }

    // ============ TEST 6: Try fetching a single lead by ID ============
    const simpleleadsData = results.simpleleads as Record<string, unknown> | undefined;
    const sampleRecords = simpleleadsData?.sampleRecords as Record<string, unknown>[] | undefined;
    if (sampleRecords?.length) {
      const firstLead = sampleRecords[0];
      const leadId = firstLead?.UniqueId || firstLead?.uniqueId || firstLead?.Id || firstLead?.id || firstLead?.LeadUniqueId;
      
      if (leadId) {
        console.log(`[Enreach-Diagnostics] TEST 6: Fetching single lead ${leadId}...`);
        try {
          const singleLeadUrl = `${baseUrl}/leads/${leadId}`;
          const res6 = await fetch(singleLeadUrl, { headers });
          
          if (res6.ok) {
            const data6 = await res6.json();
            results.singleLeadDetail = {
              status: res6.status,
              success: true,
              leadId,
              fullRecord: data6,
              allKeys: Object.keys(data6 || {}),
            };
            console.log(`[Enreach-Diagnostics] Single lead fetch successful`);
          } else {
            results.singleLeadDetail = {
              status: res6.status,
              leadId,
              error: (await res6.text()).substring(0, 300),
            };
          }
        } catch (e) {
          results.singleLeadDetail = { leadId, error: (e as Error).message };
        }
      }
    }

    // ============ TEST 7: Try different API endpoints ============
    console.log("[Enreach-Diagnostics] TEST 7: Testing alternative endpoints...");
    const alternativeEndpoints = [
      "/projects",
      "/sales",
      "/orders",
      "/results",
      "/flow",
      "/flows",
    ];
    
    results.alternativeEndpoints = {};
    for (const endpoint of alternativeEndpoints) {
      try {
        const url = `${baseUrl}${endpoint}`;
        const res = await fetch(url, { headers });
        (results.alternativeEndpoints as Record<string, unknown>)[endpoint] = {
          status: res.status,
          success: res.ok,
          preview: res.ok ? (await res.json()).toString().substring(0, 200) : null,
        };
      } catch (e) {
        (results.alternativeEndpoints as Record<string, unknown>)[endpoint] = { 
          error: (e as Error).message.substring(0, 100) 
        };
      }
    }

    // ============ Compare with DB data ============
    console.log("[Enreach-Diagnostics] Checking current DB data for Enreach...");
    const { data: dbSales, error: dbError } = await supabase
      .from("sales")
      .select("id, adversus_external_id, agent_name, customer_company, customer_phone, sale_datetime, source, integration_type")
      .eq("integration_type", "enreach")
      .order("sale_datetime", { ascending: false })
      .limit(20);

    results.currentDbData = {
      error: dbError?.message,
      count: dbSales?.length || 0,
      samples: dbSales?.slice(0, 10),
    };

    // ============ TEST 8: Fetch all projects ============
    console.log("[Enreach-Diagnostics] TEST 8: Fetching /projects...");
    try {
      const projectsUrl = `${baseUrl}/projects`;
      const res8 = await fetch(projectsUrl, { headers });
      if (res8.ok) {
        const data8 = await res8.json();
        const dataArray = Array.isArray(data8) ? data8 : (data8.Results || data8.results || data8.Projects || data8.projects || []);
        const trpProjects = dataArray.filter((p: Record<string, unknown>) => {
          const name = String(p.Name || p.name || p.ProjectName || "").toLowerCase();
          return name.includes("trp") || name.includes("recycling");
        });
        results.projects = {
          status: res8.status,
          success: true,
          totalProjects: dataArray.length,
          allProjects: dataArray.slice(0, 50),
          trpMatches: trpProjects,
          trpFound: trpProjects.length > 0,
        };
        console.log(`[Enreach-Diagnostics] /projects returned ${dataArray.length} projects, TRP matches: ${trpProjects.length}`);
      } else {
        results.projects = { status: res8.status, error: (await res8.text()).substring(0, 300) };
      }
    } catch (e) {
      results.projects = { error: (e as Error).message };
    }

    // ============ TEST 9: Fetch TRP campaigns ============
    console.log("[Enreach-Diagnostics] TEST 9: Fetching /campaigns?Project=TRP*...");
    try {
      const trpCampaignsUrl = `${baseUrl}/campaigns?Project=TRP*&Active=All`;
      const res9 = await fetch(trpCampaignsUrl, { headers });
      if (res9.ok) {
        const data9 = await res9.json();
        const dataArray = Array.isArray(data9) ? data9 : (data9.Results || data9.results || data9.Campaigns || data9.campaigns || []);
        results.trpCampaigns = {
          status: res9.status,
          success: true,
          totalCampaigns: dataArray.length,
          campaigns: dataArray.slice(0, 30),
        };
        console.log(`[Enreach-Diagnostics] TRP campaigns: ${dataArray.length}`);
      } else {
        results.trpCampaigns = { status: res9.status, error: (await res9.text()).substring(0, 300) };
      }
    } catch (e) {
      results.trpCampaigns = { error: (e as Error).message };
    }

    // ============ TEST 10: Search /calls for phone 51806520 ============
    console.log("[Enreach-Diagnostics] TEST 10: Searching /calls for phone 51806520...");
    try {
      const callsUrl = `${baseUrl}/calls?StartTime=2026-01-27&TimeSpan=3.00:00:00&Include=campaign,user&PageSize=500`;
      const res10 = await fetch(callsUrl, { headers });
      if (res10.ok) {
        const data10 = await res10.json();
        const dataArray = Array.isArray(data10) ? data10 : (data10.Results || data10.results || data10.Calls || data10.calls || data10.Data || data10.data || []);
        const phoneMatches = dataArray.filter((c: Record<string, unknown>) => {
          const phone = String(c.LeadPhoneNumber || c.leadPhoneNumber || c.PhoneNumber || c.phoneNumber || "");
          return phone.includes("51806520");
        });
        results.callsPhoneSearch = {
          status: res10.status,
          success: true,
          totalCalls: dataArray.length,
          phoneMatches: phoneMatches,
          phoneMatchCount: phoneMatches.length,
          sampleCalls: dataArray.slice(0, 5),
          topLevelKeys: Object.keys(data10 || {}),
          callFieldKeys: dataArray.length > 0 ? Object.keys(dataArray[0] || {}) : [],
        };
        console.log(`[Enreach-Diagnostics] /calls returned ${dataArray.length} calls, phone 51806520 matches: ${phoneMatches.length}`);
      } else {
        results.callsPhoneSearch = { status: res10.status, error: (await res10.text()).substring(0, 300) };
      }
    } catch (e) {
      results.callsPhoneSearch = { error: (e as Error).message };
    }

    // ============ TEST 11: Try /leads endpoint ============
    console.log("[Enreach-Diagnostics] TEST 11: Fetching /leads?ModifiedFrom=2026-01-27...");
    try {
      const leadsAltUrl = `${baseUrl}/leads?ModifiedFrom=2026-01-27&PageSize=500`;
      const res11 = await fetch(leadsAltUrl, { headers });
      if (res11.ok) {
        const data11 = await res11.json();
        const dataArray = Array.isArray(data11) ? data11 : (data11.Results || data11.results || data11.Leads || data11.leads || data11.Data || data11.data || []);
        const phoneMatches = dataArray.filter((l: Record<string, unknown>) => {
          const allValues = JSON.stringify(l);
          return allValues.includes("51806520");
        });
        results.leadsEndpoint = {
          status: res11.status,
          success: true,
          totalLeads: dataArray.length,
          phoneMatches: phoneMatches.slice(0, 5),
          phoneMatchCount: phoneMatches.length,
          sampleLeads: dataArray.slice(0, 5),
          topLevelKeys: Object.keys(data11 || {}),
          leadFieldKeys: dataArray.length > 0 ? Object.keys(dataArray[0] || {}) : [],
        };
        console.log(`[Enreach-Diagnostics] /leads returned ${dataArray.length} leads, phone 51806520 matches: ${phoneMatches.length}`);
      } else {
        results.leadsEndpoint = { status: res11.status, error: (await res11.text()).substring(0, 300) };
      }
    } catch (e) {
      results.leadsEndpoint = { error: (e as Error).message };
    }

    // Summary analysis
    results.analysis = generateAnalysis(results);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Enreach-Diagnostics] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, stack: (error as Error).stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Analyze field structure across multiple records
 */
function analyzeFieldStructure(records: Record<string, unknown>[]): Record<string, unknown> {
  if (!records.length) return { empty: true };

  const allKeys = new Set<string>();
  const keyPresence: Record<string, number> = {};
  const keySamples: Record<string, unknown[]> = {};
  const nestedObjects: Record<string, string[]> = {};

  for (const record of records) {
    for (const [key, value] of Object.entries(record || {})) {
      allKeys.add(key);
      keyPresence[key] = (keyPresence[key] || 0) + 1;
      
      // Collect sample values
      if (!keySamples[key]) keySamples[key] = [];
      if (keySamples[key].length < 3 && value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          keySamples[key].push(`[Object: ${Object.keys(value || {}).join(', ')}]`);
          nestedObjects[key] = Object.keys(value || {});
        } else if (Array.isArray(value)) {
          keySamples[key].push(`[Array: ${value.length} items]`);
        } else {
          keySamples[key].push(String(value).substring(0, 50));
        }
      }
    }
  }

  // Sort keys by presence
  const sortedKeys = [...allKeys].sort((a, b) => keyPresence[b] - keyPresence[a]);

  return {
    totalFields: allKeys.size,
    recordsAnalyzed: records.length,
    fieldPresence: sortedKeys.map(key => ({
      field: key,
      count: keyPresence[key],
      percentage: Math.round((keyPresence[key] / records.length) * 100),
      samples: keySamples[key],
      hasNestedObject: !!nestedObjects[key],
      nestedKeys: nestedObjects[key],
    })),
    // Key fields for sales
    keyFieldsFound: {
      id: sortedKeys.filter(k => k.toLowerCase().includes('id')),
      agent: sortedKeys.filter(k => k.toLowerCase().includes('agent') || k.toLowerCase().includes('user')),
      phone: sortedKeys.filter(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('tel')),
      name: sortedKeys.filter(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('company')),
      date: sortedKeys.filter(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time') || k.toLowerCase().includes('created')),
      campaign: sortedKeys.filter(k => k.toLowerCase().includes('campaign') || k.toLowerCase().includes('project') || k.toLowerCase().includes('flow')),
      product: sortedKeys.filter(k => k.toLowerCase().includes('product') || k.toLowerCase().includes('item')),
      status: sortedKeys.filter(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('closure')),
    }
  };
}

/**
 * Generate analysis summary
 */
function generateAnalysis(results: Record<string, unknown>): Record<string, unknown> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check simpleleads
  const simpleleads = results.simpleleads as Record<string, unknown> | undefined;
  if (simpleleads?.success) {
    const totalRecords = simpleleads.totalRecords as number;
    if (totalRecords === 0) {
      issues.push("No records returned from /simpleleads - check filters");
    } else {
      const fieldAnalysis = simpleleads.fieldAnalysis as Record<string, unknown>;
      if (fieldAnalysis) {
        const keyFields = fieldAnalysis.keyFieldsFound as Record<string, string[]>;
        if (keyFields) {
          if (!keyFields.agent?.length) issues.push("No agent-related fields found");
          if (!keyFields.phone?.length) issues.push("No phone-related fields found");
          if (!keyFields.name?.length) issues.push("No name-related fields found");
          if (!keyFields.date?.length) issues.push("No date-related fields found");
        }
      }
    }
  } else {
    issues.push("Failed to fetch /simpleleads endpoint");
    recommendations.push("Try different API endpoints or check credentials");
  }

  // Compare with DB
  const dbData = results.currentDbData as Record<string, unknown>;
  if (dbData) {
    const dbSamples = dbData.samples as Record<string, unknown>[];
    if (dbSamples?.length) {
      const missingFields = dbSamples.filter(s => 
        !s.agent_name && !s.customer_phone && !s.customer_company
      );
      if (missingFields.length === dbSamples.length) {
        issues.push("ALL DB records are missing agent, phone, and company data");
        recommendations.push("The EnreachAdapter field extraction needs fixing based on actual API response format");
      }
    }
  }

  return {
    issuesFound: issues.length,
    issues,
    recommendations,
    nextSteps: [
      "1. Review the 'sampleRecords' in each endpoint to see actual field names",
      "2. Compare field names with EnreachAdapter.ts getValue() lookups",
      "3. Update adapter to match actual API response structure",
      "4. Run integration-engine with updated adapter"
    ]
  };
}
