import { MonthlyVoiceGoalBoard } from "@/components/dashboards/MonthlyVoiceGoalBoard";
import { useEesyFmMonthlyGoal } from "@/hooks/useEesyFmMonthlyGoal";
import { EESY_FM_MONTHLY_GOAL_BOARD_KEY } from "@/config/eesyFmMonthlyGoals";

export default function EesyFmMonthlyGoalBoard() {
  const { data, isLoading, error } = useEesyFmMonthlyGoal();

  return (
    <MonthlyVoiceGoalBoard
      boardKey={EESY_FM_MONTHLY_GOAL_BOARD_KEY}
      title="Eesy FM Månedsmål"
      subtitleSuffix="voice-salg (alt undtagen 5G Internet)"
      emptyText="Ingen Eesy FM-salg eller mål i denne måned."
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
