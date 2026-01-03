import { Flame, Target, Zap, TrendingUp, Shield, Sparkles } from "lucide-react";

interface H2HAchievementBadgesProps {
  isLeading: boolean;
  isLosing: boolean;
  hasMoreCalls: boolean;
  hasMoreTalkTime: boolean;
  consecutiveWins: number;
  commissionPerSale: { my: number; opponent: number };
  callsRatio: number; // my calls / opponent calls
  recentActivityRatio: number; // recent momentum
}

type AchievementType = "hot_streak" | "closer" | "grinder" | "comeback" | "dominating" | "surge";

interface Achievement {
  id: AchievementType;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "hot_streak",
    label: "Hot Streak",
    icon: Flame,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/40",
    glowColor: "shadow-orange-500/50",
  },
  {
    id: "closer",
    label: "Closer",
    icon: Target,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500/40",
    glowColor: "shadow-purple-500/50",
  },
  {
    id: "grinder",
    label: "Grinder",
    icon: Zap,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    borderColor: "border-cyan-500/40",
    glowColor: "shadow-cyan-500/50",
  },
  {
    id: "comeback",
    label: "Comeback",
    icon: TrendingUp,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    glowColor: "shadow-emerald-500/50",
  },
  {
    id: "dominating",
    label: "Dominerer",
    icon: Shield,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/40",
    glowColor: "shadow-amber-500/50",
  },
  {
    id: "surge",
    label: "Surge",
    icon: Sparkles,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    borderColor: "border-pink-500/40",
    glowColor: "shadow-pink-500/50",
  },
];

export const H2HAchievementBadges = ({
  isLeading,
  isLosing,
  hasMoreCalls,
  hasMoreTalkTime,
  consecutiveWins,
  commissionPerSale,
  callsRatio,
  recentActivityRatio,
}: H2HAchievementBadgesProps) => {
  // Determine which achievements are active
  const activeAchievements: AchievementType[] = [];

  // Hot Streak: Leading in 3+ KPIs or consecutive wins
  if (consecutiveWins >= 3) {
    activeAchievements.push("hot_streak");
  }

  // Closer: Higher commission per sale ratio
  if (commissionPerSale.my > commissionPerSale.opponent * 1.2 && commissionPerSale.my > 0) {
    activeAchievements.push("closer");
  }

  // Grinder: Much more call activity
  if (callsRatio > 1.3) {
    activeAchievements.push("grinder");
  }

  // Comeback: Losing but high recent activity
  if (isLosing && recentActivityRatio > 0.6) {
    activeAchievements.push("comeback");
  }

  // Dominating: Leading with big margin
  if (isLeading && consecutiveWins >= 3) {
    activeAchievements.push("dominating");
  }

  // Surge: High recent momentum
  if (recentActivityRatio > 0.7) {
    activeAchievements.push("surge");
  }

  if (activeAchievements.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {activeAchievements.slice(0, 3).map((achievementId) => {
        const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (!achievement) return null;

        const Icon = achievement.icon;

        return (
          <div
            key={achievement.id}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-full
              ${achievement.bgColor} ${achievement.borderColor} border
              shadow-lg ${achievement.glowColor}
              animate-achievement-pop
            `}
          >
            {/* Pulsing glow behind */}
            <div
              className={`absolute inset-0 rounded-full ${achievement.bgColor} animate-pulse opacity-50`}
            />

            <Icon className={`relative w-3.5 h-3.5 ${achievement.color} animate-pulse`} />
            <span className={`relative text-xs font-bold ${achievement.color}`}>
              {achievement.label}
            </span>
          </div>
        );
      })}

      <style>{`
        @keyframes achievement-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-achievement-pop {
          animation: achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
};
