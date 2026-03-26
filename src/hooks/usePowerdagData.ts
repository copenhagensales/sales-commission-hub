import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PowerdagEvent {
  id: string;
  name: string;
  event_date: string;
  is_active: boolean;
  created_at: string;
}

export interface PowerdagRule {
  id: string;
  event_id: string;
  team_name: string;
  sub_client_name: string | null;
  points_per_sale: number;
  display_order: number;
  created_at: string;
}

export interface PowerdagScore {
  id: string;
  event_id: string;
  rule_id: string;
  sales_count: number;
  updated_by: string | null;
  updated_at: string;
}

export interface TeamStanding {
  team_name: string;
  total_points: number;
  sub_entries: { sub_client_name: string | null; sales_count: number; points_per_sale: number; points: number }[];
}

export function useActiveEvent() {
  return useQuery({
    queryKey: ["powerdag-active-event"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("powerdag_events")
        .select("*")
        .eq("is_active", true)
        .order("event_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PowerdagEvent | null;
    },
    staleTime: 60_000,
  });
}

export function useAllEvents() {
  return useQuery({
    queryKey: ["powerdag-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("powerdag_events")
        .select("*")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as PowerdagEvent[];
    },
  });
}

export function useRulesForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["powerdag-rules", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("powerdag_point_rules")
        .select("*")
        .eq("event_id", eventId!)
        .order("display_order");
      if (error) throw error;
      return data as PowerdagRule[];
    },
  });
}

export function useScoresForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["powerdag-scores", eventId],
    enabled: !!eventId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("powerdag_scores")
        .select("*")
        .eq("event_id", eventId!);
      if (error) throw error;
      return data as PowerdagScore[];
    },
  });
}

export function useUpsertScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, ruleId, salesCount }: { eventId: string; ruleId: string; salesCount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("powerdag_scores")
        .upsert(
          { event_id: eventId, rule_id: ruleId, sales_count: salesCount, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: "event_id,rule_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["powerdag-scores", vars.eventId] });
    },
  });
}

/** Compute team standings from rules + scores */
export function computeStandings(rules: PowerdagRule[], scores: PowerdagScore[]): TeamStanding[] {
  const scoreMap = new Map<string, number>();
  for (const s of scores) scoreMap.set(s.rule_id, s.sales_count);

  const teamMap = new Map<string, TeamStanding>();
  for (const r of rules) {
    if (!teamMap.has(r.team_name)) {
      teamMap.set(r.team_name, { team_name: r.team_name, total_points: 0, sub_entries: [] });
    }
    const standing = teamMap.get(r.team_name)!;
    const sc = scoreMap.get(r.id) ?? 0;
    const pts = sc * r.points_per_sale;
    standing.sub_entries.push({ sub_client_name: r.sub_client_name, sales_count: sc, points_per_sale: r.points_per_sale, points: pts });
    standing.total_points += pts;
  }

  return Array.from(teamMap.values()).sort((a, b) => b.total_points - a.total_points);
}
