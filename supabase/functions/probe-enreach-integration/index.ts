import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALKA_INTEGRATION_ID = "48d8bd23-df14-41fe-b000-abb8a4d6cd1d";

// Baseline /simpleleads data-fields we already know about today
const BASELINE_DATA_FIELDS = new Set([
  "Resultat", "Mødedato", "Mødetidspunkt",
  "cusFornavn", "cusEfternavn", "cusAdresse", "cusPOSTNR", "cusPOSTDISTRIKT",
  "cusBoligform", "cusKUNDE_ID", "cusPART_ID", "cusTELEFONNR_MOBIL",
  "Kontaktnummer", "age",
]);

interface ProbeResult {
  endpoint: string;
  url: string;
  ok: boolean;
  status: number;
  count?: number;
  rateLimitRemaining?: string | null;
  rateLimitReset?: string | null;
  error?: string;
  sample?: unknown;
  allDataFields?: string[];
  newDataFieldsVsBaseline?: string[];
  topLevelKeys?: string[];
  notes?: string;
}

async function probe(
  label: string,
  url: string,
  authHeader: string,
  opts: { extractDataFields?: boolean; limitSample?: boolean } = {}
): Promise<ProbeResult> {
  console.log(`[Probe] → ${label}: ${url}`);
  const result: ProbeResult = { endpoint: label, url, ok: false, status: 0 };
  try {
    const resp = await fetch(url, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    result.status = resp.status;
    result.ok = resp.status === 200;
    result.rateLimitRemaining = resp.headers.get("X-Rate-Limit-Remaining");
    result.rateLimitReset = resp.headers.get("X-Rate-Limit-Reset");

    const text = await resp.text();
    if (!result.ok) {
      result.error = text.slice(0, 400);
      return result;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      result.notes = `Non-JSON response (${text.length} bytes)`;
      result.sample = text.slice(0, 300);
      return result;
    }

    if (Array.isArray(json)) {
      result.count = json.length;
      const first = json[0];
      result.sample = opts.limitSample && first ? truncateForSample(first) : first;
      if (first && typeof first === "object") {
        result.topLevelKeys = Object.keys(first as Record<string, unknown>);
      }

      if (opts.extractDataFields) {
        const allKeys = new Set<string>();
        for (const item of json as Array<Record<string, unknown>>) {
          const data = item?.data;
          if (data && typeof data === "object" && !Array.isArray(data)) {
            for (const k of Object.keys(data)) allKeys.add(k);
          }
        }
        result.allDataFields = Array.from(allKeys).sort();
        result.newDataFieldsVsBaseline = result.allDataFields.filter(
          (k) => !BASELINE_DATA_FIELDS.has(k)
        );
      }
    } else if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      result.topLevelKeys = Object.keys(obj);
      result.sample = opts.limitSample ? truncateForSample(obj) : obj;
      if (opts.extractDataFields && obj.data && typeof obj.data === "object") {
        const dataObj = obj.data as Record<string, unknown>;
        result.allDataFields = Object.keys(dataObj).sort();
        result.newDataFieldsVsBaseline = result.allDataFields.filter(
          (k) => !BASELINE_DATA_FIELDS.has(k)
        );
      }
    } else {
      result.sample = json;
    }
    return result;
  } catch (e) {
    result.error = (e as Error).message;
    return result;
  }
}

function truncateForSample(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const json = JSON.stringify(obj);
  if (json.length < 4000) return obj;
  return JSON.parse(json.slice(0, 4000) + '"...TRUNCATED"}');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let integrationId = ALKA_INTEGRATION_ID;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.integration_id) integrationId = body.integration_id;
      } catch { /* default */ }
    }

    // Lookup integration metadata
    const { data: integration, error: intErr } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, api_url, calls_org_codes")
      .eq("id", integrationId)
      .single();

    if (intErr || !integration) {
      return new Response(JSON.stringify({ error: `Integration not found: ${integrationId}`, intErr }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (integration.api_url || "https://wshero01.herobase.com/api").replace(/\/$/, "");
    const orgCodes: string[] = integration.calls_org_codes || [];
    const primaryOrgCode = orgCodes[0] || "Copenhagen sales";

    // Fetch credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    const { data: credentials, error: credErr } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integrationId,
      p_encryption_key: encryptionKey,
    });

    if (credErr || !credentials?.username || !credentials?.password) {
      return new Response(JSON.stringify({ error: "Failed to fetch credentials", credErr }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = `Basic ${btoa(`${credentials.username.trim()}:${credentials.password.trim()}`)}`;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const startTime = new Date(Date.now() - 24 * 3600000).toISOString();

    const endpoints: ProbeResult[] = [];

    // 1. Quota / limits
    endpoints.push(await probe("/myaccount/request/limits", `${baseUrl}/myaccount/request/limits`, authHeader));
    await sleep(150);
    endpoints.push(await probe("/myaccount/request/counts", `${baseUrl}/myaccount/request/counts`, authHeader));
    await sleep(150);

    // 2. Projects
    endpoints.push(await probe("/projects", `${baseUrl}/projects`, authHeader, { limitSample: true }));
    await sleep(150);

    // 3. Campaigns
    endpoints.push(await probe("/campaigns", `${baseUrl}/campaigns?Limit=5`, authHeader, { limitSample: true }));
    await sleep(150);

    // Adapter pattern: existing Enreach Projects=* wildcard
    const projectsEp = endpoints.find((e) => e.endpoint === "/projects");
    const projectSample = projectsEp?.sample as Record<string, unknown> | undefined;
    const projectUniqueId = (projectSample?.uniqueId as string) || "";
    const projectFilter = `Projects=*`;

    // 4. Baseline /simpleleads with Projects=* (matches today's adapter)
    const simpleLeads = await probe(
      "/simpleleads (baseline Projects=*)",
      `${baseUrl}/simpleleads?${projectFilter}&ModifiedFrom=${sevenDaysAgo}&AllClosedStatuses=true&Limit=10`,
      authHeader,
      { extractDataFields: true, limitSample: true }
    );
    endpoints.push(simpleLeads);
    await sleep(200);

    // 4b. AGENT AUDIT — fetch 100 leads to map orgCodes/email-domains
    const CURRENT_WHITELIST = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
    const auditUrl = `${baseUrl}/simpleleads?${projectFilter}&ModifiedFrom=${sevenDaysAgo}&AllClosedStatuses=true&Limit=100`;
    let agentAudit: Record<string, unknown> = { skipped: true };
    try {
      console.log(`[Probe] → agent-audit: ${auditUrl}`);
      const resp = await fetch(auditUrl, { headers: { Authorization: authHeader, Accept: "application/json" } });
      if (resp.ok) {
        const leads = await resp.json() as Array<Record<string, unknown>>;
        const groups = new Map<string, { count: number; emails: Set<string>; domains: Set<string>; sources: Set<string>; wouldPass: boolean }>();
        let totalSuccess = 0;
        let wouldBeFiltered = 0;
        let wouldPass = 0;

        const recordUser = (u: unknown, source: "lastModified" | "firstProcessed") => {
          if (!u || typeof u !== "object") return;
          const user = u as Record<string, unknown>;
          const orgCode = (user.orgCode as string) || "(none)";
          const email = (user.email as string) || "";
          const domain = email.includes("@") ? "@" + email.split("@")[1].toLowerCase() : "(none)";
          const passes = CURRENT_WHITELIST.some(d => email.toLowerCase().endsWith(d));
          const key = orgCode;
          const g = groups.get(key) ?? { count: 0, emails: new Set(), domains: new Set(), sources: new Set(), wouldPass: passes };
          g.count++;
          if (email) g.emails.add(email);
          if (domain) g.domains.add(domain);
          g.sources.add(source);
          if (passes) g.wouldPass = true;
          groups.set(key, g);
        };

        for (const lead of leads) {
          totalSuccess++;
          const lastUser = lead.lastModifiedByUser as Record<string, unknown> | undefined;
          const firstUser = lead.firstProcessedByUser as Record<string, unknown> | undefined;
          recordUser(lastUser, "lastModified");
          if (firstUser && (firstUser as { email?: string }).email !== (lastUser as { email?: string } | undefined)?.email) {
            recordUser(firstUser, "firstProcessed");
          }
          // Determine if THIS LEAD would pass the current filter (based on lastModifiedByUser like the adapter)
          const leadEmail = ((lastUser?.email as string) || "").toLowerCase();
          const passes = CURRENT_WHITELIST.some(d => leadEmail.endsWith(d));
          if (passes) wouldPass++; else wouldBeFiltered++;
        }

        const top = Array.from(groups.entries())
          .map(([orgCode, g]) => ({
            orgCode,
            count: g.count,
            emailDomains: Array.from(g.domains),
            sampleEmails: Array.from(g.emails).slice(0, 3),
            sources: Array.from(g.sources),
            wouldPassCurrentFilter: g.wouldPass,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const allDomains = new Set<string>();
        for (const g of groups.values()) for (const d of g.domains) allDomains.add(d);

        agentAudit = {
          totalLeadsAnalyzed: totalSuccess,
          uniqueOrgCodes: groups.size,
          uniqueEmailDomains: Array.from(allDomains).sort(),
          currentWhitelist: CURRENT_WHITELIST,
          leadsThatWouldPassFilter: wouldPass,
          leadsThatWouldBeFiltered: wouldBeFiltered,
          top10OrgCodes: top,
          recommendation: wouldBeFiltered === totalSuccess
            ? `🚨 ALLE ${totalSuccess} leads ville blive filtreret væk. Whitelist SKAL udvides for at Alka virker.`
            : wouldBeFiltered > 0
              ? `⚠️ ${wouldBeFiltered}/${totalSuccess} leads ville blive filtreret. Tilføj manglende domæner til Alka's allowedAgentEmailDomains.`
              : `✅ Alle ${totalSuccess} leads passerer nuværende filter — ingen whitelist-ændring nødvendig.`,
        };
      } else {
        agentAudit = { error: `Status ${resp.status}`, body: (await resp.text()).slice(0, 300) };
      }
    } catch (e) {
      agentAudit = { error: (e as Error).message };
    }
    await sleep(200);

    // 4c. AGENT DIAGNOSIS — confirm WHY lastModifiedByUser.email is empty
    // Test A: /simpleleads WITH Include=lastModifiedByUser,firstProcessedByUser
    // Test B: cross-reference orgCodes from audit against /users (build orgCode→email map)
    // Test C: /leads/{uniqueId} detail with Include (single-lead path)
    const agentDiagnosis: Record<string, unknown> = {};

    // ---------- Test A ----------
    try {
      const urlA = `${baseUrl}/simpleleads?${projectFilter}&ModifiedFrom=${sevenDaysAgo}&AllClosedStatuses=true&Include=lastModifiedByUser,firstProcessedByUser&Limit=10`;
      console.log(`[Probe] → testA: ${urlA}`);
      const respA = await fetch(urlA, { headers: { Authorization: authHeader, Accept: "application/json" } });
      if (respA.ok) {
        const leadsA = await respA.json() as Array<Record<string, unknown>>;
        const withEmail = leadsA.filter((l) => {
          const u = l.lastModifiedByUser as Record<string, unknown> | undefined;
          return !!(u?.email);
        });
        const sample = withEmail[0]?.lastModifiedByUser as Record<string, unknown> | undefined;
        agentDiagnosis.testA_includeOnSimpleleads = {
          worked: withEmail.length > 0,
          status: respA.status,
          totalLeads: leadsA.length,
          leadsWithEmail: withEmail.length,
          sampleEmail: (sample?.email as string) || null,
          sampleOrgCode: (sample?.orgCode as string) || null,
          sampleUserKeys: leadsA[0]?.lastModifiedByUser
            ? Object.keys(leadsA[0].lastModifiedByUser as Record<string, unknown>)
            : [],
          note: withEmail.length > 0
            ? "✅ Include-parameter virker → 5-linjers fix i adapter"
            : "❌ Include ændrede ikke noget — email mangler stadig",
        };
      } else {
        agentDiagnosis.testA_includeOnSimpleleads = {
          worked: false,
          status: respA.status,
          error: (await respA.text()).slice(0, 300),
        };
      }
    } catch (e) {
      agentDiagnosis.testA_includeOnSimpleleads = { worked: false, error: (e as Error).message };
    }
    await sleep(200);

    // ---------- Test B ----------
    try {
      console.log(`[Probe] → testB: fetching /users (full list)`);
      const respB = await fetch(`${baseUrl}/users?Limit=1000`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });
      if (respB.ok) {
        const users = await respB.json() as Array<Record<string, unknown>>;
        // Build orgCode → user map
        const orgCodeMap = new Map<string, { email: string; name: string; domain: string }>();
        const userIdMap = new Map<string, { email: string; name: string; orgCode: string }>();
        const domainCounts = new Map<string, number>();
        for (const u of users) {
          const orgCode = (u.orgCode as string) || "";
          const email = (u.email as string) || "";
          const name = (u.name as string) || (u.userName as string) || "";
          const userId = (u.uniqueId as string) || (u.id as string) || "";
          const domain = email.includes("@") ? "@" + email.split("@")[1].toLowerCase() : "(none)";
          if (orgCode) orgCodeMap.set(orgCode, { email, name, domain });
          if (userId) userIdMap.set(userId, { email, name, orgCode });
          if (email) domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
        }

        // Cross-reference against orgCodes seen in agentAudit
        const auditTop = (agentAudit as { top10OrgCodes?: Array<{ orgCode: string; count: number }> })?.top10OrgCodes ?? [];
        const auditOrgCodes = auditTop.map((t) => t.orgCode).filter((c) => c && c !== "(none)");
        const matched = auditOrgCodes
          .map((oc) => ({ orgCode: oc, lookup: orgCodeMap.get(oc) ?? null }))
          .filter((m) => m.lookup !== null);

        const topDomains = Array.from(domainCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .reduce((acc, [d, c]) => { acc[d] = c; return acc; }, {} as Record<string, number>);

        agentDiagnosis.testB_orgCodeToUserMap = {
          totalUsersInTenant: users.length,
          uniqueOrgCodesInUsers: orgCodeMap.size,
          userIdMapSize: userIdMap.size,
          auditOrgCodesChecked: auditOrgCodes.length,
          matchedInUsers: matched.length,
          matchSamples: matched.slice(0, 5).map((m) => ({
            orgCode: m.orgCode,
            email: m.lookup!.email,
            name: m.lookup!.name,
            domain: m.lookup!.domain,
          })),
          topDomains,
          userObjectKeys: users[0] ? Object.keys(users[0]) : [],
          note: matched.length === auditOrgCodes.length && auditOrgCodes.length > 0
            ? "✅ ALLE audit-orgCodes findes i /users → pre-fetch user-map er en valid løsning"
            : matched.length > 0
              ? `⚠️ ${matched.length}/${auditOrgCodes.length} audit-orgCodes findes i /users — delvis dækning`
              : "❌ Ingen audit-orgCodes matchede /users — orgCode er ikke en pålidelig nøgle",
        };
      } else {
        agentDiagnosis.testB_orgCodeToUserMap = {
          worked: false,
          status: respB.status,
          error: (await respB.text()).slice(0, 300),
        };
      }
    } catch (e) {
      agentDiagnosis.testB_orgCodeToUserMap = { worked: false, error: (e as Error).message };
    }
    await sleep(200);

    // ---------- Test C ----------
    try {
      // Get a uniqueId from the baseline simpleLeads sample
      const simpleSampleC = simpleLeads.sample as Record<string, unknown> | undefined;
      const detailUniqueId = (simpleSampleC?.uniqueId as string) || null;
      if (detailUniqueId) {
        const urlC = `${baseUrl}/leads/${detailUniqueId}?Include=lastModifiedByUser,firstProcessedByUser`;
        console.log(`[Probe] → testC: ${urlC}`);
        const respC = await fetch(urlC, { headers: { Authorization: authHeader, Accept: "application/json" } });
        if (respC.ok) {
          const lead = await respC.json() as Record<string, unknown>;
          const lastUser = lead.lastModifiedByUser as Record<string, unknown> | undefined;
          const firstUser = lead.firstProcessedByUser as Record<string, unknown> | undefined;
          agentDiagnosis.testC_leadsDetail = {
            worked: !!(lastUser?.email || firstUser?.email),
            status: respC.status,
            uniqueIdProbed: detailUniqueId,
            lastModifiedEmail: (lastUser?.email as string) || null,
            lastModifiedOrgCode: (lastUser?.orgCode as string) || null,
            firstProcessedEmail: (firstUser?.email as string) || null,
            firstProcessedOrgCode: (firstUser?.orgCode as string) || null,
            userObjectKeys: lastUser ? Object.keys(lastUser) : [],
            note: (lastUser?.email || firstUser?.email)
              ? "✅ /leads/{id} detail returnerer email → fallback ved sync er muligt"
              : "❌ Selv detail-endpointet har tom email — data leveres slet ikke til denne API-bruger",
          };
        } else {
          agentDiagnosis.testC_leadsDetail = {
            worked: false,
            status: respC.status,
            uniqueIdProbed: detailUniqueId,
            error: (await respC.text()).slice(0, 300),
          };
        }
      } else {
        agentDiagnosis.testC_leadsDetail = { worked: false, skipped: "No uniqueId from simpleLeads sample" };
      }
    } catch (e) {
      agentDiagnosis.testC_leadsDetail = { worked: false, error: (e as Error).message };
    }
    await sleep(200);

    // ---------- Recommendation ----------
    const a = agentDiagnosis.testA_includeOnSimpleleads as { worked?: boolean } | undefined;
    const b = agentDiagnosis.testB_orgCodeToUserMap as { matchedInUsers?: number; auditOrgCodesChecked?: number } | undefined;
    const c = agentDiagnosis.testC_leadsDetail as { worked?: boolean } | undefined;
    let recommendation = "Ingen entydig løsning fundet — manuel inspektion påkrævet";
    if (a?.worked) {
      recommendation = "Brug Include=lastModifiedByUser,firstProcessedByUser på /simpleleads (mindst invasiv)";
    } else if (b?.matchedInUsers && b.auditOrgCodesChecked && b.matchedInUsers === b.auditOrgCodesChecked) {
      recommendation = "Pre-fetch /users og byg orgCode→email map ved hver sync";
    } else if (c?.worked) {
      recommendation = "Pr-lead detail-fetch (dyrest, men muligt fallback)";
    } else if ((b?.matchedInUsers ?? 0) > 0) {
      recommendation = "Kombinér: brug orgCode-map fra /users som primær + accepter delvis dækning";
    }
    agentDiagnosis.recommendation = recommendation;

    // 5. RICH /leads with broad Include + Projects=*
    const richInclude = "data,campaign,lastModifiedByUser,firstProcessedByUser,closureData,questions,answers,attempts,history,orgUnit,uploadedByUser";
    const richLeads = await probe(
      "/leads (rich Include, Projects=*)",
      `${baseUrl}/leads?${projectFilter}&ModifiedFrom=${sevenDaysAgo}&Include=${richInclude}&Limit=10`,
      authHeader,
      { extractDataFields: true, limitSample: true }
    );
    endpoints.push(richLeads);
    await sleep(200);

    // 5b. /leads with explicit project unique id
    if (projectUniqueId) {
      endpoints.push(await probe(
        `/leads (Projects=${projectUniqueId})`,
        `${baseUrl}/leads?Projects=${encodeURIComponent(projectUniqueId)}&ModifiedFrom=${sevenDaysAgo}&Include=data,campaign&Limit=5`,
        authHeader,
        { extractDataFields: true, limitSample: true }
      ));
      await sleep(200);
    }

    // 5c. /leads with SearchName (ASE-style — does Alka have a saved search?)
    endpoints.push(await probe(
      "/leads (SearchName=cphsales2 ASE-style)",
      `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${sevenDaysAgo}&Include=data,campaign&Limit=5`,
      authHeader,
      { extractDataFields: true, limitSample: true }
    ));
    await sleep(200);

    // 6. Single lead detail (use uniqueId from richLeads or simpleLeads)
    let sampleUniqueId: string | null = null;
    const richSample = richLeads.sample as Record<string, unknown> | undefined;
    const simpleSample = simpleLeads.sample as Record<string, unknown> | undefined;
    sampleUniqueId = (richSample?.uniqueId || simpleSample?.uniqueId || null) as string | null;

    if (sampleUniqueId) {
      endpoints.push(await probe(
        `/leads/{uniqueId} detail`,
        `${baseUrl}/leads/${sampleUniqueId}?Include=${richInclude}`,
        authHeader,
        { extractDataFields: true }
      ));
      await sleep(200);
    } else {
      endpoints.push({
        endpoint: "/leads/{uniqueId} detail",
        url: "(skipped)",
        ok: false,
        status: 0,
        notes: "No sample uniqueId available from list calls",
      });
    }

    // 7. Calls (CDR)
    endpoints.push(await probe(
      "/calls",
      `${baseUrl}/calls?OrgCode=${encodeURIComponent(primaryOrgCode)}&StartTime=${encodeURIComponent(startTime)}&TimeSpan=PT24H&Limit=20`,
      authHeader,
      { limitSample: true }
    ));
    await sleep(200);

    // 8. Sessions
    endpoints.push(await probe(
      "/sessions",
      `${baseUrl}/sessions?StartTime=${encodeURIComponent(startTime)}&TimeSpan=PT24H&Limit=20`,
      authHeader,
      { limitSample: true }
    ));
    await sleep(200);

    // 9. Hooks
    endpoints.push(await probe("/hooks", `${baseUrl}/hooks`, authHeader, { limitSample: true }));
    await sleep(150);
    endpoints.push(await probe("/hooks/meta", `${baseUrl}/hooks/meta`, authHeader, { limitSample: true }));
    await sleep(150);

    // 10. Users / agents
    endpoints.push(await probe("/users", `${baseUrl}/users?Limit=5`, authHeader, { limitSample: true }));
    await sleep(150);
    endpoints.push(await probe("/agents", `${baseUrl}/agents?Limit=5`, authHeader, { limitSample: true }));

    // Build recommendations
    const recommendations: string[] = [];
    if (richLeads.ok && (richLeads.newDataFieldsVsBaseline?.length ?? 0) > 0) {
      recommendations.push(
        `🎯 /leads med rig Include returnerer ${richLeads.newDataFieldsVsBaseline!.length} NYE data-felter ud over baseline: ${richLeads.newDataFieldsVsBaseline!.slice(0, 15).join(", ")}${richLeads.newDataFieldsVsBaseline!.length > 15 ? "…" : ""}. Overvej at flytte Alka fra /simpleleads til /leads.`
      );
    } else if (richLeads.ok) {
      recommendations.push("ℹ️ /leads med rig Include svarer 200, men ingen nye data-felter ud over baseline. Ingen gevinst ved at skifte endpoint.");
    } else {
      recommendations.push(`❌ /leads (rich Include) fejler med status ${richLeads.status}: ${richLeads.error?.slice(0, 200)}`);
    }

    const callsEp = endpoints.find((e) => e.endpoint === "/calls");
    if (callsEp?.ok && (callsEp.count ?? 0) > 0) {
      recommendations.push(`📞 /calls returnerer ${callsEp.count} opkald for OrgCode='${primaryOrgCode}'. Aktiver call-sync for Alka via callsOrgCodes i registry.`);
    } else if (callsEp?.ok) {
      recommendations.push(`⚠️ /calls svarer 200 men 0 records for OrgCode='${primaryOrgCode}'. Tjek om OrgCode er korrekt for Alka.`);
    } else {
      recommendations.push(`❌ /calls fejler (status ${callsEp?.status}). Ingen opkaldsdata tilgængelig.`);
    }

    const sessionsEp = endpoints.find((e) => e.endpoint === "/sessions");
    if (sessionsEp?.ok) {
      recommendations.push(`✅ /sessions tilgængelig (${sessionsEp.count ?? 0} records). Kan bruges til hitrate-analytics.`);
    }

    const campaignsEp = endpoints.find((e) => e.endpoint === "/campaigns");
    if (campaignsEp?.ok) {
      recommendations.push(`✅ /campaigns tilgængelig (${campaignsEp.count ?? 0} records). Kan berige kampagne-mapping.`);
    }

    const report = {
      integration: integration.name,
      integrationId,
      provider: integration.provider,
      host: baseUrl,
      callsOrgCodes: orgCodes,
      probedAt: new Date().toISOString(),
      windowFrom: sevenDaysAgo,
      summary: {
        totalEndpointsProbed: endpoints.length,
        successCount: endpoints.filter((e) => e.ok).length,
        failureCount: endpoints.filter((e) => !e.ok).length,
        baselineDataFields: Array.from(BASELINE_DATA_FIELDS).sort(),
      },
      recommendations,
      agentAudit,
      agentDiagnosis,
      endpoints,
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Probe] Fatal error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message, stack: (e as Error).stack }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
