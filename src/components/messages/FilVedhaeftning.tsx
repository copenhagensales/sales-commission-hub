import { useEffect, useRef, useState } from "react";
import { FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hentFil, filFejlTekst, erPermanentFilFejl, SbFilFejl } from "@/lib/sbFil";
import { fastholdEjer, ejerGyldig, sessionsGeneration, abonnerAfsendelser } from "@/lib/sbKladder";

interface Props {
  messageId: string;
  /** Aktuel registersti – skift rydder blob og hentning. */
  sti: string;
  navn: string | null;
  type: string | null;
  isOwn: boolean;
  /** Medarbejder-id; skift rydder tilstand. */
  brugerId?: string;
  /** Samtalen; indgår i hentningens fastholdte kontekst (B2c-2b-1 §6). */
  conversationId?: string;
}

/**
 * Vedhæftning via autentificeret GET sb-fil (JWT i header). Bytes vises som kortlivet blob-URL,
 * der ryddes ved ændret reference, tilbagetrækning/udløb (afmontering) og brugerskift.
 * Billeder hentes først ved tryk (ingen størrelsesgaranti for automatisk preview ≤ 200 KB).
 */
export function FilVedhaeftning({ messageId, sti, navn, type, isOwn, brugerId, conversationId }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [tekst, setTekst] = useState<string | null>(null);
  const [fejl, setFejl] = useState<unknown>(null);
  const [henter, setHenter] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const erBillede = !!type?.startsWith("image/");

  // B2c-2b-1 §6: hentningsnummer (identitet), synkron lås og monteringsstatus.
  const nrRef = useRef(0);
  const laasRef = useRef<number | null>(null);
  const monteret = useRef(true);
  const genRef = useRef(sessionsGeneration());

  const ryd = () => {
    nrRef.current++; // alle igangværende forløb bliver forældede
    laasRef.current = null;
    ctrl.current?.abort();
    ctrl.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null); setTekst(null); setFejl(null); setHenter(false);
  };
  useEffect(() => {
    monteret.current = true;
    return () => { monteret.current = false; ryd(); };
  }, []);
  useEffect(() => { ryd(); }, [messageId, sti, brugerId]);
  // Logud/brugerskift (ny sessionsgeneration, også samme bruger efter genlogin) rydder bytes og stopper hentning.
  useEffect(() => abonnerAfsendelser(() => {
    const g = sessionsGeneration();
    if (g !== genRef.current) { genRef.current = g; ryd(); }
  }), []);

  const hent = async () => {
    if (laasRef.current !== null) return; // synkron lås: to klik før render starter ikke to hentninger
    const ejer = fastholdEjer(brugerId, conversationId ?? messageId);
    ryd();
    const nr = nrRef.current;
    if (!ejer) { setFejl(new SbFilFejl(401, "jwt")); return; }
    laasRef.current = nr;
    const c = new AbortController();
    ctrl.current = c;
    const gyldig = () => monteret.current && nrRef.current === nr && !c.signal.aborted && ejerGyldig(ejer);
    setHenter(true);
    try {
      const blob = await hentFil(messageId, c.signal, { vagt: gyldig, bruger: ejer.bruger });
      if (!gyldig()) return;
      if (blob.type === "text/plain") {
        const t = await blob.text();
        if (!gyldig()) return;
        setTekst(t);
      } else {
        const u = URL.createObjectURL(blob);
        if (!gyldig()) { URL.revokeObjectURL(u); return; }
        urlRef.current = u; setUrl(u);
      }
    } catch (e) {
      if (!gyldig()) return;
      setFejl(e);
    } finally {
      // Kun eget forløb frigiver låsen; et gammelt finally rører ikke en ny hentning.
      if (laasRef.current === nr) {
        laasRef.current = null;
        if (gyldig()) setHenter(false);
      }
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
