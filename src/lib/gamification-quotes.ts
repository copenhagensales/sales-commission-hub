import { Flame, TrendingUp, Target, Trophy, Rocket, Star, Zap, Sparkles } from "lucide-react";

export type PerformanceStatus = "behind" | "on_track" | "ahead" | "goal_reached";

export interface MotivationalQuote {
  quote: string;
  icon: React.ElementType;
}

export const motivationalQuotes: Record<PerformanceStatus, MotivationalQuote[]> = {
  behind: [
    { quote: "En langsom start er stadig en start. Bliv ved!", icon: Flame },
    { quote: "Mestre falder også - de rejser sig bare hurtigere.", icon: Zap },
    { quote: "Hver samtale bringer dig tættere på målet.", icon: Target },
    { quote: "Det er ikke slut, før du siger det er slut!", icon: Sparkles },
    { quote: "Tag det én dag ad gangen. Du kan gøre det!", icon: Star },
    { quote: "Succes er summen af små indsatser gentaget dag efter dag.", icon: TrendingUp },
    { quote: "Dit potentiale er ubegrænset. Vis det i dag!", icon: Rocket },
    { quote: "Fokuser på fremskridt, ikke perfektion.", icon: Target },
  ],
  on_track: [
    { quote: "Du er på rette vej - hold momentum!", icon: TrendingUp },
    { quote: "Konsistens slår talent. Hver. Eneste. Gang.", icon: Target },
    { quote: "Du beviser hver dag, at du kan levere!", icon: Star },
    { quote: "Bliv ved med at pushe - du er tættere end du tror!", icon: Flame },
    { quote: "Dit tempo er perfekt. Bare fortsæt!", icon: Zap },
    { quote: "Stabil som en klippe. Imponerende arbejde!", icon: Trophy },
    { quote: "Du gør det rigtige. Bliv ved!", icon: Sparkles },
    { quote: "Fokuseret, disciplineret, ustoppelig.", icon: Rocket },
  ],
  ahead: [
    { quote: "Du sætter standarden! Fortsæt sådan!", icon: Trophy },
    { quote: "Sprint-mode aktiveret! 🚀", icon: Rocket },
    { quote: "Du er på ild! Intet kan stoppe dig nu!", icon: Flame },
    { quote: "Fantastisk præstation - du inspirerer andre!", icon: Star },
    { quote: "Foran planen og med stil! Keep going!", icon: Zap },
    { quote: "Du gør det umulige muligt. Respekt!", icon: Sparkles },
    { quote: "Champion-mentalitet i aktion!", icon: Trophy },
    { quote: "Du hæver barren for alle. Stærkt arbejde!", icon: TrendingUp },
  ],
  goal_reached: [
    { quote: "BOOM! Mål nået! Du er en legende! 🎉", icon: Trophy },
    { quote: "Mission accomplished. Hvad bliver det næste mål?", icon: Star },
    { quote: "Du gjorde det! Fejr denne sejr! 🏆", icon: Trophy },
    { quote: "Fra drøm til virkelighed. Stolt af dig!", icon: Sparkles },
    { quote: "Mål? Crushed it! Du er fantastisk!", icon: Rocket },
    { quote: "Beviset på, at hårdt arbejde betaler sig!", icon: Flame },
    { quote: "Succes tiltrækker succes. Du er på vej op!", icon: TrendingUp },
    { quote: "Du har tjent din plads på toppen! 👑", icon: Trophy },
  ],
};

export function getRandomQuote(status: PerformanceStatus): MotivationalQuote {
  const quotes = motivationalQuotes[status];
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

export function getPerformanceStatus(
  progressPercent: number,
  isAhead: boolean,
  isOnTrack: boolean
): PerformanceStatus {
  if (progressPercent >= 100) {
    return "goal_reached";
  }
  if (isAhead) {
    return "ahead";
  }
  if (isOnTrack) {
    return "on_track";
  }
  return "behind";
}
