import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ejerGyldig, ejerPasser, annullerOperation, sessionsGeneration, type OperationsEjer } from "@/lib/sbKladder";

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Nøgle for nye direkte samtaler (24d); null for grupper og historiske direkte samtaler. */
  direct_key: string | null;
  vaern_niveau: number;
  members?: ConversationMember[];
  unread_count?: number;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  employee_id: string;
  joined_at: string;
  last_read_at: string | null;
  employee?: {
    id: string;
    full_name: string;
  };
}

export interface MessageReadReceipt {
  id: string;
  message_id: string;
  employee_id: string;
  read_at: string;
  employee?: {
    id: string;
    full_name: string;
  };
}

export type BeskedStatusVaerdi = "tjekkes" | "leveret" | "afventer_afsender" | "trukket_tilbage";

/** Svaruddrag – ikke en komplet Message. */
export interface ReplyPreview {
  id: string;
  content: string;
  sender_id: string;
  sender?: { id: string; full_name: string };
  /** B2c-1 §5: originalens serverstatus/frist/sletning – til lokal visningsvagt. */
  status: BeskedStatusVaerdi | null;
  slettes_efter: string | null;
  deleted_at: string | null;
}

/** Søgeresultat (særskilt projektion af chat_messages). */
export interface SoegeResultat {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  slettes_efter: string | null;
  sender?: { id: string; full_name: string };
  conversation?: { id: string; name: string | null; is_group: boolean } | null;
}

// ---------- B2c-1 §5: lokal fristkontrol (kun visningsværn; skriver intet) ----------
/** Er serverleveret slettes_efter passeret efter KLIENTENS ur? */
export function erUdloebet(slettesEfter: string | null | undefined, nu: number): boolean {
  if (!slettesEfter) return false;
  const t = new Date(slettesEfter).getTime();
  return Number.isFinite(t) && t <= nu;
}
/** Er svaroriginalen utilgængelig (tilbagetrukket, slettet eller udløbet lokalt)? */
export function svarUtilgaengeligt(r: { status: BeskedStatusVaerdi | null; slettes_efter: string | null; deleted_at?: string | null }, nu: number): boolean {
  return r.status === "trukket_tilbage" || !!r.deleted_at || erUdloebet(r.slettes_efter, nu);
}
/**
 * Ur for frister: armeres med tidsforskellen (frist − Date.now()) til nærmeste FREMTIDIGE frist; efter udløb
 * planlægges næste. Allerede udløbne frister armeres aldrig (ingen 0-ms-løkke). Forgrund/genforbindelse kontrollerer straks.
 */
export function useFristUr(frister: ReadonlyArray<string | null | undefined>): number {
  const [nu, setNu] = useState(() => Date.now());
  const noegle = [...new Set(frister.filter((f): f is string => !!f))].sort().join("|");
  useEffect(() => {
    const opd = () => setNu(Date.now());
    const synlig = () => { if (document.visibilityState === "visible") opd(); };
    const start = Date.now();
    let min = Infinity;
    for (const f of noegle ? noegle.split("|") : []) {
      const d = new Date(f).getTime() - start;
      if (d > 0 && d < min) min = d;
    }
    const t = Number.isFinite(min) ? setTimeout(opd, Math.min(min, 2 ** 31 - 1)) : null;
    window.addEventListener("online", opd);
    window.addEventListener("focus", opd);
    document.addEventListener("visibilitychange", synlig);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("online", opd);
      window.removeEventListener("focus", opd);
      document.removeEventListener("visibilitychange", synlig);
    };
  }, [noegle, nu]);
  return nu;
}

/** Ventetider for genhentning, når serveren stadig returnerer en lokalt udløbet række (ure kan afvige). */
export const FRIST_GENHENT_MS = [500, 2000, 4000, 8000, 16000, 32000] as const;

/**
 * B2c-1 §5: svaroriginal uden for de indlæste sider valideres ved et afgrænset RLS-opslag (én række).
 * null = ingen synlig række (utilgængelig). Nøglen indeholder sessionsgenerationen, så et gammelt svar aldrig rammer en ny session.
 */
export function useSvarOriginal(id: string | null) {
  const gen = sessionsGeneration();
  return useQuery({
    queryKey: ["chat-svar-original", gen, id],
    enabled: !!id,
    retry: false,
    queryFn: async (): Promise<ReplyPreview | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, content, sender_id, status, slettes_efter, deleted_at, sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const s = data.sender;
      return {
        id: data.id, content: data.content, sender_id: data.sender_id,
        status: tilStatus(data.status), slettes_efter: data.slettes_efter, deleted_at: data.deleted_at,
        sender: s && s.id ? { id: s.id, full_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() } : undefined,
      };
    },
  });
}
const STATUSSER: readonly BeskedStatusVaerdi[] = ["tjekkes", "leveret", "afventer_afsender", "trukket_tilbage"];
function tilStatus(v: unknown): BeskedStatusVaerdi | null {
  return STATUSSER.find((x) => x === v) ?? null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  reply_to_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_path: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  status: BeskedStatusVaerdi;
  revision: number;
  leveret_at: string | null;
  afventer_fra: string | null;
  trukket_tilbage_at: string | null;
  slettes_efter: string | null;
  personoplysning: boolean;
  vaern_niveau: number;
  sender?: {
    id: string;
    full_name: string;
  };
  reply_to?: ReplyPreview | null;
  reactions?: MessageReaction[];
  read_receipts?: MessageReadReceipt[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  employee_id: string;
  emoji: string;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
  };
}

async function getCurrentEmployeeId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  
  const { data } = await supabase.rpc('get_current_employee_id') as any;
  if (!data) throw new Error("Employee not found");
  return data as string;
}

export function useConversations() {
  return useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const currentEmployeeId = await getCurrentEmployeeId();
      
      // Use secure view for employee data
      const { data, error } = await supabase
        .from("chat_conversations")
        .select(`*, members:chat_conversation_members(*, employee:employee_basic_info(id, first_name, last_name))`)
        .order("updated_at", { ascending: false }) as any;

      if (error) throw error;
      
      // Ulæst = besked fra andre, ikke slettet, uden min læsekvittering (én definition: chat_ulaeste_pr_samtale).
      const { data: ulaeste, error: uErr } = await supabase.rpc("chat_ulaeste_pr_samtale");
      if (uErr) throw uErr;
      const ulaestMap = new Map((ulaeste ?? []).map((u) => [u.conversation_id, Number(u.antal) || 0]));
      const conversations = await Promise.all((data || []).map(async (conv: any) => {
        const unreadCount = ulaestMap.get(conv.id) ?? 0;
        return {
          ...conv,
          unread_count: unreadCount,
          members: conv.members?.map((m: any) => ({
            ...m,
            employee: m.employee ? {
              id: m.employee.id,
              full_name: `${m.employee.first_name || ''} ${m.employee.last_name || ''}`.trim()
            } : undefined
          }))
        };
      }));
      
      return conversations as Conversation[];
    },
  });
}

export interface ReadReceipt {
  id: string;
  message_id: string;
  employee_id: string;
  read_at: string;
  employee?: {
    id: string;
    full_name: string;
  };
}

/** Henter rækker for en id-liste i blokke à 100 id'er, hver pagineret i blokke à 1.000. Fejl → tom blok (som før). */
async function iBlokke<T = Record<string, unknown>>(
  ids: string[],
  hent: (del: string[], fra: number, til: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const ud: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const del = ids.slice(i, i + 100);
    for (let fra = 0; ; fra += 1000) {
      const { data, error } = await hent(del, fra, fra + 999);
      if (error) break;
      const rows = (data ?? []) as T[];
      ud.push(...rows);
      if (rows.length < 1000) break;
    }
  }
  return ud;
}

/** Beskeder hentes nyeste først i blokke à 100; ældre historik hentes ved »Indlæs ældre«. */
export const CHAT_PAGE_SIZE = 100;

export function useMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ["chat-messages", conversationId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Message[]> => {
      if (!conversationId) return [];
      const fra = pageParam * CHAT_PAGE_SIZE;
      // Use secure view for sender data
      const { data: nyesteFoerst, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name)
        `)
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(fra, fra + CHAT_PAGE_SIZE - 1) as any;

      if (error) throw error;
      // Vises stigende inden for blokken.
      const data = [...(nyesteFoerst || [])].reverse();
      
      // Fetch reactions for all messages
      const messageIds = (data || []).map((m: any) => m.id);
      
      // Aldrig in() over 100 id'er: blokke à 100, hver pagineret i blokke à 1.000 ordnet efter id.
      const reactions = await iBlokke(messageIds, (del, fra, til) => supabase
        .from("chat_message_reactions")
        .select(`*, employee:employee_basic_info(id, first_name, last_name)`)
        .in("message_id", del).order("id").range(fra, til));
      
      // Fetch read receipts for all messages
      const readReceipts = await iBlokke(messageIds, (del, fra, til) => supabase
        .from("chat_message_read_receipts")
        .select(`*, employee:employee_basic_info(id, first_name, last_name)`)
        .in("message_id", del).order("id").range(fra, til));
      
      // Fetch reply_to messages
      const replyToIds: string[] = [...new Set<string>((data || []).filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id))];
      const replyMessages = await iBlokke(replyToIds, (del, fra, til) => supabase
        .from("chat_messages")
        .select(`*, sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name)`)
        .in("id", del).order("id").range(fra, til));
      
      const replyMap = new Map((replyMessages || []).map((m: any) => [m.id, m]));
      const reactionsMap = new Map<string, any[]>();
      const readReceiptsMap = new Map<string, any[]>();
      
      (reactions || []).forEach((r: any) => {
        if (!reactionsMap.has(r.message_id)) {
          reactionsMap.set(r.message_id, []);
        }
        reactionsMap.get(r.message_id)!.push({
          ...r,
          employee: r.employee ? {
            id: r.employee.id,
            full_name: `${r.employee.first_name || ''} ${r.employee.last_name || ''}`.trim()
          } : undefined
        });
      });
      
      (readReceipts || []).forEach((r: any) => {
        if (!readReceiptsMap.has(r.message_id)) {
          readReceiptsMap.set(r.message_id, []);
        }
        readReceiptsMap.get(r.message_id)!.push({
          ...r,
          employee: r.employee ? {
            id: r.employee.id,
            full_name: `${r.employee.first_name || ''} ${r.employee.last_name || ''}`.trim()
          } : undefined
        });
      });
      
      return (data || []).map((msg: any) => {
        const replyTo = msg.reply_to_id ? replyMap.get(msg.reply_to_id) as any : null;
        // Svaruddrag viser aldrig originaltekst, når originalen er trukket tilbage/slettet/udløbet.
        const replyVaek = replyTo && (replyTo.status === "trukket_tilbage" || replyTo.deleted_at
          || (replyTo.slettes_efter && new Date(replyTo.slettes_efter).getTime() <= Date.now()));
        return {
          ...msg,
          sender: msg.sender ? {
            id: msg.sender.id,
            full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim()
          } : undefined,
          reply_to: replyTo ? {
            id: replyTo.id,
            content: replyVaek ? "Beskeden er ikke længere tilgængelig" : replyTo.content,
            sender_id: replyTo.sender_id,
            status: tilStatus(replyTo.status), slettes_efter: replyTo.slettes_efter ?? null, deleted_at: replyTo.deleted_at ?? null,
            sender: replyTo.sender ? {
              id: replyTo.sender.id,
              full_name: `${replyTo.sender.first_name || ''} ${replyTo.sender.last_name || ''}`.trim()
            } : undefined
          } : null,
          reactions: reactionsMap.get(msg.id) || [],
          read_receipts: readReceiptsMap.get(msg.id) || []
        };
      }) as Message[];
    },
    getNextPageParam: (last, all) => (last.length === CHAT_PAGE_SIZE ? all.length : undefined),
    enabled: !!conversationId,
  });
  // Ældste blok først; dubletter (forskudte blokke efter nye beskeder) fjernes.
  const data = useMemo(() => {
    if (!query.data) return undefined;
    const set = new Set<string>();
    const ud: Message[] = [];
    for (const page of [...query.data.pages].reverse()) {
      for (const m of page) if (!set.has(m.id)) { set.add(m.id); ud.push(m); }
    }
    return ud;
  }, [query.data]);
  return {
    data,
    isLoading: query.isLoading,
    hasOlder: !!query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: () => { if (!query.isFetching) void query.fetchNextPage(); },
    /** B2c-1: tidspunkt for seneste hentning (til fristgenhentning). */
    opdateret: query.dataUpdatedAt,
  };
}

export function useMarkMessageAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const employeeId = await getCurrentEmployeeId();
      // Fokus kontrolleres umiddelbart før skrivning (også ved retry); ellers afbrydes uden skrivning.
      if (!erSynligMedFokus()) return { conversationId };
      // Idempotent kvittering
      const { error } = await supabase
        .from("chat_message_read_receipts")
        .upsert({ 
          message_id: messageId, 
          employee_id: employeeId,
          read_at: new Date().toISOString()
        }, { onConflict: 'message_id,employee_id', ignoreDuplicates: true });
      if (error) throw error;
      
      return { conversationId };
    },
    retry: 2,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", result.conversationId] });
      queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (e, vars) => {
      console.error("Kunne ikke kvittere besked", e instanceof Error ? e.message : e);
      queryClient.invalidateQueries({ queryKey: ["chat-messages", vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

/**
 * Fejl ved afsendelse (S6/B2a §2):
 * - `server`: kendt afvist/ikke gennemført (P0001 vises ordret);
 * - `ukendt`: udfaldet er uafklaret – samme id afstemmes, ingen Ret som ny besked;
 * - `gemt_vaek`: tidligere gemning er bevist, men rækken er ikke længere tilgængelig;
 * - `genudsted`: dokumenteret ubundet sti overtaget af oprydningen – brugerudløst genudstedelse er tilladt.
 */
export class SendFejl extends Error {
  /** `indsat=false`: intet INSERT blev forsøgt i dette forsøg (fx fejlet forhåndsopslag). */
  constructor(public art: "server" | "ukendt" | "gemt_vaek" | "genudsted" | "stop", tekst: string, public indsat = true) { super(tekst); this.name = "SendFejl"; }
}

export const GEMT_VAEK_TEKST = "Beskeden blev gemt, men er ikke længere tilgængelig";
export const IKKE_REGISTRERET_TEKST = "Filen er ikke registreret til dig i denne samtale";
const CHAT_BUCKET = "chat-attachments";

/** Findes beskeden med dette id allerede (egen række)? null = kunne ikke afgøres. */
export async function afstemBesked(id: string, conversationId?: string): Promise<boolean | null> {
  try {
    let q = supabase.from("chat_messages").select("id, conversation_id").eq("id", id);
    if (conversationId) q = q.eq("conversation_id", conversationId);
    const { data, error } = await q.maybeSingle();
    if (error) return null;
    return !!data;
  } catch { return null; }
}

/** Egen registerrække for stien (eksisterende RLS); kun læsning. */
export type RegisterUdfald =
  | { art: "bundet_her" }                // binding til netop dette besked-id (beviser gemning)
  | { art: "bundet_andet" }              // binding til et andet id – aldrig denne afsendelses succes
  | { art: "ubundet_overtaget" }         // besked_id=null og status slettes/slettet
  | { art: "ubundet" }                   // besked_id=null og status uploadet (gyldig egen sti)
  | { art: "ukendt" };                   // manglende/minimeret række, fejl, fremmed ejer/samtale/sti, ukendt status
export async function laesRegister(sti: string, beskedId: string, conversationId: string, employeeId: string): Promise<RegisterUdfald> {
  try {
    const { data, error } = await supabase.from("sb_stier").select("bucket, sti, besked_id, status, samtale_id, ejer_employee_id")
      .eq("bucket", CHAT_BUCKET).eq("sti", sti).maybeSingle();
    if (error || !data) return { art: "ukendt" };
    // §2/§8: beviset skal vedrøre præcis denne sti i chat-bucket med egen ejer og samtale.
    if (data.bucket !== CHAT_BUCKET || data.sti !== sti) return { art: "ukendt" };
    if (data.ejer_employee_id !== employeeId || data.samtale_id !== conversationId) return { art: "ukendt" };
    if (typeof data.besked_id === "string" && data.besked_id) return data.besked_id === beskedId ? { art: "bundet_her" } : { art: "bundet_andet" };
    if (data.besked_id !== null) return { art: "ukendt" }; // ubundet betyder udtrykkeligt besked_id=null
    if (data.status === "slettes" || data.status === "slettet") return { art: "ubundet_overtaget" };
    if (data.status === "uploadet") return { art: "ubundet" };
    return { art: "ukendt" }; // ukendt/inkonsistent status
  } catch { return { art: "ukendt" }; }
}

/**
 * fundet = synlig egen besked; gemt_vaek = bevist tidligere gemning uden synlig besked;
 * ikke_fundet = fejlfrit tomt opslag (og for fil: gyldig egen ubundet sti med status uploadet) – ALDRIG bevis for »ikke gemt«;
 * stop = filstien er bundet til et andet id (ingen succes, INSERT eller genudstedelse); ukendt = uafklaret.
 */
export type Afstemning = "fundet" | "gemt_vaek" | "ikke_fundet" | "stop" | "genudsted" | "ukendt";
/** Afstemmer et afsendelses-id (kun læsning). Et tomt SELECT er ikke bevis for, at beskeden aldrig blev gemt. */
export async function afstemAfsendelse(v: Pick<SendInput, "id" | "conversationId" | "attachmentPath">, employeeId: string, vagt: () => boolean = () => true): Promise<Afstemning> {
  const r = await afstemBesked(v.id, v.conversationId);
  if (r === true) return "fundet";
  if (!vagt()) return "ukendt";
  if (v.attachmentPath) {
    const reg = await laesRegister(v.attachmentPath, v.id, v.conversationId, employeeId);
    if (reg.art === "bundet_her") return "gemt_vaek";
    if (reg.art === "bundet_andet") return "stop";
    // §8 (afgørelse A): fejlfrit tomt beskedopslag + præcis egen ubundet sti med status slettes/slettet beviser,
    // at det tidligere INSERT ikke blev gemt (binding sker i INSERT-transaktionen og kræver status uploadet).
    // Giver kun et TILBUD om genudstedelse; udføres først efter brugertryk.
    if (r === false && reg.art === "ubundet_overtaget") return "genudsted";
    if (r === null || reg.art !== "ubundet") return "ukendt"; // registerfejl/overtaget/ukendt → intet INSERT
    return "ikke_fundet";
  }
  return r === null ? "ukendt" : "ikke_fundet";
}

export interface SendInput {
  /** Stabil klientgenereret UUID for afsendelsen og alle dens genforsøg. */
  id: string;
  conversationId: string;
  content: string;
  replyToId?: string;
  attachmentPath?: string;
  attachmentType?: string;
  attachmentName?: string;
  /** Mindst ét tidligere forsøg med samme id havde ukendt udfald. */
  tidligereUkendt?: boolean;
  /** §1: obligatorisk fastholdt kontekst fra brugerhandlingens start; sender_id tages herfra. */
  ejer: OperationsEjer;
}

/** Forældet operation (logud/brugerskift): intet efterfølgende kald startes. */
const foraeldet = () => new SendFejl("ukendt", "Ikke sendt – prøv igen", false);

const ukendt = () => new SendFejl("ukendt", "Ikke sendt – prøv igen");

/**
 * Indsætter én besked med stabilt id. INSERT sker kun efter et fejlfrit forhåndsopslag;
 * ukendt udfald afstemmes, og en bekræftet række genindsættes aldrig.
 */
export async function sendBesked(v: Omit<SendInput, "ejer">, employeeId: string, vagt: () => boolean = () => true): Promise<void> {
  if (!vagt()) throw foraeldet();
  const foer = await afstemAfsendelse(v, employeeId, vagt);
  if (!vagt()) throw foraeldet();
  if (foer === "fundet") return;
  if (foer === "gemt_vaek") throw new SendFejl("gemt_vaek", GEMT_VAEK_TEKST);
  if (foer === "stop") throw new SendFejl("stop", IKKE_REGISTRERET_TEKST, false);
  if (foer === "genudsted") throw new SendFejl("genudsted", IKKE_REGISTRERET_TEKST, false);
  if (foer === "ukendt") throw new SendFejl("ukendt", "Ikke sendt – prøv igen", false);
  let error: { code?: string; message?: string } | null = null;
  try {
    const r = await supabase.from("chat_messages").insert({
      id: v.id,
      conversation_id: v.conversationId,
      sender_id: employeeId,
      content: v.content,
      reply_to_id: v.replyToId || null,
      attachment_path: v.attachmentPath || null,
      attachment_type: v.attachmentType || null,
      attachment_name: v.attachmentName || null,
    });
    error = r.error;
  } catch { error = { message: "transport" }; }
  if (!error) return;
  // Et allerede afsendt INSERT kan være gennemført; et forældet forløb starter ingen afstemning.
  if (!vagt()) throw new SendFejl("ukendt", "Ikke sendt – prøv igen");

  // Afstem altid samme id før endelig klassifikation (P0001 fra sb_fil_vaern kan komme før 23505).
  const efter = await afstemBesked(v.id, v.conversationId);
  if (efter === true) return;
  if (!vagt()) throw ukendt();
  const reg = v.attachmentPath ? await laesRegister(v.attachmentPath, v.id, v.conversationId, employeeId) : null;
  if (reg?.art === "bundet_her") throw new SendFejl("gemt_vaek", GEMT_VAEK_TEKST);
  if (reg?.art === "bundet_andet") throw new SendFejl("stop", IKKE_REGISTRERET_TEKST);
  if (efter === null) throw ukendt();

  if (error.code === "P0001") {
    if (v.attachmentPath && error.message === IKKE_REGISTRERET_TEKST) {
      // §8: præcis filbindingsfejl + dokumenteret ubundet, overtaget egen sti → genudstedelse, også efter tidligere ukendt forsøg.
      if (reg?.art === "ubundet_overtaget") throw new SendFejl("genudsted", IKKE_REGISTRERET_TEKST);
      if (reg?.art !== "ubundet" || v.tidligereUkendt) throw ukendt();
    }
    // Generel P0001/CPR efter tidligere ukendt udfald er ikke bevis for afvisning → uafklaret.
    if (v.tidligereUkendt) throw ukendt();
    throw new SendFejl("server", error.message || "Beskeden blev afvist");
  }
  // 23505 uden synlig række eller transportfejl: uafklaret.
  if (error.code === "23505" || !error.code || v.tidligereUkendt) throw ukendt();
  throw new SendFejl("server", "Beskeden kunne ikke sendes");
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (v: SendInput) => {
      // §1 (c1): kun med fuld kontekst for netop denne samtale; ingen ejerløs fallback, intet opslag undervejs.
      const ejer = v.ejer;
      const vagt = () => ejerPasser(ejer, v.conversationId);
      if (!vagt()) throw foraeldet();
      await sendBesked(v, ejer.emp, vagt);
      return v;
    },
    // Afstemningsforløbet ejer genforsøgene (App.tsx' mutations.retry=1 overstyres lokalt).
    retry: 0,
    onSuccess: (v) => {
      const ejer = v.ejer;
      const vagt = () => ejerGyldig(ejer); // sent svar må ikke skrive til den nye session
      if (!vagt()) return;
      efterHandling(queryClient, ejer, v.conversationId, v.id);
      if (vagt()) void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

/** Ren afstemning (kun læsning) til backoff-løkken. */
export async function afstemKun(v: Pick<SendInput, "id" | "conversationId" | "attachmentPath" | "ejer">): Promise<Afstemning> {
  // §1 (c1): uden fuld, passende kontekst afstemmes intet.
  const vagt = () => ejerPasser(v.ejer, v.conversationId);
  if (!vagt()) return "ukendt";
  const r = await afstemAfsendelse(v, v.ejer.emp, vagt);
  return vagt() ? r : "ukendt";
}

/** Backoff for afstemning: 1, 2, 4, 8, 16, 30 s; derefter venter klienten på bruger/online/forgrund. */
export const AFSTEM_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const;

/** Redigering via sb_ret (ingen direkte content-UPDATE). Starter tjek for den nye revision. */
export interface RetInput {
  messageId: string; content: string; conversationId: string; revision: number;
  /** §2 (c1): fastholdt kontekst fra Gem-trykket. */
  ejer: OperationsEjer;
}

/** Ejerskab kontrolleres før sb_ret, efter svaret og før hver efterbehandling; låsen holdes gennem resultatafstemningen. */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId, revision, ejer }: RetInput) => {
      try {
        const vagt = () => ejerPasser(ejer, conversationId) && ejerHandling(ejer, messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        if (content.length > 4000) throw Object.assign(new Error("Højst 4.000 tegn"), { code: "P0001" });
        const res = await kaldRpc(() => supabase.rpc("sb_ret", { p_kilde: "besked", p_id: messageId, p_revision: revision, p_tekst: content }));
        if (!vagt()) throw new HandlingsFejl("stoppet");
        // §4: sb_ret returnerer den nye revision; alt andet er ikke succes.
        if (!res.error && typeof res.data === "number" && res.data > revision) return { revision: res.data, conversationId, messageId, ejer };
        const raek = await laesRaekke(messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        const ok = (r: Raekke) => r.content === content && r.revision > revision;
        if (raek !== "fejl" && raek && ok(raek)) return { revision: raek.revision, conversationId, messageId, ejer };
        throw klassificer(res, raek);
      } finally { frigivHandling(ejer, messageId); }
    },
    // §2 (c1): ingen automatisk genkørsel af sb_ret (App.tsx' mutations.retry=1 overstyres lokalt).
    retry: 0,
    onSuccess: (r) => {
      if (!ejerGyldig(r.ejer)) return;
      efterHandling(queryClient, r.ejer, r.conversationId, r.messageId);
    },
    onError: (e, v) => efterFejl(queryClient, e, v.ejer, v.conversationId, v.messageId),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;
      return { conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", result.conversationId] });
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      const employeeId = await getCurrentEmployeeId();
      
      // Check if reaction exists
      const { data: existing } = await supabase
        .from("chat_message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("employee_id", employeeId)
        .eq("emoji", emoji)
        .maybeSingle() as any;
      
      if (existing) {
        // Remove reaction
        await supabase
          .from("chat_message_reactions")
          .delete()
          .eq("id", existing.id);
      } else {
        // Add reaction
        await supabase
          .from("chat_message_reactions")
          .insert({ message_id: messageId, employee_id: employeeId, emoji });
      }
      
      return { conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", result.conversationId] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    // Kvitterer kun de beskeder, der er hentet og vist i tråden (ikke hele samtalen).
    mutationFn: async ({ conversationId, messageIds }: { conversationId: string; messageIds: string[] }) => {
      const employeeId = await getCurrentEmployeeId();
      
      // Kvitterer kun, når vinduet er synligt og har fokus (aldrig massekvittering i baggrunden).
      if (!erSynligMedFokus() || !employeeId) return conversationId;
      const ids = [...new Set(messageIds)];
      const nu = new Date().toISOString();
      for (let i = 0; i < ids.length; i += 500) {
        // Fokus kontrolleres før hver skrivning; falder det, afbrydes uden yderligere skrivning.
        if (!erSynligMedFokus()) break;
        const { error } = await supabase
          .from("chat_message_read_receipts")
          .upsert(ids.slice(i, i + 500).map((id) => ({ message_id: id, employee_id: employeeId, read_at: nu })), { onConflict: "message_id,employee_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      return conversationId;
    },
    retry: 2,
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
    onError: (e) => {
      console.error("Kunne ikke kvittere samtalen", e instanceof Error ? e.message : e);
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
    },
  });
}

/** Nøglebundne direkte samtaler (direct_key) kan ikke slettes eller forlades. */
export const kanSletteSamtale = (c: Pick<Conversation, "direct_key">) => !c.direct_key;

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const employeeId = await getCurrentEmployeeId();
      const { data: conversation, error: cErr } = await supabase
        .from("chat_conversations")
        .select("created_by, is_group, direct_key")
        .eq("id", conversationId)
        .single();
      if (cErr || !conversation) throw cErr ?? new Error("Samtalen findes ikke");
      // Afvis før nogen DELETE.
      if (conversation.direct_key) throw new Error("Direkte samtaler kan ikke slettes");

      if (conversation.created_by === employeeId || !conversation.is_group) {
        const a = await supabase.from("chat_messages").delete().eq("conversation_id", conversationId);
        if (a.error) throw a.error;
        const b = await supabase.from("chat_conversation_members").delete().eq("conversation_id", conversationId);
        if (b.error) throw b.error;
        const c = await supabase.from("chat_conversations").delete().eq("id", conversationId).select("id");
        if (c.error) throw c.error;
        if (!c.data?.length) throw new Error("Sletningen blev afvist");
      } else {
        const d = await supabase.from("chat_conversation_members").delete()
          .eq("conversation_id", conversationId).eq("employee_id", employeeId).select("id");
        if (d.error) throw d.error;
        if (!d.data?.length) throw new Error("Kunne ikke forlade gruppen");
      }
      return conversationId;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useSearchMessages() {
  return useMutation({
    mutationFn: async (query: string): Promise<SoegeResultat[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name),
          conversation:chat_conversations(id, name, is_group)
        `)
        .is("deleted_at", null)
        .neq("status", "trukket_tilbage")
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(50) as any;
      if (error) throw error;
      const nu = Date.now();
      return (data || [])
        .filter((msg: any) => !msg.slettes_efter || new Date(msg.slettes_efter).getTime() > nu)
        .map((msg: any) => ({
          ...msg,
          sender: msg.sender ? {
            id: msg.sender.id,
            full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim()
          } : undefined
        }));
    },
  });
}

/** Henter samtalen med medlemmer i samme format som useConversations. */
async function hentSamtale(id: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select(`*, members:chat_conversation_members(*, employee:employee_basic_info(id, first_name, last_name))`)
    .eq("id", id)
    .single() as any;
  if (error || !data) throw error ?? new Error("Samtalen findes ikke");
  return {
    ...data,
    unread_count: 0,
    members: data.members?.map((m: any) => ({
      ...m,
      employee: m.employee ? { id: m.employee.id, full_name: `${m.employee.first_name || ''} ${m.employee.last_name || ''}`.trim() } : undefined,
    })),
  } as Conversation;
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, memberIds, isGroup }: { name?: string; memberIds: string[]; isGroup: boolean }) => {
      const mig = await getCurrentEmployeeId();
      const andre = [...new Set(memberIds)].filter((x) => x && x !== mig);
      const v = validerSamtale(andre.length, name, isGroup);
      if ("fejl" in v) throw Object.assign(new Error(v.fejl), { code: "P0001" });
      const { data: id, error } = isGroup
        ? await supabase.rpc("sb_chat_start_gruppe", { p_navn: (name ?? "").trim(), p_medlemmer: andre })
        : await supabase.rpc("sb_chat_start_direkte", { p_anden: andre[0] });
      if (error) throw error;
      if (typeof id !== "string") throw new Error("Intet samtale-id");
      const conversation = await hentSamtale(id);
      queryClient.setQueryData<Conversation[]>(["chat-conversations"], (old) => [conversation, ...(old ?? []).filter((c) => c.id !== id)]);
      return conversation;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const key = ["chat-messages", conversationId] as const;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => planlaeg(queryClient, key)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" },
        () => planlaeg(queryClient, key)
      )
      // Offentlige samtalesignaler (24d); private signaler håndteres i useChatUnreadTotal.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sb_signaler", filter: `conversation_id=eq.${conversationId}` },
        (p) => { if ((p.new as { kilde?: string })?.kilde === "besked") planlaeg(queryClient, key); }
      )
      .subscribe((s) => { if (s === "SUBSCRIBED") planlaeg(queryClient, key); });
    const forgrund = () => { if (document.visibilityState === "visible") planlaeg(queryClient, key); };
    document.addEventListener("visibilitychange", forgrund);
    return () => { document.removeEventListener("visibilitychange", forgrund); supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);
}

// Typing indicator using presence
export function useTypingIndicator(conversationId: string | null) {
  const [typingUsers, setTypingUsers] = useState<{id: string; name: string}[]>([]);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const ch = supabase.channel(`typing-${conversationId}`);
    
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const users: {id: string; name: string}[] = [];
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p.isTyping) {
            users.push({ id: p.id, name: p.name });
          }
        });
      });
      setTypingUsers(users);
    });

    ch.subscribe();
    setChannel(ch);

    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId]);

  const setTyping = useCallback(async (isTyping: boolean, userId: string, userName: string) => {
    if (channel) {
      await channel.track({ id: userId, name: userName, isTyping });
    }
  }, [channel]);

  return { typingUsers, setTyping };
}

// Online status using presence
export function useOnlineStatus() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel('online-users');
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = new Set<string>();
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          users.add(p.id);
        });
      });
      setOnlineUsers(users);
    });

    // Track current user as online
    getCurrentEmployeeId().then(id => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id });
        }
      });
    }).catch(console.error);

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}

export function useEmployeesForChat() {
  return useQuery({
    queryKey: ["employees-for-chat"],
    queryFn: async () => {
      // Use secure view that only exposes non-sensitive columns
      const { data, error } = await supabase
        .from("employee_basic_info")
        .select("id, first_name, last_name")
        .order("first_name") as any;

      if (error) throw error;
      return (data || []).map((emp: any) => ({
        id: emp.id,
        full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      }));
    },
  });
}

export function useTeamsForChat() {
  return useQuery({
    queryKey: ["teams-for-chat"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name") as any;

      if (error) throw error;
      return data || [];
    },
  });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", teamId) as any;

      if (error) throw error;
      return (data || []).map((m: any) => m.employee_id) as string[];
    },
    enabled: !!teamId,
  });
}

export const CHAT_UNREAD_KEY = ["chat-unread-total"] as const;

/**
 * Sand, hvis en UPDATE på chat_conversation_members kun ændrer aktiv_til/last_read_at (heartbeat).
 * Tabellen har REPLICA IDENTITY DEFAULT, så `old` indeholder typisk kun id; de øvrige kolonner
 * (conversation_id, employee_id, joined_at) ændres ikke ved opdatering, så en UPDATE uden sammenlignelige
 * gamle værdier behandles som heartbeat. Ulæsttal bygger på kvitteringer, ikke på disse kolonner.
 */
function kunAktivitet(old: Record<string, unknown> | null | undefined, ny: Record<string, unknown> | null | undefined): boolean {
  const ignorer = new Set(["aktiv_til", "last_read_at"]);
  const noegler = Object.keys(ny ?? {}).filter((k) => !ignorer.has(k) && k !== "id" && old && k in old);
  return noegler.every((k) => JSON.stringify(old?.[k]) === JSON.stringify(ny?.[k]));
}

/**
 * Ulæste chatbeskeder i alt: beskeder i samtaler, brugeren er medlem af, fra andre, ikke slettet,
 * og uden læsekvittering fra brugeren i chat_message_read_receipts. Opdateres via realtime.
 */
export function useChatUnreadTotal(employeeId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const on = enabled && !!employeeId;

  useEffect(() => {
    if (!on || !employeeId) return;
    const invalidate = () => {
      planlaeg(queryClient, CHAT_UNREAD_KEY);
      planlaeg(queryClient, ["chat-conversations"]);
    };
    const channel = supabase
      .channel(`chat-unread-${employeeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_read_receipts", filter: `employee_id=eq.${employeeId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversation_members" }, (p) => {
        if (p.eventType === "UPDATE" && kunAktivitet(p.old as Record<string, unknown>, p.new as Record<string, unknown>)) return;
        invalidate();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sb_signaler" }, (p) => {
        void behandlSignal(queryClient, p.new as SignalRaekke, employeeId);
      })
      .subscribe((s) => { if (s === "SUBSCRIBED") invalidate(); });
    const forgrund = () => { if (document.visibilityState === "visible") { invalidate(); planlaeg(queryClient, ["chat-messages"]); } };
    document.addEventListener("visibilitychange", forgrund);
    return () => { document.removeEventListener("visibilitychange", forgrund); supabase.removeChannel(channel); };
  }, [on, employeeId, queryClient]);

  return useQuery({
    queryKey: [...CHAT_UNREAD_KEY, employeeId],
    enabled: on,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("chat_ulaeste_pr_samtale");
      if (error) throw error;
      return (data ?? []).reduce((sum, r) => sum + (Number(r.antal) || 0), 0);
    },
  });
}

// ---------- sb_signaler (S6) ----------

interface SignalRaekke { id: number; kilde: string; kilde_id: string; haendelse: string; privat: boolean; conversation_id: string | null }

const planlagt = new Map<string, ReturnType<typeof setTimeout>>();
/** Debounce 300 ms pr. query-nøgle, delt på tværs af hookinstanser. */
export function planlaeg(qc: QueryClient, key: readonly unknown[]): void {
  const k = JSON.stringify(key);
  if (planlagt.has(k)) return;
  planlagt.set(k, setTimeout(() => { planlagt.delete(k); void qc.invalidateQueries({ queryKey: [...key] }); }, 300));
}

type SignalLytter = (s: { conversationId: string | null; kildeId: string; haendelse: string }) => void;
const signalLyttere = new Set<SignalLytter>();
/** Søgning og svaruddrag genvalideres ved signaler (tilbagetrækning, sletning, udløb). */
export function onChatSignal(cb: SignalLytter): () => void {
  signalLyttere.add(cb);
  return () => { signalLyttere.delete(cb); };
}

const sete = new Set<string>();
const toastet = new Set<number>();

/** Kun kilde='besked'. Indhold/status læses aldrig fra payload – kun genhentning. */
async function behandlSignal(qc: QueryClient, s: SignalRaekke, employeeId: string): Promise<void> {
  if (!s || s.kilde !== "besked") return;
  const noegle = `${s.id}`;
  let conv = s.conversation_id;
  if (!s.privat) {
    if (sete.has(noegle)) return;
    sete.add(noegle);
    if (conv) planlaeg(qc, ["chat-messages", conv]);
    planlaeg(qc, ["chat-conversations"]);
    planlaeg(qc, CHAT_UNREAD_KEY);
  } else {
    if (toastet.has(s.id)) return;
    toastet.add(s.id);
    const { data } = await supabase.from("chat_messages").select("conversation_id").eq("id", s.kilde_id).eq("sender_id", employeeId).maybeSingle();
    conv = data?.conversation_id ?? null;
    if (conv) planlaeg(qc, ["chat-messages", conv]);
    planlaeg(qc, ["sb-begrundelse", employeeId]);
    if (s.haendelse === "afventer") toast("Din besked afventer dig");
    else if (s.haendelse === "udloeb") toast("Din besked blev trukket tilbage");
  }
  for (const l of signalLyttere) l({ conversationId: conv, kildeId: s.kilde_id, haendelse: s.haendelse });
  if (sete.size > 2000) sete.clear();
}

// ---------- Status, begrundelser og handlinger (S6) ----------

export type Begrundelse = "haard_tone" | "personoplysning" | "cpr_fil" | "ikke_tjekket_fil" | "ikke_tjekket";
export const BEGRUNDELSE_TEKST: Record<Begrundelse, string> = {
  haard_tone: "Tonen virker hård. Læs den igen, før du sender.",
  personoplysning: "Beskeden ser ud til at indeholde personoplysninger. Sender du, slettes den automatisk efter 7 dage.",
  cpr_fil: "Filen indeholder et CPR-nummer og kan ikke sendes.",
  ikke_tjekket_fil: "Filen kunne ikke tjekkes. Fjern filen eller træk beskeden tilbage.",
  ikke_tjekket: "Beskeden kunne ikke tjekkes. Læs den igennem, før du sender.",
};
const KENDTE = new Set(Object.keys(BEGRUNDELSE_TEKST));

/** Egen begrundelse for præcis (besked, id, revision); cache adskilt pr. bruger. */
export function useBegrundelse(employeeId: string | undefined, messageId: string, revision: number, enabled: boolean) {
  return useQuery({
    queryKey: ["sb-begrundelse", employeeId, messageId, revision],
    enabled: enabled && !!employeeId,
    retry: 2,
    queryFn: async (): Promise<Begrundelse | null> => {
      const { data, error } = await supabase.from("sb_tjek_begrundelser").select("aarsag_kode")
        .eq("kilde", "besked").eq("kilde_id", messageId).eq("revision", revision).limit(1).maybeSingle();
      if (error) throw error;
      const k = data?.aarsag_kode;
      return k && KENDTE.has(k) ? (k as Begrundelse) : null;
    },
  });
}

/** Fejl fra serveren: P0001 vises ordret, ellers fast tekst. */
export function serverTekst(e: unknown, fast: string): string {
  const pe = e as { code?: string; message?: string } | null;
  if (pe?.code === "P0001" && typeof pe.message === "string" && pe.message) return pe.message;
  return fast;
}
export const erForaeldet = (e: unknown) => (e as { code?: string; message?: string } | null)?.code === "P0001" && /forældet revision/i.test((e as { message?: string }).message ?? "");

const vent = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- B2b-2 §4 / B2b-3a §1–§2a: fælles handlingslås pr. (generation, medarbejder, samtale, besked) ----------
export type HandlingsArt = "send" | "traek" | "fjern" | "ret" | "gem";
interface Handling { ejer: OperationsEjer; art: HandlingsArt }
const handlinger = new Map<string, Handling>();
/** Skrivende handlinger, hvis udfald afstemmes mod et snapshot. */
export type SkriveArt = "send" | "traek" | "fjern" | "gem";
/**
 * B2b-3a §1: afgrænset snapshot til resultatafstemning (ingen JWT, ingen filbytes).
 * bekraeftet=false: udfaldet er ukendt. bekraeftet=true: resultatet er bekræftet, men visningen kunne ikke genhentes.
 */
export interface UdfaldSnapshot {
  ejer: OperationsEjer; id: string; art: SkriveArt; startRevision: number;
  forventet: { revision: number; status?: string; content?: string; utenFil?: boolean };
  /** Filreferencen ved handlingens start (Fjern fil). */
  filRef: string | null;
  /** Redigeringskladdens version ved Gem (lokal markør), ellers null. */
  kladdeVersion: number | null;
  bekraeftet: boolean;
}
/** Ukendt/uopdateret udfald pr. besked (overlever afmontering og Ret-åbning; ryddes af ny skrivende handling eller afklaring). */
const ukendte = new Map<string, UdfaldSnapshot>();
/** Igangværende »Tjek igen«-læsninger (kun visning). */
const tjekker = new Set<string>();
const hNoegle = (gen: number, emp: string, conv: string, id: string) => `${gen}:${emp}:${conv}:${id}`;
const hLyttere = new Set<() => void>();
let hVersion = 0;
const hMeld = () => { hVersion++; for (const l of hLyttere) l(); };
/** Kobling til ChatViews afsendelsesejerskab (afsOps/netværkslås/pending) uden cirkulær import. */
type AfsKoordinering = (gen: number, emp: string, conv: string, id: string) => boolean;
let afsKoordinering: AfsKoordinering = () => false;
export function registrerAfsendelsesKoordinering(fn: AfsKoordinering): void { afsKoordinering = fn; }

/** Den viste rækkes grundlag ved trykket (B2b-3a §2a): et bekræftet, ikke genhentet resultat spærrer for det gamle grundlag. */
export interface Visning { revision: number; status: string }
function foraeldetVisning(k: string, vis?: Visning): boolean {
  const s = ukendte.get(k);
  if (!s || !s.bekraeftet || !vis) return !!s?.bekraeftet && !vis;
  if (vis.revision !== s.forventet.revision || (s.forventet.status && vis.status !== s.forventet.status)) return true;
  ukendte.delete(k); // visningen viser nu resultatet
  return false;
}

/**
 * Tager låsen synkront for den accepterede operation. Optaget lås, igangværende manuel/baggrunds-afsendelse
 * på samme id, forældet visningsgrundlag eller ugyldig ejer → false (klikket ignoreres: ingen mutation, ingen toast).
 * Låsen frigives kun af sin egen operation (mutationFn's finally eller editorens afslutning) – aldrig af afmontering.
 * Ret-åbning ('ret') rydder ikke et ukendt udfald; en ny skrivende handling erstatter det.
 */
export function tagHandling(ejer: OperationsEjer | null, id: string, art: HandlingsArt, vis?: Visning): boolean {
  if (!ejer || !ejerGyldig(ejer)) return false;
  rydGamleGenerationer();
  const k = hNoegle(ejer.gen, ejer.emp, ejer.conv, id);
  if (handlinger.has(k) || afsKoordinering(ejer.gen, ejer.emp, ejer.conv, id)) return false;
  if (art !== "ret" && foraeldetVisning(k, vis)) { hMeld(); return false; }
  handlinger.set(k, { ejer, art });
  if (art !== "ret") ukendte.delete(k);
  hMeld();
  return true;
}
/** Låse og snapshots fra en tidligere sessionsgeneration kan aldrig matche igen (nøglen indeholder generationen). */
function rydGamleGenerationer(): void {
  const pre = `${sessionsGeneration()}:`;
  for (const k of [...handlinger.keys()]) if (!k.startsWith(pre)) handlinger.delete(k);
  for (const k of [...ukendte.keys()]) if (!k.startsWith(pre)) ukendte.delete(k);
}
/** Atomisk overgang editor → Gem: kun hvis låsen er editorens (art 'ret') eller fri. */
export function overtagTilGem(ejer: OperationsEjer | null, id: string, vis?: Visning): boolean {
  if (!ejer || !ejerGyldig(ejer)) return false;
  rydGamleGenerationer();
  const k = hNoegle(ejer.gen, ejer.emp, ejer.conv, id);
  const h = handlinger.get(k);
  if (h && h.art !== "ret") return false;
  if (!h && afsKoordinering(ejer.gen, ejer.emp, ejer.conv, id)) return false;
  if (foraeldetVisning(k, vis)) { hMeld(); return false; }
  handlinger.set(k, { ejer, art: "gem" });
  ukendte.delete(k);
  hMeld();
  return true;
}
/** Gamle afslutninger frigiver kun deres egen lås. */
export function frigivHandling(ejer: OperationsEjer, id: string): void {
  const k = hNoegle(ejer.gen, ejer.emp, ejer.conv, id);
  if (handlinger.get(k)?.ejer.op === ejer.op) { handlinger.delete(k); hMeld(); }
}
/** Frigiver editorens lås (art 'ret') for beskeden i aktuel generation. */
export function frigivRet(emp: string, conv: string, id: string): void {
  const k = hNoegle(sessionsGeneration(), emp, conv, id);
  if (handlinger.get(k)?.art === "ret") { handlinger.delete(k); hMeld(); }
}
/** Ejer operationen stadig låsen for netop denne besked? */
export const ejerHandling = (ejer: OperationsEjer, id: string) =>
  handlinger.get(hNoegle(ejer.gen, ejer.emp, ejer.conv, id))?.ejer.op === ejer.op;
export interface HandlingsTilstand { art: HandlingsArt | null; ukendt: SkriveArt | null; bekraeftet: boolean; tjekker: boolean }
export function handlingFor(emp: string | undefined, conv: string, id: string): HandlingsTilstand {
  if (!emp) return { art: null, ukendt: null, bekraeftet: false, tjekker: false };
  const k = hNoegle(sessionsGeneration(), emp, conv, id);
  const s = ukendte.get(k);
  return { art: handlinger.get(k)?.art ?? null, ukendt: s?.art ?? null, bekraeftet: !!s?.bekraeftet, tjekker: tjekker.has(k) };
}
/** Snapshot til prøver/editor (kun aktuel generation). */
export const udfaldSnapshot = (emp: string, conv: string, id: string): UdfaldSnapshot | null =>
  ukendte.get(hNoegle(sessionsGeneration(), emp, conv, id)) ?? null;
/** Abonnement for UI (deaktivering, ukendt-tilstand). */
export function useHandling(emp: string | undefined, conv: string, id: string) {
  useSyncExternalStore((l) => { hLyttere.add(l); return () => { hLyttere.delete(l); }; }, () => hVersion);
  return handlingFor(emp, conv, id);
}
/** Til prøver: antal holdte låse (kun tal). */
export const aktiveHandlinger = () => { const pre = `${sessionsGeneration()}:`; return [...handlinger.keys()].filter((k) => k.startsWith(pre)).length; };

/** Klassificeret udfald af en serverhandling efter resultatafstemning. */
export class HandlingsFejl extends Error {
  constructor(public art: "konflikt" | "afvist" | "ukendt" | "stoppet", public kilde: unknown = null) { super(art); this.name = "HandlingsFejl"; }
}
/** Tekst til én fejltoast; null = ingen toast (ukendt udfald vises lokalt, stoppet/forældet vises aldrig). */
export function handlingsTekst(e: unknown, fast: string): string | null {
  if (e instanceof HandlingsFejl) {
    if (e.art === "konflikt") return "Beskeden er ændret – prøv igen";
    if (e.art === "afvist") return serverTekst(e.kilde, fast);
    return null;
  }
  if (erForaeldet(e)) return "Beskeden er ændret – prøv igen";
  return serverTekst(e, fast);
}
interface RpcSvar { data: unknown; error: { code?: string; message?: string } | null }
/** Fejlobjekt uden cast: kun code/message læses. */
function tilFejl(e: unknown): RpcSvar["error"] {
  if (!e) return null;
  if (typeof e !== "object") return { message: "ukendt" };
  return {
    code: "code" in e && typeof e.code === "string" ? e.code : undefined,
    message: "message" in e && typeof e.message === "string" ? e.message : undefined,
  };
}
async function kaldRpc(f: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<RpcSvar> {
  try { const r = await f(); return { data: r.data, error: tilFejl(r.error) }; }
  catch { return { data: null, error: { message: "transport" } }; }
}
interface Raekke { status: string; revision: number; content: string; attachment_path: string | null }
/** Aktuel række (kun læsning). null = ikke synlig; "fejl" = kunne ikke læses. */
async function laesRaekke(id: string): Promise<Raekke | null | "fejl"> {
  try {
    const { data, error } = await supabase.from("chat_messages").select("status, revision, content, attachment_path").eq("id", id).maybeSingle();
    if (error) return "fejl";
    if (!data) return null;
    return { status: String(data.status), revision: Number(data.revision), content: String(data.content ?? ""), attachment_path: (data.attachment_path as string | null) ?? null };
  } catch { return "fejl"; }
}
export type Vurdering = "bekraeftet" | "konflikt" | "ukendt";
/**
 * B2b-3a §1: vurderer en læst række mod snapshottet. Kun præcis den forventede revision med det konkrete ønskede
 * resultat bekræfter. En større revision er en reel konflikt (også med samme tekst/ingen fil). Den gamle række
 * (startrevisionen, uændret) beviser ikke afvisning efter en transportfejl → ukendt. Ulæselig/usynlig → ukendt.
 */
export function vurderUdfald(s: Pick<UdfaldSnapshot, "art" | "startRevision" | "forventet" | "filRef">, r: Raekke | null | "fejl"): Vurdering {
  if (r === "fejl" || !r || !Number.isFinite(r.revision)) return "ukendt";
  const f = s.forventet;
  if (r.revision === f.revision) {
    if (f.content !== undefined && r.content !== f.content) return "konflikt";
    if (f.utenFil && r.attachment_path !== null) return "konflikt";
    if (f.status !== undefined && r.status !== f.status) {
      // send/træk: samme revision, men stadig afventer → intet bevis endnu; anden status → konflikt.
      return r.status === "afventer_afsender" ? "ukendt" : "konflikt";
    }
    return "bekraeftet";
  }
  if (r.revision === s.startRevision) {
    // Fjern fil: filreferencen fra start er ændret uden revisionsskift → konflikt; ellers intet bevis.
    if (s.art === "fjern" && r.attachment_path !== s.filRef) return "konflikt";
    return "ukendt";
  }
  return "konflikt";
}
function gemSnapshot(s: Omit<UdfaldSnapshot, "bekraeftet">, bekraeftet: boolean): void {
  if (!ejerGyldig(s.ejer)) return;
  ukendte.set(hNoegle(s.ejer.gen, s.ejer.emp, s.ejer.conv, s.id), { ...s, bekraeftet });
  hMeld();
}
/** Genhenter beskedvisningen, før låsen slippes. Fejl → bekræftet snapshot, så det gamle grundlag ikke kan handle igen. */
async function opdaterVisning(qc: QueryClient, s: Omit<UdfaldSnapshot, "bekraeftet">, vagt: () => boolean): Promise<boolean> {
  try {
    await qc.refetchQueries({ queryKey: ["chat-messages", s.ejer.conv], type: "active" }, { throwOnError: true });
    return true;
  } catch {
    if (vagt()) gemSnapshot(s, true);
    return false;
  }
}
/**
 * Fælles resultatkontrakt for sb_ret / sb_fjern_fil / sb_afgoer. Direkte succes kun ved præcis kontraktværdi
 * (startrevision + 1 eller true). Kendt P0001: forældet → konflikt, ellers afvist ordret. Alt andet afstemmes ved læsning.
 * Låsen holdes til visningen er genhentet; kalderen frigiver i finally.
 */
async function udfoerHandling(qc: QueryClient, s: Omit<UdfaldSnapshot, "bekraeftet">, vagt: () => boolean,
  kald: () => PromiseLike<{ data: unknown; error: unknown }>, direkte: (data: unknown) => boolean): Promise<void> {
  if (!vagt()) throw new HandlingsFejl("stoppet");
  const res = await kaldRpc(kald);
  if (!vagt()) throw new HandlingsFejl("stoppet");
  if (!(res.error === null && direkte(res.data))) {
    if (res.error?.code === "P0001") throw new HandlingsFejl(erForaeldet(res.error) ? "konflikt" : "afvist", res.error);
    const raek = await laesRaekke(s.id);
    if (!vagt()) throw new HandlingsFejl("stoppet");
    const v = vurderUdfald(s, raek);
    if (v === "konflikt") throw new HandlingsFejl("konflikt");
    if (v === "ukendt") { gemSnapshot(s, false); throw new HandlingsFejl("ukendt"); }
  }
  await opdaterVisning(qc, s, vagt);
  if (!vagt()) throw new HandlingsFejl("stoppet");
}
function efterFejl(qc: QueryClient, e: unknown, ejer: OperationsEjer, conv: string, fejltekst?: string) {
  if (!ejerGyldig(ejer)) return;
  if (fejltekst) { const t = handlingsTekst(e, fejltekst); if (t) toast.error(t); }
  void qc.invalidateQueries({ queryKey: ["chat-messages", conv] });
}

/**
 * B2b-3a §1: »Tjek igen« – kun læsning; vurderer det bevarede snapshot. Ingen automatisk ny skrivning.
 * Fejlet/ulæselig læsning bevarer tilstanden. Returnerer vurderingen (eller "stoppet" ved skiftet ejer).
 */
export async function tjekUdfaldIgen(qc: QueryClient, emp: string, conv: string, id: string): Promise<Vurdering | "stoppet"> {
  const k = hNoegle(sessionsGeneration(), emp, conv, id);
  const s = ukendte.get(k);
  if (!s || tjekker.has(k) || !ejerGyldig(s.ejer)) return "stoppet";
  const gyldig = () => ejerGyldig(s.ejer) && ukendte.get(k) === s;
  tjekker.add(k); hMeld();
  try {
    if (s.bekraeftet) {
      const ok = await opdaterVisning(qc, s, () => false);
      if (!gyldig()) return "stoppet";
      if (ok) { ukendte.delete(k); hMeld(); return "bekraeftet"; }
      return "ukendt";
    }
    const raek = await laesRaekke(id);
    if (!gyldig()) return "stoppet";
    const v = vurderUdfald(s, raek);
    if (v === "ukendt") return "ukendt";
    ukendte.delete(k); hMeld();
    if (v === "bekraeftet") efterHandling(qc, s.ejer, conv, id);
    else void qc.invalidateQueries({ queryKey: ["chat-messages", conv] });
    return v;
  } finally { tjekker.delete(k); hMeld(); }
}

// ---------- §9: tjek for den rigtige revision ----------
/** Aktive tjekforløb pr. (bruger, generation, id, revision): parallelle starter deduplikeres. */
const tjekAktive = new Set<string>();
export const aktiveTjek = () => tjekAktive.size;
const erTransport = (error: unknown) => {
  const navn = (error as { name?: string } | null)?.name;
  return navn === "FunctionsFetchError" || navn === "FunctionsRelayError";
};
async function laesStatus(id: string): Promise<{ status: string; revision: number } | null> {
  try {
    const { data, error } = await supabase.from("chat_messages").select("status, revision").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return { status: String(data.status), revision: Number(data.revision) };
  } catch { return null; }
}
/**
 * Starter tjek for den aktuelle revision, hvis rækken står i 'tjekkes'. Ét transportgenforsøg efter 2 s, kun hvis
 * genlæsningen viser samme revision og stadig 'tjekkes'. Edge-resultatet ændrer aldrig klientstatus direkte.
 */
export async function startTjekHvisNoedvendigt(messageId: string, vagt: () => boolean = () => true, ejer?: OperationsEjer): Promise<void> {
  if (!vagt()) return;
  const r = await laesStatus(messageId);
  if (!vagt() || !r || r.status !== "tjekkes") return;
  const k = `${ejer?.bruger ?? ""}:${ejer?.gen ?? sessionsGeneration()}:${messageId}:${r.revision}`;
  if (tjekAktive.has(k)) return;
  tjekAktive.add(k);
  try {
    for (let forsoeg = 0; forsoeg < 2; forsoeg++) {
      if (!vagt()) return;
      let error: unknown = null;
      try { ({ error } = await supabase.functions.invoke("storkbook-tjek", { body: { type: "besked", id: messageId, revision: r.revision } })); }
      catch { return; } // uventet kast: intet genforsøg; klienten læser altid faktisk DB-status
      if (!error || !erTransport(error) || forsoeg === 1) return;
      await vent(2000);
      if (!vagt()) return;
      const r2 = await laesStatus(messageId);
      // Ændret revision/status, utilgængelig række eller læsefejl stopper det gamle forløb.
      if (!vagt() || !r2 || r2.status !== "tjekkes" || r2.revision !== r.revision) return;
    }
  } finally { tjekAktive.delete(k); }
}

/** Registreret efterbehandling (bruger, generation, samtale, id, operation), synlig for stopvejen til den er afsluttet. */
const efterOps = new Map<string, { ejer: OperationsEjer; conv: string; id: string }>();
export const aktiveEfterbehandlinger = () => efterOps.size;
/** Stopvej: invaliderer efterbehandling/statusopslag/tjek-genforsøg for (medarbejder, samtale[, id]) i aktuel generation. */
export function stopEfterbehandling(emp: string, conv: string, id?: string): void {
  const gen = sessionsGeneration();
  for (const [k, e] of [...efterOps]) {
    if (e.ejer.gen === gen && e.ejer.emp === emp && e.conv === conv && (id === undefined || e.id === id)) { annullerOperation(e.ejer.op); efterOps.delete(k); }
  }
}
/** Efter bekræftet INSERT/sb_ret/sb_fjern_fil: genhent og tjek rigtig revision; ejerskab før hvert kald og cachetrin. */
function efterHandling(qc: QueryClient, ejer: OperationsEjer, conversationId: string, messageId: string) {
  const vagt = () => ejerGyldig(ejer);
  if (!vagt()) return;
  const k = `${ejer.op}:${messageId}`;
  efterOps.set(k, { ejer, conv: conversationId, id: messageId });
  void qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
  void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
  void startTjekHvisNoedvendigt(messageId, vagt, ejer).finally(() => {
    efterOps.delete(k);
    if (!vagt()) return;
    void qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
  });
}

/** B2b-1: revisionen er fastholdt fra den viste række; ejer er obligatorisk og fastholdt synkront ved trykket. */
export interface AfgoerInput { messageId: string; revision: number; handling: "send" | "traek"; conversationId: string; ejer: OperationsEjer }
export interface FjernFilInput { messageId: string; revision: number; conversationId: string; ejer: OperationsEjer }

/** Kalderen har taget låsen med tagHandling; mutationFn holder den gennem resultatafstemning og frigiver den selv. */
export function useAfgoer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: AfgoerInput) => {
      try {
        const vagt = () => ejerPasser(v.ejer, v.conversationId) && ejerHandling(v.ejer, v.messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        const res = await kaldRpc(() => supabase.rpc("sb_afgoer", { p_kilde: "besked", p_id: v.messageId, p_revision: v.revision, p_handling: v.handling }));
        if (!vagt()) throw new HandlingsFejl("stoppet");
        // 24d: true eller exception. sb_afgoer øger ikke revisionen.
        if (!res.error && res.data === true) return v;
        const raek = await laesRaekke(v.messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        const maal = v.handling === "send" ? "leveret" : "trukket_tilbage";
        // Kun en fejl (ikke uventet false/null) kan afstemmes til succes: samme revision i målstatus.
        if (res.error && raek !== "fejl" && raek && raek.revision === v.revision && raek.status === maal) return v;
        throw klassificer(res, raek);
      } finally { frigivHandling(v.ejer, v.messageId); }
    },
    // B2b-1: ingen automatisk genkørsel af sb_afgoer (App.tsx' mutations.retry=1 overstyres lokalt).
    retry: 0,
    onError: (e, v) => efterFejl(qc, e, v.ejer, v.conversationId, v.messageId),
    onSettled: (_d, _e, v) => {
      if (!ejerGyldig(v.ejer)) return;
      void qc.invalidateQueries({ queryKey: ["chat-messages", v.conversationId] });
      void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
      void qc.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
    },
  });
}

export function useFjernFil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: FjernFilInput) => {
      try {
        const vagt = () => ejerPasser(v.ejer, v.conversationId) && ejerHandling(v.ejer, v.messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        const res = await kaldRpc(() => supabase.rpc("sb_fjern_fil", { p_kilde: "besked", p_id: v.messageId, p_revision: v.revision }));
        if (!vagt()) throw new HandlingsFejl("stoppet");
        if (!res.error && typeof res.data === "number" && res.data > v.revision) return v;
        const raek = await laesRaekke(v.messageId);
        if (!vagt()) throw new HandlingsFejl("stoppet");
        if (res.error && raek !== "fejl" && raek && raek.attachment_path === null && raek.revision > v.revision) return v;
        throw klassificer(res, raek);
      } finally { frigivHandling(v.ejer, v.messageId); }
    },
    // B2b-1: ingen automatisk genkørsel af sb_fjern_fil.
    retry: 0,
    onSuccess: (v) => { if (ejerGyldig(v.ejer)) efterHandling(qc, v.ejer, v.conversationId, v.messageId); },
    onError: (e, v) => efterFejl(qc, e, v.ejer, v.conversationId, v.messageId),
  });
}

/** Minimalt aktivt kollegaopslag (samme som useActiveColleagues i usePulsen) til nye samtaler. */
export function useActiveChatColleagues(enabled = true) {
  return useQuery({
    queryKey: ["chat-active-colleagues"],
    enabled,
    staleTime: 600000,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_master_data").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      if (error) throw error;
      return (data ?? []).map((e) => ({ id: e.id, full_name: `${e.first_name || ""} ${e.last_name || ""}`.trim() }));
    },
  });
}

/** Unikke andre medarbejdere blandt aktive kolleger (egen og inaktive frasorteres). */
export function normaliserDeltagere(ids: string[], mig: string | null | undefined, aktive: Set<string>): string[] {
  return [...new Set(ids)].filter((id) => id && id !== mig && aktive.has(id));
}

export type SamtaleValidering = { ok: true } | { ok: false; fejl: string };
export function validerSamtale(andre: number, navn: string | undefined, isGroup: boolean): SamtaleValidering {
  if (!isGroup) return andre === 1 ? { ok: true } : { ok: false, fejl: "Vælg én aktiv kollega" };
  if (andre < 2 || andre > 50) return { ok: false, fejl: "En gruppe har 2–50 andre medlemmer" };
  const n = (navn ?? "").trim();
  if (!n || n.length > 80) return { ok: false, fejl: "Gruppen skal have et navn (højst 80 tegn)" };
  return { ok: true };
}

/** Vinduet er synligt og har fokus – betingelsen for kvitteringer og aktivitet. */
export function erSynligMedFokus(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Markerer brugeren som aktiv i samtalen (chat_marker_aktiv) ved åbning og hvert 30. s,
 * kun mens vinduet er synligt og har fokus. Stopper ved blur, faneskift og afmontering.
 */
export function useChatAktiv(conversationId: string | null | undefined) {
  useEffect(() => {
    if (!conversationId) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stoppet = false;
    const marker = async () => {
      const { data, error } = await supabase.rpc("chat_marker_aktiv", { p_conversation_id: conversationId });
      if (!stoppet && (error || data === false)) console.warn("chat_marker_aktiv afvist");
    };
    const start = () => {
      if (timer || !erSynligMedFokus()) return;
      void marker();
      timer = setInterval(() => { if (erSynligMedFokus()) void marker(); else stop(); }, 30000);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const skift = () => (erSynligMedFokus() ? start() : stop());
    start();
    window.addEventListener("focus", skift);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", skift);
    return () => {
      stoppet = true;
      stop();
      window.removeEventListener("focus", skift);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", skift);
    };
  }, [conversationId]);
}
