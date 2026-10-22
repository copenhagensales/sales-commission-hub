import { Smile } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PulsenMilestoneItem } from "@/components/pulsen/PulsenMilestoneItem";
import type { PulsenMilestone } from "@/hooks/usePulsen";

const NOW = new Date();
const day = (offset: number) => {
  const d = new Date(NOW); d.setDate(d.getDate() - offset);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
};
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();
const m = (p: Partial<PulsenMilestone> & Pick<PulsenMilestone, "milestone_type">): PulsenMilestone => ({
  id: crypto.randomUUID(), employee_id: null, team_id: null, period_key: "demo", level: 0, value: 0,
  payload: null, shown_in_house: true, occurred_at: ago(5), ...p,
});

/** Fiktive eksempler – ingen rigtige data. Viser samme komponent som feedet. */
const DEMO: PulsenMilestone[] = [
  m({ milestone_type: "team_record", value: 342, occurred_at: ago(4), payload: { text: "**Team Demo** satte teamrekord {dag}: **342 salg** (før 331)", previous: 331, day: day(0) } }),
  m({ milestone_type: "house_record", value: 512, occurred_at: ago(30), payload: { text: "Husrekord {dag}: **512 salg** (før 498)", previous: 498, day: day(0) } }),
  m({ milestone_type: "club", level: 100000, value: 103250, occurred_at: ago(45), payload: { text: "**Sælger A.** nåede Klub 100 – **103.250 kr** i provision denne lønperiode", day: day(0) } }),
  m({ milestone_type: "team_day_sales", level: 300, occurred_at: ago(80), payload: { text: "**Team Demo** rundede **300 salg** {dag}", day: day(0), tier: 2 } }),
  m({ milestone_type: "first_sale", occurred_at: ago(150), payload: { text: "**Sælger B.** lavede sit første salg {dag}", day: day(0) } }),
  m({ milestone_type: "record_day", value: 4250, occurred_at: ago(60 * 26), payload: { text: "**Sælger C.** slog sin dagsrekord {dag}: **4.250 kr** (før 3.900 kr)", day: day(1) } }),
  m({ milestone_type: "streak", level: 20, occurred_at: ago(60 * 50), payload: { text: "**Sælger D.** har solgt **20 dage i træk**", day: day(2) } }),
];

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
            <p className="mt-2 text-[15px] text-muted-foreground">Intern visning. Eksemplerne er fiktive.</p>
          </div>
          {DEMO.map((x) => <PulsenMilestoneItem key={x.id} milestone={x} reaction={reaction} now={NOW} />)}
        </div>
      </div>
    </MainLayout>
  );
}
