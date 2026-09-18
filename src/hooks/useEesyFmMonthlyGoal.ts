import { isEesyFmVoiceProduct, EESY_FM_MONTHLY_GOAL_BOARD_KEY } from "@/config/eesyFmMonthlyGoals";
import { useVoiceMonthlyGoal, voiceMonthKey } from "@/hooks/useVoiceMonthlyGoal";
import type {
  MonthlyVoiceGoalData,
  MonthlyVoiceGoalDay,
  MonthlyVoiceGoalSeller,
} from "@/hooks/useVoiceMonthlyGoal";

export type EesyFmMonthlyGoalData = MonthlyVoiceGoalData;
export type EesyFmMonthlyGoalDay = MonthlyVoiceGoalDay;
export type EesyFmMonthlyGoalSeller = MonthlyVoiceGoalSeller;

export const eesyFmMonthKey = voiceMonthKey;

/** Voice-salg på Eesy FM (alt undtagen 5G Internet) for indeværende måned. */
export function useEesyFmMonthlyGoal(enabled = true) {
  return useVoiceMonthlyGoal({
    boardKey: EESY_FM_MONTHLY_GOAL_BOARD_KEY,
    action: "eesy-fm-monthly-goal",
    isVoiceItem: (productId) => isEesyFmVoiceProduct(productId),
    enabled,
  });
}
