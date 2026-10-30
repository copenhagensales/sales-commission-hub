// S8: tekst i opslag/kommentarer med @-omtaler OG links. Første link får en lille forhåndsvisning (samme som i chatten).
import type { ReactNode } from "react";
import { LinkPreview, extractUrls } from "@/components/messages/LinkPreview";
import { renderOmtaler } from "./omtaler";
import type { Omtale } from "./omtaler";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** Omtaler og klikbare links i én tekst. */
export function renderTekstMedLinks(body: string, mentions: Omtale[] | null | undefined): ReactNode {
  if (!body) return body;
  const urls = extractUrls(body);
  if (urls.length === 0) return renderOmtaler(body, mentions);
  return body.split(URL_REGEX).map((del, i) =>
    urls.includes(del)
      ? <a key={i} href={del} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:no-underline">{del}</a>
      : <span key={i}>{renderOmtaler(del, mentions)}</span>);
}

/** Forhåndsvisning af det første link i teksten (ingen hvis intet link). */
export function FoersteLink({ body }: { body: string }) {
  const url = extractUrls(body)[0];
  return url ? <LinkPreview url={url} /> : null;
}
