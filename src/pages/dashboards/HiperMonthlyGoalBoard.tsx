import { MonthlyVoiceGoalBoard } from "@/components/dashboards/MonthlyVoiceGoalBoard";
import { useHiperMonthlyGoal } from "@/hooks/useHiperMonthlyGoal";
import { HIPER_MONTHLY_GOAL_BOARD_KEY } from "@/config/hiperMonthlyGoals";

export default function HiperMonthlyGoalBoard() {
  const { data, isLoading, error } = useHiperMonthlyGoal();
  return (
    <MonthlyVoiceGoalBoard
      boardKey={HIPER_MONTHLY_GOAL_BOARD_KEY}
      title="Hiper Månedsmål"
      subtitleSuffix="salg fra Hiper-teamet"
      emptyText="Ingen Hiper-salg eller mål i denne måned."
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
