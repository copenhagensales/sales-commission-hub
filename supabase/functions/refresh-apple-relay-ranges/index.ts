// Indlæser Apples iCloud Privat videresendelse-relæadresser (kun EU/EØS-lande)
// i apple_relay_eea_ranges, så geo-login-guard bruger brugerens reelle land.
// Kilde: Apples offentlige liste. Kun ejer eller cron. Ingen persondata.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const SOURCE = "https://mask-api.icloud.com/egress-ip-ranges.csv";
const EEA = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO".split(" "),
);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  const { svc } = auth;

  try {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`Apple-listen svarede ${res.status}`);
    const text = await res.text();
    const rows: { net: string; country: string; loaded_at: string }[] = [];
    const now = new Date().toISOString();
    for (const line of text.split("\n")) {
      const [net, country] = line.split(",");
      if (net && country && EEA.has(country)) rows.push({ net: net.trim(), country, loaded_at: now });
    }
    if (rows.length < 1000) throw new Error(`For få rækker (${rows.length}) — afbryder`);

    for (let i = 0; i < rows.length; i += 2000) {
      const { error } = await svc.from("apple_relay_eea_ranges").upsert(rows.slice(i, i + 2000), { onConflict: "net" });
      if (error) throw new Error(error.message);
    }
    // Fjern adresser Apple ikke længere opgiver som EU/EØS.
    const { error: delErr } = await svc.from("apple_relay_eea_ranges").delete().lt("loaded_at", now);
    if (delErr) throw new Error(delErr.message);
    return json(200, { ok: true, ranges: rows.length });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : "Ukendt fejl" });
  }
});
