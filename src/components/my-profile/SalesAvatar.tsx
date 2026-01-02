import { Progress } from "@/components/ui/progress";
import { getProgressToNextLevel, type LevelConfig } from "@/lib/gamification-levels";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SalesAvatarProps {
  totalEarned: number;
  className?: string;
  showProgress?: boolean;
}

export function SalesAvatar({ 
  totalEarned, 
  className,
  showProgress = true 
}: SalesAvatarProps) {
  const { current, next, progressPercent, amountToNext } = getProgressToNextLevel(totalEarned);
  const Icon = current.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-3", className)}>
            {/* Avatar Circle */}
            <div className={cn(
              "relative flex items-center justify-center w-14 h-14 rounded-full border-2 transition-all",
              current.color,
              "border-current bg-current/10"
            )}>
              <Icon className="h-7 w-7" />
              <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full px-1.5 py-0.5 text-xs font-bold">
                {current.level}
              </div>
            </div>

            {/* Level Info */}
            {showProgress && (
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-sm font-semibold", current.color)}>
                    Level {current.level}
                  </span>
                  <span className="text-sm text-muted-foreground">{current.name}</span>
                </div>
                {next && (
                  <div className="mt-1 space-y-1">
                    <Progress 
                      value={progressPercent} 
                      className="h-1.5 [&>div]:bg-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      {amountToNext.toLocaleString("da-DK")} kr til {next.name}
                    </p>
                  </div>
                )}
                {!next && (
                  <p className="text-xs text-primary font-medium mt-1">
                    Max level! Du er en legende! 👑
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          <p className="font-semibold">Total optjent provision</p>
          <p className="text-lg font-bold text-primary">
            {totalEarned.toLocaleString("da-DK")} kr
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dit niveau er baseret på al din historiske provision.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
