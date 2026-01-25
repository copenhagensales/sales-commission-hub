import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";

const POWER_MOVES = [
  { 
    amount: 10000, 
    name: "The Shield", 
    emoji: "🛡️",
    vibe: "Stress-fri zone",
    description: "Du ejer dine regninger, de ejer ikke dig."
  },
  { 
    amount: 15000, 
    name: "The Starter", 
    emoji: "🌱",
    vibe: "Momentum",
    description: "Momentum bygger. Du er i gang med noget stort."
  },
  { 
    amount: 20000, 
    name: "The Player", 
    emoji: "🎯",
    vibe: "I spil",
    description: "Nu spiller du i de stores liga."
  },
  { 
    amount: 25000, 
    name: "The Seed", 
    emoji: "💰",
    vibe: "Bliv banken",
    description: "Lad pengene arbejde for dig – de vokser mens du sover."
  },
  { 
    amount: 30000, 
    name: "The Builder", 
    emoji: "🏗️",
    vibe: "Fundament",
    description: "Fundamentet er sat. Alt herfra er bonus."
  },
  { 
    amount: 35000, 
    name: "The Accelerator", 
    emoji: "⚡",
    vibe: "Fuld fart",
    description: "Fuld fart fremad. Ingen bremser."
  },
  { 
    amount: 40000, 
    name: "The Veteran", 
    emoji: "🎖️",
    vibe: "Erfaring",
    description: "Du ved hvad du laver. Det er skills."
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
  projectedAmount: number;
  className?: string;
}

export function PowerMovesMilestones({ projectedAmount, className }: PowerMovesMilestonesProps) {
  // Find achieved and next milestone
  const achievedMilestones = POWER_MOVES.filter(m => projectedAmount >= m.amount);
  const lastAchieved = achievedMilestones[achievedMilestones.length - 1] || null;
  const nextMilestone = POWER_MOVES.find(m => projectedAmount < m.amount) || null;
  
  // Calculate progress to next milestone
  const progressToNext = nextMilestone 
    ? Math.min(100, Math.round((projectedAmount / nextMilestone.amount) * 100))
    : 100;
  
  const distanceToNext = nextMilestone 
    ? nextMilestone.amount - projectedAmount 
    : 0;

  // Calculate overall progress across all milestones
  const maxAmount = POWER_MOVES[POWER_MOVES.length - 1].amount;
  const overallProgress = Math.min(100, (projectedAmount / maxAmount) * 100);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Timeline with Emoji Markers */}
      <div className="relative pt-6 pb-2">
        {/* Emoji markers */}
        <div className="absolute top-0 left-0 right-0 flex justify-between px-1">
          {POWER_MOVES.map((milestone, index) => {
            const isAchieved = projectedAmount >= milestone.amount;
            const position = (milestone.amount / maxAmount) * 100;
            return (
              <div
                key={milestone.amount}
                className={cn(
                  "text-lg transition-all duration-300",
                  isAchieved ? "opacity-100 scale-110" : "opacity-30 grayscale"
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
        
        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-success to-warning rounded-full transition-all duration-700 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
          {/* Current position indicator */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background shadow-lg transition-all duration-500"
            style={{ left: `${overallProgress}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      {/* Milestone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Last Achieved */}
        {lastAchieved && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{lastAchieved.emoji}</span>
                <div>
                  <p className="font-semibold text-success">{lastAchieved.name}</p>
                  <p className="text-xs text-muted-foreground">{lastAchieved.amount.toLocaleString("da-DK")} kr</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-success">
                <Check className="h-4 w-4" />
                <span className="text-xs font-medium">Nået!</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">"{lastAchieved.description}"</p>
          </div>
        )}

        {/* Next Milestone */}
        {nextMilestone && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 animate-pulse-slow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{nextMilestone.emoji}</span>
                <div>
                  <p className="font-semibold text-primary">{nextMilestone.name}</p>
                  <p className="text-xs text-muted-foreground">{nextMilestone.amount.toLocaleString("da-DK")} kr</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">
                  Kun {distanceToNext.toLocaleString("da-DK")} kr!
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic mb-2">"{nextMilestone.description}"</p>
            <div className="flex items-center gap-2">
              <Progress value={progressToNext} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-primary">{progressToNext}%</span>
            </div>
          </div>
        )}

        {/* All milestones achieved */}
        {!nextMilestone && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 sm:col-span-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="font-bold text-warning">Boss Mode Unlocked!</p>
                <p className="text-sm text-muted-foreground">Du har nået alle milestones. Legend status.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
