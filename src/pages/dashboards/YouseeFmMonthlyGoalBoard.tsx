import { MonthlyVoiceGoalBoard } from "@/components/dashboards/MonthlyVoiceGoalBoard";
import { useYouseeFmMonthlyGoal } from "@/hooks/useYouseeFmMonthlyGoal";
import { YOUSEE_FM_MONTHLY_GOAL_BOARD_KEY } from "@/config/youseeFmMonthlyGoals";

export default function YouseeFmMonthlyGoalBoard() {
  const { data, isLoading, error } = useYouseeFmMonthlyGoal();

  return (
    <MonthlyVoiceGoalBoard
      boardKey={YOUSEE_FM_MONTHLY_GOAL_BOARD_KEY}
      title="Yousee FM Månedsmål"
      subtitleSuffix="salg (alle produkter)"
      emptyText="Ingen Yousee FM-salg eller mål i denne måned."
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
