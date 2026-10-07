// Henter DB-IP Lite (land, CC BY 4.0) og gemmer kun EU/EØS-intervaller.
// Køres månedligt via cron eller manuelt af ejer. Ingen persondata.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const EEA = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO".split(" "),
);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

async function fetchCsv(): Promise<Response> {
  const now = new Date();
  for (let back = 0; back < 3; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const res = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${ym}.csv.gz`);
    if (res.ok && res.body) return res;
  }
  throw new Error("Kunne ikke hente DB-IP-listen");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;
  const { svc } = auth;

  try {
    const res = await fetchCsv();
    const stream = res.body!
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream());
    const batch = crypto.randomUUID();
    let buf = "";
    let rows: { ip_start: string; ip_end: string; country: string; batch: string }[] = [];
    const flush = async () => {
      if (!rows.length) return;
      const { error } = await svc.from("eea_ip_ranges").insert(rows);
      if (error) throw new Error(error.message);
      rows = [];
    };
    for await (const chunk of stream) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const [s, e, c] = line.trim().split(",");
        if (c && EEA.has(c)) rows.push({ ip_start: s, ip_end: e, country: c, batch });
      }
      if (rows.length >= 5000) await flush();
    }
    const [s, e, c] = buf.trim().split(",");
    if (c && EEA.has(c)) rows.push({ ip_start: s, ip_end: e, country: c, batch });
    await flush();

    const { data, error } = await svc.rpc("geo_eea_activate_batch", { _batch: batch });
    if (error) {
      await svc.from("eea_ip_ranges").delete().eq("batch", batch);
      throw new Error(error.message);
    }
    return json(200, { ok: true, ranges: data });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : "Ukendt fejl" });
  }
});
