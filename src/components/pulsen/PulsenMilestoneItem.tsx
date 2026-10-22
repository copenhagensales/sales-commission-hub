import { Flag, Flame, Medal, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MilestoneBar } from "@/components/pulsen/MilestoneBar";
import { MilestoneHeroCard } from "@/components/pulsen/MilestoneHeroCard";
import type { PulsenMilestone, PulsenMilestoneType } from "@/hooks/usePulsen";
import { pulsenRelativeTime } from "@/lib/pulsen/format";

const ICON: Record<PulsenMilestoneType, LucideIcon> = {
  first_sale: Flag,
  record_day: TrendingUp,
  record_week: TrendingUp,
  record_pay_period: TrendingUp,
  club: Medal,
  team_day_sales: Users,
  streak: Flame,
  house_record: Trophy,
};
const LABEL: Record<PulsenMilestoneType, string> = {
  first_sale: "Første salg", record_day: "Rekord", record_week: "Rekord", record_pay_period: "Rekord",
  club: "Klub", team_day_sales: "Teamfejring", streak: "Stribe", house_record: "Husrekord",
};

/** "**x** tekst" -> <b>x</b> tekst. Teksten kommer fra jobbet, ikke fra brugere. */
export function renderMilestoneText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
  );
}

export const isHeroMilestone = (m: Pick<PulsenMilestone, "milestone_type" | "level">) =>
  m.milestone_type === "house_record" || (m.milestone_type === "team_day_sales" && m.level >= 100);

const plain = (t: string) => t.replace(/\*\*/g, "");
const num = (n: number | null | undefined) => Math.round(Number(n ?? 0)).toLocaleString("da-DK");

export function PulsenMilestoneItem({ milestone: m, reaction, now }: { milestone: PulsenMilestone; reaction?: ReactNode; now?: Date }) {
  const text = m.payload?.text ?? "";
  const time = pulsenRelativeTime(m.occurred_at, now);
  if (isHeroMilestone(m)) {
    const house = m.milestone_type === "house_record";
    return (
      <MilestoneHeroCard
        value={num(house ? m.value : m.level)}
        unit="salg"
        eyebrow={`${LABEL[m.milestone_type]} · ${time}`}
        title={house ? "Ny husrekord på én dag" : plain(text)}
        subtitle={house && m.payload?.previous != null ? `Før ${num(m.payload.previous)} salg` : undefined}
        footer={reaction}
      />
    );
  }
  const club = m.milestone_type === "club";
  return (
    <MilestoneBar
      icon={ICON[m.milestone_type]}
      iconLabel={LABEL[m.milestone_type]}
      tone={m.milestone_type === "streak" || m.milestone_type === "first_sale" ? "emerald" : "onyx"}
      iconContent={club ? (
        <>
          <Medal className="h-3 w-3" aria-hidden="true" />
          <span className="text-[11px] font-black leading-none tabular-nums">{Math.round(m.level / 1000)}</span>
        </>
      ) : undefined}
      time={time}
      reaction={reaction}
    >
      {renderMilestoneText(text)}
    </MilestoneBar>
  );
}
