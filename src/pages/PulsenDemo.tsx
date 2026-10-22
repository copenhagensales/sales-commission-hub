import { Crown, Flame, Rocket, Smile, Trophy } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MilestoneBar } from "@/components/pulsen/MilestoneBar";
import { MilestoneHeroCard } from "@/components/pulsen/MilestoneHeroCard";

/** Intern forhåndsvisning af milepæls-komponenterne. Fiktive eksempler – ingen rigtige data. */
export default function PulsenDemo() {
  const reaction = (
    <button type="button" aria-label="Reagér" className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">
      <Smile className="h-5 w-5" aria-hidden="true" />
    </button>
  );
  return (
    <MainLayout>
      <div className="min-h-screen bg-background px-4 pb-16 pt-6">
        <div className="mx-auto flex max-w-[680px] flex-col gap-4">
          <div>
            <h1 className="text-[32px] font-black leading-none tracking-[-0.03em] text-foreground">Milepæle · demo</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Intern visning af komponenterne. Eksemplerne er fiktive; rigtige milepæle kommer i trin 6.</p>
          </div>
          <MilestoneHeroCard value="100K" unit="kr" eyebrow="Klub 100 · Lønperiode" title="Sælger A er i 100K-klubben" subtitle="Første gang nogensinde" />
          <MilestoneHeroCard value="#1" eyebrow="Husrekord · Dag" title="Ny husrekord på en dag" subtitle="Team Demo" />
          <MilestoneBar icon={Rocket} time="12 min" reaction={reaction}><b>Sælger B</b> har lavet sit første salg</MilestoneBar>
          <MilestoneBar icon={Trophy} tone="onyx" time="i går 14:05" reaction={reaction}><b>Sælger C</b> slog sin dagsrekord · <b>4.250 kr</b></MilestoneBar>
          <MilestoneBar icon={Flame} time="3 t"><b>Team Demo</b> har rundet <b>50 salg</b> i dag</MilestoneBar>
          <MilestoneBar icon={Crown} tone="onyx" time="nu"><b>Sælger D</b> er i 50K-klubben</MilestoneBar>
        </div>
      </div>
    </MainLayout>
  );
}
