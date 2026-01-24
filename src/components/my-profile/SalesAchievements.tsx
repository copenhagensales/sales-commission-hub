import { createAchievementConfigs, ACHIEVEMENT_CATEGORIES, type AchievementCheckData } from "@/lib/gamification-achievements";
import { useAchievementTargets } from "@/hooks/useAchievementTargets";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Lock, ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SalesAchievementsProps {
  unlockedAchievementIds: string[];
  achievements?: Array<{
    achievement_type: string;
    unlocked_at: string;
  }>;
  achievementData?: AchievementCheckData;
}

export function SalesAchievements({ 
  unlockedAchievementIds,
  achievements = [],
  achievementData
}: SalesAchievementsProps) {
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const { data: targets } = useAchievementTargets();
  
  // Create achievement configs with dynamic targets
  const achievementConfigs = useMemo(() => createAchievementConfigs(targets), [targets]);

  // Get unlocked achievements with dates
  const unlockedAchievements = useMemo(() => {
    return achievementConfigs
      .filter(config => unlockedAchievementIds.includes(config.id))
      .map(config => ({
        ...config,
        unlockedAt: achievements.find(a => a.achievement_type === config.id)?.unlocked_at
      }));
  }, [unlockedAchievementIds, achievements, achievementConfigs]);

  // Get next achievement (closest to unlocking)
  const nextAchievement = useMemo(() => {
    if (!achievementData) return null;

    const lockedWithProgress = achievementConfigs
      .filter(config => !unlockedAchievementIds.includes(config.id))
      .map(config => {
        const progress = config.getProgress(achievementData);
        if (!progress) return null;
        const percent = (progress.current / progress.target) * 100;
        return { config, progress, percent };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.percent - a.percent);

    return lockedWithProgress[0] || null;
  }, [achievementData, unlockedAchievementIds, achievementConfigs]);

  // Get achievements by category for full view
  const achievementsByCategory = useMemo(() => {
    const categories = Object.keys(ACHIEVEMENT_CATEGORIES) as Array<keyof typeof ACHIEVEMENT_CATEGORIES>;
    return categories.map(category => ({
      key: category,
      ...ACHIEVEMENT_CATEGORIES[category],
      achievements: achievementConfigs.filter(a => a.category === category)
    }));
  }, [achievementConfigs]);

  const unlockedCount = unlockedAchievementIds.length;
  const totalCount = achievementConfigs.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            🏅 Achievements
          </h4>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Optjen achievements ved at nå dine mål
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
          {unlockedCount}/{totalCount} optjent
        </div>
      </div>

      {/* Unlocked Achievements */}
      {unlockedAchievements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Optjent</p>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {unlockedAchievements.slice(0, 6).map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <Tooltip key={achievement.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                          `${achievement.color} border-current`
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="font-semibold">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      {achievement.unlockedAt && (
                        <p className="text-xs text-primary mt-1">
                          Optjent {format(new Date(achievement.unlockedAt), "d. MMM yyyy", { locale: da })}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
            {unlockedAchievements.length > 6 && (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 text-muted-foreground text-xs font-medium">
                +{unlockedAchievements.length - 6}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Achievement - Highlight */}
      {nextAchievement && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs">✨</span>
            <p className="text-xs font-medium text-primary">Næste Achievement</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2",
                `${nextAchievement.config.color} border-current opacity-60`
              )}
            >
              <nextAchievement.config.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{nextAchievement.config.name}</p>
              <p className="text-xs text-muted-foreground truncate">{nextAchievement.config.requirement}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Progress value={nextAchievement.percent} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {nextAchievement.progress.current}/{nextAchievement.progress.target}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Achievements - Collapsible */}
      <Collapsible open={showAllAchievements} onOpenChange={setShowAllAchievements}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2">
          {showAllAchievements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{showAllAchievements ? "Skjul" : "Se"} alle {totalCount} achievements</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <TooltipProvider>
            {achievementsByCategory.map(category => (
              <div key={category.key} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span>{category.emoji}</span>
                  <span>{category.label}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {category.achievements.map(config => {
                    const isUnlocked = unlockedAchievementIds.includes(config.id);
                    const achievement = achievements.find(a => a.achievement_type === config.id);
                    const progress = achievementData ? config.getProgress(achievementData) : null;
                    const Icon = config.icon;

                    return (
                      <Tooltip key={config.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border transition-all",
                              isUnlocked
                                ? "bg-card border-border"
                                : "bg-muted/30 border-muted/50"
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0",
                                isUnlocked
                                  ? `${config.color} border-current`
                                  : "bg-muted/30 text-muted-foreground/40 border-muted/50"
                              )}
                            >
                              {isUnlocked ? (
                                <Icon className="h-4 w-4" />
                              ) : (
                                <Lock className="h-3 w-3" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-medium truncate",
                                !isUnlocked && "text-muted-foreground"
                              )}>
                                {config.name}
                              </p>
                              {!isUnlocked && progress && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Progress 
                                    value={(progress.current / progress.target) * 100} 
                                    className="h-1 flex-1" 
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {progress.current}/{progress.target}
                                  </span>
                                </div>
                              )}
                              {isUnlocked && (
                                <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> Optjent
                                </span>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px]">
                          <p className="font-semibold">{config.name}</p>
                          <p className="text-xs text-muted-foreground">{config.requirement}</p>
                          {isUnlocked && achievement && (
                            <p className="text-xs text-primary mt-1">
                              Optjent {format(new Date(achievement.unlocked_at), "d. MMM yyyy", { locale: da })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </TooltipProvider>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
