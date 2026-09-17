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

  // Resolve base URL by probing /campaigns
  let baseUrl: string | null = null;
  let campaignsRaw: unknown = null;
  for (const candidate of BASE_URLS) {
    try {
      const res = await fetch(`${candidate}/campaigns`, {
        headers: { Authorization: basic, "Content-Type": "application/json" },
      });
      if (res.ok) {
        baseUrl = candidate;
        campaignsRaw = await res.json();
        break;
      }
      errors.push({
        endpoint: `${candidate}/campaigns`,
        status: res.status,
        message: (await res.text()).slice(0, 300),
      });
    } catch (e) {
      errors.push({ endpoint: `${candidate}/campaigns`, message: (e as Error).message });
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
  ];

  return json({
    ok: true,
    mode: "read-only discovery — ingen data gemt",
    base_url: baseUrl,
    campaign_count: campaigns.length,
    campaigns,
    global_field_definitions: globalFields,
    campaigns_with_fields: perCampaignFields,
    record_shapes: shapes,
    errors,
  });
});
