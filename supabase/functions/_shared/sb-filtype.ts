// Fælles filtypekontrol og begrænset objektlæsning for sb-fil og storkbook-tjek (S6 / 24d).
// Konservativt formatværn: typen bestemmes af bytes; attachment_type og Storage-MIME ophøjes aldrig til bevis.
// Ikke et bevis for, at alle tænkelige formater, kodninger eller polyglotter genkendes. Ingen PDF-parser.
import { laesBegraenset, type LaesUdfald } from "./sb-budget.ts";

export const MAKS_BYTES = 10 * 1024 * 1024;
export const MAKS_TEKST_BYTES = 20 * 1024;

export type FilType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "text/plain";

const starter = (b: Uint8Array, sig: number[], fra = 0) => b.length >= fra + sig.length && sig.every((v, i) => b[fra + i] === v);

/** Binære dokument-/arkivsignaturer ved byte 0 (byteværdier, ikke tekst). */
const BINAERE: number[][] = [
  [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08], // ZIP (inkl. OOXML/ODF)
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE (doc/xls/ppt/msg)
  [0x1f, 0x8b], // gzip
  [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], // RAR
  [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], // 7z
];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/** Indeks for første ikke-BOM/ikke-ASCII-whitespace byte. */
function tekstStart(b: Uint8Array): number {
  let i = starter(b, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x0c)) i++;
  return i;
}
const lille = (x: number) => (x >= 0x41 && x <= 0x5a ? x + 0x20 : x);
const starterCI = (b: Uint8Array, i: number, s: string) => b.length >= i + s.length && [...s].every((c, k) => lille(b[i + k]) === c.charCodeAt(0));

/**
 * Dokumentafvisning før UTF-8-fallback.
 * Præfiksregel for markup: efter BOM/whitespace begynder indholdet med '<' umiddelbart efterfulgt af
 * et bogstav, '!', '?' eller '/' (tag, deklaration/kommentar, processing instruction, sluttag).
 * Tekst, der begynder sådan, afvises bevidst; markup længere inde i almindelig prosa afvises ikke.
 */
export function erDokument(b: Uint8Array): boolean {
  if (BINAERE.some((s) => starter(b, s))) return true;
  const n = Math.min(b.length, 1024);
  for (let i = 0; i + PDF.length <= n; i++) if (starter(b, PDF, i)) return true;
  const i = tekstStart(b);
  if (starterCI(b, i, "{\\rtf") || starterCI(b, i, "%!")) return true; // RTF, PostScript
  if (b[i] === 0x3c && i + 1 < b.length) {
    const c = lille(b[i + 1]);
    if ((c >= 0x61 && c <= 0x7a) || c === 0x21 || c === 0x3f || c === 0x2f) return true;
  }
  return false;
}

/** Indholdsbaseret type (magic bytes). Billedgenkendelse uændret fra leverance A. */
export function filtype(b: Uint8Array): FilType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (erDokument(b)) return null;
  if (b.includes(0)) return null;
  try { new TextDecoder("utf-8", { fatal: true }).decode(b); return "text/plain"; } catch { return null; }
}

/** Loft før download: .txt-sti strammer til 20 KiB; endelsen bruges kun til at stramme. */
export const loftForSti = (sti: string) => (/\.txt$/i.test(sti) ? MAKS_TEKST_BYTES : MAKS_BYTES);

/** Faktisk loft efter typebestemmelse fra bytes. */
export const loftForType = (t: FilType) => (t === "text/plain" ? MAKS_TEKST_BYTES : MAKS_BYTES);

type StorageKlient = {
  storage: {
    from(b: string): {
      info(p: string): PromiseLike<{ data: { size?: unknown } | null; error: unknown }>;
      download(p: string): { asStream(): PromiseLike<{ data: ReadableStream<Uint8Array> | null; error: unknown }> };
    };
  };
};

/** Objektstørrelse via storage.info (supabase-js 2.118.0). null = ukendt (404, fejl, exception, ugyldig størrelse). */
export async function objektStoerrelse(svc: StorageKlient, bucket: string, sti: string): Promise<number | null> {
  try {
    const { data, error } = await svc.storage.from(bucket).info(sti);
    if (error || !data) return null;
    const s = data.size;
    return typeof s === "number" && Number.isSafeInteger(s) && s >= 0 ? s : null;
  } catch { return null; }
}

export type HentUdfald =
  | { ok: true; bytes: Uint8Array; type: FilType }
  | { ok: false; grund: "stoerrelse_ukendt" | "for_stor" | "frist" | "fejl" | "ufuldstaendig" | "type_afvist" };

/**
 * Begrænset hentning af ét registreret objekt: størrelse → loft → stream (tæller bytes) → komplethed → type.
 * Ingen download ved afvisende metadata; ingen delvis fil returneres.
 */
export async function hentBegraenset(svc: StorageKlient, bucket: string, sti: string, slut: number): Promise<HentUdfald> {
  const size = await objektStoerrelse(svc, bucket, sti);
  if (size === null) return { ok: false, grund: "stoerrelse_ukendt" };
  const loft = loftForSti(sti);
  if (size > loft) return { ok: false, grund: "for_stor" };
  let s: { data: ReadableStream<Uint8Array> | null; error: unknown };
  try { s = await svc.storage.from(bucket).download(sti).asStream(); } catch { return { ok: false, grund: "fejl" }; }
  if (s.error || !s.data) return { ok: false, grund: "fejl" };
  // Readeren annulleres ved første byte ud over den opslåede størrelse (og aldrig over loftet).
  const l: LaesUdfald = await laesBegraenset(s.data, Math.min(loft, size), slut);
  if (!l.ok) return { ok: false, grund: l.grund };
  if (l.bytes.length !== size) return { ok: false, grund: "ufuldstaendig" };
  const type = filtype(l.bytes);
  if (!type) return { ok: false, grund: "type_afvist" };
  if (l.bytes.length > loftForType(type)) return { ok: false, grund: "for_stor" };
  return { ok: true, bytes: l.bytes, type };
}
