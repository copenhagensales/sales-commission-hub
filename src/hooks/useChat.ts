import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members?: ConversationMember[];
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
  sender?: {
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
      const { data, error } = await supabase
        .from("chat_conversations")
        .select(`*, members:chat_conversation_members(*, employee:employee_master_data(id, first_name, last_name))`)
        .order("updated_at", { ascending: false }) as any;

      if (error) throw error;
      
      return (data || []).map((conv: any) => ({
        ...conv,
        members: conv.members?.map((m: any) => ({
          ...m,
          employee: m.employee ? {
            id: m.employee.id,
            full_name: `${m.employee.first_name || ''} ${m.employee.last_name || ''}`.trim()
          } : undefined
        }))
      })) as Conversation[];
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
        .select(`*, sender:employee_master_data(id, first_name, last_name)`)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }) as any;

      if (error) throw error;
      
      return (data || []).map((msg: any) => ({
        ...msg,
        sender: msg.sender ? {
          id: msg.sender.id,
          full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim()
        } : undefined
      })) as Message[];
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const employeeId = await getCurrentEmployeeId();

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ conversation_id: conversationId, sender_id: employeeId, content })
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);
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
