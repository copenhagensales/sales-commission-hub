import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  edited_at?: string | null;
  deleted_at?: string | null;
  sender?: {
    id: string;
    full_name: string;
  };
  reply_to?: Message | null;
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

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      // Use secure view for sender data
      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name)
        `)
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }) as any;

      if (error) throw error;
      
      // Fetch reactions for all messages
      const messageIds = (data || []).map((m: any) => m.id);
      
      const { data: reactions } = await supabase
        .from("chat_message_reactions")
        .select(`*, employee:employee_basic_info(id, first_name, last_name)`)
        .in("message_id", messageIds) as any;
      
      // Fetch read receipts for all messages
      const { data: readReceipts } = await supabase
        .from("chat_message_read_receipts")
        .select(`*, employee:employee_basic_info(id, first_name, last_name)`)
        .in("message_id", messageIds) as any;
      
      // Fetch reply_to messages
      const replyToIds = (data || []).filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id);
      const { data: replyMessages } = replyToIds.length > 0 
        ? await supabase
            .from("chat_messages")
            .select(`*, sender:employee_basic_info!chat_messages_sender_id_fkey(id, first_name, last_name)`)
            .in("id", replyToIds) as any
        : { data: [] };
      
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
        return {
          ...msg,
          sender: msg.sender ? {
            id: msg.sender.id,
            full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim()
          } : undefined,
          reply_to: replyTo ? {
            id: replyTo.id,
            content: replyTo.content,
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
    enabled: !!conversationId,
  });
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

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      replyToId,
      attachmentUrl,
      attachmentType,
      attachmentName
    }: { 
      conversationId: string; 
      content: string;
      replyToId?: string;
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
    }) => {
      const employeeId = await getCurrentEmployeeId();

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ 
          conversation_id: conversationId, 
          sender_id: employeeId, 
          content,
          reply_to_id: replyToId || null,
          attachment_url: attachmentUrl || null,
          attachment_type: attachmentType || null,
          attachment_name: attachmentName || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId }: { messageId: string; content: string; conversationId: string }) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", messageId)
        .select()
        .single();

      if (error) throw error;
      return { data, conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", result.conversationId] });
    },
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
    mutationFn: async (conversationId: string) => {
      const employeeId = await getCurrentEmployeeId();
      
      // Kvitterer kun, når vinduet er synligt og har fokus (aldrig massekvittering i baggrunden).
      if (!erSynligMedFokus() || !employeeId) return conversationId;
      // Alle ulæste fra andre (pagineret i blokke à 1.000, ordnet efter id) – ikke kun de seneste.
      const ids: string[] = [];
      for (let fra = 0; ; fra += 1000) {
        const { data: side, error: mErr } = await supabase
          .from("chat_messages")
          .select("id, chat_message_read_receipts!left(employee_id)")
          .eq("conversation_id", conversationId)
          .neq("sender_id", employeeId)
          .is("deleted_at", null)
          .eq("chat_message_read_receipts.employee_id", employeeId)
          .order("id")
          .range(fra, fra + 999);
        if (mErr) throw mErr;
        for (const m of side ?? []) {
          if (!(m.chat_message_read_receipts as { employee_id: string }[] | null)?.length) ids.push(m.id);
        }
        if ((side ?? []).length < 1000) break;
      }
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

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const employeeId = await getCurrentEmployeeId();
      
      // Delete membership (this effectively "leaves" the conversation)
      // For 1:1 chats or if you're the creator, delete the whole conversation
      const { data: conversation } = await supabase
        .from("chat_conversations")
        .select("created_by, is_group")
        .eq("id", conversationId)
        .single() as any;
      
      if (conversation?.created_by === employeeId || !conversation?.is_group) {
        // Delete all related data
        await supabase.from("chat_messages").delete().eq("conversation_id", conversationId);
        await supabase.from("chat_conversation_members").delete().eq("conversation_id", conversationId);
        await supabase.from("chat_conversations").delete().eq("id", conversationId);
      } else {
        // Just leave the group
        await supabase
          .from("chat_conversation_members")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("employee_id", employeeId);
      }
      
      return conversationId;
    },
    onSuccess: () => {
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
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(50) as any;
      
      if (error) throw error;
      
      return (data || []).map((msg: any) => ({
        ...msg,
        sender: msg.sender ? {
          id: msg.sender.id,
          full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim()
        } : undefined
      }));
    },
  });
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: async (file: File) => {
      const employeeId = await getCurrentEmployeeId();
      const fileName = `${employeeId}/${Date.now()}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(data.path);
      
      return {
        url: publicUrl,
        type: file.type,
        name: file.name
      };
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, memberIds, isGroup }: { name?: string; memberIds: string[]; isGroup: boolean }) => {
      const employeeId = await getCurrentEmployeeId();

      const { data: conversation, error: convError } = await supabase
        .from("chat_conversations")
        .insert({ name: isGroup ? name : null, is_group: isGroup, created_by: employeeId })
        .select()
        .single();

      if (convError) throw convError;

      const allMemberIds = [...new Set([employeeId, ...memberIds])];
      const { error: memberError } = await supabase
        .from("chat_conversation_members")
        .insert(allMemberIds.map((id) => ({ conversation_id: conversation.id, employee_id: id })));

      if (memberError) throw memberError;
      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" },
        () => queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    if (!on) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    const channel = supabase
      .channel(`chat-unread-${employeeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_read_receipts", filter: `employee_id=eq.${employeeId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversation_members" }, (p) => {
        if (p.eventType === "UPDATE" && kunAktivitet(p.old as Record<string, unknown>, p.new as Record<string, unknown>)) return;
        invalidate();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
