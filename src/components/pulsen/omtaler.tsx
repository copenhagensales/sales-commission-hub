import type { ReactNode } from "react";

/** Én omtale i Storkbook (samme form som CHECK *_mentions_gyldige): e = medarbejder, t = team. */
export type Omtale = { t: "e" | "t"; id: string; navn: string };

export const OMTALER_MAX = 10;
export const OMTALE_NAVN_MAX = 80;

/** Læser mentions-kolonnen sikkert (ukendte/ugyldige elementer udelades). */
export function tilOmtaler(v: unknown): Omtale[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    if ((o.t !== "e" && o.t !== "t") || typeof o.id !== "string" || typeof o.navn !== "string" || !o.navn) return [];
    return [{ t: o.t, id: o.id, navn: o.navn }];
  });
}

/** Beholder kun omtaler, hvis »@navn« stadig står i teksten (eksakt, case-sensitiv). */
export function rensOmtaler(tekst: string, mentions: Omtale[]): Omtale[] {
  return mentions.filter((m) => tekst.includes(`@${m.navn}`));
}

/** Fejl fra databasens CHECK på omtaler. */
export function erOmtaleFejl(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as { code?: unknown; message?: unknown; details?: unknown };
  if (o.code !== "23514") return false;
  // Constraints: pulsen_posts_mentions_gyldige, feed_comments_mentions_gyldige.
  const tekst = `${typeof o.message === "string" ? o.message : ""} ${typeof o.details === "string" ? o.details : ""}`;
  return /\w+_mentions_gyldige\b/.test(tekst);
}

/** Fremhæver hvert »@navn« fra mentions. Uden omtaler returneres teksten uændret. */
export function renderOmtaler(body: string, mentions: Omtale[] | null | undefined): ReactNode {
  const navne = Array.from(new Set((mentions ?? []).map((m) => `@${m.navn}`))).sort((a, b) => b.length - a.length);
  if (!body || navne.length === 0) return body;
  const ud: ReactNode[] = [];
  let buf = "";
  let i = 0;
  while (i < body.length) {
    const hit = body[i] === "@" ? navne.find((n) => body.startsWith(n, i)) : undefined;
    if (hit) {
      if (buf) { ud.push(buf); buf = ""; }
      ud.push(<span key={i} className="font-semibold text-primary">{hit}</span>);
      i += hit.length;
    } else {
      buf += body[i];
      i += 1;
    }
  }
  if (buf) ud.push(buf);
  return ud;
}
