import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AchievementTargets {
  weekWarrior: number;
  consistent: number;
  streakLegend: number;
  unstoppable: number;
  monthHero: number;
  overachiever: number;
  earlyBird: number;
}

export const DEFAULT_ACHIEVEMENT_TARGETS: AchievementTargets = {
  weekWarrior: 5,
  consistent: 10,
  streakLegend: 14,
  unstoppable: 30,
  monthHero: 100,
  overachiever: 110,
  earlyBird: 50,
};

const SLUG_TO_KEY: Record<string, keyof AchievementTargets> = {
  achievement_week_warrior_target: "weekWarrior",
  achievement_consistent_target: "consistent",
  achievement_streak_legend_target: "streakLegend",
  achievement_unstoppable_target: "unstoppable",
  achievement_month_hero_target: "monthHero",
  achievement_overachiever_target: "overachiever",
  achievement_early_bird_target: "earlyBird",
};

export function useAchievementTargets() {
  return useQuery({
    queryKey: ["achievement-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("slug, example_value")
        .like("slug", "achievement_%_target")
        .eq("is_active", true);

      if (error) {
        console.error("Failed to fetch achievement targets:", error);
        return DEFAULT_ACHIEVEMENT_TARGETS;
      }

      const targets = { ...DEFAULT_ACHIEVEMENT_TARGETS };

      data?.forEach((row) => {
        const key = SLUG_TO_KEY[row.slug];
        if (key && row.example_value) {
          const value = parseInt(row.example_value, 10);
          if (!isNaN(value)) {
            targets[key] = value;
          }
        }
      });

      return targets;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}
