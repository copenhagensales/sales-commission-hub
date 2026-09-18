import { MonthlyVoiceGoalBoard } from "@/components/dashboards/MonthlyVoiceGoalBoard";
import { useEesyTmMonthlyGoal } from "@/hooks/useEesyTmMonthlyGoal";
import { EESY_TM_MONTHLY_GOAL_BOARD_KEY } from "@/config/eesyTmMonthlyGoals";

export default function EesyTmMonthlyGoalBoard() {
  const { data, isLoading, error } = useEesyTmMonthlyGoal();

  return (
    <MonthlyVoiceGoalBoard
      boardKey={EESY_TM_MONTHLY_GOAL_BOARD_KEY}
      title="Eesy TM Månedsmål"
      subtitleSuffix="voice-salg (alt undtagen 5G internet)"
      emptyText="Ingen Eesy TM-salg eller mål i denne måned."
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
