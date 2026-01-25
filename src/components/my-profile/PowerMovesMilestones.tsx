import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target } from "lucide-react";

const POWER_MOVES = [
  { 
    amount: 10000, 
    name: "The Shield", 
    emoji: "🛡️",
    vibe: "Stress-fri zone",
    description: "Første buffer. Du kan sige nej til overarbejde."
  },
  { 
    amount: 15000, 
    name: "The Starter", 
    emoji: "🌱",
    vibe: "Momentum",
    description: "Råd til oplevelser. Spontane planer unlocked."
  },
  { 
    amount: 20000, 
    name: "The Player", 
    emoji: "🎯",
    vibe: "I spil",
    description: "Weekend-trips unlocked. Du lever, ikke bare overlever."
  },
  { 
    amount: 25000, 
    name: "The Seed", 
    emoji: "💰",
    vibe: "Bliv banken",
    description: "Investeringskapital. Passiv indkomst starter her."
  },
  { 
    amount: 30000, 
    name: "The Builder", 
    emoji: "🏗️",
    vibe: "Fundament",
    description: "Fundamentet er sat. Alt herfra er ren bonus."
  },
  { 
    amount: 35000, 
    name: "The Accelerator", 
    emoji: "⚡",
    vibe: "Fuld fart",
    description: "Fuld fart fremad. Ingen bremser. Kun grønt lys."
  },
  { 
    amount: 40000, 
    name: "The Veteran", 
    emoji: "🎖️",
    vibe: "Erfaring",
    description: "Du ved hvad du laver. Det her er skills, ikke held."
  },
  { 
    amount: 50000, 
    name: "The Multiplier", 
    emoji: "👑",
    vibe: "Boss Mode",
    description: "Du bygger imperium. Kapital til de store træk."
  },
];

interface PowerMovesMilestonesProps {
  currentAmount: number;
  projectedAmount: number;
  className?: string;
}

export function PowerMovesMilestones({ currentAmount, projectedAmount, className }: PowerMovesMilestonesProps) {
  const maxAmount = POWER_MOVES[POWER_MOVES.length - 1].amount;
  
  // Current position (what you have NOW)
  const currentProgress = Math.min(100, (currentAmount / maxAmount) * 100);
  const currentNextMilestone = POWER_MOVES.find(m => currentAmount < m.amount) || null;
  const currentDistanceToNext = currentNextMilestone 
    ? currentNextMilestone.amount - currentAmount 
    : 0;
  const currentProgressToNext = currentNextMilestone 
    ? Math.min(100, Math.round((currentAmount / currentNextMilestone.amount) * 100))
    : 100;
  
  // Projected position (where you'll END UP)
  const projectedProgress = Math.min(100, (projectedAmount / maxAmount) * 100);
  const projectedAchievedMilestones = POWER_MOVES.filter(m => projectedAmount >= m.amount);
  const projectedLastAchieved = projectedAchievedMilestones[projectedAchievedMilestones.length - 1] || null;
  const projectedNextMilestone = POWER_MOVES.find(m => projectedAmount < m.amount) || null;
  const projectedDistanceToNext = projectedNextMilestone 
    ? projectedNextMilestone.amount - projectedAmount 
    : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with context */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Din Power Move-rejse</span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{currentAmount.toLocaleString("da-DK")} kr</span>
          <span className="mx-1">→</span>
          <span className="font-semibold text-primary">{projectedAmount.toLocaleString("da-DK")} kr</span>
        </div>
      </div>

      {/* Dual Progress Timeline */}
      <div className="relative pt-6 pb-2">
        {/* Emoji markers */}
        <div className="absolute top-0 left-0 right-0 flex justify-between px-1">
          {POWER_MOVES.map((milestone) => {
            const isCurrentlyAchieved = currentAmount >= milestone.amount;
            const isProjectedAchieved = projectedAmount >= milestone.amount;
            const position = (milestone.amount / maxAmount) * 100;
            return (
              <div
                key={milestone.amount}
                className={cn(
                  "text-sm transition-all duration-300",
                  isCurrentlyAchieved 
                    ? "opacity-100 scale-110" 
                    : isProjectedAchieved 
                      ? "opacity-70" 
                      : "opacity-30 grayscale"
                )}
                style={{ 
                  position: 'absolute', 
                  left: `${position}%`, 
                  transform: 'translateX(-50%)' 
                }}
                title={`${milestone.name} - ${milestone.amount.toLocaleString("da-DK")} kr`}
              >
                {milestone.emoji}
              </div>
            );
          })}
        </div>
        
        {/* Dual progress bar */}
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          {/* Projected progress (striped/lighter) */}
          <div 
            className="absolute inset-y-0 left-0 bg-primary/30 rounded-full transition-all duration-700 ease-out"
            style={{ 
              width: `${projectedProgress}%`,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
            }}
          />
          {/* Current progress (solid) */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-success to-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
          {/* Current position marker */}
          <div 
            className="absolute top-1/2 w-4 h-4 bg-success rounded-full border-2 border-background shadow-lg transition-all duration-500 z-10"
            style={{ left: `${currentProgress}%`, transform: 'translate(-50%, -50%)' }}
            title="Du er her nu"
          />
          {/* Projected position marker */}
          {projectedProgress > currentProgress && (
            <div 
              className="absolute top-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background shadow-md transition-all duration-500"
              style={{ left: `${projectedProgress}%`, transform: 'translate(-50%, -50%)' }}
              title="Målpunkt ved månedens udgang"
            />
          )}
        </div>
        
        {/* Legend */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span>Du er her</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span>Målpunkt</span>
          </div>
        </div>
      </div>

      {/* Milestone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Current: Next Unlock */}
        {currentNextMilestone && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Target className="h-3 w-3" />
              <span>Næste unlock</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentNextMilestone.emoji}</span>
                <div>
                  <p className="font-semibold">{currentNextMilestone.name}</p>
                  <p className="text-xs text-muted-foreground">{currentNextMilestone.amount.toLocaleString("da-DK")} kr</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">
                  {currentDistanceToNext.toLocaleString("da-DK")} kr
                </p>
                <p className="text-xs text-muted-foreground">mangler</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic mb-2">"{currentNextMilestone.description}"</p>
            <div className="flex items-center gap-2">
              <Progress value={currentProgressToNext} className="h-1.5 flex-1" />
              <span className="text-xs font-medium">{currentProgressToNext}%</span>
            </div>
          </div>
        )}

        {/* Projected: End of month */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-1.5 text-xs text-primary mb-2">
            <TrendingUp className="h-3 w-3" />
            <span>Ved månedens udgang</span>
          </div>
          
          {projectedLastAchieved && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{projectedLastAchieved.emoji}</span>
              <div>
                <p className="font-semibold text-primary">{projectedLastAchieved.name}</p>
                <p className="text-xs text-muted-foreground">{projectedLastAchieved.amount.toLocaleString("da-DK")} kr</p>
              </div>
            </div>
          )}
          
          {projectedNextMilestone ? (
            <p className="text-xs text-muted-foreground">
              + <span className="font-semibold text-primary">{projectedNextMilestone.name}</span> kun{" "}
              <span className="font-bold">{projectedDistanceToNext.toLocaleString("da-DK")} kr</span> væk!
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg">👑</span>
              <p className="text-xs font-semibold text-primary">Boss Mode Unlocked!</p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-2 italic">Hvis du holder dit tempo</p>
        </div>

        {/* All current milestones achieved */}
        {!currentNextMilestone && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="font-bold text-warning">Boss Mode Aktiv!</p>
                <p className="text-xs text-muted-foreground">Du har nået alle milestones. Legend.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
