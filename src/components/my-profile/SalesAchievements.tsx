import { ACHIEVEMENT_CONFIGS, getAchievementConfig } from "@/lib/gamification-achievements";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface SalesAchievementsProps {
  unlockedAchievementIds: string[];
  achievements?: Array<{
    achievement_type: string;
    unlocked_at: string;
  }>;
}

export function SalesAchievements({ 
  unlockedAchievementIds,
  achievements = []
}: SalesAchievementsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        🏅 Achievements
      </h4>
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          {ACHIEVEMENT_CONFIGS.slice(0, 8).map((config) => {
            const isUnlocked = unlockedAchievementIds.includes(config.id);
            const achievement = achievements.find(a => a.achievement_type === config.id);
            const Icon = config.icon;

            return (
              <Tooltip key={config.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      isUnlocked
                        ? `${config.color} border-current`
                        : "bg-muted/30 text-muted-foreground/40 border-muted/50"
                    )}
                  >
                    {isUnlocked ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {isUnlocked && (
                      <span className="absolute -top-1 -right-1 text-xs">✓</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-semibold">{config.name}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
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
      </TooltipProvider>
    </div>
  );
}
