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

export function SomeOverallProgress({
  tiktokDone,
  tiktokTarget,
  storiesDone,
  storiesTarget,
  postsDone,
  postsTarget,
}: SomeOverallProgressProps) {
  const { percentage, quote, Icon, level } = useMemo(() => {
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
      quote: randomQuote.quote,
      Icon: randomQuote.icon,
      level: lvl,
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
              <span className="text-lg font-bold">{percentage}%</span>
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
