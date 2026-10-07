// Indlæser EU/EØS-IP-intervaller (DB-IP Lite, CC BY 4.0) fra den private
// bucket geo-data/eea-ranges.csv (forbehandlet: start,slut,EEA).
// Den rå DB-IP-fil er for tung at pakke ud i en edge-funktion, så filen
// forberedes uden for funktionen. Kun ejer eller cron. Ingen persondata.
import { requireCronOrOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const CHUNK_CHARS = 1_000_000;

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
  const batch = crypto.randomUUID();

  try {
    const { data: file, error: dlErr } = await svc.storage.from("geo-data").download("eea-ranges.csv");
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Filen mangler");
    const text = await file.text();
    let pos = 0;
    while (pos < text.length) {
      let end = Math.min(pos + CHUNK_CHARS, text.length);
      if (end < text.length) end = text.lastIndexOf("\n", end) + 1;
      const { error } = await svc.rpc("geo_eea_ingest_chunk", { _batch: batch, _csv: text.slice(pos, end) });
      if (error) throw new Error(error.message);
      pos = end;
    }
    const { data, error } = await svc.rpc("geo_eea_activate_batch", { _batch: batch });
    if (error) throw new Error(error.message);
    return json(200, { ok: true, ranges: data });
  } catch (err) {
    await svc.from("eea_ip_ranges").delete().eq("batch", batch);
    return json(500, { error: err instanceof Error ? err.message : "Ukendt fejl" });
  }
});
