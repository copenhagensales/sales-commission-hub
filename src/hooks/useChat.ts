import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

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

/** Fejl ved afsendelse: `server` = afvist af serveren (tekst vises), `ukendt` = udfald ukendt (afstemmes før nyt forsøg). */
export class SendFejl extends Error {
  constructor(public art: "server" | "ukendt", tekst: string) { super(tekst); this.name = "SendFejl"; }
}

/** Findes beskeden med dette id allerede (egen række)? null = kunne ikke afgøres. */
export async function afstemBesked(id: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("chat_messages").select("id").eq("id", id).maybeSingle();
  if (error) return null;
  return !!data;
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
}

/** Indsætter én besked med stabilt id. Ukendt udfald afstemmes med serveren; en bekræftet række genindsættes aldrig. */
export async function sendBesked(v: SendInput, employeeId: string): Promise<void> {
  const foer = await afstemBesked(v.id);
  if (foer === true) return;
  const { error } = await supabase.from("chat_messages").insert({
    id: v.id,
    conversation_id: v.conversationId,
    sender_id: employeeId,
    content: v.content,
    reply_to_id: v.replyToId || null,
    attachment_path: v.attachmentPath || null,
    attachment_type: v.attachmentType || null,
    attachment_name: v.attachmentName || null,
  });
  if (!error) return;
  if (error.code === "P0001") throw new SendFejl("server", error.message || "Beskeden blev afvist");
  // 23505 (samme id) eller transportfejl: afstem samme id.
  const efter = await afstemBesked(v.id);
  if (efter === true) return;
  if (efter === false && error.code && error.code !== "23505") throw new SendFejl("server", "Beskeden kunne ikke sendes");
  throw new SendFejl("ukendt", "Ikke sendt – prøv igen");
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (v: SendInput) => {
      const employeeId = await getCurrentEmployeeId();
      await sendBesked(v, employeeId);
      return v;
    },
    onSuccess: (v) => {
      efterHandling(queryClient, v.conversationId, v.id);
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

/** Redigering via sb_ret (ingen direkte content-UPDATE). Starter tjek for den nye revision. */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId, revision }: { messageId: string; content: string; conversationId: string; revision: number }) => {
      if (content.length > 4000) throw Object.assign(new Error("Højst 4.000 tegn"), { code: "P0001" });
      const { data, error } = await supabase.rpc("sb_ret", { p_kilde: "besked", p_id: messageId, p_revision: revision, p_tekst: content });
      if (error) throw error;
      return { revision: data, conversationId, messageId };
    },
    onSuccess: (r) => efterHandling(queryClient, r.conversationId, r.messageId),
    onError: (_e, v) => { queryClient.invalidateQueries({ queryKey: ["chat-messages", v.conversationId] }); },
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
    mutationFn: async (query: string) => {
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

/** Starter tjek for den aktuelle revision, hvis rækken står i 'tjekkes'. Ét genforsøg efter 2 s ved transportfejl. */
export async function startTjekHvisNoedvendigt(messageId: string): Promise<void> {
  const { data: r } = await supabase.from("chat_messages").select("status, revision").eq("id", messageId).maybeSingle();
  if (!r || r.status !== "tjekkes") return;
  for (let forsoeg = 0; forsoeg < 2; forsoeg++) {
    const { error } = await supabase.functions.invoke("storkbook-tjek", { body: { type: "besked", id: messageId, revision: r.revision } });
    if (!error) return;
    const navn = (error as { name?: string }).name;
    if (navn !== "FunctionsFetchError" && navn !== "FunctionsRelayError") return;
    if (forsoeg === 0) await vent(2000);
  }
}

function efterHandling(qc: QueryClient, conversationId: string, messageId: string) {
  void qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
  void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
  void startTjekHvisNoedvendigt(messageId).finally(() => {
    void qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
  });
}

export function useAfgoer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { messageId: string; revision: number; handling: "send" | "traek"; conversationId: string }) => {
      const { error } = await supabase.rpc("sb_afgoer", { p_kilde: "besked", p_id: v.messageId, p_revision: v.revision, p_handling: v.handling });
      if (error) throw error;
      return v;
    },
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: ["chat-messages", v.conversationId] });
      void qc.invalidateQueries({ queryKey: ["sb-begrundelse"] });
      void qc.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
    },
  });
}

export function useFjernFil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { messageId: string; revision: number; conversationId: string }) => {
      const { error } = await supabase.rpc("sb_fjern_fil", { p_kilde: "besked", p_id: v.messageId, p_revision: v.revision });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => efterHandling(qc, v.conversationId, v.messageId),
    onError: (_e, v) => { void qc.invalidateQueries({ queryKey: ["chat-messages", v.conversationId] }); },
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
