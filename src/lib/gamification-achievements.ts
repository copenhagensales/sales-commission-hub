import { Target, Rocket, Flame, Trophy, Sparkles, Zap, Shield, Sun, Medal, Star, Award, Crown } from "lucide-react";

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

export const ACHIEVEMENT_CONFIGS: AchievementConfig[] = [
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
    requirement: "Opnå 100% af dit salgsmål",
    icon: Trophy,
    color: "text-yellow-400 bg-yellow-400/20",
    category: "goals",
    checkCondition: (data) => data.progressPercent >= 100,
    getProgress: (data) => ({ current: Math.min(data.progressPercent, 100), target: 100 }),
  },
  {
    id: "overachiever",
    name: "Overachiever",
    description: "Overskrid dit mål med mindst 10%",
    requirement: "Opnå 110% af dit salgsmål",
    icon: Rocket,
    color: "text-green-400 bg-green-400/20",
    category: "goals",
    checkCondition: (data) => data.exceededGoalBy10Percent,
    getProgress: (data) => ({ current: Math.min(data.progressPercent, 110), target: 110 }),
  },
  {
    id: "sprint_master",
    name: "Sprint Mester",
    description: "Opnå Sprint (+10%) scenarie",
    requirement: "Opnå 110% af dit salgsmål",
    icon: Zap,
    color: "text-cyan-400 bg-cyan-400/20",
    category: "goals",
    checkCondition: (data) => data.progressPercent >= 110,
    getProgress: (data) => ({ current: Math.min(data.progressPercent, 110), target: 110 }),
  },
  // Streaks & Consistency
  {
    id: "week_warrior",
    name: "Uge Kriger",
    description: "Opnå 5 dages streak",
    requirement: "Sælg noget 5 dage i træk",
    icon: Flame,
    color: "text-orange-400 bg-orange-400/20",
    category: "streaks",
    checkCondition: (data) => data.longestStreak >= 5,
    getProgress: (data) => ({ current: Math.min(data.longestStreak, 5), target: 5 }),
  },
  {
    id: "consistent",
    name: "Konsistent",
    description: "10 dages streak",
    requirement: "Sælg noget 10 dage i træk",
    icon: Shield,
    color: "text-emerald-400 bg-emerald-400/20",
    category: "streaks",
    checkCondition: (data) => data.longestStreak >= 10,
    getProgress: (data) => ({ current: Math.min(data.longestStreak, 10), target: 10 }),
  },
  {
    id: "streak_legend",
    name: "Streak Legend",
    description: "Opnå 14 dages streak",
    requirement: "Sælg noget 14 dage i træk",
    icon: Medal,
    color: "text-pink-400 bg-pink-400/20",
    category: "streaks",
    checkCondition: (data) => data.longestStreak >= 14,
    getProgress: (data) => ({ current: Math.min(data.longestStreak, 14), target: 14 }),
  },
  {
    id: "unstoppable",
    name: "Ustoppelig",
    description: "30 dages streak",
    requirement: "Sælg noget 30 dage i træk",
    icon: Crown,
    color: "text-yellow-500 bg-yellow-500/20",
    category: "streaks",
    checkCondition: (data) => data.longestStreak >= 30,
    getProgress: (data) => ({ current: Math.min(data.longestStreak, 30), target: 30 }),
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
    description: "Nå 50% af mål inden halvdelen af perioden",
    requirement: "Nå 50% af mål før halvdelen af måneden",
    icon: Sun,
    color: "text-amber-400 bg-amber-400/20",
    category: "special",
    checkCondition: (data) => 
      data.daysPassedInPeriod <= data.totalDaysInPeriod / 2 && 
      data.progressPercent >= 50,
    getProgress: (data) => {
      if (data.daysPassedInPeriod > data.totalDaysInPeriod / 2) return null;
      return { current: Math.min(data.progressPercent, 50), target: 50 };
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

export function checkAchievements(data: AchievementCheckData): string[] {
  return ACHIEVEMENT_CONFIGS
    .filter(config => config.checkCondition(data))
    .map(config => config.id);
}

export function getAchievementConfig(id: string): AchievementConfig | undefined {
  return ACHIEVEMENT_CONFIGS.find(config => config.id === id);
}
