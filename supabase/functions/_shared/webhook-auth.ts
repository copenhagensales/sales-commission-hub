/**
 * Shared webhook authentication helpers.
 *
 * Two mechanisms:
 *  1. verifyWebhookSecret — shared-secret validation for provider webhooks
 *     (Adversus, dialer, e-conomic, Zapier). The secret may arrive as a header
 *     (`x-webhook-secret`, or a provider specific header) or as a query param
 *     (`secret` / `authKey`), since not all providers allow custom headers.
 *  2. verifyTwilioRequest — validates Twilio's `X-Twilio-Signature` header
 *     (HMAC-SHA1 over the full URL + sorted POST params, keyed with the
 *     account auth token) and returns the parsed params.
 */

const jsonHeaders = { "Content-Type": "application/json" };

function unauthorized(headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...headers, ...jsonHeaders },
  });
}

/**
 * Validate a shared webhook secret.
 *
 * Returns `null` when the caller is allowed, or a 401 `Response` when not.
 *
 * If the environment variable is not configured the webhook stays open and a
 * warning is logged — this keeps the (business critical) sales pipeline running
 * until the secret has been configured on both sides. Configure the secret to
 * activate enforcement.
 */
export function verifyWebhookSecret(
  req: Request,
  envName: string,
  opts: { headerNames?: string[]; queryNames?: string[]; corsHeaders?: Record<string, string> } = {},
): Response | null {
  const expected = Deno.env.get(envName);
  if (!expected) {
    console.warn(
      `[webhook-auth] ${envName} is not configured — webhook is accepting unauthenticated calls. ` +
        `Configure ${envName} and set the same value in the provider to enable enforcement.`,
    );
    return null;
  }

  const headerNames = opts.headerNames ?? ["x-webhook-secret"];
  const queryNames = opts.queryNames ?? ["secret"];

  let received: string | null = null;
  for (const name of headerNames) {
    received = req.headers.get(name);
    if (received) break;
  }
  if (!received) {
    const url = new URL(req.url);
    for (const name of queryNames) {
      received = url.searchParams.get(name);
      if (received) break;
    }
  }

  if (!received || received !== expected) {
    console.error(`[webhook-auth] Rejected call: missing or invalid ${envName}`);
    return unauthorized(opts.corsHeaders);
  }
  return null;
}

async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export type TwilioVerification =
  | { ok: true; params: URLSearchParams; raw: string }
  | { ok: false; response: Response };

/**
 * Verify that a request genuinely originates from Twilio and return the parsed
 * form parameters. Consumes the request body, so callers must use the returned
 * `params` instead of `req.formData()`.
 */
export async function verifyTwilioRequest(
  req: Request,
  corsHeaders: Record<string, string> = {},
): Promise<TwilioVerification> {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    console.error("[webhook-auth] TWILIO_AUTH_TOKEN missing — rejecting Twilio webhook");
    return { ok: false, response: unauthorized(corsHeaders) };
  }

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) {
    console.error("[webhook-auth] Missing X-Twilio-Signature header");
    return { ok: false, response: unauthorized(corsHeaders) };
  }

  // Twilio signerer den præcise URL den er konfigureret med. Inde i edge-runtime
  // er req.url typisk http://localhost:9999/<function>, så den offentlige URL
  // skal rekonstrueres. Vi prøver alle realistiske varianter.
  const reqUrl = new URL(req.url);
  const search = reqUrl.search;
  const rawPath = reqUrl.pathname.replace(/\/+$/, "");
  const fnName = rawPath.replace(/^\/functions\/v1/, "").replace(/^\//, "");

  const origins = new Set<string>();
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (forwardedHost && !/^localhost(:|$)/.test(forwardedHost)) origins.add(`https://${forwardedHost}`);
  const configuredBase = Deno.env.get("TWILIO_WEBHOOK_BASE_URL");
  if (configuredBase) origins.add(configuredBase.replace(/\/+$/, ""));
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) origins.add(new URL(supabaseUrl).origin);

  const candidates = new Set<string>();
  for (const origin of origins) {
    for (const path of [`/functions/v1/${fnName}`, `/${fnName}`]) {
      candidates.add(`${origin}${path}${search}`);
      candidates.add(`${origin}${path}`);
    }
  }
  // Fallback: den oprindelige adfærd, hvis intet af ovenstående matcher.
  candidates.add(`${reqUrl.origin}${rawPath}${search}`);

  const sortedKeys = [...new Set([...params.keys()])].sort();
  const suffix = sortedKeys.map((k) => k + params.getAll(k).join("")).join("");

  for (const base of candidates) {
    const expected = await hmacSha1Base64(authToken, base + suffix);
    if (expected === signature) {
      return { ok: true, params, raw };
    }
  }

  console.error("[webhook-auth] Invalid Twilio signature — request rejected", {
    triedCandidates: [...candidates],
    paramKeys: sortedKeys,
  });


  console.error("[webhook-auth] Invalid Twilio signature — request rejected");
  return { ok: false, response: unauthorized(corsHeaders) };
}
