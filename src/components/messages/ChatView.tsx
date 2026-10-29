import { useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useCallback, useMemo } from "react";
import {
  useMessages, useSendMessage, useRealtimeMessages, useMarkAsRead, useTypingIndicator, useChatAktiv,
  erSynligMedFokus, onChatSignal, SendFejl, Message, useFristUr, erUdloebet, svarUtilgaengeligt, useSvarOriginal, planlaeg, erKendtUdloebet, kontrollerUdloeb, harKendtUdloebet, synkFristForloeb, fyrFristForloeb, afslutFristForsoeg, fristOprydning, afstemKun, registrerAfsendelsesKoordinering, stopEfterbehandling, AFSTEM_BACKOFF_MS, GEMT_VAEK_TEKST, IKKE_REGISTRERET_TEKST, traadHentSekvens,
} from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { findEmployeeByAuth } from "@/lib/employeeLookup";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { MessageSearch } from "./MessageSearch";
import { AttachmentPreview, kraeverGenvalg, type LokalFil } from "./AttachmentPreview";
import { TypingIndicator } from "./TypingIndicator";
import { MentionInput } from "./MentionInput";
import { toast } from "sonner";
import { SkeletonList, useDraftGuard } from "@/components/mobile";
import { validerFil, udstedUpload, uploadTilSti, udstedFejlTekst, erForaeldetOperation, FIL_ACCEPT, FIL_GRAENSER_TEKST } from "@/lib/sbFil";
import {
  laesKladde, gemKladde, sletKladde, registrerKladdeOprydning, hentAfsendelser, tilfoejAfsendelse, opdaterAfsendelse,
  fjernAfsendelse, afsendelsesFil, saetAfsendelsesFil, harLagringsFejl, abonnerAfsendelser,
  sessionsGeneration, fastholdEjer, annullerOperation, ejerGyldig, nytOperationsId, type OperationsEjer, harKladdeLagerFejl, kladdeFilTilstand, startKladdeUpload, opdaterKladdeUpload,
  erAktuelKladdeUpload, fjernKladdeFil, saetKladdeFilPost, filErSendeklar, type Afsendelse, type FilMeta,
} from "@/lib/sbKladder";

registrerKladdeOprydning();

const LAGER_FEJL = "Kladden kunne ikke gemmes på enheden – den findes kun, mens siden er åben";
const TOM: Afsendelse[] = [];
// ---------- §4: netværkslås pr. id og fælles afstemningskø (delt på tværs af monteringer) ----------
/** Højst ét netværksforløb pr. (generation, medarbejder, samtale, id); låsen ejes af én operation. */
const laase = new Map<string, string>();
const laasNoegle = (gen: number, emp: string, conv: string, id: string) => `${gen}:${emp}:${conv}:${id}`;
export function tagLaas(k: string, op: string): boolean { if (laase.has(k)) return false; laase.set(k, op); return true; }
/** b4 (iii): en gammel afslutning frigiver kun sin egen lås. */
export function frigivLaas(k: string, op: string): void { if (laase.get(k) === op) laase.delete(k); }

export const MAKS_SAMTIDIGE_AFSTEMNINGER = 3;
const LAAST_VENT_MS = 1000;
/** c2 §6: køens kapacitet tilhører én sessionsgeneration; gamle afslutninger frigiver kun deres egen sessions plads. */
/** d1 §2: en ventende pladsanmodning ejes af én operation for ét id (noegle), så stopvejen kan annullere netop den. */
interface PladsAnmodning { noegle: string | null; op: string | null; r: (ok: boolean) => void }
interface KoeSession { gen: number; aktive: number; koe: AfstemForloeb[]; venter: PladsAnmodning[] }
interface AfstemForloeb {
  noegle: string; id: string; ejer: OperationsEjer; qc: QueryClient; session: KoeSession;
  forsoeg: number; naeste: number; timer: ReturnType<typeof setTimeout> | null;
  iKoe: boolean; aktiv: boolean; udtoemt: boolean; genstartVenter: boolean;
  /** B2b-2 §9: operationen, der netop nu er ført ind i afstemKun (stopvejen invaliderer den). */
  aktivOp: string | null;
  /** Manuel handling ejer id'et lige nu; baggrunden venter på dens eksplicitte fortsættelse. */
  manuel: boolean;
}
const forloeb = new Map<string, AfstemForloeb>();
/**
 * d1 §1: accepteret manuel afsendelsesoperation pr. id (noegle → operations-id). Registreres synkront før første await
 * og gælder, mens forsøget venter på plads eller arbejder. Ret/ny afsendelse med samme id afvises imens.
 */
const afsOps = new Map<string, string>();
/** Til B2b/B2d: er id'et ejet af et accepteret manuelt forsøg lige nu? */
export const afsendelseOptaget = (gen: number, emp: string, conv: string, id: string) => afsOps.has(laasNoegle(gen, emp, conv, id));
let koeSession: KoeSession = { gen: sessionsGeneration(), aktive: 0, koe: [], venter: [] };
const koeLyttere = new Set<() => void>();
let koeVersion = 0;
const meldKoe = () => { koeVersion++; for (const l of koeLyttere) l(); };
const abonnerKoe = (l: () => void) => { koeLyttere.add(l); return () => { koeLyttere.delete(l); }; };

/** Logud/brugerskift: gamle timere, køposter, ventende pladser og låse afkobles; ny session får ny kapacitet. */
function skiftKoeSession(gen: number): void {
  const gl = koeSession;
  for (const [k, f] of forloeb) {
    if (f.session === gl || f.ejer.gen !== gen) { if (f.timer) clearTimeout(f.timer); f.timer = null; forloeb.delete(k); }
  }
  for (const k of [...laase.keys()]) if (!k.startsWith(`${gen}:`)) laase.delete(k);
  gl.koe.length = 0;
  const venter = gl.venter.splice(0);
  koeSession = { gen, aktive: 0, koe: [], venter: [] };
  for (const v of venter) v.r(false);
  for (const op of afsOps.values()) annullerOperation(op);
  afsOps.clear();
  meldKoe();
}
const aktuelKoeSession = (): KoeSession => {
  const g = sessionsGeneration();
  if (koeSession.gen !== g) skiftKoeSession(g);
  return koeSession;
};
abonnerAfsendelser(() => { if (koeSession.gen !== sessionsGeneration()) skiftKoeSession(sessionsGeneration()); });

/** Til prøver og B2d-diagnose: aktuel sessions kapacitet (kun tal). */
export const afstemningsKapacitet = () => ({ gen: koeSession.gen, aktive: koeSession.aktive, ventende: koeSession.venter.length, iKoe: koeSession.koe.length });

/** Plads til manuel afsendelse/afstemning i samme kapacitet som baggrunden; false = sessionen er skiftet. */
function tagPlads(s: KoeSession, noegle: string | null = null, op: string | null = null): Promise<boolean> {
  if (s !== aktuelKoeSession()) return Promise.resolve(false);
  if (s.aktive < MAKS_SAMTIDIGE_AFSTEMNINGER) { s.aktive++; return Promise.resolve(true); }
  return new Promise<boolean>((r) => s.venter.push({ noegle, op, r }));
}
/** Frigiver kun den angivne sessions plads; en gammel session påvirker aldrig den nye. */
function frigivPlads(s: KoeSession): void {
  if (s !== koeSession) return;
  const naeste = s.venter.shift();
  if (naeste) { naeste.r(true); return; } // pladsen overdrages direkte
  s.aktive = Math.max(0, s.aktive - 1);
  pumpKoe(s);
}

const gyldigt = (f: AfstemForloeb) => forloeb.get(f.noegle) === f && f.session === koeSession && ejerGyldig(f.ejer);

function planlaegForloeb(f: AfstemForloeb): void {
  if (!gyldigt(f) || f.timer || f.iKoe || f.aktiv || f.udtoemt || f.manuel) return;
  f.timer = setTimeout(() => {
    f.timer = null;
    if (!gyldigt(f) || f.manuel) return;
    f.iKoe = true; f.session.koe.push(f); pumpKoe(f.session);
  }, Math.max(0, f.naeste - Date.now()));
}
function pumpKoe(s: KoeSession): void {
  if (s !== koeSession) return;
  while (s.aktive < MAKS_SAMTIDIGE_AFSTEMNINGER && s.koe.length && !s.venter.length) {
    const f = s.koe.shift()!;
    f.iKoe = false;
    if (!gyldigt(f) || f.manuel) continue;
    s.aktive++;
    void koerForloeb(f, s);
  }
}
async function koerForloeb(f: AfstemForloeb, s: KoeSession): Promise<void> {
  const { emp, conv, gen } = f.ejer;
  const a = hentAfsendelser(emp, conv).find((x) => x.id === f.id);
  if (!a || a.tilstand !== "afstemmer") { frigivPlads(s); stopForloeb(f.noegle); return; }
  const op = nytOperationsId();
  // Optaget af manuel afsendelse: planlæg fortsættelse i stedet for at opgive (§4).
  if (!tagLaas(f.noegle, op)) { frigivPlads(s); f.naeste = Date.now() + LAAST_VENT_MS; planlaegForloeb(f); return; }
  f.aktiv = true; f.aktivOp = op;
  let r: Awaited<ReturnType<typeof afstemKun>> = "ukendt";
  try { r = await afstemKun({ id: f.id, conversationId: conv, attachmentPath: a.fil?.sti ?? undefined, ejer: { ...f.ejer, op } }); }
  catch { r = "ukendt"; }
  finally { frigivLaas(f.noegle, op); f.aktiv = false; if (f.aktivOp === op) f.aktivOp = null; frigivPlads(s); }
  if (!gyldigt(f)) return;
  if (r === "fundet") {
    fjernAfsendelse(emp, conv, f.id, gen);
    stopForloeb(f.noegle);
    if (ejerGyldig(f.ejer)) void f.qc.invalidateQueries({ queryKey: ["chat-messages", conv] });
    return;
  }
  if (r === "stop") { opdaterAfsendelse(emp, conv, f.id, { tilstand: "afvist", fejl: IKKE_REGISTRERET_TEKST }, gen); stopForloeb(f.noegle); return; }
  if (r === "gemt_vaek") {
    saetAfsendelsesFil(emp, conv, f.id, null);
    opdaterAfsendelse(emp, conv, f.id, { tilstand: "gemt_vaek", tekst: "", fil: null, svarId: null }, gen);
    stopForloeb(f.noegle);
    return;
  }
  if (r === "genudsted") {
    // §8 A: kun et tilbud – automatisk afstemning udfører aldrig genudstedelse.
    opdaterAfsendelse(emp, conv, f.id, { tilstand: afsendelsesFil(emp, conv, f.id) ? "genudsted" : "vaelg_fil", fejl: null }, gen);
    stopForloeb(f.noegle);
    return;
  }
  if (f.genstartVenter) { f.genstartVenter = false; f.forsoeg = 0; f.naeste = 0; planlaegForloeb(f); meldKoe(); return; }
  if (f.forsoeg >= AFSTEM_BACKOFF_MS.length) { f.udtoemt = true; meldKoe(); return; }
  f.naeste = Date.now() + AFSTEM_BACKOFF_MS[f.forsoeg];
  f.forsoeg++;
  planlaegForloeb(f);
}
function stopForloeb(k: string): void {
  const f = forloeb.get(k);
  if (!f) return;
  if (f.timer) clearTimeout(f.timer);
  f.timer = null;
  const i = f.session.koe.indexOf(f);
  if (i >= 0) f.session.koe.splice(i, 1);
  forloeb.delete(k);
  meldKoe();
}
/** Sikrer ét forløb pr. id; eksisterende forløb (med backoff) bevares ved remount. */
function sikrForloeb(ejer: OperationsEjer, id: string, qc: QueryClient): AfstemForloeb | null {
  const s = aktuelKoeSession();
  if (ejer.gen !== s.gen || !ejerGyldig(ejer)) return null;
  const k = laasNoegle(ejer.gen, ejer.emp, ejer.conv, id);
  const f = forloeb.get(k);
  if (f && gyldigt(f)) { f.qc = qc; planlaegForloeb(f); return f; }
  const ny: AfstemForloeb = { noegle: k, id, ejer, qc, session: s, forsoeg: 0, naeste: 0, timer: null, iKoe: false, aktiv: false, udtoemt: false, genstartVenter: false, manuel: false, aktivOp: null };
  forloeb.set(k, ny);
  planlaegForloeb(ny);
  return ny;
}
/** Online/forgrund: højst én ventende genstart pr. id (gentagne hændelser samles). Kun læsning. */
function genstartForloeb(): void {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  const s = aktuelKoeSession();
  for (const f of forloeb.values()) {
    if (!gyldigt(f) || f.session !== s) continue;
    if (f.aktiv || f.iKoe || f.manuel) { f.genstartVenter = true; continue; }
    if (f.timer) { clearTimeout(f.timer); f.timer = null; }
    f.forsoeg = 0; f.naeste = 0; f.udtoemt = false;
    planlaegForloeb(f);
  }
  meldKoe();
}
/** c2 §5: manuel handling overtager forløbet for id'et (timer/køpost stoppes, forløbet bevares). */
function overtagForloeb(ejer: OperationsEjer, id: string, qc: QueryClient): AfstemForloeb | null {
  const f = sikrForloeb(ejer, id, qc);
  if (!f) return null;
  if (f.timer) { clearTimeout(f.timer); f.timer = null; }
  const i = f.session.koe.indexOf(f);
  if (i >= 0) { f.session.koe.splice(i, 1); f.iKoe = false; }
  f.manuel = true; f.udtoemt = false;
  meldKoe();
  return f;
}
/** c2 §5: efter manuel handling planlægges eksplicit næste afstemning (eller forløbet stoppes) – uafhængigt af React. */
function afslutManuel(f: AfstemForloeb | null, emp: string, conv: string, id: string): void {
  if (!f || !gyldigt(f)) return;
  f.manuel = false;
  const a = hentAfsendelser(emp, conv).find((x) => x.id === id);
  if (!a || a.tilstand !== "afstemmer") { stopForloeb(f.noegle); return; }
  f.genstartVenter = false;
  f.forsoeg = 1; f.naeste = Date.now() + AFSTEM_BACKOFF_MS[0];
  planlaegForloeb(f);
  meldKoe();
}
/**
 * c2 §6: afgrænset stopvej (til B2d ved bekræftet sletning/forladelse). Stopper timere og køposter for
 * (medarbejder, samtale[, id]) i den aktuelle generation; igangværende kald afslutter og frigiver kun egne ressourcer.
 */
export function stopAfstemninger(emp: string, conv: string, id?: string): void {
  const s = aktuelKoeSession();
  const ramt = (k: string) => (id === undefined ? k.startsWith(laasNoegle(s.gen, emp, conv, "")) : k === laasNoegle(s.gen, emp, conv, id));
  // d1 §2: 1) invalidér operationerne, 2) annullér deres ventende pladsanmodninger, 3) stop timere/køposter.
  for (const [k, op] of [...afsOps]) if (ramt(k)) { annullerOperation(op); afsOps.delete(k); }
  // B2b-2 stophul 1: den operation, der er ført ind i en aktiv afstemKun, invalideres, så et sent svar ikke starter registeropslag.
  for (const f of forloeb.values()) if (f.session === s && ramt(f.noegle) && f.aktivOp) annullerOperation(f.aktivOp);
  // B2b-2 stophul 2: detached efterbehandling, statusopslag og tjek-genforsøg efter bekræftet INSERT.
  stopEfterbehandling(emp, conv, id);
  for (const v of [...s.venter]) {
    if (v.noegle && ramt(v.noegle)) { s.venter.splice(s.venter.indexOf(v), 1); if (v.op) annullerOperation(v.op); v.r(false); }
  }
  for (const f of [...forloeb.values()]) if (f.session === s && ramt(f.noegle)) stopForloeb(f.noegle);
  meldKoe();
}
/** B2b-2 §4: serverhandlinger på et id samordnes med manuel afsendelse, netværkslås, aktiv afstemning og pending post. */
registrerAfsendelsesKoordinering((gen, emp, conv, id) => {
  const k = laasNoegle(gen, emp, conv, id);
  if (afsOps.has(k) || laase.has(k) || forloeb.get(k)?.aktiv) return true;
  // B2b-3a §2a: kun fysisk/planlagt arbejde blokerer. En udtømt afstemning (»Prøv igen« venter på brugeren)
  // spærrer ikke serverhandlinger tavst; en synlig serverrække samordnes med posten i ChatView.
  return hentAfsendelser(emp, conv).some((a) => a.id === id && (a.tilstand === "sender" || (a.tilstand === "afstemmer" && !forloeb.get(k)?.udtoemt)));
});
const erUdtoemt = (gen: number, emp: string, conv: string, id: string) => !!forloeb.get(laasNoegle(gen, emp, conv, id))?.udtoemt;
if (typeof window !== "undefined") {
  window.addEventListener("online", genstartForloeb);
  document.addEventListener("visibilitychange", genstartForloeb);
}

interface ChatViewProps {
  conversationId: string;
}

async function fetchCurrentEmployee(): Promise<{ id: string; full_name: string; authId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await findEmployeeByAuth<{ id: string; first_name: string | null; last_name: string | null }>(user, "id, first_name, last_name");
  return data ? { id: data.id, full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(), authId: user.id } : null;
}

const metaFra = (f: LokalFil): FilMeta => ({ name: f.name, type: f.type, size: f.size, sti: f.sti ?? null, trin: f.trin });

export function ChatView({ conversationId }: ChatViewProps) {
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [svarId, setSvarId] = useState<string | null>(null);
  const [retId, setRetId] = useState<string | null>(null);
  const [kladdeEjer, setKladdeEjer] = useState<string | null>(null);
  const [kladdeLagerFejl, setKladdeLagerFejl] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filFejl, setFilFejl] = useState<string | null>(null);
  const [kladdeVersion, setKladdeVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendLaas = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const genvalgFor = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const convRef = useRef(conversationId);
  convRef.current = conversationId;
  const queryClient = useQueryClient();

  const { data: messages, isLoading, hasOlder, isLoadingOlder, loadOlder, opdateret, hentStart } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { typingUsers, setTyping } = useTypingIndicator(conversationId);

  useRealtimeMessages(conversationId);

  const { data: currentEmployee } = useQuery({ queryKey: ["current-employee"], queryFn: fetchCurrentEmployee });
  const meId = currentEmployee?.id;
  const brugerRef = useRef<string | null>(null);
  brugerRef.current = currentEmployee?.authId ?? null;
  const meRef = useRef(meId);
  meRef.current = meId;
  const noegle = meId ? `${meId}:${conversationId}` : null;

  // Afsendelser pr. (bruger, samtale) i et delt lager – overlever samtaleskift og afmontering.
  const afsendelser = useSyncExternalStore(abonnerAfsendelser, () => (meId ? hentAfsendelser(meId, conversationId) : TOM));
  const afsLagerFejl = useSyncExternalStore(abonnerAfsendelser, () => (meId ? harLagringsFejl(meId, conversationId) : false));

  // §3: filposten og uploadforløbet ejes af lageret; komponenten abonnerer (overlever afmontering og navigation).
  const filTilstand = useSyncExternalStore(abonnerAfsendelser, () => (meId ? kladdeFilTilstand(meId, conversationId) : null));
  const visFil = filTilstand?.file && filTilstand.meta.type.startsWith("image/") ? filTilstand.file : null;
  // B2c-2b-2 §7: preview-URL'en ejes af en ref og revokes direkte (ikke i en setState-updater) ved fjernelse,
  // erstatning, afsendelse, samtaleskift og afmontering. File bevares i kladdelageret; nyt preview dannes ved genåbning.
  const previewRef = useRef<{ file: File; url: string } | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const frigivPreview = useCallback(() => {
    const p = previewRef.current;
    if (!p) return;
    previewRef.current = null;
    URL.revokeObjectURL(p.url);
    setPreview(null);
  }, []);
  useEffect(() => {
    if (!visFil) { frigivPreview(); return; }
    if (previewRef.current?.file === visFil) return;
    frigivPreview();
    const p = { file: visFil, url: URL.createObjectURL(visFil) };
    previewRef.current = p;
    setPreview(p);
  }, [visFil, frigivPreview]);
  useEffect(() => frigivPreview, [conversationId, frigivPreview]);
  // Kun en URL, der stadig ejes for netop den viste File, vises (aldrig en revoket eller fremmed).
  const previewUrl = preview && preview.file === visFil && previewRef.current === preview ? preview.url : null;
  const fil: LokalFil | null = filTilstand ? {
    file: filTilstand.file, name: filTilstand.meta.name, type: filTilstand.meta.type, size: filTilstand.meta.size, previewUrl,
    uploader: filTilstand.aktiv, sti: filTilstand.meta.sti ?? undefined, trin: filTilstand.meta.trin, fejl: filTilstand.fejl ?? undefined,
  } : null;

  useChatAktiv(conversationId);
  // §5: en valgt svarreference alene er også en kladde.
  useDraftGuard(!!message.trim() || !!fil || !!retId || !!svarId || !!replyTo || afsendelser.some((a) => a.tilstand !== "gemt_vaek"));

  // Skrivekladde: indlæs ved skift. Gem kun, når state tilhører den aktuelle nøgle (aldrig gamle render-værdier).
  useEffect(() => {
    if (!meId) return;
    const k = laesKladde(meId, conversationId);
    setMessage(k?.tekst ?? "");
    setSvarId(k?.svarId ?? null);
    setRetId(k?.retId ?? null);
    setReplyTo(null);
    setFilFejl(null);
    setKladdeLagerFejl(harKladdeLagerFejl(meId, conversationId));
    setKladdeEjer(`${meId}:${conversationId}`);
  }, [meId, conversationId]);
  useEffect(() => {
    if (!meId || !noegle || kladdeEjer !== noegle) return;
    // Filposten skrives kun af lageret (§3); her bevares den uændret.
    gemKladde(meId, conversationId, { tekst: message, svarId: svarId ?? replyTo?.id ?? null, fil: laesKladde(meId, conversationId)?.fil ?? null, retId });
    setKladdeLagerFejl(harKladdeLagerFejl(meId, conversationId));
  }, [meId, noegle, kladdeEjer, conversationId, message, replyTo, svarId, retId]);
  // Send-låsen frigives først, når den ryddede kladde er renderet.
  useEffect(() => { sendLaas.current = false; }, [kladdeVersion, conversationId]);

  // B2c-1 §5: valgt svar – fra tråden, ellers et afgrænset RLS-opslag (fravær i siden er ikke bevis for sletning).
  const svarRef = svarId ?? replyTo?.id ?? null;
  const svarITraad = svarRef && messages ? messages.find((x) => x.id === svarRef) : undefined;
  // B2c-1b §2: genvalidering skjuler straks uddraget; ny forespørgselsgeneration efter 300 ms debounce.
  const [svarGen, setSvarGen] = useState(0);
  // B2bc-5a §3: `seq` = trådens hentesekvens ved hændelsen; kun blokke startet derefter er bevis.
  const [svarSkjult, setSvarSkjult] = useState<{ seq: number; gen: number } | null>(null);
  const [svarVent, setSvarVent] = useState(false);
  // Svaroriginaler inde i tråden: id → hentesekvens ved hændelsen; uddraget skjules til en frisk blok foreligger.
  const [traadSvarSkjult, setTraadSvarSkjult] = useState<ReadonlyMap<string, number>>(new Map());
  const svarOpslag = useSvarOriginal(svarRef && messages && !svarITraad ? svarRef : null, svarGen, !svarVent);

  // Lokal fristkontrol (klientens ur) på tværs af tråd, svaruddrag og valgt svar. Kun visning – intet skrives.
  const fristNu = useFristUr([
    ...(messages ?? []).flatMap((m) => [m.slettes_efter, m.reply_to?.slettes_efter]),
    svarITraad?.slettes_efter, svarOpslag.data?.slettes_efter,
  ]);
  // B2c-2a §1: kendt udløbet pr. (generation, bruger, samtale, id, frist) – et urhop tilbage genopliver intet.
  // B2bc-5b §2: render læser kun lageret; registreringen sker i layout-effekten nedenfor.
  const visBeskeder = useMemo(() => (messages ?? []).filter((m) => !erKendtUdloebet(meId, conversationId, m.id, m.slettes_efter, fristNu)), [messages, fristNu, meId, conversationId]);
  const [, setUdloebSlag] = useState(0);
  useLayoutEffect(() => {
    // Fælles fristgrundlag: tråd, svaruddrag og valgt svar registreres mod det aktuelle ur efter commit.
    // Render før frist → effekt efter frist: en nyregistreret, endnu vist række udløser én ny render.
    const t = Date.now();
    let ny = false;
    const reg = (id: string | undefined, frist: string | null | undefined) => {
      if (!id) return;
      const vist = !erKendtUdloebet(meId, conversationId, id, frist, fristNu);
      if (kontrollerUdloeb(meId, conversationId, id, frist, t).ny && vist) ny = true;
    };
    for (const m of messages ?? []) { reg(m.id, m.slettes_efter); if (m.reply_to) reg(m.reply_to.id, m.reply_to.slettes_efter); }
    if (!svarITraad && svarOpslag.data) reg(svarOpslag.data.id, svarOpslag.data.slettes_efter);
    if (ny) setUdloebSlag((x) => x + 1);
  });

  // Ryd valgt svar, når originalen er tilbagetrukket, slettet, udløbet eller bevist utilgængelig (tomt RLS-opslag).
  useEffect(() => {
    if (!svarRef || !messages) return;
    // B2bc-5a §3: under genvalidering er intet læseresultat bevis – et gammelt tomt svar rydder ikke referencen.
    // Kun den lokale frist (klientens ur, ingen læsning) må rydde imens.
    if (svarSkjult) {
      if (erUdloebet(svarITraad?.slettes_efter ?? replyTo?.slettes_efter, fristNu)) { setReplyTo(null); setSvarId(null); }
      return;
    }
    const vaek = svarITraad
      ? svarUtilgaengeligt(svarITraad, fristNu)
      : svarOpslag.isSuccess && (!svarOpslag.data || svarUtilgaengeligt(svarOpslag.data, fristNu));
    if (vaek) { setReplyTo(null); setSvarId(null); return; }
    if (svarITraad && (!replyTo || replyTo.id !== svarITraad.id || replyTo.content !== svarITraad.content)) setReplyTo(svarITraad);
  }, [messages, svarRef, svarITraad, svarOpslag.isSuccess, svarOpslag.data, fristNu, replyTo, svarSkjult]);
  useEffect(() => onChatSignal((s) => {
    if (["trukket", "slettet", "udloeb"].includes(s.haendelse) && (replyTo?.id === s.kildeId || svarId === s.kildeId)) {
      setReplyTo(null); setSvarId(null);
    }
  }), [replyTo, svarId]);
  // Signal, forgrund og genforbindelse genvaliderer det valgte svars opslag (300 ms debounce).
  const svarGenRef = useRef(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const gv = (sig?: { kildeId?: string }) => {
      // B2bc-5a §3: ugyldiggørelsen sker straks; de 300 ms forsinker kun den nye hentning.
      const seq = traadHentSekvens(conversationId);
      const maal = svarGenRef.current + 1;
      svarGenRef.current = maal;
      void queryClient.cancelQueries({ queryKey: ["chat-svar-original"] });
      queryClient.removeQueries({ queryKey: ["chat-svar-original"] });
      setSvarGen(maal);
      setSvarSkjult({ seq, gen: maal });
      setSvarVent(true);
      const kilde = sig?.kildeId;
      if (kilde) setTraadSvarSkjult((m) => new Map(m).set(kilde, seq));
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        setSvarVent(false);
        planlaeg(queryClient, ["chat-messages", conversationId]);
      }, 300);
    };
    const synlig = () => { if (document.visibilityState === "visible") gv(); };
    const udenSig = () => gv();
    const af = onChatSignal((sig) => gv(sig));
    window.addEventListener("online", udenSig);
    window.addEventListener("focus", udenSig);
    document.addEventListener("visibilitychange", synlig);
    return () => {
      if (t) clearTimeout(t);
      af(); window.removeEventListener("online", udenSig); window.removeEventListener("focus", udenSig); document.removeEventListener("visibilitychange", synlig);
    };
  }, [queryClient, conversationId]);
  // Skjulningen ophæves først, når et resultat fra den nye generation (eller en ny trådhentning) foreligger.
  useEffect(() => {
    if (!svarSkjult || svarGen < svarSkjult.gen || svarVent) return;
    // B2bc-5a §3: tråden er kun bevis, når alle viste blokke er startet efter hændelsen (ikke dataUpdatedAt).
    const faerdig = svarITraad ? hentStart > svarSkjult.seq : !svarRef || (!svarOpslag.isFetching && (svarOpslag.isSuccess || svarOpslag.isError));
    if (faerdig) setSvarSkjult(null);
  }, [svarSkjult, svarGen, svarVent, svarITraad, hentStart, svarRef, svarOpslag.isFetching, svarOpslag.isSuccess, svarOpslag.isError]);
  useEffect(() => {
    if (!traadSvarSkjult.size) return;
    let rest: Map<string, number> | null = null;
    for (const [id, seq] of traadSvarSkjult) if (hentStart <= seq) (rest ??= new Map()).set(id, seq);
    if ((rest?.size ?? 0) !== traadSvarSkjult.size) setTraadSvarSkjult(rest ?? new Map());
  }, [hentStart, traadSvarSkjult]);
  // B2bc-5c-1 §1: valgt svar bruger samme kendt-udløbet-grundlag (urhop genopliver ikke).
  const svarVaekKendt = (s: { id: string; slettes_efter?: string | null }) => erKendtUdloebet(meId, conversationId, s.id, s.slettes_efter, fristNu);
  const visSvar = svarSkjult ? null
    : svarITraad && !svarUtilgaengeligt(svarITraad, fristNu) && !svarVaekKendt(svarITraad) ? svarITraad
    : !svarITraad && svarOpslag.data && !svarUtilgaengeligt(svarOpslag.data, fristNu) && !svarVaekKendt(svarOpslag.data) ? svarOpslag.data : null;

  // Kvitterer kun hentede/viste LEVEREDE beskeder fra andre uden egen kvittering – kun ved synligt vindue med fokus.
  // B2c-1: skjulte (lokalt udløbne) rækker kvitteres aldrig.
  const ukvitterede = visBeskeder
    .filter((m) => meId && m.sender_id !== meId && m.status === "leveret" && !m.read_receipts?.some((rr) => rr.employee_id === meId))
    .map((m) => m.id);
  const ukvitteretNoegle = ukvitterede.join(",");
  const fristPrId = useRef(new Map<string, string | null>());
  fristPrId.current = new Map((messages ?? []).map((m) => [m.id, m.slettes_efter]));
  useEffect(() => {
    if (!conversationId || !ukvitterede.length) return;
    const kvitter = () => {
      // B2c-1b §1: aktuel frist ved selve kvitteringen – fokus før fristtimeren kvitterer aldrig udløbne id'er.
      const nuNu = Date.now();
      const ids = ukvitterede.filter((id) => !erKendtUdloebet(meRef.current, conversationId, id, fristPrId.current.get(id), nuNu));
      if (ids.length && erSynligMedFokus() && !markAsRead.isPending) markAsRead.mutate({ conversationId, messageIds: ids });
    };
    kvitter();
    window.addEventListener("focus", kvitter);
    document.addEventListener("visibilitychange", kvitter);
    return () => {
      window.removeEventListener("focus", kvitter);
      document.removeEventListener("visibilitychange", kvitter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, ukvitteretNoegle]);

  // B2c-1 §5 / B2c-2a §1: lokalt udløbne rækker genhentes (frist + 500 ms, derefter 2/4/8/16/32 s). Budgettet ejes
  // af det konkrete fristforløb (id + slettes_efter) i useChat og overlever remount og andre rækkers udløb/bortfald.
  const udloebneListe = (messages ?? []).filter((m) => m.slettes_efter && erKendtUdloebet(meId, conversationId, m.id, m.slettes_efter, fristNu));
  const udloebne = udloebneListe.map((m) => `${m.id}@${m.slettes_efter}`).join(",");
  // B2c-2b-2: fristoprydning via stopvejen for netop de kendt udløbne id'er (én gang pr. frist og generation).
  // Låsen for fysisk igangværende arbejde og andre afsendelser/kladder røres ikke.
  const fristRyddet = useRef(new Set<string>());
  useEffect(() => {
    if (!meId || !udloebne) return;
    for (const x of udloebne.split(",")) {
      const k = `${sessionsGeneration()}:${conversationId}:${x}`;
      if (fristRyddet.current.has(k)) continue;
      fristRyddet.current.add(k);
      fristOprydning(meId, conversationId, x.slice(0, x.indexOf("@")));
    }
  }, [udloebne, meId, conversationId]);
  const [fristSlag, setFristSlag] = useState(0);
  useEffect(() => {
    if (!messages) return; // ukendt liste: intet forløb afsluttes
    const liste = udloebne ? udloebne.split(",").map((x) => { const i = x.indexOf("@"); return { id: x.slice(0, i), frist: x.slice(i + 1) }; }) : [];
    const due = synkFristForloeb(meId, conversationId, liste, Date.now());
    if (due === null) return;
    const t = setTimeout(() => {
      const nr = fyrFristForloeb(meId, conversationId, Date.now());
      if (nr !== null) {
        // B2bc-5c-1 §2: kun dette forsøgs afslutning (svar eller fejl) starter næste ventetid.
        const emp = meId, conv = conversationId;
        void queryClient.invalidateQueries({ queryKey: ["chat-messages", conv] }).catch(() => undefined).finally(() => {
          afslutFristForsoeg(emp, conv, nr, Date.now());
          setFristSlag((x) => x + 1);
        });
      }
      setFristSlag((x) => x + 1);
    }, Math.max(0, due - Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [udloebne, opdateret, conversationId, queryClient, meId, fristSlag, !!messages]);

  const nyesteId = messages?.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [nyesteId, afsendelser.length, conversationId, isLoading]);

  const handleTyping = () => {
    if (!currentEmployee) return;
    const conv = conversationId, id = currentEmployee.id, navn = currentEmployee.full_name;
    setTyping(true, id, navn, conv);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; void setTyping(false, id, navn, conv); }, 2000);
  };
  // §7: skrive-timeren er komponentejet og ryddes ved samtaleskift og afmontering (ingen sen presence-skrivning).
  useEffect(() => () => {
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
  }, [conversationId]);

  /** Ét afsendelsesforsøg for samme id. Bruger, samtale og sessionsgeneration fastholdes fra starten. */
  const deliver = useCallback(async (emp: string, conv: string, id: string, genudsted = false) => {
    // §1: ejer fastholdes synkront før første await; alle efterfølgende trin tjekker ejerskabet.
    const ejer = fastholdEjer(emp, conv, brugerRef.current);
    if (!ejer) return; // manglende identitet → ingen skrivende handling
    const gen = ejer.gen, op = ejer.op;
    const fk = laasNoegle(gen, emp, conv, id);
    // d1 §1: vagten omfatter den konkrete operation – ikke kun session/samtale/id.
    const vagt = () => ejerGyldig(ejer) && afsOps.get(fk) === op;
    const kon = { vagt, bruger: ejer.bruger };
    const a = hentAfsendelser(emp, conv).find((x) => x.id === id);
    if (!a) return;
    // §4/§8(4): højst ét netværksforløb pr. id – også mod baggrundsafstemning.
    // c2 §5: optaget id tilsluttes det eksisterende forløb (genstart efter dets afslutning), intet konkurrerende kald.
    if (afsOps.has(fk) || !tagLaas(fk, op)) { const f = sikrForloeb(ejer, id, queryClient); if (f && !f.manuel) f.genstartVenter = true; return; }
    // d1 §1: ejerskab af netop denne afsendelse registreres synkront, før første await.
    afsOps.set(fk, op);
    const ks = aktuelKoeSession();
    const forl = overtagForloeb(ejer, id, queryClient);
    meldKoe();
    const slipEje = () => { if (afsOps.get(fk) === op) afsOps.delete(fk); frigivLaas(fk, op); meldKoe(); };
    // c2 §6: manuel afsendelse deler køens tre pladser; anmodningen ejes af operationen (d1 §2).
    if (ks.gen !== gen || !(await tagPlads(ks, fk, op))) { slipEje(); return; }
    if (!vagt()) { slipEje(); frigivPlads(ks); return; }
    opdaterAfsendelse(emp, conv, id, { tilstand: a.tidligereUkendt ? "afstemmer" : "sender", fejl: null }, gen);
    let filMeta = a.fil;
    try {
      if (genudsted && filMeta) {
        // §10: genudstedelse fra den bevarede File (kun dokumenteret ubundet overtaget sti, kun brugerudløst, én gang).
        const file = afsendelsesFil(emp, conv, id);
        if (!file) { opdaterAfsendelse(emp, conv, id, { tilstand: "vaelg_fil" }, gen); return; }
        const u = await udstedUpload(conv, file, filMeta.type, kon);
        if (!vagt()) return;
        filMeta = { ...filMeta, sti: u.sti, trin: "uploader" };
        opdaterAfsendelse(emp, conv, id, { fil: filMeta }, gen);
        await uploadTilSti(u, file, filMeta.type, kon);
        if (!vagt()) return;
        filMeta = { ...filMeta, trin: "uploadet" };
        opdaterAfsendelse(emp, conv, id, { fil: filMeta }, gen);
      }
      // §3: en filsending kræver bekræftet upload (trin=uploadet) og ikke-tom sti på alle veje.
      if (filMeta && !filErSendeklar(filMeta)) {
        opdaterAfsendelse(emp, conv, id, { tilstand: afsendelsesFil(emp, conv, id) ? "genudsted" : "vaelg_fil", fejl: null }, gen);
        return;
      }
      await sendMessage.mutateAsync({
        id, conversationId: conv, content: a.tekst, replyToId: a.svarId ?? undefined,
        attachmentPath: filMeta?.sti ?? undefined, attachmentType: filMeta?.type, attachmentName: filMeta?.name,
        tidligereUkendt: a.tidligereUkendt, ejer,
      });
      if (vagt()) fjernAfsendelse(emp, conv, id, gen);
    } catch (e) {
      if (!vagt()) return; // stoppet/erstattet/ny session: rør aldrig en nyere post med samme id
      if (e instanceof SendFejl) {
        if (e.art === "gemt_vaek") {
          saetAfsendelsesFil(emp, conv, id, null);
          opdaterAfsendelse(emp, conv, id, { tilstand: "gemt_vaek", tekst: "", fil: null, svarId: null, fejl: null }, gen);
        } else if (e.art === "genudsted") {
          opdaterAfsendelse(emp, conv, id, { tilstand: afsendelsesFil(emp, conv, id) ? "genudsted" : "vaelg_fil", fejl: null }, gen);
        } else if (e.art === "server" || e.art === "stop") {
          // stop: filstien er bundet til et andet id – ingen succes, intet INSERT, ingen genudstedelse.
          opdaterAfsendelse(emp, conv, id, { tilstand: "afvist", fejl: e.message }, gen);
        } else if (e.indsat || a.tidligereUkendt) {
          opdaterAfsendelse(emp, conv, id, { tilstand: "afstemmer", tidligereUkendt: true, fejl: null }, gen);
        } else {
          // Fejlet forhåndsopslag uden tidligere ukendt udfald: intet INSERT – kendt ikke gennemført.
          opdaterAfsendelse(emp, conv, id, { tilstand: "afvist", fejl: null }, gen);
        }
      } else {
        // Udstedelse/upload ved genudstedelse fejlede før INSERT.
        opdaterAfsendelse(emp, conv, id, { tilstand: "genudsted", fejl: udstedFejlTekst(e) }, gen);
      }
    } finally {
      const egen = vagt();
      frigivPlads(ks);
      if (egen) afslutManuel(forl, emp, conv, id);
      slipEje();
    }
  }, [sendMessage, queryClient]);

  // §4: afstemning (kun læsning) via den fælles kø; listeændringer berører kun tilføjede/fjernede id'er.
  const afstemmer = afsendelser.filter((a) => a.tilstand === "afstemmer").map((a) => a.id).join(",");
  const koeV = useSyncExternalStore(abonnerKoe, () => koeVersion);
  useEffect(() => {
    if (!meId) return;
    const ejer = fastholdEjer(meId, conversationId, brugerRef.current);
    if (!ejer) return;
    const ids = new Set(afstemmer ? afstemmer.split(",") : []);
    for (const id of ids) sikrForloeb(ejer, id, queryClient);
    for (const f of [...forloeb.values()]) {
      if (f.ejer.emp === meId && f.ejer.conv === conversationId && f.ejer.gen === ejer.gen && !ids.has(f.id) && !f.aktiv && !f.manuel) stopForloeb(f.noegle);
    }
  }, [meId, conversationId, afstemmer, queryClient]);
  void koeV;
  const gen = sessionsGeneration();
  // B2b-3a §2a: en synlig egen serverrække med samme id beviser gemningen. Posten ryddes, når intet fysisk arbejde
  // (manuel afsendelse, netværkslås, aktiv afstemning) holder id'et; ellers venter den på sin egen afslutning.
  const synligeEgne = (messages ?? []).filter((m) => m.sender_id === meId).map((m) => m.id);
  const synligNoegle = afsendelser.filter((a) => synligeEgne.includes(a.id)).map((a) => a.id).join(",");
  useEffect(() => {
    if (!meId || !synligNoegle) return;
    const g = sessionsGeneration();
    for (const id of synligNoegle.split(",")) {
      const k = laasNoegle(g, meId, conversationId, id);
      if (afsOps.has(k) || laase.has(k) || forloeb.get(k)?.aktiv) continue;
      if (forloeb.has(k)) stopForloeb(k);
      fjernAfsendelse(meId, conversationId, id, g);
    }
  }, [meId, conversationId, synligNoegle, koeV]);
  const udtoemt = { has: (id: string) => !!meId && erUdtoemt(gen, meId, conversationId, id) };

  const composerTom = !message.trim() && !fil && !retId && !svarId && !replyTo;
  const kanSende = !!meId && (!!message.trim() || !!fil) && !fil?.uploader && !fil?.fejl && !(fil && kraeverGenvalg(fil))
    && filErSendeklar(fil ? metaFra(fil) : null);

  const handleSend = () => {
    if (sendLaas.current || !meId || !kanSende) return;
    if (message.length > 4000) { toast.error("Beskeden må højst være 4.000 tegn"); return; }
    sendLaas.current = true; // synkront, før id dannes
    const emp = meId, conv = conversationId;
    if (currentEmployee) setTyping(false, currentEmployee.id, currentEmployee.full_name, conv);
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    frigivPreview(); // §7: preview frigives ved afsendelse; File følger afsendelsen i lageret
    const id = retId ?? crypto.randomUUID();
    const a: Afsendelse = {
      id, tekst: message.trim(), svarId: svarId ?? replyTo?.id ?? null,
      fil: fil ? metaFra(fil) : null, tilstand: "sender", fejl: null, tidligereUkendt: false, oprettet: Date.now(),
    };
    tilfoejAfsendelse(emp, conv, a, fil?.file ?? null);
    setMessage("");
    setReplyTo(null);
    setSvarId(null);
    setRetId(null);
    sletKladde(emp, conv);
    fjernKladdeFil(emp, conv);
    setKladdeVersion((v) => v + 1);
    void deliver(emp, conv, id);
  };

  /** §10: Ret af kendt afvist afsendelse – bevarer id, tekst, svar og vedhæftning; overskriver aldrig en anden kladde. */
  const ret = (a: Afsendelse) => {
    // d1 §1: håndhævet i handlingen (også klik før næste render og efter remount): et accepteret forsøg ejer id'et.
    if (!meId || !composerTom || a.tilstand !== "afvist" || afsendelseOptaget(sessionsGeneration(), meId, conversationId, a.id)) return;
    const file = afsendelsesFil(meId, conversationId, a.id);
    setMessage(a.tekst);
    setReplyTo(null); // visningen genskabes fra a.svarId
    setSvarId(a.svarId);
    setRetId(a.id);
    saetKladdeFilPost(meId, conversationId, a.fil, file);
    fjernAfsendelse(meId, conversationId, a.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /** §3: ét uploadforsøg ejet af lageret; sene svar opdaterer kun den filpost, forsøget stadig ejer. */
  const upload = async (file: File, type: string) => {
    // §1/§3 (c1): fuld kontekst fastholdes synkront; uploadforsøgets id er adskilt fra operations-id.
    const ejer = fastholdEjer(meId, conversationId, brugerRef.current);
    if (!ejer) return;
    const forsoeg = startKladdeUpload(ejer, file, { name: file.name, type, size: file.size });
    if (!forsoeg) return;
    const kon = { vagt: () => erAktuelKladdeUpload(ejer, forsoeg), bruger: ejer.bruger };
    try {
      const u = await udstedUpload(ejer.conv, file, type, kon);
      if (!opdaterKladdeUpload(ejer, forsoeg, { sti: u.sti, trin: "uploader" })) return;
      await uploadTilSti(u, file, type, kon);
      opdaterKladdeUpload(ejer, forsoeg, { trin: "uploadet", aktiv: false });
    } catch (e) {
      // Forældet operation er et særskilt udfald: ingen fejltekst, intet genforsøg, ingen skrivning.
      if (erForaeldetOperation(e)) return;
      opdaterKladdeUpload(ejer, forsoeg, { aktiv: false, sti: null, trin: "valgt", fejl: udstedFejlTekst(e) });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const maal = genvalgFor.current;
    genvalgFor.current = null;
    if (!file) return;
    const v = validerFil(file);
    if ("fejl" in v) { setFilFejl(v.fejl); return; }
    setFilFejl(null);
    if (maal && meId) {
      // Genvalg for en afsendelse, der venter på »Vælg filen igen« (samme id; ny sti ved genudstedelse).
      const a = hentAfsendelser(meId, conversationId).find((x) => x.id === maal);
      if (!a?.fil) return;
      saetAfsendelsesFil(meId, conversationId, maal, file);
      opdaterAfsendelse(meId, conversationId, maal, { tilstand: "genudsted", fil: { ...a.fil, name: file.name, size: file.size, type: v.type } });
      return;
    }
    void upload(file, v.type);
  };

  const vaelgFil = (afsendelsesId: string | null) => { genvalgFor.current = afsendelsesId; fileInputRef.current?.click(); };

  const fjernFil = () => {
    frigivPreview();
    if (meId) fjernKladdeFil(meId, conversationId);
  };

  const otherTypingUsers = typingUsers.filter(u => u.id !== currentEmployee?.id);

  if (isLoading) {
    return <div className="h-full p-3"><SkeletonList count={4} /></div>;
  }

  const lagerFejl = kladdeLagerFejl || afsLagerFejl;

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="border-b p-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)} className="h-8 px-2 md:px-3 max-md:h-11 max-md:w-11" aria-label="Søg i beskeder">
          <Search className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Søg</span>
        </Button>
      </div>

      {showSearch && <MessageSearch onClose={() => setShowSearch(false)} onSelectMessage={() => setShowSearch(false)} />}

      <ScrollArea className="flex-1 p-2 md:p-4">
        <div className="space-y-3 md:space-y-4">
          {hasOlder && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="min-h-11" onClick={loadOlder} disabled={isLoadingOlder}>
                {isLoadingOlder ? "Henter …" : "Indlæs ældre"}
              </Button>
            </div>
          )}
          {visBeskeder.map((msg) => (
            <MessageBubble key={msg.id} message={msg} svarUgyldig={!!msg.reply_to && traadSvarSkjult.has(msg.reply_to.id)} isOwn={msg.sender_id === meId} currentEmployeeId={meId} authBrugerId={currentEmployee?.authId ?? null}
              conversationId={conversationId} onReply={(m) => { setReplyTo(m); setSvarId(m.id); }} />
          ))}
          {afsendelser.filter((p) => !messages?.some((m) => m.id === p.id) && !harKendtUdloebet(meId, conversationId, p.id)).map((p) => (
            <div key={p.id} className="flex justify-end" aria-live="polite">
              <div className="max-w-[80%] min-w-0">
                {p.tilstand === "gemt_vaek" ? (
                  <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-[14px] text-muted-foreground">
                    <span className="min-w-0">{GEMT_VAEK_TEKST}</span>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Luk"
                      onClick={() => meId && fjernAfsendelse(meId, conversationId, p.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={cn("rounded-2xl px-3 py-2 text-[15px] break-words", ["afvist", "genudsted", "vaelg_fil"].includes(p.tilstand) ? "bg-destructive/10 text-foreground border border-destructive/40" : "bg-primary/70 text-primary-foreground")}>
                      {p.tekst || p.fil?.name}
                    </div>
                    {p.tilstand === "sender" ? (
                      <p className="mt-1 text-right text-[14px] text-muted-foreground">Sender …</p>
                    ) : p.tilstand === "afstemmer" ? (
                      <div className="mt-1 flex flex-col items-end">
                        <p className="text-right text-[14px] text-muted-foreground">Afstemmer …</p>
                        {udtoemt.has(p.id) && (
                          <button type="button" onClick={() => meId && void deliver(meId, conversationId, p.id)}
                            className="flex min-h-11 items-center text-[14px] font-medium text-muted-foreground active:opacity-70">
                            Prøv igen
                          </button>
                        )}
                      </div>
                    ) : p.tilstand === "vaelg_fil" ? (
                      <div className="mt-1 flex flex-col items-end">
                        <p className="text-right text-[14px] text-destructive">Vælg filen igen</p>
                        <button type="button" onClick={() => vaelgFil(p.id)} className="flex min-h-11 items-center text-[14px] font-medium text-destructive active:opacity-70">
                          Vælg filen igen
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-col items-end">
                        {p.fejl && p.fejl !== "Ikke sendt – prøv igen" && <p className="text-right text-[14px] text-destructive">{p.fejl}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => meId && void deliver(meId, conversationId, p.id, p.tilstand === "genudsted")}
                            className="flex min-h-11 items-center text-[14px] font-medium text-destructive active:opacity-70">
                            Ikke sendt – prøv igen
                          </button>
                          {p.tilstand === "afvist" && (
                            <button type="button" disabled={!composerTom || afsendelseOptaget(gen, meId ?? "", conversationId, p.id)}
                              title={composerTom ? undefined : "Send eller ryd den nuværende kladde først"}
                              className="flex min-h-11 min-w-11 items-center justify-center px-2 text-[14px] text-muted-foreground active:opacity-70 disabled:opacity-50"
                              onClick={() => ret(p)}>
                              Ret
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {visBeskeder.length === 0 && !afsendelser.some((p) => !messages?.some((m) => m.id === p.id) && !harKendtUdloebet(meId, conversationId, p.id)) && (
            <div className="text-center text-muted-foreground py-8">Ingen beskeder endnu. Start samtalen!</div>
          )}
        </div>
        <TypingIndicator users={otherTypingUsers} />
        <div ref={bottomRef} aria-hidden="true" />
      </ScrollArea>

      {svarRef && (visSvar || svarOpslag.isError || svarSkjult) && (
        <div className="px-2 md:px-4 py-2 bg-muted/50 border-t flex items-center justify-between gap-2">
          <div className="text-sm min-w-0 flex-1">
            <span className="text-muted-foreground">Svarer på: </span>
            {visSvar ? (
              <>
                <span className="font-medium">{visSvar.sender?.full_name}</span>
                <p className="text-muted-foreground truncate">{visSvar.content}</p>
              </>
            ) : (
              <span className="text-muted-foreground">Svaret kan ikke vises lige nu</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setSvarId(null); }} className="flex-shrink-0 h-8 w-8 p-0 max-md:h-11 max-md:w-11" aria-label="Fjern svar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {fil && (
        <AttachmentPreview fil={fil} onRemove={fjernFil} onGenvalg={() => vaelgFil(null)}
          onRetry={fil.fejl && fil.file ? () => { const f = fil.file; if (f) void upload(f, fil.type); } : undefined} />
      )}
      {filFejl && (
        <div className="px-2 md:px-4 py-2 border-t text-[14px] text-destructive flex items-center justify-between gap-2" role="alert">
          <span className="min-w-0">{filFejl}. {FIL_GRAENSER_TEKST}</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 max-md:h-11 max-md:w-11 shrink-0" onClick={() => setFilFejl(null)} aria-label="Luk">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {lagerFejl && <p className="px-2 md:px-4 py-1 border-t text-[14px] text-muted-foreground" role="status">{LAGER_FEJL}</p>}

      <div className="p-2 md:p-4 border-t safe-area-bottom">
        <div className="flex gap-1 md:gap-2 items-end">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept={FIL_ACCEPT} />
          <Button variant="ghost" size="icon" onClick={() => vaelgFil(null)} disabled={!!fil?.uploader}
            className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11" aria-label="Vedhæft fil" title={FIL_GRAENSER_TEKST}>
            {fil?.uploader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <MentionInput value={message} onChange={setMessage} onKeyDown={handleKeyDown} placeholder="Skriv en besked..." onTyping={handleTyping} />
          </div>
          <Button onClick={handleSend} disabled={!kanSende}
            size="icon" className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
