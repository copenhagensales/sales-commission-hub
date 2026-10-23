import { HIPER_MONTHLY_GOAL_BOARD_KEY } from "@/config/hiperMonthlyGoals";
import { useVoiceMonthlyGoal } from "@/hooks/useVoiceMonthlyGoal";

const countAll = () => true;

/** Salg fra Hiper-teamets medlemmer i indeværende måned. */
export function useHiperMonthlyGoal(enabled = true) {
  return useVoiceMonthlyGoal({
    boardKey: HIPER_MONTHLY_GOAL_BOARD_KEY,
    action: "hiper-monthly-goal",
    isVoiceItem: countAll,
    enabled,
  });
}
