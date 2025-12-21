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
      
      const { data, error } = await supabase
        .from("chat_conversations")
        .select(`*, members:chat_conversation_members(*, employee:employee_master_data(id, first_name, last_name))`)
        .order("updated_at", { ascending: false }) as any;

      if (error) throw error;
      
      // Calculate unread count for each conversation
      const conversations = await Promise.all((data || []).map(async (conv: any) => {
        const myMembership = conv.members?.find((m: any) => m.employee_id === currentEmployeeId);
        const lastReadAt = myMembership?.last_read_at;
        
        // Count messages after last_read_at
        let unreadCount = 0;
        if (lastReadAt) {
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", currentEmployeeId)
            .gt("created_at", lastReadAt)
            .is("deleted_at", null) as any;
          unreadCount = count || 0;
        } else {
          // If never read, count all messages from others
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", currentEmployeeId)
            .is("deleted_at", null) as any;
          unreadCount = count || 0;
        }
        
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

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender:employee_master_data!chat_messages_sender_id_fkey(id, first_name, last_name)
        `)
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }) as any;

      if (error) throw error;
      
      // Fetch reactions for all messages
      const messageIds = (data || []).map((m: any) => m.id);
      const { data: reactions } = await supabase
        .from("chat_message_reactions")
        .select(`*, employee:employee_master_data(id, first_name, last_name)`)
        .in("message_id", messageIds) as any;
      
      // Fetch reply_to messages
      const replyToIds = (data || []).filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id);
      const { data: replyMessages } = replyToIds.length > 0 
        ? await supabase
            .from("chat_messages")
            .select(`*, sender:employee_master_data!chat_messages_sender_id_fkey(id, first_name, last_name)`)
            .in("id", replyToIds) as any
        : { data: [] };
      
      const replyMap = new Map((replyMessages || []).map((m: any) => [m.id, m]));
      const reactionsMap = new Map<string, any[]>();
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
          reactions: reactionsMap.get(msg.id) || []
        };
      }) as Message[];
    },
    enabled: !!conversationId,
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
      
      await supabase
        .from("chat_conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("employee_id", employeeId);
      
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
          sender:employee_master_data!chat_messages_sender_id_fkey(id, first_name, last_name),
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
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
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
