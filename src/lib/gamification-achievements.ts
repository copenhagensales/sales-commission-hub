import { Target, Rocket, Flame, Trophy, Sparkles, Zap, Shield, Sun, Medal, Star, Award, Crown } from "lucide-react";
import type { AchievementTargets } from "@/hooks/useAchievementTargets";

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  requirement: string;
  icon: React.ElementType;
  color: string;
  category: "goals" | "streaks" | "special";
  checkCondition: (data: AchievementCheckData) => boolean;
  getProgress: (data: AchievementCheckData) => AchievementProgress | null;
}

export interface AchievementCheckData {
  hasSetGoal: boolean;
  progressPercent: number;
  isAhead: boolean;
  currentStreak: number;
  longestStreak: number;
  daysPassedInPeriod: number;
  totalDaysInPeriod: number;
  previousPeriodTotal?: number;
  currentPeriodTotal: number;
  exceededGoalBy10Percent: boolean;
}

export const ACHIEVEMENT_CATEGORIES = {
  goals: { label: "Mål & Præstation", emoji: "🎯" },
  streaks: { label: "Streak & Konsistens", emoji: "🔥" },
  special: { label: "Special", emoji: "✨" },
} as const;

// Default targets (fallback if database fetch fails)
const DEFAULT_TARGETS: AchievementTargets = {
  weekWarrior: 5,
  consistent: 10,
  streakLegend: 14,
  unstoppable: 30,
  monthHero: 100,
  overachiever: 110,
  earlyBird: 50,
};

export function createAchievementConfigs(targets: AchievementTargets = DEFAULT_TARGETS): AchievementConfig[] {
  return [
    // Goals & Performance
    {
      id: "first_goal",
      name: "Første Mål",
      description: "Sæt dit første salgsmål",
      requirement: "Opret et salgsmål i systemet",
      icon: Target,
      color: "text-blue-400 bg-blue-400/20",
      category: "goals",
      checkCondition: (data) => data.hasSetGoal,
      getProgress: (data) => data.hasSetGoal ? null : { current: 0, target: 1 },
    },
    {
      id: "month_hero",
      name: "Månedens Helt",
      description: "Nå dit mål",
      requirement: `Opnå ${targets.monthHero}% af dit salgsmål`,
      icon: Trophy,
      color: "text-yellow-400 bg-yellow-400/20",
      category: "goals",
      checkCondition: (data) => data.progressPercent >= targets.monthHero,
      getProgress: (data) => ({ current: Math.round(Math.min(data.progressPercent, targets.monthHero)), target: targets.monthHero }),
    },
    {
      id: "overachiever",
      name: "Overachiever",
      description: "Overskrid dit mål med mindst 10%",
      requirement: `Opnå ${targets.overachiever}% af dit salgsmål`,
      icon: Rocket,
      color: "text-green-400 bg-green-400/20",
      category: "goals",
      checkCondition: (data) => data.exceededGoalBy10Percent,
      getProgress: (data) => ({ current: Math.round(Math.min(data.progressPercent, targets.overachiever)), target: targets.overachiever }),
    },
    {
      id: "sprint_master",
      name: "Sprint Mester",
      description: "Opnå Sprint (+10%) scenarie",
      requirement: `Opnå ${targets.overachiever}% af dit salgsmål`,
      icon: Zap,
      color: "text-cyan-400 bg-cyan-400/20",
      category: "goals",
      checkCondition: (data) => data.progressPercent >= targets.overachiever,
      getProgress: (data) => ({ current: Math.round(Math.min(data.progressPercent, targets.overachiever)), target: targets.overachiever }),
    },
    // Streaks & Consistency
    {
      id: "week_warrior",
      name: "Uge Kriger",
      description: `Overgå dagen før ${targets.weekWarrior} dage i træk`,
      requirement: `Overgå gårsdagens indtjening ${targets.weekWarrior} dage i træk`,
      icon: Flame,
      color: "text-orange-400 bg-orange-400/20",
      category: "streaks",
      checkCondition: (data) => data.longestStreak >= targets.weekWarrior,
      getProgress: (data) => ({ current: Math.round(Math.min(data.longestStreak, targets.weekWarrior)), target: targets.weekWarrior }),
    },
    {
      id: "consistent",
      name: "Konsistent",
      description: `Overgå dagen før ${targets.consistent} dage i træk`,
      requirement: `Overgå gårsdagens indtjening ${targets.consistent} dage i træk`,
      icon: Shield,
      color: "text-emerald-400 bg-emerald-400/20",
      category: "streaks",
      checkCondition: (data) => data.longestStreak >= targets.consistent,
      getProgress: (data) => ({ current: Math.round(Math.min(data.longestStreak, targets.consistent)), target: targets.consistent }),
    },
    {
      id: "streak_legend",
      name: "Streak Legend",
      description: `Opnå ${targets.streakLegend} dages streak`,
      requirement: `Sælg noget ${targets.streakLegend} dage i træk`,
      icon: Medal,
      color: "text-pink-400 bg-pink-400/20",
      category: "streaks",
      checkCondition: (data) => data.longestStreak >= targets.streakLegend,
      getProgress: (data) => ({ current: Math.round(Math.min(data.longestStreak, targets.streakLegend)), target: targets.streakLegend }),
    },
    {
      id: "unstoppable",
      name: "Ustoppelig",
      description: `${targets.unstoppable} dages streak`,
      requirement: `Sælg noget ${targets.unstoppable} dage i træk`,
      icon: Crown,
      color: "text-yellow-500 bg-yellow-500/20",
      category: "streaks",
      checkCondition: (data) => data.longestStreak >= targets.unstoppable,
      getProgress: (data) => ({ current: Math.round(Math.min(data.longestStreak, targets.unstoppable)), target: targets.unstoppable }),
    },
    // Special
    {
      id: "comeback_kid",
      name: "Comeback Kid",
      description: "Kom foran efter at være bagud",
      requirement: "Vær bagud og kom så foran igen",
      icon: Sparkles,
      color: "text-purple-400 bg-purple-400/20",
      category: "special",
      checkCondition: (data) => data.isAhead && data.currentStreak > 0,
      getProgress: () => null, // No measurable progress
    },
    {
      id: "early_bird",
      name: "Early Bird",
      description: `Nå ${targets.earlyBird}% af mål inden halvdelen af perioden`,
      requirement: `Nå ${targets.earlyBird}% af mål før halvdelen af måneden`,
      icon: Sun,
      color: "text-amber-400 bg-amber-400/20",
      category: "special",
      checkCondition: (data) => 
        data.daysPassedInPeriod <= data.totalDaysInPeriod / 2 && 
        data.progressPercent >= targets.earlyBird,
      getProgress: (data) => {
        if (data.daysPassedInPeriod > data.totalDaysInPeriod / 2) return null;
        return { current: Math.round(Math.min(data.progressPercent, targets.earlyBird)), target: targets.earlyBird };
      },
    },
    {
      id: "rising_star",
      name: "Rising Star",
      description: "Overgå din forrige periode",
      requirement: "Sælg mere end sidste periode",
      icon: Star,
      color: "text-indigo-400 bg-indigo-400/20",
      category: "special",
      checkCondition: (data) => 
        data.previousPeriodTotal !== undefined && 
        data.currentPeriodTotal > data.previousPeriodTotal,
      getProgress: (data) => {
        if (data.previousPeriodTotal === undefined) return null;
        const percent = data.previousPeriodTotal > 0 
          ? Math.round((data.currentPeriodTotal / data.previousPeriodTotal) * 100)
          : 100;
        return { current: Math.min(percent, 100), target: 100 };
      },
    },
    {
      id: "goal_crusher",
      name: "Goal Crusher",
      description: "Nå mål 3 måneder i træk",
      requirement: "Nå dit mål 3 måneder i træk",
      icon: Award,
      color: "text-red-400 bg-red-400/20",
      category: "special",
      checkCondition: () => false, // Requires historical tracking
      getProgress: () => null, // Requires historical tracking
    },
  ];
}

// Legacy export for backward compatibility - uses default targets
export const ACHIEVEMENT_CONFIGS = createAchievementConfigs();

export function checkAchievements(data: AchievementCheckData, targets?: AchievementTargets): string[] {
  const configs = targets ? createAchievementConfigs(targets) : ACHIEVEMENT_CONFIGS;
  return configs
    .filter(config => config.checkCondition(data))
    .map(config => config.id);
}

export function getAchievementConfig(id: string, targets?: AchievementTargets): AchievementConfig | undefined {
  const configs = targets ? createAchievementConfigs(targets) : ACHIEVEMENT_CONFIGS;
  return configs.find(config => config.id === id);
}
