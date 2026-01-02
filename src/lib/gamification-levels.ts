import { Sprout, TrendingUp, Star, Flame, Trophy, Crown } from "lucide-react";

export interface LevelConfig {
  level: number;
  name: string;
  minAmount: number;
  maxAmount: number;
  icon: React.ElementType;
  color: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, name: "Rookie", minAmount: 0, maxAmount: 25000, icon: Sprout, color: "text-green-400" },
  { level: 2, name: "Sælger", minAmount: 25001, maxAmount: 75000, icon: TrendingUp, color: "text-blue-400" },
  { level: 3, name: "Pro", minAmount: 75001, maxAmount: 150000, icon: Star, color: "text-yellow-400" },
  { level: 4, name: "Ekspert", minAmount: 150001, maxAmount: 300000, icon: Flame, color: "text-orange-400" },
  { level: 5, name: "Mester", minAmount: 300001, maxAmount: 500000, icon: Trophy, color: "text-purple-400" },
  { level: 6, name: "Legende", minAmount: 500001, maxAmount: Infinity, icon: Crown, color: "text-amber-400" },
];

export function getLevelFromAmount(totalEarned: number): LevelConfig {
  for (const config of LEVEL_CONFIGS) {
    if (totalEarned >= config.minAmount && totalEarned <= config.maxAmount) {
      return config;
    }
  }
  return LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1];
}

export function getProgressToNextLevel(totalEarned: number): {
  current: LevelConfig;
  next: LevelConfig | null;
  progressPercent: number;
  amountToNext: number;
} {
  const current = getLevelFromAmount(totalEarned);
  const nextLevel = LEVEL_CONFIGS.find(c => c.level === current.level + 1) || null;
  
  if (!nextLevel) {
    return {
      current,
      next: null,
      progressPercent: 100,
      amountToNext: 0,
    };
  }
  
  const amountInLevel = totalEarned - current.minAmount;
  const levelRange = nextLevel.minAmount - current.minAmount;
  const progressPercent = Math.min(100, (amountInLevel / levelRange) * 100);
  const amountToNext = nextLevel.minAmount - totalEarned;
  
  return {
    current,
    next: nextLevel,
    progressPercent,
    amountToNext,
  };
}
