import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SmsMessage {
  id: string;
  content: string | null;
  direction: string;
  created_at: string;
  phone_number: string | null;
  read: boolean;
  sender_employee_id: string | null;
  target_employee_id: string | null;
}

export interface EmployeeSmsConversation {
  employee_id: string;
  employee_name: string;
  employee_phone: string | null;
  last_message: string | null;
  last_message_time: string;
  unread_count: number;
  messages: SmsMessage[];
}

export function useEmployeeSmsConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current employee ID
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-sms", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });

  // Fetch all employee SMS conversations
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ["employee-sms-conversations", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];

      // Fetch all SMS with employee context where current user is sender
      const { data: smsLogs, error } = await supabase
        .from("communication_logs")
        .select(`
          id,
          content,
          direction,
          created_at,
          phone_number,
          read,
          sender_employee_id,
          target_employee_id
        `)
        .eq("type", "sms")
        .eq("context_type", "employee")
        .eq("sender_employee_id", currentEmployee.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!smsLogs?.length) return [];

      // Get unique target employee IDs
      const targetIds = [...new Set(smsLogs.map(s => s.target_employee_id).filter(Boolean))] as string[];
      
      if (targetIds.length === 0) return [];

      // Fetch employee names
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_phone")
        .in("id", targetIds);

      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

      // Group messages by target employee
      const conversationMap = new Map<string, EmployeeSmsConversation>();

      for (const msg of smsLogs) {
        const targetId = msg.target_employee_id;
        if (!targetId) continue;

        const employee = employeeMap.get(targetId);
        if (!employee) continue;

        if (!conversationMap.has(targetId)) {
          conversationMap.set(targetId, {
            employee_id: targetId,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            employee_phone: employee.private_phone,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0,
            messages: [],
          });
        }

        const conv = conversationMap.get(targetId)!;
        conv.messages.push(msg as SmsMessage);

        // Count unread inbound messages
        if (msg.direction === "inbound" && !msg.read) {
          conv.unread_count++;
        }
      }

      // Sort conversations by last message time (newest first)
      return Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );
    },
    enabled: !!currentEmployee?.id,
    staleTime: 10000,
  });

  // Calculate total unread count
  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  // Realtime subscription
  useEffect(() => {
    if (!currentEmployee?.id) return;

    const channel = supabase
      .channel("employee-sms-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "communication_logs",
          filter: `type=eq.sms`,
        },
        (payload) => {
          const msg = payload.new as any;
          // Refetch if this is an employee-context SMS where we are sender or target
          if (
            msg?.context_type === "employee" &&
            (msg?.sender_employee_id === currentEmployee.id || msg?.target_employee_id === currentEmployee.id)
          ) {
            queryClient.invalidateQueries({ queryKey: ["employee-sms-conversations"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployee?.id, queryClient]);

  return {
    conversations,
    isLoading,
    totalUnread,
    currentEmployeeId: currentEmployee?.id,
    refetch,
  };
}

// Hook to get unread count for sidebar badge
export function useEmployeeSmsUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-sms-unread-count", user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;

      const lowerEmail = user.email.toLowerCase();
      const { data: currentEmployee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!currentEmployee) return 0;

      // Count unread inbound SMS where current user is sender (they sent the original message)
      const { count, error } = await supabase
        .from("communication_logs")
        .select("*", { count: "exact", head: true })
        .eq("type", "sms")
        .eq("context_type", "employee")
        .eq("sender_employee_id", currentEmployee.id)
        .eq("direction", "inbound")
        .eq("read", false);

      if (error) {
        console.error("Error fetching unread SMS count:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.email,
    staleTime: 10000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}
