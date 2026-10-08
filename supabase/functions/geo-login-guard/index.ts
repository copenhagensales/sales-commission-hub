// EU/EØS-spærre ved login. Slår klientens IP op i eea_ip_ranges.
// IP uden for EU/EØS-listen -> sessionen tilbagekaldes server-side.
// Ingen IP eller fejl i opslaget -> lukkes ind (tvivl kommer brugeren til gode).
// IP-adressen gemmes ikke.
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

const DENIED_MSG = "Stork kan kun bruges fra EU/EØS";

function clientIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;
  const { userId, svc } = auth;
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

  // Test-override kun med cron-secret (bruges til at simulere lande).
  let ip = clientIp(req);
  const testIp = req.headers.get("x-geo-test-ip");
  const cronSecret = req.headers.get("x-cron-secret");
  if (testIp !== null && cronSecret) {
    const { data: ok } = await svc.rpc("verify_internal_cron_secret", { _token: cronSecret });
    if (ok === true) ip = testIp || null;
  }

  let country: string | null = null;
  let reason = "no_ip";
  if (ip) {
    const { data, error } = await svc.rpc("geo_ip_in_eea", { _ip: ip });
    if (error) reason = "lookup_failed";
    else if (data) country = data as string;
    else reason = "outside_eea";
  }

  if (country) return json(200, { allowed: true, country });
  // Tvivl (ingen IP eller opslag fejlede) = luk ind. Kun påvist udenfor afvises.
  if (reason !== "outside_eea") return json(200, { allowed: true, reason });

  await svc.from("geo_login_denials").insert({ user_id: userId, reason });
  if (!testIp) await svc.auth.admin.signOut(token, "global");
  return json(200, { allowed: false, reason, message: DENIED_MSG });
});
