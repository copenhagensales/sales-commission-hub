// READ-ONLY discovery of the Adversus REST API.
// Returns ONLY metadata: campaign list, field definitions, and the KEY NAMES
// (with data types) of one sample record per endpoint. No values are returned,
// nothing is written to the database, and no lead/customer data is logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BASE_URLS = ["https://api.adversus.io/v1", "https://api.adversus.dk/v1"];

const PII_HINTS = [
  "name", "navn", "firstname", "lastname", "company", "firma",
  "address", "adresse", "zip", "postnr", "city", "by",
  "email", "mail", "phone", "tlf", "telefon", "mobil", "msisdn",
  "cpr", "cvr", "note", "noter", "comment", "kommentar", "birth", "foed",
];

const looksLikePii = (label: string, type?: string) => {
  const l = `${label} ${type ?? ""}`.toLowerCase();
  return PII_HINTS.some((h) => l.includes(h));
};

const isFreeText = (label: string, type?: string) => {
  const l = `${label} ${type ?? ""}`.toLowerCase();
  return ["note", "noter", "comment", "kommentar", "textarea", "freetext", "fritekst"].some((h) =>
    l.includes(h),
  );
};

/** Describe a value's type only — never the value itself. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(empty)";
    return `array<${describeType(value[0])}>`;
  }
  const t = typeof value;
  if (t === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `object{${keys.slice(0, 25).join(", ")}}`;
  }
  if (t === "string") {
    const s = value as string;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "string(datetime)";
    return "string";
  }
  return t;
}

/** Return only key names + types for one record. */
function keysOf(record: Record<string, unknown>): Array<{ key: string; type: string; pii_hint: boolean }> {
  return Object.entries(record).map(([key, value]) => ({
    key,
    type: describeType(value),
    pii_hint: looksLikePii(key),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ---- Auth: superadmin only -------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userData, error: userError } = await svc.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: isSuperadmin } = await svc.rpc("is_superadmin", { _user_id: userData.user.id });
  if (isSuperadmin !== true) return json({ error: "Forbidden — superadmin required" }, 403);

  // ---- Credentials (account selectable; default = existing integration) ------
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const account = String((body as Record<string, unknown>).account ?? "default").toLowerCase();

  const SECRET_NAMES: Record<string, { user: string; pass: string }> = {
    default: { user: "ADVERSUS_API_USERNAME", pass: "ADVERSUS_API_PASSWORD" },
    lederne: { user: "ADVERSUS_LEDERNE_API_USERNAME", pass: "ADVERSUS_LEDERNE_API_PASSWORD" },
  };

  const names = SECRET_NAMES[account];
  if (!names) {
    return json(
      { error: `Ukendt account: ${account}. Gyldige: ${Object.keys(SECRET_NAMES).join(", ")}` },
      400,
    );
  }

  const username = Deno.env.get(names.user);
  const password = Deno.env.get(names.pass);
  if (!username || !password) {
    return json({ error: `${names.user} / ${names.pass} mangler` }, 500);
  }
  const basic = `Basic ${btoa(`${username}:${password}`)}`;

  const errors: Array<{ endpoint: string; status?: number; message: string }> = [];

  // Resolve base URL. Some API users are only permitted on a subset of endpoints,
  // so probe several read-only endpoints before giving up.
  let baseUrl: string | null = null;
  let campaignsRaw: unknown = null;
  const probePaths = ["/campaigns", "/leads?pageSize=1"];
  outer: for (const candidate of BASE_URLS) {
    for (const probe of probePaths) {
      try {
        const res = await fetch(`${candidate}${probe}`, {
          headers: { Authorization: basic, "Content-Type": "application/json" },
        });
        if (res.ok) {
          baseUrl = candidate;
          if (probe === "/campaigns") campaignsRaw = await res.json();
          break outer;
        }
        errors.push({
          endpoint: `${candidate}${probe}`,
          status: res.status,
          message: (await res.text()).slice(0, 300),
        });
      } catch (e) {
        errors.push({ endpoint: `${candidate}${probe}`, message: (e as Error).message });
      }
    }
  }

  if (!baseUrl) {
    return json({ ok: false, stage: "auth/base_url", errors }, 502);
  }

  const getJson = async (path: string): Promise<unknown | null> => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: basic, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        errors.push({
          endpoint: path,
          status: res.status,
          message: (await res.text()).slice(0, 300),
        });
        return null;
      }
      return await res.json();
    } catch (e) {
      errors.push({ endpoint: path, message: (e as Error).message });
      return null;
    }
  };

  const asArray = (data: unknown, ...keys: string[]): Record<string, unknown>[] => {
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === "object") {
      for (const k of keys) {
        const v = (data as Record<string, unknown>)[k];
        if (Array.isArray(v)) return v as Record<string, unknown>[];
      }
    }
    return [];
  };

  // ---- a) Campaigns ----------------------------------------------------------
  const campaignList = asArray(campaignsRaw, "campaigns", "data");
  const campaignName = (c: Record<string, unknown>): string | null => {
    const s = (c.settings ?? {}) as Record<string, unknown>;
    return (c.name ?? s.name ?? s.campaignName ?? null) as string | null;
  };
  const campaignActive = (c: Record<string, unknown>): unknown => {
    const s = (c.settings ?? {}) as Record<string, unknown>;
    return c.active ?? c.status ?? s.active ?? s.status ?? null;
  };
  const campaigns = campaignList.map((c) => ({
    id: c.id,
    name: campaignName(c),
    active: campaignActive(c),
  }));

  // ---- b) Field definitions --------------------------------------------------
  const fieldsRaw = await getJson("/fields");
  const fieldDefs = asArray(fieldsRaw, "fields", "data");

  const describeField = (f: Record<string, unknown>, kind: string) => {
    const label = String(f.name ?? f.label ?? f.title ?? "");
    const type = String(f.type ?? "unknown");
    return {
      field_id: f.id ?? null,
      label,
      type,
      kind, // masterData | resultData | campaignData
      active: f.active ?? null,
      free_text: isFreeText(label, type) ? "note/fritekst (indhold ikke hentet)" : null,
      pii_hint: looksLikePii(label, type),
    };
  };

  const globalFields = fieldDefs.map((f) =>
    describeField(f, String(f.dataSet ?? f.dataset ?? f.group ?? "unknown")),
  );

  // Lookup so campaigns that only reference field ids can be resolved to labels.
  const fieldById = new Map<string, Record<string, unknown>>();
  for (const f of fieldDefs) if (f.id !== undefined) fieldById.set(String(f.id), f);

  const resolveFields = (source: unknown, kind: string) => {
    const raw = Array.isArray(source) ? source : asArray(source, "fields", "data");
    return raw.map((entry) => {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const def = e.id !== undefined ? fieldById.get(String(e.id)) : undefined;
        return describeField({ ...(def ?? {}), ...e }, kind);
      }
      const def = fieldById.get(String(entry));
      return describeField(def ?? { id: entry }, kind);
    });
  };

  const perCampaignFields = campaignList.map((c) => {
    const s = (c.settings ?? {}) as Record<string, unknown>;
    return {
      campaign_id: c.id,
      campaign_name: campaignName(c),
      active: campaignActive(c),
      master_data_fields: resolveFields(c.masterFields ?? s.masterFields, "masterData"),
      result_data_fields: resolveFields(c.resultFields ?? s.resultFields, "resultData"),
      campaign_fields: resolveFields(c.campaignFields ?? s.campaignFields, "campaignData"),
    };
  });

  // Fallback: if /campaigns and /fields are not permitted for this API user,
  // derive campaign ids and field metadata (id + label + inferred type ONLY —
  // never values) from a sample of leads.
  let derivedFrom: string | null = null;
  if (campaignList.length === 0) {
    const sample = await getJson("/leads?pageSize=1000&page=1");
    const leads = asArray(sample, "leads", "data");
    if (leads.length > 0) {
      derivedFrom = `afledt af ${leads.length} leads (kun felt-id, label og datatype — ingen værdier)`;
      const byCampaign = new Map<
        string,
        { master: Map<string, ReturnType<typeof describeField>>; result: Map<string, ReturnType<typeof describeField>> }
      >();
      for (const lead of leads) {
        const cid = String(lead.campaignId ?? "ukendt");
        if (!byCampaign.has(cid)) byCampaign.set(cid, { master: new Map(), result: new Map() });
        const entry = byCampaign.get(cid)!;
        for (const [key, kind, target] of [
          ["masterData", "masterData", entry.master],
          ["resultData", "resultData", entry.result],
        ] as const) {
          for (const f of asArray(lead[key])) {
            const id = String(f.id ?? f.label ?? "");
            if (!id || target.has(id)) continue;
            target.set(id, describeField({ id: f.id, name: f.label, type: describeType(f.value) }, kind));
          }
        }
      }
      for (const [cid, entry] of byCampaign) {
        campaigns.push({ id: cid, name: null, active: null });
        perCampaignFields.push({
          campaign_id: cid,
          campaign_name: null,
          active: null,
          master_data_fields: [...entry.master.values()],
          result_data_fields: [...entry.result.values()],
          campaign_fields: [],
        });
      }
    }
  }

  // ---- c) One sample record per endpoint → keys only -------------------------
  const shapeOf = async (label: string, path: string) => {
    const data = await getJson(path);
    if (!data) return { endpoint: label, available: false, keys: [] };
    const rows = asArray(data, label, "data", "leads", "sales", "appointments", "sessions", "cdr");
    const one = rows[0] ?? (typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null);
    if (!one) return { endpoint: label, available: true, keys: [], note: "ingen records i svaret" };
    const keys = keysOf(one);
    return { endpoint: label, available: true, keys };
  };

  const shapes = [
    await shapeOf("leads", "/leads?pageSize=1&page=1"),
    await shapeOf("sales", "/sales?pageSize=1&page=1"),
    await shapeOf("appointments", "/appointments?pageSize=1&page=1"),
    await shapeOf("sessions", "/sessions?pageSize=1&page=1"),
    await shapeOf("cdr", "/cdr?pageSize=1&page=1"),
    await shapeOf("users", "/users?pageSize=1&page=1"),
    await shapeOf("products", "/products?pageSize=1&page=1"),
  ];

  // ---- d) Endpoint permission status (read-only probes) ----------------------
  const probe = async (path: string) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: basic, "Content-Type": "application/json" },
      });
      const message = res.ok ? "OK" : (await res.text()).slice(0, 200);
      return { endpoint: path, status: res.status, message };
    } catch (e) {
      return { endpoint: path, status: null, message: (e as Error).message };
    }
  };

  const endpointStatus = [];
  for (
    const p of [
      "/leads?pageSize=1",
      "/sales?pageSize=1",
      "/users?pageSize=1",
      "/campaigns",
      "/fields",
      "/appointments?pageSize=1",
      "/sessions?pageSize=1",
      "/cdr?pageSize=1",
      "/products?pageSize=1",
    ]
  ) {
    endpointStatus.push(await probe(p));
  }

  // ---- e) Sales debugging: many query variants, raw top-level shape ----------
  const closedByIds = new Set<string>();
  let salesSummary: Record<string, unknown> | null = null;
  {
    const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o));
    const variantDefs: Array<{ label: string; path: string }> = [
      { label: "uden parametre", path: "/sales" },
      { label: "page=1 uden pageSize", path: "/sales?page=1" },
      { label: "pageSize=5", path: "/sales?pageSize=5" },
      {
        label: 'filters createdTime $gt 2026-01-01',
        path: `/sales?filters=${enc({ createdTime: { $gt: "2026-01-01T00:00:00Z" } })}`,
      },
      {
        label: "filters campaignId $eq 118971",
        path: `/sales?filters=${enc({ campaignId: { $eq: 118971 } })}`,
      },
      {
        label: "filters campaignId $eq 118972",
        path: `/sales?filters=${enc({ campaignId: { $eq: 118972 } })}`,
      },
      {
        label: 'filters state $eq closed',
        path: `/sales?filters=${enc({ state: { $eq: "closed" } })}`,
      },
      { label: "filter[campaignId]=118971", path: "/sales?filter[campaignId]=118971" },
      { label: "campaign_id=118971", path: "/sales?campaign_id=118971" },
      { label: "campaignId=118971", path: "/sales?campaignId=118971" },
      { label: "campaignId=118972", path: "/sales?campaignId=118972" },
    ];

    const perCampaign: Record<string, number> = {};
    const perState: Record<string, number> = {};
    const variants: Array<Record<string, unknown>> = [];
    let sampleKeys: Array<{ key: string; type: string; pii_hint: boolean }> | null = null;
    let sampleLineKeys: string[] = [];
    let scopeNote: string | null = null;

    for (const v of variantDefs) {
      try {
        const res = await fetch(`${baseUrl}${v.path}`, {
          headers: { Authorization: basic, "Content-Type": "application/json" },
        });
        const text = await res.text();
        if (!res.ok) {
          variants.push({
            variant: v.label,
            status: res.status,
            count: null,
            message: text.slice(0, 200),
          });
          continue;
        }
        let data: unknown = null;
        try {
          data = JSON.parse(text);
        } catch {
          variants.push({
            variant: v.label,
            status: res.status,
            count: null,
            message: "svar var ikke gyldig JSON",
          });
          continue;
        }
        const isArr = Array.isArray(data);
        const topKeys = isArr
          ? ["(array)"]
          : data && typeof data === "object"
          ? Object.keys(data as Record<string, unknown>)
          : [typeof data];
        const rows = asArray(data, "sales", "data", "records", "items", "results");
        // Look for scope/limitation messages in the envelope (key names + short
        // message strings only — no customer data is present at this level).
        if (!isArr && data && typeof data === "object") {
          for (const [k, val] of Object.entries(data as Record<string, unknown>)) {
            if (/message|error|warning|scope|note/i.test(k) && typeof val === "string") {
              scopeNote = `${k}: ${val.slice(0, 200)}`;
            }
          }
        }
        variants.push({
          variant: v.label,
          status: res.status,
          count: rows.length,
          top_level_keys: topKeys,
          envelope_hint: isArr ? null : "data ligger muligvis under en anden nøgle",
        });
        for (const s of rows) {
          const cid = String(s.campaignId ?? s.campaign_id ?? "ukendt");
          perCampaign[cid] = (perCampaign[cid] ?? 0) + 1;
          const st = String(s.state ?? s.status ?? "(tom)");
          perState[st] = (perState[st] ?? 0) + 1;
          if (s.closedBy !== undefined && s.closedBy !== null) closedByIds.add(String(s.closedBy));
          if (!sampleKeys) {
            sampleKeys = keysOf(s);
            const lineKeys = new Set<string>();
            for (const key of ["products", "items", "saleLines", "lines"] as const) {
              for (const line of asArray(s[key])) {
                for (const k of Object.keys(line)) lineKeys.add(`${key}.${k}`);
              }
            }
            sampleLineKeys = [...lineKeys];
          }
        }
      } catch (e) {
        variants.push({ variant: v.label, status: null, count: null, message: (e as Error).message });
      }
    }

    salesSummary = {
      variant_probes: variants,
      records_found: sampleKeys !== null,
      sample_keys: sampleKeys,
      sale_line_keys: sampleLineKeys,
      per_campaign: perCampaign,
      per_state: perState,
      distinct_closed_by_count: closedByIds.size,
      scope_note: scopeNote,
    };
  }

  // ---- f) Cross-check via leads: status counts per campaign ------------------
  let leadsCrossCheck: Record<string, unknown> | null = null;
  {
    const perCampaignStatus: Record<string, Record<string, number>> = {};
    let scanned = 0;
    let successLeadKeys: unknown = null;
    let successResultFieldLabels: string[] | null = null;
    let successStatusValue: string | null = null;

    for (let page = 1; page <= 20; page++) {
      const data = await getJson(`/leads?pageSize=1000&page=${page}`);
      if (!data) break;
      const rows = asArray(data, "leads", "data");
      if (rows.length === 0) break;
      for (const lead of rows) {
        scanned++;
        const cid = String(lead.campaignId ?? "ukendt");
        const status = String(lead.status ?? "(tom)");
        perCampaignStatus[cid] ??= {};
        perCampaignStatus[cid][status] = (perCampaignStatus[cid][status] ?? 0) + 1;
        if (!successLeadKeys && /success|closed|sale/i.test(status)) {
          successStatusValue = status;
          successLeadKeys = keysOf(lead);
          successResultFieldLabels = asArray(lead.resultData).map((f) =>
            String(f.label ?? f.id ?? "(ukendt)"),
          );
        }
      }
      if (rows.length < 1000) break;
    }

    leadsCrossCheck = {
      leads_scanned: scanned,
      status_counts_per_campaign: perCampaignStatus,
      success_lead_found: successLeadKeys !== null,
      success_status_value: successStatusValue,
      success_lead_keys: successLeadKeys,
      success_lead_result_field_labels: successResultFieldLabels,
    };
  }

  // ---- g) Users: counts, domain filter and team names only -------------------
  let usersSummary: Record<string, unknown> | null = null;
  {
    const rows: Record<string, unknown>[] = [];
    for (let page = 1; page <= 10; page++) {
      const data = await getJson(`/users?pageSize=1000&page=${page}`);
      if (!data) break;
      const batch = asArray(data, "users", "data");
      if (batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (rows.length > 0) {
      const DOMAIN = "@copenhagensales.dk";
      const teamNames = new Set<string>();
      let domainCount = 0;
      let domainActive = 0;
      let overlapClosedBy = 0;
      for (const u of rows) {
        const email = String(u.email ?? u.username ?? "").toLowerCase();
        const isOurs = email.endsWith(DOMAIN);
        if (!isOurs) continue;
        domainCount++;
        const active = u.active ?? u.enabled ?? u.status;
        if (active === true || active === 1 || String(active).toLowerCase() === "active") {
          domainActive++;
        }
        const id = u.id ?? u.userId;
        if (id !== undefined && id !== null && closedByIds.has(String(id))) overlapClosedBy++;
        for (const key of ["memberOf", "teams", "groups"] as const) {
          for (const t of asArray(u[key])) {
            const n = t.name ?? t.title ?? t.label;
            if (typeof n === "string") teamNames.add(n);
          }
          const raw = u[key];
          if (Array.isArray(raw)) {
            for (const t of raw) if (typeof t === "string") teamNames.add(t);
          }
        }
      }
      usersSummary = {
        user_count_total: rows.length,
        user_count_with_copenhagensales_domain: domainCount,
        active_of_those: domainActive,
        team_names: [...teamNames],
        users_appearing_as_closed_by: overlapClosedBy,
        keys: keysOf(rows[0]),
      };
    }
  }

  return json({
    endpoint_status: endpointStatus,
    sales_summary: salesSummary,
    leads_cross_check: leadsCrossCheck,
    users_summary: usersSummary,
    ok: true,
    mode: "read-only discovery — ingen data gemt",
    account,
    base_url: baseUrl,
    campaign_count: campaigns.length,
    campaign_metadata_derived_from: derivedFrom,
    campaigns,
    global_field_definitions: globalFields,
    campaigns_with_fields: perCampaignFields,
    record_shapes: shapes,
    errors,
  });
});
