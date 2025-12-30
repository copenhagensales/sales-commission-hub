import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DebugLogItem {
  raw: Record<string, unknown>;
  registered: boolean;
  skipReason?: string;
}

export interface DebugLogStats {
  total: number;
  registered: number;
  skipped: number;
  skipReasons: Record<string, number>;
}

export interface IntegrationDebugLog {
  id: string;
  provider: string;
  sync_type: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  raw_items: DebugLogItem[];
  registered_items: DebugLogItem[];
  skipped_items: DebugLogItem[];
  stats: DebugLogStats;
  error_message: string | null;
  created_at: string;
}

export function useIntegrationDebugLogs() {
  return useQuery({
    queryKey: ["integration-debug-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_debug_log")
        .select("*")
        .order("sync_started_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as IntegrationDebugLog[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useIntegrationDebugLog(provider: string, syncType: string) {
  return useQuery({
    queryKey: ["integration-debug-log", provider, syncType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_debug_log")
        .select("*")
        .eq("provider", provider)
        .eq("sync_type", syncType)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as unknown as IntegrationDebugLog | null;
    },
    refetchInterval: 30000,
  });
}
