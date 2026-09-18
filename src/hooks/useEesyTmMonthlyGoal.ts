import { isEesyTmVoiceProduct, EESY_TM_MONTHLY_GOAL_BOARD_KEY } from "@/config/eesyTmMonthlyGoals";
import { useVoiceMonthlyGoal } from "@/hooks/useVoiceMonthlyGoal";

/** Voice-salg på Eesy TM (alt undtagen 5G internet) for indeværende måned. */
export function useEesyTmMonthlyGoal(enabled = true) {
  return useVoiceMonthlyGoal({
    boardKey: EESY_TM_MONTHLY_GOAL_BOARD_KEY,
    action: "eesy-tm-monthly-goal",
    isVoiceItem: isEesyTmVoiceProduct,
    enabled,
  });
}
