import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Rocket, Star, Trophy, Zap } from "lucide-react";

interface SomeOverallProgressProps {
  tiktokDone: number;
  tiktokTarget: number;
  storiesDone: number;
  storiesTarget: number;
  postsDone: number;
  postsTarget: number;
}

const motivationalQuotes = {
  low: [
    { quote: "Enhver rejse starter med det første skridt 🚀", icon: Rocket },
    { quote: "Du har potentialet – nu er det tid til at vise det!", icon: Zap },
    { quote: "Små skridt fører til store resultater", icon: Star },
  ],
  medium: [
    { quote: "Du er godt på vej! Bliv ved med det gode arbejde 💪", icon: Flame },
    { quote: "Halvvejs der – du klarer det!", icon: Star },
    { quote: "Momentum er på din side nu!", icon: Zap },
  ],
  high: [
    { quote: "Fantastisk indsats! Målstregen er i sigte 🏆", icon: Trophy },
    { quote: "Du er ustoppelig! Næsten i mål!", icon: Flame },
    { quote: "Champions giver aldrig op – og det gør du heller ikke!", icon: Trophy },
  ],
  complete: [
    { quote: "BOOM! Alle mål nået! Du er en legende 🎉", icon: Trophy },
    { quote: "100% – Du har smadret det denne uge!", icon: Star },
    { quote: "Perfektion! Tag en velfortjent pause ☕", icon: Trophy },
  ],
};

// Oscar & Kasper happiness levels with granular progression
const getHappinessLevel = (percentage: number) => {
  if (percentage >= 150) return { 
    emoji: "🔥🤯🔥", 
    text: "Oscar & Kasper er LEGENDARISKE!!!", 
    bg: "bg-gradient-to-r from-orange-500/40 to-red-500/40 border-orange-500/60",
    textColor: "text-orange-700 dark:text-orange-300",
    animate: "animate-pulse"
  };
  if (percentage >= 130) return { 
    emoji: "🔥🚀🔥", 
    text: "Oscar & Kasper er ON FIRE!!!", 
    bg: "bg-gradient-to-r from-red-500/30 to-orange-500/30 border-red-500/50",
    textColor: "text-red-700 dark:text-red-300",
    animate: "animate-pulse"
  };
  if (percentage >= 120) return { 
    emoji: "🤯", 
    text: "Oscar & Kaspers hoveder EKSPLODERER!", 
    bg: "bg-purple-500/30 border border-purple-500/50",
    textColor: "text-purple-700 dark:text-purple-300",
    animate: "animate-bounce"
  };
  if (percentage >= 110) return { 
    emoji: "🤩", 
    text: "Oscar & Kasper er VILDE med det!", 
    bg: "bg-green-500/30 border border-green-500/50",
    textColor: "text-green-700 dark:text-green-300",
    animate: ""
  };
  if (percentage >= 100) return { 
    emoji: "🙌", 
    text: "Oscar & Kasper high-fiver!", 
    bg: "bg-green-500/20 border border-green-500/40",
    textColor: "text-green-600 dark:text-green-400",
    animate: ""
  };
  if (percentage >= 90) return { 
    emoji: "🤗", 
    text: "Oscar & Kasper krammer hinanden!", 
    bg: "bg-emerald-500/20 border border-emerald-500/40",
    textColor: "text-emerald-600 dark:text-emerald-400",
    animate: ""
  };
  if (percentage >= 80) return { 
    emoji: "😁", 
    text: "Oscar & Kasper jubler!", 
    bg: "bg-teal-500/20 border border-teal-500/40",
    textColor: "text-teal-600 dark:text-teal-400",
    animate: ""
  };
  if (percentage >= 70) return { 
    emoji: "😀", 
    text: "Oscar & Kasper er begejstrede!", 
    bg: "bg-cyan-500/20 border border-cyan-500/40",
    textColor: "text-cyan-600 dark:text-cyan-400",
    animate: ""
  };
  if (percentage >= 60) return { 
    emoji: "😊", 
    text: "Oscar & Kasper smiler!", 
    bg: "bg-blue-500/20 border border-blue-500/40",
    textColor: "text-blue-600 dark:text-blue-400",
    animate: ""
  };
  if (percentage >= 50) return { 
    emoji: "🙂", 
    text: "Oscar & Kasper ser håb!", 
    bg: "bg-indigo-500/20 border border-indigo-500/40",
    textColor: "text-indigo-600 dark:text-indigo-400",
    animate: ""
  };
  if (percentage >= 40) return { 
    emoji: "😐", 
    text: "Oscar & Kasper holder vejret...", 
    bg: "bg-amber-500/20 border border-amber-500/40",
    textColor: "text-amber-600 dark:text-amber-400",
    animate: ""
  };
  if (percentage >= 30) return { 
    emoji: "😕", 
    text: "Oscar & Kasper kigger bekymret...", 
    bg: "bg-orange-500/20 border border-orange-500/40",
    textColor: "text-orange-600 dark:text-orange-400",
    animate: ""
  };
  if (percentage >= 20) return { 
    emoji: "😟", 
    text: "Oscar & Kasper venter nervøst...", 
    bg: "bg-red-500/20 border border-red-500/40",
    textColor: "text-red-600 dark:text-red-400",
    animate: ""
  };
  if (percentage >= 10) return { 
    emoji: "😰", 
    text: "Oscar & Kasper sveder...", 
    bg: "bg-red-500/25 border border-red-500/45",
    textColor: "text-red-700 dark:text-red-300",
    animate: ""
  };
  return { 
    emoji: "🤒", 
    text: "Oscar & Kasper er syge af bekymring...", 
    bg: "bg-red-500/30 border border-red-500/50",
    textColor: "text-red-700 dark:text-red-300",
    animate: ""
  };
};

export function SomeOverallProgress({
  tiktokDone,
  tiktokTarget,
  storiesDone,
  storiesTarget,
  postsDone,
  postsTarget,
}: SomeOverallProgressProps) {
  const { percentage, displayPercentage, quote, Icon, level, happiness } = useMemo(() => {
    const totalDone = tiktokDone + storiesDone + postsDone;
    const totalTarget = tiktokTarget + storiesTarget + postsTarget;
    const pct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
    
    let lvl: keyof typeof motivationalQuotes;
    if (pct >= 100) lvl = "complete";
    else if (pct >= 70) lvl = "high";
    else if (pct >= 40) lvl = "medium";
    else lvl = "low";

    const quotes = motivationalQuotes[lvl];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    return {
      percentage: Math.min(pct, 100),
      displayPercentage: pct,
      quote: randomQuote.quote,
      Icon: randomQuote.icon,
      level: lvl,
      happiness: getHappinessLevel(pct),
    };
  }, [tiktokDone, tiktokTarget, storiesDone, storiesTarget, postsDone, postsTarget]);

  const progressColor = 
    level === "complete" ? "bg-green-500" :
    level === "high" ? "bg-emerald-500" :
    level === "medium" ? "bg-amber-500" :
    "bg-blue-500";

  const bgGradient =
    level === "complete" ? "from-green-500/10 to-emerald-500/10 border-green-500/30" :
    level === "high" ? "from-emerald-500/10 to-teal-500/10 border-emerald-500/30" :
    level === "medium" ? "from-amber-500/10 to-orange-500/10 border-amber-500/30" :
    "from-blue-500/10 to-indigo-500/10 border-blue-500/30";

  return (
    <Card className={`bg-gradient-to-r ${bgGradient}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${progressColor} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Samlet ugeprogression</p>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{displayPercentage}%</span>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${happiness.bg} ${happiness.animate}`}>
                  <span className="text-2xl">{happiness.emoji}</span>
                  <span className={`text-xs font-bold ${happiness.textColor}`}>
                    {happiness.text}
                  </span>
                </div>
              </div>
            </div>
            <Progress value={percentage} className="h-3" />
            <div className={`p-3 rounded-lg ${
              level === "complete" ? "bg-green-500/20" :
              level === "high" ? "bg-emerald-500/20" :
              level === "medium" ? "bg-amber-500/20" :
              "bg-blue-500/20"
            }`}>
              <p className={`text-base font-semibold ${
                level === "complete" ? "text-green-700 dark:text-green-300" :
                level === "high" ? "text-emerald-700 dark:text-emerald-300" :
                level === "medium" ? "text-amber-700 dark:text-amber-300" :
                "text-blue-700 dark:text-blue-300"
              }`}>
                "{quote}"
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}