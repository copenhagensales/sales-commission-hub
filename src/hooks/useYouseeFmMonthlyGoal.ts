import { YOUSEE_FM_MONTHLY_GOAL_BOARD_KEY } from "@/config/youseeFmMonthlyGoals";
import { useVoiceMonthlyGoal } from "@/hooks/useVoiceMonthlyGoal";

/** Alle Yousee FM-salg for indeværende måned. */
export function useYouseeFmMonthlyGoal(enabled = true) {
  return useVoiceMonthlyGoal({
    boardKey: YOUSEE_FM_MONTHLY_GOAL_BOARD_KEY,
    action: "yousee-fm-monthly-goal",
    isVoiceItem: () => true,
    enabled,
  });
}
