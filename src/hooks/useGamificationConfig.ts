import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PulseThresholds {
  flying: number;
  ahead: number;
  close: number;
  behind: number;
}

export interface StreakThresholds {
  hot: number;
  fire: number;
  legendary: number;
}

export interface CelebrationTriggers {
  pulse_100: boolean;
  new_record: boolean;
  daily_goal: boolean;
  achievement: boolean;
}

export interface CollapseDefaults {
  mobile: boolean;
  desktop: boolean;
}

export interface ProgressColors {
  complete: string;
  almost: string;
  behind: string;
}

export interface GamificationConfig {
  pulseThresholds: PulseThresholds;
  streakThresholds: StreakThresholds;
  nextUnlockPriority: string[];
  celebrationTriggers: CelebrationTriggers;
  collapseDefaults: CollapseDefaults;
  progressColors: ProgressColors;
}

const DEFAULT_CONFIG: GamificationConfig = {
  pulseThresholds: { flying: 120, ahead: 100, close: 90, behind: 75 },
  streakThresholds: { hot: 3, fire: 5, legendary: 10 },
  nextUnlockPriority: ["streak", "record", "achievement"],
  celebrationTriggers: { pulse_100: true, new_record: true, daily_goal: true, achievement: true },
  collapseDefaults: { mobile: true, desktop: false },
  progressColors: { complete: "#22c55e", almost: "#f59e0b", behind: "#ef4444" },
};

const CONFIG_SLUGS = [
  "hero_pulse_animation_thresholds",
  "streak_badge_thresholds",
  "next_unlock_priority_order",
  "micro_celebration_triggers",
  "kpi_card_collapse_default",
  "daily_goal_progress_colors",
] as const;

function parseJsonValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function useGamificationConfig() {
  const query = useQuery({
    queryKey: ["gamification-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("slug, example_value")
        .in("slug", CONFIG_SLUGS);

      if (error) throw error;

      const slugToValue = new Map(
        data?.map((item) => [item.slug, item.example_value]) || []
      );

      const config: GamificationConfig = {
        pulseThresholds: parseJsonValue(
          slugToValue.get("hero_pulse_animation_thresholds") || null,
          DEFAULT_CONFIG.pulseThresholds
        ),
        streakThresholds: parseJsonValue(
          slugToValue.get("streak_badge_thresholds") || null,
          DEFAULT_CONFIG.streakThresholds
        ),
        nextUnlockPriority: parseJsonValue(
          slugToValue.get("next_unlock_priority_order") || null,
          DEFAULT_CONFIG.nextUnlockPriority
        ),
        celebrationTriggers: parseJsonValue(
          slugToValue.get("micro_celebration_triggers") || null,
          DEFAULT_CONFIG.celebrationTriggers
        ),
        collapseDefaults: parseJsonValue(
          slugToValue.get("kpi_card_collapse_default") || null,
          DEFAULT_CONFIG.collapseDefaults
        ),
        progressColors: parseJsonValue(
          slugToValue.get("daily_goal_progress_colors") || null,
          DEFAULT_CONFIG.progressColors
        ),
      };

      return config;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    config: query.data || DEFAULT_CONFIG,
    isLoading: query.isLoading,
  };
}

// Helper to get pulse status based on thresholds
export function getPulseStatus(
  pulsePercent: number,
  thresholds: PulseThresholds
): "flying" | "ahead" | "close" | "behind" {
  if (pulsePercent >= thresholds.flying) return "flying";
  if (pulsePercent >= thresholds.ahead) return "ahead";
  if (pulsePercent >= thresholds.close) return "close";
  return "behind";
}

// Helper to get streak badge based on thresholds
export function getStreakBadge(
  streakDays: number,
  thresholds: StreakThresholds
): { badge: "legendary" | "fire" | "hot" | null; nextBadge: string | null; daysToNext: number } {
  if (streakDays >= thresholds.legendary) {
    return { badge: "legendary", nextBadge: null, daysToNext: 0 };
  }
  if (streakDays >= thresholds.fire) {
    return { badge: "fire", nextBadge: "legendary", daysToNext: thresholds.legendary - streakDays };
  }
  if (streakDays >= thresholds.hot) {
    return { badge: "hot", nextBadge: "fire", daysToNext: thresholds.fire - streakDays };
  }
  return { badge: null, nextBadge: "hot", daysToNext: thresholds.hot - streakDays };
}
