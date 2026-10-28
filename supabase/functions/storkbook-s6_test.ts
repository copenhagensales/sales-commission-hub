// S6 (leverance A + A2): kontrakt- og handlerprøver UDEN netværk og uden produktionskald.
// Deno.serve stubbes før dynamisk import (ingen server startes); handlerne fanges og kaldes med Request-objekter.
// globalThis.fetch erstattes KUN i prøverne af en mock; ukendt adresse får prøven til at fejle.
// SQL-adfærd (kø, register, slet_tidligst) er MOCKET i JS – det er ikke kørte SQL-prøver.
// Tid styres med FakeTime (std testing/time); ingen rigtige ventetider.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakeTime } from "https://deno.land/std@0.224.0/testing/time.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Handler = (r: Request) => Promise<Response>;
const fangede: Handler[] = [];
(Deno as unknown as { serve: unknown }).serve = (a: unknown, b?: unknown) => {
  fangede.push((typeof a === "function" ? a : b) as Handler);
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
const MOCK = "http://mock.test";
Deno.env.set("SUPABASE_URL", MOCK);
Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-test");
Deno.env.set("LOVABLE_API_KEY", "gw-test");
Deno.env.delete("SB_TJEK_STUB");

const tjek = await import("./storkbook-tjek/index.ts");
const hTjek = fangede[fangede.length - 1];
const fil = await import("./sb-fil/index.ts");
const hFil = fangede[fangede.length - 1];
const opr = await import("./beskeder-oprydning/index.ts");
const hOpr = fangede[fangede.length - 1];
const wrk = await import("./storkbook-udsendelser/index.ts");
const ft = await import("./_shared/sb-filtype.ts");
const bud = await import("./_shared/sb-budget.ts");

// Hver prøve nulstiller listen over ukendte/umockede kald ved start og FEJLER, hvis der efter prøven er
// registreret et ukendt kald – også når SDK/handler har fanget fetch-exceptionen.
// Sanitizers er som standard SLÅET TIL. Undtagelse: se `klientTest` nedenfor.
const medKontrol = (fn: () => void | Promise<void>) => async () => { ukendt = []; await fn(); assertEquals(ukendt, [], "ukendt/umocket request i prøven"); };
const test = (name: string, fn: () => void | Promise<void>) => Deno.test({ name, fn: medKontrol(fn) });
// Sanitizer-undtagelse – KUN prøver, der kalder sb-fil-handleren (navne begynder med "§n sb-fil:" samt
// "§1 stateful mock"): sb-fils eksisterende brugerklient (createClient uden budgetIndstillinger, auth med
// standard autoRefreshToken) starter et auto-refresh-interval, som ikke ryddes inden prøven slutter.
// sb-fils produktionsauth ændres ikke for at gøre prøverne grønne. Ingen netværkskald følger af det –
// fetch-mocken registrerer alle kald, og medKontrol fejler ved ukendte kald. Alle øvrige prøver kører med sanitizers.
const klientTest = (name: string, fn: () => void | Promise<void>) => Deno.test({ name, fn: medKontrol(fn), sanitizeOps: false, sanitizeResources: false });
const flush = async (time: FakeTime) => { for (let i = 0; i < 20; i++) await time.tickAsync(0); };

// ---------------------------------------------------------------- mock-infrastruktur
type Kald = { metode: string; sti: string; url: URL; krop: string; headers: Headers; signal: AbortSignal | null; t: number };
type Rute = (k: Kald) => Promise<Response | undefined> | Response | undefined;
let rute: Rute = () => undefined;
let kald: Kald[] = [];
let ukendt: string[] = [];
const ægteFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin !== MOCK && url.origin !== "https://ai.gateway.lovable.dev") { ukendt.push(url.origin); throw new Error("ukendt netværksadresse i prøve"); }
  if (req.signal.aborted) throw req.signal.reason;
  const k: Kald = { metode: req.method, sti: url.pathname, url, krop: req.body ? await req.text() : "", headers: req.headers, signal: init?.signal ?? req.signal, t: Date.now() };
  kald.push(k);
  const r = await rute(k);
  if (!r) { ukendt.push(`${req.method} ${url.pathname}`); throw new Error("ingen mockrute"); }
  return r;
}) as typeof fetch;
void ægteFetch;

const nulstil = (r: Rute) => { rute = r; kald = []; };
const jsonR = (b: unknown, status = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...h } });
const tom = (status = 204) => new Response(null, { status });
const fejlR = () => jsonR({ message: "mockfejl", code: "XX000" }, 500);
/** Venter (fake) ms; afvises ved abort på kaldets signal. */
const vent = (ms: number, s: AbortSignal | null) => new Promise<void>((res, rej) => {
  if (s?.aborted) return rej(s.reason);
  const t = setTimeout(res, ms);
  s?.addEventListener("abort", () => { clearTimeout(t); rej(s.reason); }, { once: true });
});
const hænger = (s: AbortSignal | null) => new Promise<never>((_, rej) => s?.addEventListener("abort", () => rej(s.reason), { once: true }));
const tabel = (k: Kald, navn: string) => k.sti === `/rest/v1/${navn}`;
const rpc = (k: Kald, navn: string) => k.sti === `/rest/v1/rpc/${navn}`;
const kaldTil = (pred: (k: Kald) => boolean) => kald.filter(pred);
const ingenUkendte = () => assertEquals(ukendt, []);

let uidNr = 0;
const fælles = (k: Kald): Response | undefined => {
  if (k.sti === "/auth/v1/user") return jsonR({ id: `00000000-0000-4000-8000-${String(++uidNr).padStart(12, "0")}`, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
  if (rpc(k, "get_current_employee_id")) return jsonR("e1");
  if (tabel(k, "employee_master_data")) return jsonR([{ is_active: true }]);
  return undefined;
};

/** Kører en handler under FakeTime til den svarer (eller maks fake-ms). */
async function kørFake(h: Handler, req: Request, time: FakeTime, maks = 120_000): Promise<{ res: Response; ms: number }> {
  const t0 = Date.now();
  let res: Response | null = null;
  h(req).then((r) => { res = r; });
  while (!res && Date.now() - t0 < maks) await time.tickAsync(25);
  assert(res, "handler svarede ikke inden for fake-tiden");
  return { res: res as Response, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- eksisterende kontraktprøver (A)
test("tjek: gyldige domme for alle fem begrundelsesveje", () => {
  assertEquals(tjek.validerDom({ tone: "ok", personoplysninger: "ingen", cpr: false }), { tone: "ok", personoplysninger: "ingen", cpr: false });
  assert(tjek.validerDom({ tone: "haard", personoplysninger: "ingen", type: "truende", cpr: false }));
  assert(tjek.validerDom({ tone: "ok", personoplysninger: "fundet", type: "telefon", cpr: false }));
  assert(tjek.validerDom({ tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: true }));
});

test("tjek: ugyldige/modstridende domme afvises (→ ukendt)", () => {
  for (const x of [null, [], "ok", { tone: "ok" }, { tone: "ok", personoplysninger: "ingen", cpr: "false" },
    { tone: "ok", personoplysninger: "ingen", cpr: true }, { tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: false },
    { tone: "ok", personoplysninger: "ingen", type: "chikane", cpr: false }, { tone: "haard", personoplysninger: "ingen", type: "email", cpr: false },
    { tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: true }, { tone: "ok", personoplysninger: "ingen", cpr: false, type: "x" }]) {
    assertEquals(tjek.validerDom(x), null);
  }
  assertEquals(tjek.UKENDT, { tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: false, udfald: "ukendt" });
  assertEquals(tjek.MAKS_OUTPUT_TOKENS, 200);
});

test("Content-Disposition er sikker og tvinger faktisk endelse", () => {
  const d = fil.disposition('ond"\r\nX: y.html', "text/plain");
  assert(!/[\r\n]/.test(d));
  assert(d.startsWith('attachment; filename="'));
  assert(d.includes(".txt"));
  assert(!d.includes(".html"));
  assert(fil.disposition(null, "image/png").startsWith('inline; filename="fil.png"'));
});

test("Range: 206-grænser og 416", () => {
  assertEquals(fil.range(null, 10), null);
  assertEquals(fil.range("bytes=0-3", 10), { start: 0, slut: 3 });
  assertEquals(fil.range("bytes=5-", 10), { start: 5, slut: 9 });
  assertEquals(fil.range("bytes=-4", 10), { start: 6, slut: 9 });
  assertEquals(fil.range("bytes=2-99", 10), { start: 2, slut: 9 });
  for (const h of ["bytes=10-", "bytes=5-2", "bytes=0-1,3-4", "items=0-1", "bytes=-", "bytes=-0"]) assertEquals(fil.range(h, 10), "ugyldig");
});

test("tokenudløb læses fra JWT-payload", () => {
  const p = btoa(JSON.stringify({ exp: 1900000000 })).replace(/=+$/, "");
  assertEquals(fil.tokenUdloeb(`x.${p}.y`), 1900000000);
  assertEquals(fil.tokenUdloeb("ugyldig"), null);
  assertEquals(fil.TYPER.pdf, undefined);
});

test("oprydning: konstant-tid og tidsvindue 03–04 dansk", () => {
  assert(opr.ensKonstantTid("abc", "abc"));
  assert(!opr.ensKonstantTid("abc", "abd"));
  assert(!opr.ensKonstantTid("abc", "abcd"));
  assert(opr.iOptaellingsvindue(new Date("2026-10-28T02:30:00Z")));
  assert(!opr.iOptaellingsvindue(new Date("2026-10-28T03:30:00Z")));
});

test("worker: tjek-mapping (kilde_type = underliggende indhold, modtager = afsender)", () => {
  const k = wrk.tjekKandidater([
    { id: "h1", tid: "t", kilde: "besked", kilde_id: "m1", revision: 2, type: "afventer", employee_id: "e1" },
    { id: "h2", tid: "t", kilde: "tjek", kilde_id: "m2", revision: 1, type: "afventer", employee_id: "e1" },
    { id: "h3", tid: "t", kilde: "besked", kilde_id: "m3", revision: 0, type: "udloeb", employee_id: "e1" },
    { id: "h4", tid: "t", kilde: "opslag", kilde_id: "p1", revision: 1, type: "udloeb", employee_id: "e2" },
  ]);
  assertEquals(k.length, 2);
  assertEquals(k[0].haendelse, "tjek:besked:m1:2:afventer");
  assertEquals(k[0].kilde_type, "besked");
  assertEquals(k[0].kilde_id, "m1");
  assertEquals(k[0].modtager_employee_id, "e1");
  assertEquals(k[0].afsender_employee_id, null);
  assertEquals(k[0].type_noegle, "storkbook_tjek");
  assertEquals(k[0].metadata, { revision: 2, tjek_type: "afventer" });
  assertEquals(k[1].kilde_type, "opslag");
});

test("worker: indhold med feltet status er ikke et Afslut", () => {
  assert(wrk.erAfslut({ status: "annulleret", aarsag: "x" }));
  assert(!wrk.erAfslut({ id: "p", status: "leveret" }));
  assert(!wrk.erAfslut({ title: "t", body: "b", status: "leveret" }));
  assert(wrk.erLeveret({ status: "leveret", slettes_efter: null }));
  assert(!wrk.erLeveret({ status: "tjekkes", slettes_efter: null }));
  assert(!wrk.erLeveret({ status: "leveret", slettes_efter: "2000-01-01T00:00:00Z" }));
});

// ---------------------------------------------------------------- §4 filtype (helper)
const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...a: (Uint8Array | number[])[]) => { const ud: number[] = []; for (const x of a) ud.push(...x); return new Uint8Array(ud); };
const BOM = [0xef, 0xbb, 0xbf];

test("§4 filtype: billeder uændrede, tekst accepteres", () => {
  assertEquals(ft.filtype(new Uint8Array([0xff, 0xd8, 0xff, 0])), "image/jpeg");
  assertEquals(ft.filtype(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assertEquals(ft.filtype(enc("GIF89a")), "image/gif");
  assertEquals(ft.filtype(cat(enc("RIFF"), [0, 0, 0, 0], enc("WEBP"))), "image/webp");
  assertEquals(ft.filtype(enc("hej")), "text/plain");
  assertEquals(ft.filtype(cat(BOM, enc("Almindelig tekst æøå"))), "text/plain");
  assertEquals(ft.filtype(enc("Se fx eksemplet <html><body> længere inde i prosa.")), "text/plain");
  assertEquals(ft.filtype(enc("2 < 3 og a<b")), "text/plain");
  assertEquals(ft.filtype(new Uint8Array([0x68, 0, 0x69])), null);
  assertEquals(ft.filtype(new Uint8Array([0xc3, 0x28])), null);
});

test("§4 filtype: PDF afvises også uden NUL og efter indledende bytes", () => {
  assertEquals(ft.filtype(enc("%PDF-1.4\n1 0 obj << >> endobj\ntrailer\n%%EOF")), null);
  assertEquals(ft.filtype(cat(BOM, enc("\r\n\n  %PDF-1.7\n"))), null);
  assertEquals(ft.filtype(cat(enc("x".repeat(900)), enc("%PDF-1.3"))), null);
  assertEquals(ft.filtype(cat(enc("x".repeat(1100)), enc("%PDF-1.3"))), "text/plain"); // efter 1.024 bytes: prosa
});

test("§4 filtype: alle dokument-/arkivsignaturer afvises (byteværdier)", () => {
  for (const sig of [[0x50, 0x4b, 3, 4], [0x50, 0x4b, 5, 6], [0x50, 0x4b, 7, 8], [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    [0x1f, 0x8b, 8], [0x52, 0x61, 0x72, 0x21, 0x1a, 7, 0], [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]]) {
    assertEquals(ft.filtype(cat(sig, enc("abc"))), null, `signatur ${sig}`);
  }
  assertEquals(ft.filtype(enc("PK\\x03\\x04 er bare tekst")), "text/plain"); // bogstavelig tekst er ikke signaturen
  for (const t of ["{\\rtf1\\ansi hej}", "  {\\RTF1 x}", "%!PS-Adobe-3.0", "%!ps"]) assertEquals(ft.filtype(enc(t)), null, t);
});

test("§4 filtype: markup ved begyndelsen afvises (kommentar, deklaration, fragment, XML uden <?xml)", () => {
  for (const t of ["<!-- k --><html></html>", "<!DOCTYPE html><p>x", "<?xml version='1.0'?><a/>", "<svg xmlns='x'></svg>",
    "<!-- kommentar -->\n<svg></svg>", "<div>fragment</div>", "<rod><barn/></rod>", "</p>", "<HTML>", "\n\t <Svg>"]) {
    assertEquals(ft.filtype(enc(t)), null, t);
    assertEquals(ft.filtype(cat(BOM, enc(t))), null, `BOM+${t}`);
  }
  // Ægte tekst med dokumentpræfiks afvises som besluttet (konservativt værn).
  assertEquals(ft.filtype(enc("<b>Husk</b> mødet i morgen")), null);
});

// ---------------------------------------------------------------- §5 Content-Disposition
test("§5 disposition: kodepunkter, surrogater og RFC 5987", () => {
  const d = fil.disposition("a".repeat(99) + "😀.png", "image/png");
  const enc5987 = /filename\*=UTF-8''([^;]+)$/.exec(d)![1];
  assertEquals(decodeURIComponent(enc5987), "a".repeat(99) + "😀.png");
  const lang = fil.disposition("ø".repeat(150) + ".txt", "text/plain");
  assertEquals(Array.from(decodeURIComponent(/filename\*=UTF-8''([^;]+)$/.exec(lang)![1])).length, 104);
  const s = fil.disposition("x\uD800y\uDC00z😀.png", "image/png");
  assertEquals(decodeURIComponent(/filename\*=UTF-8''([^;]+)$/.exec(s)![1]), "xyz😀.png");
  assert(fil.disposition("chef's (ny)*.txt", "text/plain").endsWith("filename*=UTF-8''chef%27s%20%28ny%29%2A.txt"));
  assert(fil.disposition("Æble Øl.png", "image/png").includes("%C3%86ble%20%C3%98l.png"));
});

// ---------------------------------------------------------------- sb-fil laes (handler)
const MID = "11111111-2222-4333-8444-555555555555";
type FilOps = { sti?: string; navn?: string; info?: (k: Kald) => Response | Promise<Response>; download?: (k: Kald) => Response | Promise<Response> };
function laesRute(o: FilOps): Rute {
  const sti = o.sti ?? "c/e1/x.png";
  return (k) => fælles(k) ?? (tabel(k, "chat_messages") ? jsonR([{ id: MID, attachment_path: sti, attachment_name: o.navn ?? "foto.png", deleted_at: null, slettes_efter: null, status: "leveret" }])
    : tabel(k, "sb_stier") ? jsonR([{ status: "bundet", besked_id: MID }])
    : k.sti === `/storage/v1/object/info/chat-attachments/${sti}` ? o.info?.(k)
    : k.sti === `/storage/v1/object/chat-attachments/${sti}` ? o.download?.(k) : undefined);
}
const laesReq = (range?: string) => new Request(`${MOCK}/functions/v1/sb-fil?action=laes&message_id=${MID}`, { headers: { Authorization: "Bearer jwt-test", ...(range ? { Range: range } : {}) } });
const downloads = () => kaldTil((k) => k.sti.startsWith("/storage/v1/object/chat-attachments/")).length;
const png = (n: number) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };
const info = (size: unknown) => () => jsonR(size === undefined ? { name: "x" } : { name: "x", size });

klientTest("§2 sb-fil: præcis 10 MiB godkendes, 10 MiB+1 afvises uden download", async () => {
  const N = 10 * 1024 * 1024;
  nulstil(laesRute({ info: info(N), download: () => new Response(png(N)) }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 200); assertEquals((await r.arrayBuffer()).byteLength, N); ingenUkendte();
  nulstil(laesRute({ info: info(N + 1), download: () => new Response(png(N + 1)) }));
  const r2 = await hFil(laesReq());
  assertEquals(r2.status, 410); assertEquals(await r2.json(), { kode: "vaek" }); assertEquals(downloads(), 0); ingenUkendte();
});

klientTest("§2 sb-fil: .txt på præcis 20 KiB godkendes, 20 KiB+1 afvises uden download", async () => {
  const N = 20 * 1024;
  nulstil(laesRute({ sti: "c/e1/n.txt", navn: "n.txt", info: info(N), download: () => new Response(enc("a".repeat(N))) }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 200); assertEquals(r.headers.get("Content-Type"), "text/plain"); await r.body?.cancel();
  nulstil(laesRute({ sti: "c/e1/n.txt", navn: "n.txt", info: info(N + 1), download: () => new Response(enc("a".repeat(N + 1))) }));
  const r2 = await hFil(laesReq());
  assertEquals(r2.status, 410); assertEquals(downloads(), 0); ingenUkendte();
});

klientTest("§2 sb-fil: ukendt størrelse (null, streng, negativ, manglende felt, 404, exception) → 410 uden download", async () => {
  const varianter: (() => Response | Promise<Response>)[] = [info(null), info("5"), info(-1), info(undefined), info(1.5),
    () => jsonR({ statusCode: "404", error: "not_found", message: "Object not found" }, 404), () => { throw new Error("transport"); }];
  for (const v of varianter) {
    nulstil(laesRute({ info: v, download: () => new Response(png(10)) }));
    const r = await hFil(laesReq());
    assertEquals(r.status, 410); assertEquals(await r.json(), { kode: "vaek" }); assertEquals(downloads(), 0);
  }
});

klientTest("§2 sb-fil: fuld sti med flere punktummer; info-respons med data.size", async () => {
  const sti = "c/e1/a.b.c.png";
  nulstil(laesRute({ sti, info: info(16), download: () => new Response(png(16)) }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 200); assertEquals((await r.arrayBuffer()).byteLength, 16);
  assertEquals(kaldTil((k) => k.sti === `/storage/v1/object/info/chat-attachments/${sti}`).length, 1); ingenUkendte();
});

klientTest("§2 sb-fil: lille metadata men for stor stream → reader annulleres tidligt, 410", async () => {
  let træk = 0, annulleret = false;
  const strøm = () => new Response(new ReadableStream<Uint8Array>({
    pull(c) { træk++; c.enqueue(træk === 1 ? png(1024) : new Uint8Array(1024)); },
    cancel() { annulleret = true; },
  }));
  nulstil(laesRute({ info: info(1500), download: strøm }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 410); assert(annulleret, "reader blev ikke annulleret"); assert(træk <= 5, `for mange træk: ${træk}`); // få chunks pga. stream-buffering, ikke hele objektet
});

klientTest("§2 sb-fil: for kort, afbrudt stream og størrelsesafvigelse → 410", async () => {
  nulstil(laesRute({ info: info(100), download: () => new Response(png(50)) }));
  assertEquals((await hFil(laesReq())).status, 410);
  nulstil(laesRute({ info: info(100), download: () => new Response(new ReadableStream({ start(c) { c.enqueue(png(20)); c.error(new Error("afbrudt")); } })) }));
  assertEquals((await hFil(laesReq())).status, 410);
  nulstil(laesRute({ info: info(100), download: () => fejlR() }));
  assertEquals((await hFil(laesReq())).status, 410);
});

klientTest("§2 sb-fil: faktisk tekst over 20 KiB med misvisende endelse → 410", async () => {
  const N = 30 * 1024;
  nulstil(laesRute({ sti: "c/e1/x.png", info: info(N), download: () => new Response(enc("a".repeat(N))) }));
  assertEquals((await hFil(laesReq())).status, 410);
});

klientTest("§2 sb-fil: gyldige 200/206/416-forløb bevares på den komplette fil", async () => {
  const fuld = png(32); for (let i = 8; i < 32; i++) fuld[i] = i;
  const dl = () => kaldTil((k) => k.sti.startsWith("/storage/v1/object/chat-attachments/"));
  const metaFør = () => { const i = kald.findIndex((k) => k.sti.startsWith("/storage/v1/object/info/")), d = kald.findIndex((k) => k.sti.startsWith("/storage/v1/object/chat-attachments/")); assert(i >= 0 && d > i, "metadata før download"); };
  nulstil(laesRute({ info: info(32), download: () => new Response(fuld.slice()) }));
  const r = await hFil(laesReq("bytes=4-11"));
  assertEquals(r.status, 206); assertEquals(r.headers.get("Content-Range"), "bytes 4-11/32"); assertEquals(r.headers.get("Content-Length"), "8");
  assertEquals(new Uint8Array(await r.arrayBuffer()), fuld.slice(4, 12));
  assertEquals(dl().length, 1); assertEquals(dl()[0].headers.get("range"), null, "klient-Range sendt videre til Storage"); assert(!dl()[0].url.searchParams.has("range")); metaFør();
  nulstil(laesRute({ info: info(32), download: () => new Response(fuld.slice()) }));
  const r2 = await hFil(laesReq("bytes=40-"));
  assertEquals(r2.status, 416); assertEquals(r2.headers.get("Content-Range"), "bytes */32"); await r2.body?.cancel();
  assertEquals(dl().length, 1); assertEquals(dl()[0].headers.get("range"), null, "klient-Range sendt videre til Storage (416)"); metaFør();
  nulstil(laesRute({ info: info(32), download: () => new Response(png(32)) }));
  const r3 = await hFil(laesReq());
  assertEquals(r3.status, 200); assertEquals(r3.headers.get("X-Content-Type-Options"), "nosniff"); await r3.body?.cancel();
});

klientTest("§4 sb-fil: ASCII-PDF uden NUL som .txt → 410 type_afvist", async () => {
  const pdf = enc("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF");
  nulstil(laesRute({ sti: "c/e1/d.txt", info: info(pdf.length), download: () => new Response(pdf) }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 410); assertEquals(await r.json(), { kode: "vaek" });
});

klientTest("§5 sb-fil: Content-Disposition gennem handleren (emoji, surrogater, '()*)", async () => {
  for (const [navn, forventet] of [["a".repeat(99) + "😀.png", "a".repeat(99) + "😀.png"], ["x\uD800\uDC00\uDC00y.png", "x\u{10000}y.png"], ["Æ😀 ø.png", "Æ😀 ø.png"]] as const) {
    nulstil(laesRute({ navn, info: info(16), download: () => new Response(png(16)) }));
    const r = await hFil(laesReq());
    assertEquals(r.status, 200);
    const cd = r.headers.get("Content-Disposition")!;
    assert(!/[\r\n]/.test(cd));
    assertEquals(decodeURIComponent(/filename\*=UTF-8''([^;]+)$/.exec(cd)![1]), forventet);
    await r.body?.cancel();
  }
  nulstil(laesRute({ sti: "c/e1/t.txt", navn: "chef's (ny)*.html", info: info(3), download: () => new Response(enc("hej")) }));
  const r = await hFil(laesReq());
  assertEquals(r.status, 200);
  assert(r.headers.get("Content-Disposition")!.endsWith("filename*=UTF-8''chef%27s%20%28ny%29%2A.txt"));
  await r.body?.cancel();
});

const CRON = "cron-test";
const CRON_HASH = await (async () => [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc(CRON)))].map((b) => b.toString(16).padStart(2, "0")).join(""))();
const oprReq = (body = "{}") => new Request(`${MOCK}/functions/v1/beskeder-oprydning`, { method: "POST", headers: { "x-pulsen-cron-token": CRON }, body });
// ---------------------------------------------------------------- §1 sb-fil udsted/opryd (handler)
const KONV = "22222222-3333-4444-8555-666666666666";
const udstedReq = () => new Request(`${MOCK}/functions/v1/sb-fil`, { method: "POST", headers: { Authorization: "Bearer jwt-test", "Content-Type": "application/json" },
  body: JSON.stringify({ action: "udsted", conversation_id: KONV, filnavn: "a.png", type: "image/png", size: 10 }) });
function udstedRute(koe: (k: Kald) => Response | Promise<Response>, patch: (k: Kald) => Response = () => tom()): Rute {
  return (k) => fælles(k) ?? (tabel(k, "chat_conversation_members") ? jsonR([{ id: "m" }])
    : tabel(k, "sb_stier") && k.metode === "POST" ? tom(201)
    : tabel(k, "sb_stier") && k.metode === "PATCH" ? patch(k)
    : k.sti.startsWith("/storage/v1/object/upload/sign/") ? fejlR()
    : rpc(k, "sb_koe_fil") ? koe(k) : undefined);
}
const statusPatches = () => kaldTil((k) => tabel(k, "sb_stier") && k.metode === "PATCH");

klientTest("§1 sb-fil: køfejl som {error} → ingen statusopdatering, 500 token_fejl, intet token", async () => {
  nulstil(udstedRute(() => fejlR()));
  const r = await hFil(udstedReq());
  assertEquals(r.status, 500); const b = await r.json(); assertEquals(b, { kode: "token_fejl" }); assert(!("token" in b));
  assertEquals(statusPatches().length, 0); ingenUkendte();
});

klientTest("§1 sb-fil: køfejl som exception → ingen statusopdatering, 500 token_fejl", async () => {
  nulstil(udstedRute(() => { throw new Error("transport"); }));
  const r = await hFil(udstedReq());
  assertEquals(r.status, 500); assertEquals(await r.json(), { kode: "token_fejl" }); assertEquals(statusPatches().length, 0);
});

klientTest("§1 sb-fil: køsucces med data=null (void) → statusopdatering forsøges på bucket/sti/uploadet", async () => {
  nulstil(udstedRute(() => tom(204)));
  const r = await hFil(udstedReq());
  assertEquals(r.status, 500); assertEquals(await r.json(), { kode: "token_fejl" });
  const p = statusPatches(); assertEquals(p.length, 1);
  assertEquals(JSON.parse(p[0].krop), { status: "slettes" });
  assertEquals(p[0].url.searchParams.get("status"), "eq.uploadet"); assertEquals(p[0].url.searchParams.get("bucket"), "eq.chat-attachments");
  // Køen kaldes FØR statusændringen.
  const ik = kald.findIndex((k) => rpc(k, "sb_koe_fil")), ip = kald.findIndex((k) => tabel(k, "sb_stier") && k.metode === "PATCH");
  assert(ik >= 0 && ik < ip);
});

klientTest("§1 sb-fil: køsucces + statusfejl → køhensigt bevares (ingen kompensation), 500", async () => {
  nulstil(udstedRute(() => tom(204), () => fejlR()));
  const r = await hFil(udstedReq());
  assertEquals(r.status, 500); assertEquals(await r.json(), { kode: "token_fejl" });
  assertEquals(kaldTil((k) => rpc(k, "sb_koe_fil")).length, 1); assertEquals(statusPatches().length, 1);
  assertEquals(kaldTil((k) => k.metode === "DELETE").length, 0);
});

// Stateful MOCK af SQL-protokollen (ikke kørt SQL): register + kø + slet_tidligst.
klientTest("§1/§5 stateful MOCK af SQL-reglerne: udstedelsesfejl → overtagelse > 3 t → post 1 afsluttes (slettet ved første succes) → særskilt afhentning af post 2 bevarer slettet; intet før slet_tidligst", async () => {
  // MOCK af SQL-protokollen i JS (ikke kørt SQL/samtidighed). Regler modelleret:
  // - slet_tidligst tilhører registerrækken og deles af køposter for samme sti; uden finaliseret uploadudløb = oprettet + 3 t.
  // - sb_overtag_foraeldreloese: uploadet og oprettet STRENGT mere end 3 t siden → slettes + ny køpost.
  // - sb_koe_naeste: ikke-afsluttede poster, hvis reservation er udløbet (genforsøgsvindue), og registerets slet_tidligst <= nu;
  //   sætter selv slettes for uploadet/bundet; må afhente en kvalificeret post, selv om registeret allerede er slettet.
  // - sb_koe_afslut(p_ok=true): afslutter posten; registeret slettes → slettet ved FØRSTE succes; senere afslutning bevarer slettet.
  const T0 = Date.parse("2026-10-28T10:00:00Z");
  const time = new FakeTime(T0);
  try {
    type Reg = { sti: string; status: string; oprettet: number; slet_tidligst: number };
    type Post = { id: number; sti: string; kilde: string; reserveret_til: number; afsluttet: boolean };
    let reg: Reg | null = null;
    const koe: Post[] = [];
    const objekter = new Set<string>();
    const TRE_T = 3 * 3600_000;
    const VINDUE = 10 * 60_000; // genforsøgsvindue for en reservation
    const afhentet: number[][] = [];
    const statusVedAfslut: string[] = [];
    // a) Udstedelse fejler: koe_fil lykkes, statusopdatering fejler.
    nulstil((k) => fælles(k) ?? (tabel(k, "chat_conversation_members") ? jsonR([{ id: "m" }])
      : tabel(k, "sb_stier") && k.metode === "POST" ? (() => { const b = JSON.parse(k.krop); reg = { sti: b.sti, status: "uploadet", oprettet: Date.now(), slet_tidligst: Date.now() + TRE_T }; objekter.add(b.sti); return tom(201); })()
      : tabel(k, "sb_stier") && k.metode === "PATCH" ? fejlR()
      : k.sti.startsWith("/storage/v1/object/upload/sign/") ? fejlR()
      : rpc(k, "sb_koe_fil") ? (() => { const b = JSON.parse(k.krop); koe.push({ id: koe.length + 1, sti: b.p_sti, kilde: b.p_kilde, reserveret_til: 0, afsluttet: false }); return tom(204); })()
      : undefined));
    assertEquals((await hFil(udstedReq())).status, 500);
    assertEquals(reg!.status, "uploadet"); assertEquals(koe.length, 1); assertEquals(koe[0].kilde, "udstedelse_fejl");

    const reserverPost2VedOvertagelse = false;
    const rute: Rute = (k) => {
      if (tabel(k, "pulsen_config")) return jsonR([{ value: CRON_HASH }]);
      if (rpc(k, "sb_version")) return jsonR("24d");
      if (rpc(k, "sb_overtag_foraeldreloese")) {
        assertEquals(JSON.parse(k.krop), { p_limit: 100 });
        let n = 0;
        if (reg && reg.status === "uploadet" && Date.now() - reg.oprettet > TRE_T) {
          reg.status = "slettes";
          koe.push({ id: koe.length + 1, sti: reg.sti, kilde: "foraeldreloes", reserveret_til: reserverPost2VedOvertagelse ? Date.now() + VINDUE : 0, afsluttet: false }); n++;
        }
        return jsonR(n);
      }
      if (rpc(k, "sb_koe_naeste")) {
        const nu = Date.now();
        const klar = koe.filter((p) => !p.afsluttet && p.reserveret_til <= nu && reg && reg.sti === p.sti && reg.slet_tidligst <= nu);
        for (const p of klar) { p.reserveret_til = nu + VINDUE; if (reg && (reg.status === "uploadet" || reg.status === "bundet")) reg.status = "slettes"; }
        afhentet.push(klar.map((p) => p.id));
        return jsonR(klar.map((p) => ({ id: p.id, bucket: "chat-attachments", sti: p.sti })));
      }
      if (k.metode === "DELETE" && k.sti === "/storage/v1/object/chat-attachments") {
        assert(reg && Date.now() >= reg.slet_tidligst, "fysisk sletning før slet_tidligst");
        for (const x of JSON.parse(k.krop).prefixes) objekter.delete(x); return jsonR([]);
      }
      if (rpc(k, "sb_koe_afslut")) {
        const b = JSON.parse(k.krop); const p = koe.find((x) => x.id === b.p_id)!;
        if (b.p_ok === true) { p.afsluttet = true; if (reg && reg.status === "slettes") reg.status = "slettet"; }
        statusVedAfslut.push(reg!.status);
        return jsonR(true);
      }
      if (rpc(k, "sb_personoplysninger_til_sletning")) return jsonR([]);
      if (rpc(k, "sb_minimer_register")) return jsonR(0);
      return undefined;
    };
    // b) Efter 1 t: ingen overtagelse (≤ 3 t) og slet_tidligst ikke nået → ingen afhentning/sletning.
    time.tick(3600_000);
    nulstil(rute);
    const r1 = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(r1.slettet, 0); assertEquals(r1.foraeldreloese, 0);
    assertEquals(kaldTil((k) => k.metode === "DELETE").length, 0); assertEquals(objekter.size, 1);
    // c) Præcis 3 t efter oprettelse: overtagelse kræver STRENGT mere end 3 t → ingen.
    time.tick(T0 + TRE_T - Date.now());
    nulstil(rute);
    const rPræcis = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(rPræcis.foraeldreloese, 0); assertEquals(koe.length, 1);
    // Post 1 er nu kvalificeret (registerets slet_tidligst = oprettet + 3 t ≤ nu): sb_koe_naeste sætter uploadet → slettes,
    // og første succesfulde afslutning gør registeret slettet.
    assertEquals(rPræcis.slettet, 1); assertEquals(reg!.status, "slettet"); assertEquals(statusVedAfslut, ["slettet"]);
    assertEquals(objekter.size, 0);
    // d) Senere: registeret er slettet → ingen overtagelse; ingen yderligere poster.
    time.tick(60_000);
    nulstil(rute);
    const r3 = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(r3.foraeldreloese, 0); assertEquals(r3.ok, true);
  } finally { time.restore(); }
});

klientTest("§5 stateful MOCK: overtagelse > 3 t → post 1 afsluttes først (slettet), post 2 afhentes SÆRSKILT efter genforsøgsvinduet og bevarer slettet", async () => {
  // MOCK (ikke kørt SQL). Samme regler som ovenfor; her sker overtagelsen før post 1 er afhentet.
  const T0 = Date.parse("2026-10-28T10:00:00Z");
  const time = new FakeTime(T0);
  try {
    const TRE_T = 3 * 3600_000, VINDUE = 10 * 60_000;
    const reg = { sti: "c/e1/u.png", status: "uploadet", oprettet: T0, slet_tidligst: T0 + TRE_T };
    type Post = { id: number; sti: string; kilde: string; reserveret_til: number; afsluttet: boolean };
    // Post 1 (udstedelse_fejl) er oprettet ved udstedelsesfejlen; reserveres ikke af naeste før registeret er kvalificeret.
    const koe: Post[] = [{ id: 1, sti: reg.sti, kilde: "udstedelse_fejl", reserveret_til: 0, afsluttet: false }];
    const objekter = new Set([reg.sti]);
    const afhentet: number[][] = [];
    const statusEfterAfslut: [number, string][] = [];
    const rute: Rute = (k) => {
      if (tabel(k, "pulsen_config")) return jsonR([{ value: CRON_HASH }]);
      if (rpc(k, "sb_version")) return jsonR("24d");
      if (rpc(k, "sb_overtag_foraeldreloese")) {
        let n = 0;
        if (reg.status === "uploadet" && Date.now() - reg.oprettet > TRE_T) {
          reg.status = "slettes";
          // Post 2 er reserveret af en tidligere, afbrudt afhentning; vinduet udløber om 10 min.
          koe.push({ id: 2, sti: reg.sti, kilde: "foraeldreloes", reserveret_til: Date.now() + VINDUE, afsluttet: false }); n++;
        }
        return jsonR(n);
      }
      if (rpc(k, "sb_koe_naeste")) {
        const nu = Date.now();
        const klar = koe.filter((p) => !p.afsluttet && p.reserveret_til <= nu && reg.slet_tidligst <= nu);
        for (const p of klar) { p.reserveret_til = nu + VINDUE; if (reg.status === "uploadet" || reg.status === "bundet") reg.status = "slettes"; }
        afhentet.push(klar.map((p) => p.id));
        return jsonR(klar.map((p) => ({ id: p.id, bucket: "chat-attachments", sti: p.sti })));
      }
      if (k.metode === "DELETE" && k.sti === "/storage/v1/object/chat-attachments") {
        assert(Date.now() >= reg.slet_tidligst, "fysisk sletning før slet_tidligst");
        for (const x of JSON.parse(k.krop).prefixes) objekter.delete(x); return jsonR([]);
      }
      if (rpc(k, "sb_koe_afslut")) {
        const b = JSON.parse(k.krop); const p = koe.find((x) => x.id === b.p_id)!;
        if (b.p_ok === true) { p.afsluttet = true; if (reg.status === "slettes") reg.status = "slettet"; }
        statusEfterAfslut.push([p.id, reg.status]);
        return jsonR(true);
      }
      if (rpc(k, "sb_personoplysninger_til_sletning")) return jsonR([]);
      if (rpc(k, "sb_minimer_register")) return jsonR(0);
      return undefined;
    };
    // Før slet_tidligst: intet afhentes eller slettes.
    time.tick(TRE_T - 60_000);
    nulstil(rute);
    assertEquals((await (await kørFake(hOpr, oprReq(), time)).res.json()).slettet, 0);
    assertEquals(kaldTil((k) => k.metode === "DELETE").length, 0); assertEquals(objekter.size, 1);
    // Strengt mere end 3 t: overtagelse opretter post 2 (reserveret); kun post 1 afhentes og afsluttes → slettet ved første succes.
    time.tick(2 * 60_000);
    nulstil(rute);
    const r1 = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(r1.foraeldreloese, 1); assertEquals(r1.slettet, 1);
    assertEquals(statusEfterAfslut, [[1, "slettet"]]); assertEquals(koe[1].afsluttet, false);
    // Særskilt afhentning af post 2 EFTER første afslutning (vinduet udløbet): registeret er allerede slettet, post 2 afhentes
    // stadig, og dens afslutning bevarer slettet.
    time.tick(VINDUE + 60_000);
    nulstil(rute);
    const r2 = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(r2.slettet, 1); assertEquals(r2.ok, true);
    assertEquals(statusEfterAfslut, [[1, "slettet"], [2, "slettet"]]);
    assert(koe.every((p) => p.afsluttet)); assertEquals(reg.status, "slettet");
    const ikkeTomme = afhentet.filter((x) => x.length);
    assertEquals(ikkeTomme, [[1], [2]], "post 2 skal afhentes i en særskilt afhentning efter post 1's afslutning");
  } finally { time.restore(); }
});

// ---------------------------------------------------------------- storkbook-tjek (handler)
const TJEK_ID = "33333333-4444-4555-8666-777777777777";
type TjekOps = { sti?: string | null; info?: (k: Kald) => Response | Promise<Response>; download?: (k: Kald) => Response | Promise<Response>;
  gateway?: (k: Kald) => Response | Promise<Response>; afslut?: (k: Kald) => Response | Promise<Response>; auth?: (k: Kald) => Response | Promise<Response> | undefined };
const okDom = () => jsonR({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ tone: "ok", personoplysninger: "ingen", cpr: false }) } }] });
function tjekRute(o: TjekOps): Rute {
  const sti = o.sti === undefined ? "c/e1/x.png" : o.sti;
  return (k) => {
    if (o.auth && k.sti === "/auth/v1/user") return o.auth(k);
    const f = fælles(k); if (f) return f;
    if (tabel(k, "chat_messages")) return jsonR([{ id: TJEK_ID, sender_id: "e1", revision: 1, content: "hej kollega", attachment_path: sti, conversation_id: "c", status: "tjekkes" }]);
    if (tabel(k, "pulsen_config")) return jsonR([{ value: "model-test" }]);
    if (rpc(k, "sb_tjek_reserver")) return jsonR("tok");
    if (tabel(k, "sb_stier")) return jsonR([{ status: "bundet", besked_id: TJEK_ID, samtale_id: "c", ejer_employee_id: "e1" }]);
    if (sti && k.sti === `/storage/v1/object/info/chat-attachments/${sti}`) return o.info?.(k);
    if (sti && k.sti === `/storage/v1/object/chat-attachments/${sti}`) return o.download?.(k);
    if (k.url.origin === "https://ai.gateway.lovable.dev") return (o.gateway ?? okDom)(k);
    if (rpc(k, "sb_tjek_afslut")) return (o.afslut ?? (() => jsonR(true)))(k);
    return undefined;
  };
}
const tjekReq = (body: BodyInit = JSON.stringify({ type: "besked", id: TJEK_ID, revision: 1 })) =>
  new Request(`${MOCK}/functions/v1/storkbook-tjek`, { method: "POST", headers: { Authorization: "Bearer jwt-test", "Content-Type": "application/json" }, body });
const gwKald = () => kaldTil((k) => k.url.origin === "https://ai.gateway.lovable.dev");
const afslutKald = () => kaldTil((k) => rpc(k, "sb_tjek_afslut"));
const udfaldSendt = () => JSON.parse(afslutKald()[0].krop).p_udfald;
const harFilPayload = () => gwKald().some((k) => k.krop.includes("image_url") || k.krop.includes("<<<FIL>>>"));

test("§2/§4 tjek: gyldigt billede sendes som filpayload, fil_tjekket=true", async () => {
  nulstil(tjekRute({ info: info(16), download: () => new Response(png(16)) }));
  const r = await hTjek(tjekReq());
  assertEquals(await r.json(), { status: "tjekket" }); assert(harFilPayload()); assertEquals(udfaldSendt().fil_tjekket, true); ingenUkendte();
});

test("§2/§4 tjek: afvist fil (størrelse, ukendt, kort stream, PDF, markup) → ingen filpayload, fil_tjekket=false, tekst tjekkes", async () => {
  const pdf = enc("%PDF-1.4\n%%EOF"), svg = enc("<!-- k --><svg></svg>");
  const varianter: TjekOps[] = [
    { info: info(10 * 1024 * 1024 + 1), download: () => new Response(png(16)) },
    { info: info(null), download: () => new Response(png(16)) },
    { info: () => fejlR(), download: () => new Response(png(16)) },
    { info: info(100), download: () => new Response(png(50)) },
    { sti: "c/e1/d.txt", info: info(pdf.length), download: () => new Response(pdf) },
    { sti: "c/e1/s.txt", info: info(svg.length), download: () => new Response(svg) },
    { sti: "c/e1/x.png", info: info(30 * 1024), download: () => new Response(enc("a".repeat(30 * 1024))) },
  ];
  for (const v of varianter) {
    nulstil(tjekRute(v));
    const r = await hTjek(tjekReq());
    assertEquals(await r.json(), { status: "tjekket" });
    assertEquals(gwKald().length, 1, "beskedteksten tjekkes fortsat"); assert(!harFilPayload(), "afvist fil sendt til gateway");
    const u = udfaldSendt(); assertEquals(u.fil_tjekket, false); assertEquals(u.udfald, "ok");
    // Ingen egen begrundelseskode i payloaden – SQL bestemmer.
    assertEquals(Object.keys(u).sort(), ["cpr", "fil_tjekket", "personoplysninger", "tone", "udfald"]);
    ingenUkendte();
  }
  // Ingen download ved afvisende metadata.
  nulstil(tjekRute({ info: info(10 * 1024 * 1024 + 1), download: () => new Response(png(16)) }));
  await (await hTjek(tjekReq())).json();
  assertEquals(kaldTil((k) => k.sti.startsWith("/storage/v1/object/chat-attachments/")).length, 0);
});

test("§3 tjek: Storage hænger før og efter headers → fil_tjekket=false og afslutning inden 55 s", async () => {
  for (const variant of ["før", "efter"] as const) {
    const time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
    try {
      nulstil(tjekRute({ info: info(16), download: (k) => variant === "før" ? hænger(k.signal) as Promise<Response>
        : new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(png(8)); } })) }));
      const { res, ms } = await kørFake(hTjek, tjekReq(), time);
      assertEquals(await res.json(), { status: "tjekket" });
      assert(ms < 55_000, `varighed ${ms}`);
      assertEquals(afslutKald().length, 1); assertEquals(udfaldSendt().fil_tjekket, false); assert(!harFilPayload());
    } finally { time.restore(); }
  }
});

test("§3 tjek: langsom bruger-auth afbrydes af budget (15 s) → 401; langsom request-body → intet efterfølgende arbejde", async () => {
  let time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    nulstil(tjekRute({ auth: (k) => hænger(k.signal) as Promise<Response> }));
    const { res, ms } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(res.status, 401); assert(ms >= 15_000 && ms < 16_000, `auth-varighed ${ms}`);
  } finally { time.restore(); }
  time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    nulstil(tjekRute({}));
    const evig = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc("{")); } });
    const { res, ms } = await kørFake(hTjek, tjekReq(evig), time);
    assertEquals(res.status, 500); assert(ms <= 50_100, `body-varighed ${ms}`);
    assertEquals(kald.length, 0, "arbejde startet efter budgetstop under parsing");
  } finally { time.restore(); }
});

test("§3 tjek: gateway efter arbejdsfristen → UKENDT; 4 s tilbage giver positiv afslut-timeout; 0 s → intet kald", async () => {
  // Ikke-samarbejdende transport, der ignorerer abort, flytter tiden forbi arbejdsfristen.
  let time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    const t0 = Date.now(); let afslutVarighed = -1;
    nulstil(tjekRute({ sti: null, gateway: async () => { await vent(51_000 - (Date.now() - t0), null); return okDom(); },
      afslut: async (k) => { const s = Date.now(); try { return await hænger(k.signal); } finally { afslutVarighed = Date.now() - s; } } }));
    const { res, ms } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(res.status, 500); assertEquals(await res.json(), { kode: "afslut_fejl" });
    assert(afslutVarighed > 3_900 && afslutVarighed <= 4_100, `afslut-timeout ${afslutVarighed}`); assert(ms <= 55_100);
  } finally { time.restore(); }
  time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    const t0 = Date.now();
    nulstil(tjekRute({ sti: null, gateway: async () => { await vent(56_000 - (Date.now() - t0), null); return okDom(); } }));
    const { res } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(res.status, 500); assertEquals(await res.json(), { kode: "afslut_fejl" }); assertEquals(afslutKald().length, 0);
  } finally { time.restore(); }
  // Gateway hænger → afbrydes ved arbejdsfristen (50 s) → UKENDT, afslutning lykkes.
  time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    nulstil(tjekRute({ sti: null, gateway: (k) => hænger(k.signal) as Promise<Response> }));
    const { res, ms } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(await res.json(), { status: "tjekket" }); assertEquals(udfaldSendt().udfald, "ukendt"); assert(ms < 51_000);
  } finally { time.restore(); }
});

test("§3 tjek: RPC-false er forældet, RPC-fejl er fejl, ikke_konfigureret/optaget bevares", async () => {
  nulstil(tjekRute({ sti: null, afslut: () => jsonR(false) }));
  assertEquals(await (await hTjek(tjekReq())).json(), { status: "forældet" });
  nulstil(tjekRute({ sti: null, afslut: () => fejlR() }));
  const r = await hTjek(tjekReq()); assertEquals(r.status, 500); assertEquals(await r.json(), { kode: "afslut_fejl" });
  nulstil((k) => tabel(k, "pulsen_config") ? jsonR([]) : tjekRute({ sti: null })(k));
  assertEquals(await (await hTjek(tjekReq())).json(), { status: "ikke_konfigureret" });
  nulstil((k) => rpc(k, "sb_tjek_reserver") ? jsonR(null) : tjekRute({ sti: null })(k));
  assertEquals(await (await hTjek(tjekReq())).json(), { status: "optaget" });
  ingenUkendte();
});

// ---------------------------------------------------------------- beskeder-oprydning (handler, kontrolleret tid)
type OprOps = { naeste?: (k: Kald, n: number) => Response | Promise<Response>; remove?: (k: Kald) => Response | Promise<Response>; afslut?: (k: Kald) => Response | Promise<Response>;
  overtag?: (k: Kald) => Response | Promise<Response>; slet?: (k: Kald) => Response | Promise<Response>; udvaelg?: (k: Kald, n: number) => Response | Promise<Response>;
  minimer?: (k: Kald) => Response | Promise<Response>; list?: (k: Kald) => Response | Promise<Response>; register?: (k: Kald) => Response | Promise<Response>; dagstal?: (k: Kald) => Response };
function oprRute(o: OprOps): Rute {
  let n = 0, u = 0;
  return (k) => {
    if (tabel(k, "pulsen_config")) return jsonR([{ value: CRON_HASH }]);
    if (rpc(k, "sb_version")) return jsonR("24d");
    if (rpc(k, "sb_overtag_foraeldreloese")) return (o.overtag ?? (() => jsonR(0)))(k);
    if (rpc(k, "sb_koe_naeste")) return (o.naeste ?? (() => jsonR([])))(k, n++);
    if (k.metode === "DELETE" && k.sti === "/storage/v1/object/chat-attachments") return (o.remove ?? (() => jsonR([])))(k);
    if (rpc(k, "sb_koe_afslut")) return (o.afslut ?? (() => jsonR(true)))(k);
    if (rpc(k, "sb_personoplysninger_til_sletning")) return (o.udvaelg ?? (() => jsonR([])))(k, u++);
    if (rpc(k, "sb_slet_personoplysninger")) return (o.slet ?? (() => jsonR(0)))(k);
    if (rpc(k, "sb_minimer_register")) return (o.minimer ?? (() => jsonR(0)))(k);
    if (k.sti === "/storage/v1/object/list/chat-attachments") return (o.list ?? (() => jsonR([])))(k);
    if (tabel(k, "sb_stier")) return (o.register ?? (() => jsonR([])))(k);
    if (rpc(k, "sb_dagstal_objekter")) return (o.dagstal ?? (() => tom()))(k);
    return undefined;
  };
}
const poster = (n: number, fra = 0) => Array.from({ length: n }, (_, i) => ({ id: fra + i + 1, bucket: "chat-attachments", sti: `c/e/${fra + i}.png` }));
const DAG = Date.parse("2026-10-28T10:00:00Z"); // uden for optællingsvinduet
const NAT = Date.parse("2026-10-28T02:30:00Z"); // 03:30 dansk

test("§3 oprydning: 13 grupper à 8 s uden kaldfejl → stop inden 58 s, rester synlige, ok=true", async () => {
  const time = new FakeTime(DAG);
  try {
    nulstil(oprRute({ naeste: (_k, n) => jsonR(n === 0 ? poster(50) : []), remove: async (k) => { await vent(7_000, k.signal); return jsonR([]); },
      afslut: async (k) => { await vent(1_000, k.signal); return jsonR(true); } }));
    const { res, ms } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assert(ms <= 58_100, `varighed ${ms}`);
    assertEquals(b.ok, true); assertEquals(b.fejl, []);
    assertEquals(b.rester.koe, true); assertEquals(b.rester.personoplysninger, true); assertEquals(b.rester.minimering, true);
    assertEquals(b.slettet, 7 * 4); // grupper startet ved 0,8,…,48 s
    ingenUkendte();
  } finally { time.restore(); }
});

test("§3 oprydning: gruppe ved 49 s med langsom remove OG langsom afslut → ingen overskridelse, afbrudt afslut er fejl", async () => {
  const time = new FakeTime(DAG);
  try {
    let gruppe = 0;
    const langsomme = new Set<number>();
    nulstil(oprRute({ naeste: (_k, n) => jsonR(n === 0 ? poster(32) : []),
      remove: async (k) => {
        const langsom = Date.now() - DAG >= 49_000;
        if (langsom) for (const s of JSON.parse(k.krop).prefixes as string[]) langsomme.add(Number(/(\d+)\.png$/.exec(s)![1]) + 1);
        await vent(langsom ? 60_000 : 7_000, k.signal); return jsonR([]);
      },
      afslut: async (k) => { if (langsomme.has(JSON.parse(k.krop).p_id)) return await hænger(k.signal); gruppe++; return jsonR(true); } }));
    const { res, ms } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assert(ms <= 58_100, `varighed ${ms} (må ikke nå 65 s)`);
    assert(langsomme.size > 0, "gruppen ved 49 s startede ikke");
    assertEquals(b.ok, false); assert(b.fejl.includes("koe_afslut")); assert(b.fejl.includes("storage_fejl")); assertEquals(b.rester.koe, true);
    assertEquals(b.slettet, gruppe); // kun bekræftede
  } finally { time.restore(); }
});

test("§3 oprydning: de to tunge RPC'er med 9 s svar fuldføres (ingen kunstig 8 s-fejl)", async () => {
  const time = new FakeTime(DAG);
  try {
    nulstil(oprRute({ overtag: async (k) => { await vent(9_000, k.signal); return jsonR(3); },
      udvaelg: (_k, u) => jsonR(u === 0 ? [{ kilde: "chat_messages", kilde_id: puid(1) }] : []),
      slet: async (k) => { const b = sletParam(k); assertEquals(b, { p_kilde: "chat_messages", p_ids: [puid(1)] }); await vent(9_000, k.signal); return jsonR(1); } }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(b.ok, true); assertEquals(b.foraeldreloese, 3); assertEquals(b.personoplysninger, 1); assertEquals(b.fejl, []);
  } finally { time.restore(); }
});

test("§3 oprydning: timeout med ukendt commit → ingen falsk succes, intet blindt genforsøg", async () => {
  const time = new FakeTime(DAG);
  try {
    nulstil(oprRute({ naeste: (_k, n) => jsonR(n === 0 ? poster(1) : []), afslut: (k) => hænger(k.signal) as Promise<Response> }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(b.ok, false); assertEquals(b.slettet, 0); assert(b.fejl.includes("koe_afslut"));
    assertEquals(kaldTil((k) => rpc(k, "sb_koe_afslut")).length, 1);
    assertEquals(kaldTil((k) => k.metode === "DELETE").length, 1);
  } finally { time.restore(); }
});

test("§3 oprydning: budgetstop midt i optælling og lige før dagstal → ingen dagstal; reel Storage-fejl skelnes", async () => {
  // a) midt i optælling
  let time = new FakeTime(NAT);
  try {
    const side = Array.from({ length: 1000 }, (_, i) => ({ name: `f${i}`, id: `i${i}` }));
    nulstil(oprRute({ list: async (k) => { await vent(7_000, k.signal); return jsonR(side); } }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(b.ok, true); assertEquals(b.rester.optaelling, true); assertEquals(b.objekter_uden_register, null);
    assertEquals(kaldTil((k) => rpc(k, "sb_dagstal_objekter")).length, 0);
  } finally { time.restore(); }
  // b) komplet optælling afsluttes efter arbejdsfristen → dagstal skrives ikke
  time = new FakeTime(NAT);
  try {
    nulstil(oprRute({ minimer: async (k) => { await vent(7_900, k.signal); return jsonR(0); }, overtag: async (k) => { await vent(14_000, k.signal); return jsonR(0); },
      udvaelg: async (k) => { await vent(7_900, k.signal); return jsonR([]); },
      // Første side (fra 37,7 s) giver en mappe; anden side starter før 50 s og slutter efter 50 s.
      list: async (k) => { await vent(7_900, k.signal); return jsonR(JSON.parse(k.krop).prefix === "" ? [{ name: "m", id: null }] : [{ name: "a", id: "x" }]); },
      naeste: async (k) => { await vent(7_900, k.signal); return jsonR([]); } }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(kaldTil((k) => rpc(k, "sb_dagstal_objekter")).length, 0);
    assertEquals(b.objekter_uden_register, null); assertEquals(b.rester.optaelling, true); assertEquals(b.ok, true);
  } finally { time.restore(); }
  // c) reel Storage-fejl → ok=false
  time = new FakeTime(NAT);
  try {
    nulstil(oprRute({ list: () => fejlR() }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(b.ok, false); assert(b.fejl.includes("optaelling")); assertEquals(kaldTil((k) => rpc(k, "sb_dagstal_objekter")).length, 0);
  } finally { time.restore(); }
  // d) komplet optælling med tid tilbage → dagstal skrives
  time = new FakeTime(NAT);
  try {
    nulstil(oprRute({ list: () => jsonR([{ name: "a", id: "x" }, { name: "b", id: "y" }]), register: () => jsonR([{ sti: "a" }]) }));
    const { res } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assertEquals(b.ok, true); assertEquals(b.objekter_uden_register, 1); assertEquals(JSON.parse(kaldTil((k) => rpc(k, "sb_dagstal_objekter"))[0].krop), { p_antal: 1 });
  } finally { time.restore(); }
});

test("§3 oprydning: dry_run er skrivefri og budgetbeskyttet", async () => {
  const time = new FakeTime(DAG);
  try {
    nulstil((k) => tabel(k, "sb_filsletninger") ? hænger(k.signal) as Promise<Response> : oprRute({})(k) ?? (tabel(k, "sb_stier") ? jsonR([]) : undefined));
    const { res, ms } = await kørFake(hOpr, oprReq(JSON.stringify({ dry_run: true })), time);
    const b = await res.json();
    assertEquals(b.dry_run, true); assertEquals(b.ok, false); assert(b.fejl.includes("koe")); assert(ms <= 8_100);
    assert(kald.every((k) => k.metode === "GET" || k.metode === "HEAD" || ["sb_version", "sb_personoplysninger_til_sletning"].some((n) => rpc(k, n))), "skrivende kald i dry_run");
    for (const n of ["sb_overtag_foraeldreloese", "sb_koe_naeste", "sb_koe_afslut", "sb_minimer_register", "sb_dagstal_objekter"]) assertEquals(kaldTil((k) => rpc(k, n)).length, 0);
  } finally { time.restore(); }
});

// ---------------------------------------------------------------- §3 budgethelper + SDK med mocket fetch
test("§3 budgetFetch: ms<=0 → intet netværkskald; eksisterende abortsignal respekteres; timeout gælder body", async () => {
  nulstil(() => jsonR({}));
  let fejl: unknown = null;
  try { await bud.budgetFetch(() => Date.now() - 1, 8_000)(`${MOCK}/x`); } catch (e) { fejl = e; }
  assert(bud.erBudgetStop(fejl)); assertEquals(kald.length, 0);
  const ac = new AbortController(); ac.abort();
  fejl = null;
  try { await bud.budgetFetch(() => Date.now() + 10_000, 8_000)(`${MOCK}/x`, { signal: ac.signal }); } catch (e) { fejl = e; }
  assert(fejl); assertEquals(kald.length, 0);
  const time = new FakeTime(DAG);
  try {
    nulstil((k) => new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc("{")); k.signal?.addEventListener("abort", () => c.error(k.signal!.reason)); } })));
    const res = await bud.budgetFetch(() => Date.now() + 60_000, 8_000)(`${MOCK}/x`);
    let færdig = false, bodyFejl: unknown = null;
    res.text().catch((e) => { bodyFejl = e; }).finally(() => { færdig = true; });
    await time.tickAsync(7_000); await flush(time); assert(!færdig, "timeout ryddet ved headers");
    await time.tickAsync(1_100); await flush(time); assert(færdig && bodyFejl, "body-timeout virkede ikke");
  } finally { time.restore(); }
});

test("§3 laesBegraenset: overskridelse annullerer, frist annullerer, ingen delvis fil", async () => {
  let annulleret = 0;
  const s = () => new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(10)); }, cancel() { annulleret++; } });
  assertEquals(await bud.laesBegraenset(s(), 25, Date.now() + 1000), { ok: false, grund: "for_stor" }); assertEquals(annulleret, 1);
  const time = new FakeTime(DAG);
  try {
    const p = bud.laesBegraenset(new ReadableStream<Uint8Array>({ cancel() { annulleret++; } }), 25, Date.now() + 5_000);
    let r: unknown = null; p.then((x) => { r = x; });
    await time.tickAsync(5_100); await flush(time);
    assertEquals(r, { ok: false, grund: "frist" }); assertEquals(annulleret, 2);
  } finally { time.restore(); }
});

test("§3 SDK 2.118.0 med mocket fetch: RPC/Storage {error} og exception, ingen skjulte genforsøg", async () => {
  const c = createClient(MOCK, "svc-test", bud.budgetIndstillinger(() => Date.now() + 30_000, 8_000));
  nulstil(() => jsonR({ message: "x" }, 503));
  const r1 = await c.rpc("sb_version"); assert(r1.error); assertEquals(kald.length, 1);
  nulstil(() => jsonR({ message: "x" }, 503));
  const r2 = await c.from("sb_stier").select("sti"); assert(r2.error); assertEquals(kald.length, 1, "skjult GET-genforsøg");
  nulstil(() => { throw new Error("transport"); });
  let kastet = false;
  try { const r3 = await c.from("sb_stier").select("sti"); kastet = !!r3.error; } catch { kastet = true; }
  assert(kastet); assertEquals(kald.length, 1);
  nulstil(() => fejlR());
  const r4 = await c.storage.from("chat-attachments").remove(["a"]); assert(r4.error); assertEquals(kald.length, 1);
  nulstil(() => { throw new Error("transport"); });
  let k5 = false; try { const r5 = await c.storage.from("chat-attachments").remove(["a"]); k5 = !!r5.error; } catch { k5 = true; }
  assert(k5);
  nulstil(() => new Response(enc("abc")));
  const r6 = await c.storage.from("chat-attachments").download("a.b.txt").asStream();
  assert(r6.data instanceof ReadableStream); assertEquals(kald[0].sti, "/storage/v1/object/chat-attachments/a.b.txt");
  await r6.data!.cancel();
  nulstil(() => jsonR({ name: "a", size: 42 }));
  assertEquals(await ft.objektStoerrelse(c, "chat-attachments", "x/a.b.png"), 42); assertEquals(kald[0].sti, "/storage/v1/object/info/chat-attachments/x/a.b.png");
  ingenUkendte();
});

// ================================================================ A3
// Syntetiske UUID'er og parameterkontrol for persondata-RPC'erne (SQL-kildeværdier fra 24d-vaern.sql).
const PO_KILDER = new Set(["chat_messages", "pulsen_posts", "feed_comments"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function puid(n: number): string { return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }
/** Læser og validerer sb_slet_personoplysninger-parametre; ugyldige parametre registreres som ukendt kald (→ prøven fejler). */
function sletParam(k: Kald): { p_kilde: string; p_ids: string[] } {
  const b = JSON.parse(k.krop);
  const gyldig = b && Object.keys(b).sort().join(",") === "p_ids,p_kilde" && PO_KILDER.has(b.p_kilde) && Array.isArray(b.p_ids)
    && b.p_ids.length >= 1 && b.p_ids.length <= 100 && b.p_ids.every((x: unknown) => typeof x === "string" && UUID_RE.test(x));
  if (!gyldig) ukendt.push("ugyldige sb_slet_personoplysninger-parametre");
  return b;
}
const poRækker = (n: number, kilde = "chat_messages", fra = 0) => Array.from({ length: n }, (_, i) => ({ kilde, kilde_id: puid(fra + i + 1) }));
const sletKald = () => kaldTil((k) => rpc(k, "sb_slet_personoplysninger"));
const udvaelgKald = () => kaldTil((k) => rpc(k, "sb_personoplysninger_til_sletning"));

// ---------------------------------------------------------------- §2 oprydning: stop persondatatrinnet ved slettefejl
type FejlVariant = "error" | "exception" | "timeout";
const fejlSvar = (v: FejlVariant, k: Kald): Response | Promise<Response> =>
  v === "error" ? fejlR() : v === "exception" ? (() => { throw new Error("transport"); })() : hænger(k.signal) as Promise<Response>;

for (const v of ["timeout", "error", "exception"] as FejlVariant[]) {
  test(`§2 oprydning: 101 rækker, første bundt (100) fejler som ${v} → præcis ét slettekald, ingen ny udvælgelse, 0, po_slet`, async () => {
    const time = new FakeTime(DAG);
    try {
      const alle = poRækker(101);
      nulstil(oprRute({ udvaelg: () => jsonR(alle), slet: (k) => { sletParam(k); return fejlSvar(v, k); } }));
      const { res } = await kørFake(hOpr, oprReq(), time);
      assertEquals(res.status, 200);
      const b = await res.json();
      assertEquals(sletKald().length, 1); assertEquals(udvaelgKald().length, 1);
      const p = sletParam(sletKald()[0]); assertEquals(p.p_kilde, "chat_messages"); assertEquals(p.p_ids, alle.slice(0, 100).map((r) => r.kilde_id));
      assertEquals(b.personoplysninger, 0); assert(b.fejl.includes("po_slet")); assertEquals(b.rester.personoplysninger, true); assertEquals(b.ok, false);
    } finally { time.restore(); }
  });

  test(`§2 oprydning: 201 rækker, første 100 bekræftet, næste 100 fejler som ${v} → to kald, sidste række forsøges ikke, 100`, async () => {
    const time = new FakeTime(DAG);
    try {
      const alle = poRækker(201);
      let n = 0;
      nulstil(oprRute({ udvaelg: () => jsonR(alle), slet: (k) => { sletParam(k); return n++ === 0 ? jsonR(100) : fejlSvar(v, k); } }));
      const { res } = await kørFake(hOpr, oprReq(), time);
      const b = await res.json();
      assertEquals(sletKald().length, 2); assertEquals(udvaelgKald().length, 1);
      assertEquals(sletKald().map((k) => sletParam(k).p_ids.length), [100, 100]);
      assert(!sletKald().some((k) => sletParam(k).p_ids.includes(alle[200].kilde_id)), "sidste række forsøgt");
      assertEquals(b.personoplysninger, 100); assert(b.fejl.includes("po_slet")); assertEquals(b.rester.personoplysninger, true); assertEquals(b.ok, false);
    } finally { time.restore(); }
  });
}

test("§2 oprydning: bekræftet returantal mindre end bundtet tælles; fejlet bundt tælles ikke, selv om mocken modellerer senere commit", async () => {
  const time = new FakeTime(DAG);
  try {
    // Tre kilder (SQL-værdier), gruppering efter kilde; første bundt bekræfter 97 af 100, andet bundt "committer" men svarer fejl.
    const alle = [...poRækker(100, "chat_messages"), ...poRækker(5, "pulsen_posts", 100), ...poRækker(3, "feed_comments", 200)];
    let n = 0, senereCommittet = 0;
    nulstil(oprRute({ udvaelg: () => jsonR(alle), slet: (k) => { const p = sletParam(k); if (n++ === 0) return jsonR(97); senereCommittet += p.p_ids.length; return fejlR(); } }));
    const b = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(sletKald().map((k) => sletParam(k).p_kilde), ["chat_messages", "pulsen_posts"]);
    assertEquals(senereCommittet, 5);
    assertEquals(b.personoplysninger, 97); assert(b.fejl.includes("po_slet")); assertEquals(b.ok, false);
  } finally { time.restore(); }
});

test("§2 oprydning: rent budgetstop efter vellykkede bundter bevarer antallet uden po_slet", async () => {
  const time = new FakeTime(DAG);
  try {
    const alle = poRækker(500);
    nulstil(oprRute({ udvaelg: () => jsonR(alle), slet: async (k) => { const p = sletParam(k); await vent(14_000, k.signal); return jsonR(p.p_ids.length); } }));
    const { res, ms } = await kørFake(hOpr, oprReq(), time);
    const b = await res.json();
    assert(ms <= 58_100, `varighed ${ms}`);
    assertEquals(sletKald().length, 4); // start ved ~0, 14, 28, 42 s; 5. bundt efter arbejdsfristen startes ikke
    assertEquals(b.personoplysninger, 400); assert(!b.fejl.includes("po_slet")); assertEquals(b.rester.personoplysninger, true);
  } finally { time.restore(); }
});

test("§2 oprydning: succesrunde genudvælger uden offset og tæller hver runde én gang", async () => {
  const time = new FakeTime(DAG);
  try {
    nulstil(oprRute({ udvaelg: (_k, u) => jsonR(u === 0 ? poRækker(100) : u === 1 ? poRækker(30, "feed_comments", 100) : []),
      slet: (k) => jsonR(sletParam(k).p_ids.length) }));
    const b = await (await kørFake(hOpr, oprReq(), time)).res.json();
    assertEquals(udvaelgKald().length, 3); assertEquals(sletKald().length, 2);
    assertEquals(b.personoplysninger, 130); assertEquals(b.fejl, []); assertEquals(b.ok, true);
  } finally { time.restore(); }
});

// ---------------------------------------------------------------- §1 storkbook-tjek: fælles afslutning efter reservation
const svcGenlaes = (k: Kald) => tabel(k, "chat_messages") && k.headers.get("authorization") === "Bearer svc-test";
const RAEKKE = { id: TJEK_ID, sender_id: "e1", revision: 1, content: "hej kollega", attachment_path: null, conversation_id: "c", status: "tjekkes" };
/** tjekRute med styret reservation og genlæsning (service-klientens læsning af chat_messages). */
function tjekA3(o: { reserver?: (k: Kald) => Response | Promise<Response>; genlaes?: (k: Kald) => Response | Promise<Response>; afslut?: TjekOps["afslut"]; gateway?: TjekOps["gateway"] }): Rute {
  const basis = tjekRute({ sti: null, afslut: o.afslut, gateway: o.gateway });
  return (k) => {
    if (rpc(k, "sb_tjek_reserver") && o.reserver) return o.reserver(k);
    if (svcGenlaes(k) && o.genlaes) return o.genlaes(k);
    return basis(k);
  };
}
const forventAfslutParam = (u: unknown) => {
  assertEquals(afslutKald().length, 1);
  const b = JSON.parse(afslutKald()[0].krop);
  assertEquals(b, { p_kilde: "besked", p_id: TJEK_ID, p_revision: 1, p_token: "tok", p_udfald: u });
};

for (const v of ["error", "exception"] as const) {
  test(`§1 tjek: reservation ved 49 s, genlæsningsfejl (${v}) ved 50 s → præcis ét afslutningsforsøg med hele UKENDT, ingen gateway, 200`, async () => {
    const time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
    try {
      const t0 = Date.now(); let genlaesT = -1, afslutT = -1;
      nulstil(tjekA3({
        reserver: async () => { await vent(49_000 - (Date.now() - t0), null); return jsonR("tok"); },
        genlaes: async () => { await vent(50_000 - (Date.now() - t0) - 1, null); genlaesT = Date.now() - t0; return v === "error" ? fejlR() : (() => { throw new Error("transport"); })(); },
        afslut: () => { afslutT = Date.now() - t0; return jsonR(true); },
      }));
      const { res } = await kørFake(hTjek, tjekReq(), time);
      assertEquals(res.status, 200); assertEquals(await res.json(), { status: "tjekket" });
      assert(genlaesT >= 49_900 && genlaesT < 50_100, `genlæsning ${genlaesT}`); assert(afslutT >= genlaesT && afslutT < 55_000, `afslut ${afslutT}`);
      forventAfslutParam({ tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: false, udfald: "ukendt" });
      assertEquals(gwKald().length, 0); assertEquals(kaldTil((k) => rpc(k, "sb_tjek_reserver")).length, 1);
    } finally { time.restore(); }
  });
}

test("§1 tjek: genlæsning hænger → afbrydes af arbejdsfristen (transportvej) → ét afslutningsforsøg med UKENDT", async () => {
  const time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    nulstil(tjekA3({ reserver: async () => { await vent(45_000, null); return jsonR("tok"); }, genlaes: (k) => hænger(k.signal) as Promise<Response> }));
    const { res, ms } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(await res.json(), { status: "tjekket" }); assert(ms < 55_000);
    forventAfslutParam({ ...tjek.UKENDT }); assertEquals(gwKald().length, 0);
  } finally { time.restore(); }
});

test("§1 tjek: genlæsningsfejl uden resterende tid → nul afslutningskald, 500 afslut_fejl", async () => {
  const time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    const t0 = Date.now();
    // Ikke-samarbejdende transport, der ignorerer abort og svarer fejl efter den samlede slutfrist.
    nulstil(tjekA3({ genlaes: async () => { await vent(56_000 - (Date.now() - t0), null); return fejlR(); } }));
    const { res } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(res.status, 500); assertEquals(await res.json(), { kode: "afslut_fejl" });
    assertEquals(afslutKald().length, 0); assertEquals(gwKald().length, 0);
  } finally { time.restore(); }
});

test("§1 tjek: manglende række, forkert revision, afsender eller status → forældet uden afslutning/gateway", async () => {
  for (const svar of [[], [{ ...RAEKKE, revision: 2 }], [{ ...RAEKKE, sender_id: "e2" }], [{ ...RAEKKE, status: "sendt" }]]) {
    nulstil(tjekA3({ genlaes: () => jsonR(svar) }));
    const r = await hTjek(tjekReq());
    assertEquals(r.status, 200); assertEquals(await r.json(), { status: "forældet" });
    assertEquals(afslutKald().length, 0); assertEquals(gwKald().length, 0);
  }
});

test("§1 tjek: ændring efter genlæsning (RPC false) → forældet, oprindelig revision/token, intet genforsøg", async () => {
  nulstil(tjekA3({ afslut: () => jsonR(false) }));
  const r = await hTjek(tjekReq());
  assertEquals(await r.json(), { status: "forældet" });
  forventAfslutParam({ tone: "ok", personoplysninger: "ingen", cpr: false, fil_tjekket: false, udfald: "ok" });
  assertEquals(kaldTil((k) => rpc(k, "sb_tjek_reserver")).length, 1);
});

test("§1 tjek: fejl og timeout i afslutningen → præcis ét forsøg og afslut_fejl", async () => {
  for (const v of ["error", "exception"] as const) {
    nulstil(tjekA3({ afslut: () => v === "error" ? fejlR() : (() => { throw new Error("transport"); })() }));
    const r = await hTjek(tjekReq());
    assertEquals(r.status, 500); assertEquals(await r.json(), { kode: "afslut_fejl" }); assertEquals(afslutKald().length, 1);
  }
  const time = new FakeTime(Date.parse("2026-10-28T10:00:00Z"));
  try {
    nulstil(tjekA3({ afslut: (k) => hænger(k.signal) as Promise<Response> }));
    const { res, ms } = await kørFake(hTjek, tjekReq(), time);
    assertEquals(res.status, 500); assertEquals(await res.json(), { kode: "afslut_fejl" }); assertEquals(afslutKald().length, 1);
    assert(ms >= 5_000 && ms < 5_200, `afslut-timeout ${ms}`);
  } finally { time.restore(); }
});

test("§1 tjek: filfejl med tid til teksttjek → ingen filpayload, fil_tjekket=false, gyldig CPR-dom bevares", async () => {
  const cprDom = () => jsonR({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: true }) } }] });
  nulstil(tjekRute({ info: () => fejlR(), download: () => new Response(png(16)), gateway: cprDom }));
  const r = await hTjek(tjekReq());
  assertEquals(await r.json(), { status: "tjekket" });
  assertEquals(gwKald().length, 1); assert(!harFilPayload());
  assertEquals(udfaldSendt(), { tone: "ok", personoplysninger: "fundet", type: "cpr", cpr: true, fil_tjekket: false, udfald: "ok" });
});

test("§1 tjek: model uden gyldig dom → UKENDT via fælles afslutning", async () => {
  nulstil(tjekA3({ gateway: () => jsonR({ choices: [{ finish_reason: "length", message: { content: "{" } }] }) }));
  assertEquals(await (await hTjek(tjekReq())).json(), { status: "tjekket" });
  forventAfslutParam({ ...tjek.UKENDT });
});

// ---------------------------------------------------------------- §4 0x0B og hele ASCII-whitespace-sættet
const VT = 0x0b;
const html = enc("<html><body>x</body></html>");
const rtf = enc("{\\rtf1\\ansi hej}"); // bytes indeholder {\rtf (backslash), ikke carriage return
const dokVarianter: [string, Uint8Array][] = [
  ["0x0B+HTML", cat([VT], html)], ["0x0B+RTF", cat([VT], rtf)],
  ["BOM+blandet+HTML", cat(BOM, [0x09, VT, 0x0c, 0x0d, 0x0a, 0x20], html)], ["BOM+blandet+RTF", cat(BOM, [0x20, VT, 0x09, 0x0c], rtf)],
];

test("§4 filtype: 0x09–0x0D og 0x20 springes over før dokumentpræfiks; RTF-bytes er korrekte", () => {
  assertEquals(rtf[0], 0x7b); assertEquals(rtf[1], 0x5c); assert(!rtf.includes(0x0d));
  for (const [n, b] of dokVarianter) assertEquals(ft.filtype(b), null, n);
  assertEquals(ft.filtype(cat([VT], enc("almindelig prosa æøå"))), "text/plain");
  assertEquals(ft.filtype(enc("Almindelig UTF-8-prosa – æøå 😀")), "text/plain");
  assertEquals(ft.filtype(png(16)), "image/png");
});

klientTest("§4 sb-fil: 0x0B/BOM/blandet whitespace foran HTML og RTF → 410 {kode:'vaek'}; prosa og billede accepteres", async () => {
  for (const [n, b] of dokVarianter) {
    nulstil(laesRute({ sti: "c/e1/d.txt", navn: "d.txt", info: info(b.length), download: () => new Response(b.slice()) }));
    const r = await hFil(laesReq());
    assertEquals(r.status, 410, n); assertEquals(await r.json(), { kode: "vaek" });
  }
  const prosa = enc("Almindelig prosa æøå");
  nulstil(laesRute({ sti: "c/e1/p.txt", navn: "p.txt", info: info(prosa.length), download: () => new Response(prosa.slice()) }));
  const r = await hFil(laesReq()); assertEquals(r.status, 200); assertEquals(new Uint8Array(await r.arrayBuffer()), prosa);
  nulstil(laesRute({ info: info(16), download: () => new Response(png(16)) }));
  const r2 = await hFil(laesReq()); assertEquals(r2.status, 200); await r2.body?.cancel();
});

test("§4 tjek: 0x0B/BOM foran HTML og RTF → ingen filpayload, fil_tjekket=false, tekst tjekkes og afsluttes", async () => {
  for (const [n, b] of dokVarianter) {
    nulstil(tjekRute({ sti: "c/e1/d.txt", info: info(b.length), download: () => new Response(b.slice()) }));
    const r = await hTjek(tjekReq());
    assertEquals(await r.json(), { status: "tjekket" }, n);
    assertEquals(gwKald().length, 1); assert(!harFilPayload(), n);
    assertEquals(udfaldSendt().fil_tjekket, false); assertEquals(udfaldSendt().udfald, "ok"); assertEquals(afslutKald().length, 1);
  }
});
