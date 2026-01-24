import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Flame, Trophy, Award, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { StreakThresholds, getStreakBadge } from "@/hooks/useGamificationConfig";

interface NextUnlockCardProps {
  currentStreak: number;
  streakThresholds: StreakThresholds;
  todayTotal: number;
  bestDayRecord: number | undefined;
  nextAchievement?: {
    name: string;
    icon: React.ElementType;
    progress: { current: number; target: number };
  };
  priorityOrder: string[];
  className?: string;
}

interface UnlockItem {
  type: "streak" | "record" | "achievement";
  title: string;
  subtitle: string;
  icon: React.ElementType;
  progress: number;
  progressLabel: string;
  colorClass: string;
}

const STREAK_ICONS = {
  hot: Flame,
  fire: Zap,
  legendary: Star,
};

const STREAK_LABELS = {
  hot: "🔥 Hot Streak",
  fire: "⚡ Fire Streak",
  legendary: "⭐ Legendary",
};

export function NextUnlockCard({
  currentStreak,
  streakThresholds,
  todayTotal,
  bestDayRecord,
  nextAchievement,
  priorityOrder,
  className,
}: NextUnlockCardProps) {
  const unlockItems = useMemo(() => {
    const items: UnlockItem[] = [];

    // Streak unlock
    const streakInfo = getStreakBadge(currentStreak, streakThresholds);
    if (streakInfo.nextBadge) {
      const nextBadgeKey = streakInfo.nextBadge as keyof typeof STREAK_LABELS;
      const targetDays = streakThresholds[nextBadgeKey];
      items.push({
        type: "streak",
        title: STREAK_LABELS[nextBadgeKey],
        subtitle: `${streakInfo.daysToNext} dag${streakInfo.daysToNext !== 1 ? "e" : ""} til næste badge`,
        icon: STREAK_ICONS[nextBadgeKey],
        progress: (currentStreak / targetDays) * 100,
        progressLabel: `${currentStreak}/${targetDays} dage`,
        colorClass: "text-warning",
      });
    }

    // Record unlock
    if (bestDayRecord && bestDayRecord > 0) {
      const gapToRecord = bestDayRecord - todayTotal;
      if (gapToRecord > 0) {
        const progress = Math.min((todayTotal / bestDayRecord) * 100, 99);
        items.push({
          type: "record",
          title: "💰 Ny personlig rekord",
          subtitle: `${Math.round(gapToRecord).toLocaleString("da-DK")} kr fra bedste dag`,
          icon: Trophy,
          progress,
          progressLabel: `${Math.round(todayTotal).toLocaleString("da-DK")} / ${Math.round(bestDayRecord).toLocaleString("da-DK")} kr`,
          colorClass: "text-primary",
        });
      }
    }

    // Achievement unlock
    if (nextAchievement && nextAchievement.progress.target > 0) {
      const progress = (nextAchievement.progress.current / nextAchievement.progress.target) * 100;
      if (progress < 100) {
        items.push({
          type: "achievement",
          title: nextAchievement.name,
          subtitle: `${nextAchievement.progress.target - nextAchievement.progress.current} til næste`,
          icon: nextAchievement.icon || Award,
          progress,
          progressLabel: `${nextAchievement.progress.current}/${nextAchievement.progress.target}`,
          colorClass: "text-accent-foreground",
        });
      }
    }

    // Sort by priority order
    return items.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.type);
      const bIndex = priorityOrder.indexOf(b.type);
      return aIndex - bIndex;
    });
  }, [currentStreak, streakThresholds, todayTotal, bestDayRecord, nextAchievement, priorityOrder]);

  // Take top 2 items to display
  const displayItems = unlockItems.slice(0, 2);

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border border-border/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5 text-primary" />
          Næste unlock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={`${item.type}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", item.colorClass)} />
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.progressLabel}
                </span>
              </div>
              <Progress value={item.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
