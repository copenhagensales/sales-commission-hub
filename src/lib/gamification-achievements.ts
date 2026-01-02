import { Target, Rocket, Flame, Trophy, Sparkles, Zap, Shield, Sun, Medal, Star, Award, Crown } from "lucide-react";

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  checkCondition: (data: AchievementCheckData) => boolean;
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

export const ACHIEVEMENT_CONFIGS: AchievementConfig[] = [
  {
    id: "first_goal",
    name: "Første Mål",
    description: "Sæt dit første salgsmål",
    icon: Target,
    color: "text-blue-400 bg-blue-400/20",
    checkCondition: (data) => data.hasSetGoal,
  },
  {
    id: "overachiever",
    name: "Overachiever",
    description: "Overskrid dit mål med mindst 10%",
    icon: Rocket,
    color: "text-green-400 bg-green-400/20",
    checkCondition: (data) => data.exceededGoalBy10Percent,
  },
  {
    id: "week_warrior",
    name: "Uge Kriger",
    description: "Opnå 5 dages streak",
    icon: Flame,
    color: "text-orange-400 bg-orange-400/20",
    checkCondition: (data) => data.longestStreak >= 5,
  },
  {
    id: "month_hero",
    name: "Månedens Helt",
    description: "Nå dit mål",
    icon: Trophy,
    color: "text-yellow-400 bg-yellow-400/20",
    checkCondition: (data) => data.progressPercent >= 100,
  },
  {
    id: "comeback_kid",
    name: "Comeback Kid",
    description: "Kom foran efter at være bagud",
    icon: Sparkles,
    color: "text-purple-400 bg-purple-400/20",
    checkCondition: (data) => data.isAhead && data.currentStreak > 0,
  },
  {
    id: "sprint_master",
    name: "Sprint Mester",
    description: "Opnå Sprint (+10%) scenarie",
    icon: Zap,
    color: "text-cyan-400 bg-cyan-400/20",
    checkCondition: (data) => data.progressPercent >= 110,
  },
  {
    id: "consistent",
    name: "Konsistent",
    description: "10 dages streak",
    icon: Shield,
    color: "text-emerald-400 bg-emerald-400/20",
    checkCondition: (data) => data.longestStreak >= 10,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Nå 50% af mål inden halvdelen af perioden",
    icon: Sun,
    color: "text-amber-400 bg-amber-400/20",
    checkCondition: (data) => 
      data.daysPassedInPeriod <= data.totalDaysInPeriod / 2 && 
      data.progressPercent >= 50,
  },
  {
    id: "streak_legend",
    name: "Streak Legend",
    description: "Opnå 14 dages streak",
    icon: Medal,
    color: "text-pink-400 bg-pink-400/20",
    checkCondition: (data) => data.longestStreak >= 14,
  },
  {
    id: "unstoppable",
    name: "Ustoppelig",
    description: "30 dages streak",
    icon: Crown,
    color: "text-yellow-500 bg-yellow-500/20",
    checkCondition: (data) => data.longestStreak >= 30,
  },
  {
    id: "rising_star",
    name: "Rising Star",
    description: "Overgå din forrige periode",
    icon: Star,
    color: "text-indigo-400 bg-indigo-400/20",
    checkCondition: (data) => 
      data.previousPeriodTotal !== undefined && 
      data.currentPeriodTotal > data.previousPeriodTotal,
  },
  {
    id: "goal_crusher",
    name: "Goal Crusher",
    description: "Nå mål 3 måneder i træk",
    icon: Award,
    color: "text-red-400 bg-red-400/20",
    checkCondition: () => false, // Requires historical tracking
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
