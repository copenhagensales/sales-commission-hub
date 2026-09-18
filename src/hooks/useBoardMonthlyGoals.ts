import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BoardMonthlyGoalRow {
  id: string;
  employeeId: string | null;
  target: number;
}

export interface SaveBoardMonthlyGoalsInput {
  /** null = fælles mål for hele boardet */
  teamGoal?: number | null;
  /** mål pr. medarbejder */
  sellerGoals?: { employeeId: string; target: number }[];
}

/**
 * Skriveadgang til månedsmål på boards.
 * Genbruger databasens eksisterende rolleafgørelse — ingen ny rollemodel.
 */
export function useCanManageBoardGoals() {
  return useQuery({
    queryKey: ["board-monthly-goals-can-manage"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("effective_is_teamleder_or_above");
      if (error) return false;
      return Boolean(data);
    },
  });
}

/** Månedsmål for et board (fælles + pr. medarbejder). */
export function useBoardMonthlyGoals(boardKey: string, monthKey: string, enabled = true) {
  return useQuery({
    queryKey: ["board-monthly-goals", boardKey, monthKey],
    enabled: enabled && Boolean(boardKey) && Boolean(monthKey),
    queryFn: async (): Promise<BoardMonthlyGoalRow[]> => {
      const { data, error } = await supabase
        .from("board_monthly_goals")
        .select("id, employee_id, target_amount")
        .eq("board_key", boardKey)
        .eq("month_key", monthKey);
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        target: Number(r.target_amount ?? 0),
      }));
    },
  });
}

/** Gemmer fælles mål og individuelle mål for en måned. */
export function useSaveBoardMonthlyGoals(boardKey: string, monthKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveBoardMonthlyGoalsInput) => {
      const rows: { board_key: string; month_key: string; employee_id: string | null; target_amount: number }[] = [];

      if (input.teamGoal !== undefined && input.teamGoal !== null) {
        rows.push({
          board_key: boardKey,
          month_key: monthKey,
          employee_id: null,
          target_amount: input.teamGoal,
        });
      }
      for (const g of input.sellerGoals ?? []) {
        rows.push({
          board_key: boardKey,
          month_key: monthKey,
          employee_id: g.employeeId,
          target_amount: g.target,
        });
      }
      if (rows.length === 0) return;

      const { error } = await supabase
        .from("board_monthly_goals")
        .upsert(rows, { onConflict: "board_key,month_key,employee_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-monthly-goals", boardKey, monthKey] });
      // Boardets egen query bruger board-nøglen som prefix
      queryClient.invalidateQueries({ queryKey: [boardKey] });
    },
  });
}
