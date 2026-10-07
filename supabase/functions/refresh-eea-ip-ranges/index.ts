// Henter DB-IP Lite (land, CC BY 4.0). Funktionen pakker kun ud og sender
// tekst-bidder til databasen, som filtrerer EU/EØS (edge har lav CPU-grænse).
// Køres månedligt via cron eller manuelt af ejer. Ingen persondata.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const CHUNK_CHARS = 2_000_000;

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
  const batch = crypto.randomUUID();

  try {
    const res = await fetchCsv();
    const stream = res.body!
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream());
    let buf = "";
    let total = 0;
    const send = async (text: string) => {
      const { data, error } = await svc.rpc("geo_eea_ingest_chunk", { _batch: batch, _csv: text });
      if (error) throw new Error(error.message);
      total += (data as number) ?? 0;
    };
    for await (const chunk of stream) {
      buf += chunk;
      if (buf.length >= CHUNK_CHARS) {
        const cut = buf.lastIndexOf("\n");
        await send(buf.slice(0, cut));
        buf = buf.slice(cut + 1);
      }
    }
    if (buf.trim()) await send(buf);

    const { data, error } = await svc.rpc("geo_eea_activate_batch", { _batch: batch });
    if (error) throw new Error(error.message);
    return json(200, { ok: true, ranges: data, inserted: total });
  } catch (err) {
    await svc.from("eea_ip_ranges").delete().eq("batch", batch);
    return json(500, { error: err instanceof Error ? err.message : "Ukendt fejl" });
  }
});
