import { useEffect, useRef, useState } from "react";
import { FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hentFil, filFejlTekst, erPermanentFilFejl, SbFilFejl } from "@/lib/sbFil";

interface Props {
  messageId: string;
  /** Aktuel registersti – skift rydder blob og hentning. */
  sti: string;
  navn: string | null;
  type: string | null;
  isOwn: boolean;
  /** Bruger-id; skift rydder tilstand. */
  brugerId?: string;
}

/**
 * Vedhæftning via autentificeret GET sb-fil (JWT i header). Bytes vises som kortlivet blob-URL,
 * der ryddes ved ændret reference, tilbagetrækning/udløb (afmontering) og brugerskift.
 * Billeder hentes først ved tryk (ingen størrelsesgaranti for automatisk preview ≤ 200 KB).
 */
export function FilVedhaeftning({ messageId, sti, navn, type, isOwn, brugerId }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [tekst, setTekst] = useState<string | null>(null);
  const [fejl, setFejl] = useState<unknown>(null);
  const [henter, setHenter] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const erBillede = !!type?.startsWith("image/");

  const ryd = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null); setTekst(null); setFejl(null); setHenter(false);
  };
  useEffect(() => ryd, []);
  useEffect(() => { ryd(); }, [messageId, sti, brugerId]);

  const hent = async () => {
    if (henter) return;
    ryd();
    const c = new AbortController();
    ctrl.current = c;
    setHenter(true);
    try {
      const blob = await hentFil(messageId, c.signal);
      if (c.signal.aborted) return;
      if (blob.type === "text/plain") setTekst(await blob.text());
      else { const u = URL.createObjectURL(blob); urlRef.current = u; setUrl(u); }
    } catch (e) {
      if (c.signal.aborted) return;
      setFejl(e);
    } finally {
      if (!c.signal.aborted) setHenter(false);
    }
  };

  const flise = cn("flex min-h-11 w-full min-w-0 items-center gap-2 rounded p-2 text-left", isOwn ? "bg-primary-foreground/10" : "bg-background");

  if (fejl) {
    const permanent = erPermanentFilFejl(fejl);
    const ventSek = fejl instanceof SbFilFejl ? fejl.retryAfter : null;
    return (
      <div className={cn(flise, "flex-wrap")}>
        <FileIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-[14px]">{filFejlTekst(fejl)}</span>
        {!permanent && (
          <Button size="sm" variant="outline" className="min-h-11 text-foreground" onClick={() => void hent()}>
            {ventSek ? `Prøv igen (${ventSek} s)` : "Prøv igen"}
          </Button>
        )}
      </div>
    );
  }
  if (url) {
    return (
      <div className="w-full max-w-full overflow-hidden rounded">
        <img src={url} alt={navn || "Billede"} className="block h-auto max-h-60 w-full max-w-full object-contain" />
      </div>
    );
  }
  if (tekst !== null) {
    return (
      <div className="w-full min-w-0 space-y-1">
        <pre className={cn("max-h-60 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-[14px]", isOwn ? "bg-primary-foreground/10" : "bg-background text-foreground")}>{tekst}</pre>
        <Button size="sm" variant="ghost" className="min-h-11" onClick={ryd}>Luk</Button>
      </div>
    );
  }
  return (
    <button type="button" className={flise} onClick={() => void hent()} disabled={henter} aria-label={`Åbn ${navn || "fil"}`}>
      {henter ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : erBillede ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileIcon className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 truncate text-[14px] underline">{navn || (erBillede ? "Billede" : "Fil")}</span>
    </button>
  );
}
