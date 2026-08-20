import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import {
  fmtPct,
  fmtPp,
  sortTeamsForPriority,
  type ChurnMetricsPayload,
  type DerivedGroup,
} from "@/lib/churn/metrics";

interface Props {
  payload: ChurnMetricsPayload;
  company: DerivedGroup;
  teams: DerivedGroup[];
}

/** Automatisk ledelseskonklusion (UI-02). Ingen tal er hardcodet. */
export function ChurnConclusion({ payload, company, teams }: Props) {
  const s = payload.settings;
  const monthCount = payload.mature_months.length;
  const sentences: string[] = [];

  if (company.rate === null) {
    sentences.push("Der er ikke tilstrækkeligt datagrundlag til at beregne 60-dages tidligt frafald.");
  } else {
    sentences.push(
      `60-dages tidligt frafald er ${fmtPct(company.rate)} — ${company.exits} af ${company.starters} startere — for de seneste ${monthCount} fuldt modne startmåneder.`,
    );
  }

  const trendQualified =
    company.deltaPp !== null && company.recent.n >= s.minimum_n && company.previous.n >= s.minimum_n;
  if (trendQualified) {
    const delta = company.deltaPp as number;
    const direction = delta < 0 ? "bedre" : delta > 0 ? "værre" : "uændret i forhold til";
    sentences.push(
      `Det er ${fmtPp(Math.abs(delta)).replace("+", "")} ${direction} end de foregående tre modne måneder (${company.recent.x}/${company.recent.n} mod ${company.previous.x}/${company.previous.n}).`,
    );
  } else {
    sentences.push("Datagrundlaget er for lille til at konkludere på udviklingen mellem de seneste og de foregående tre modne måneder.");
  }

  if (s.target_60d_rate !== null && s.target_60d_rate !== undefined && company.excessExits !== null) {
    const excess = company.excessExits;
    sentences.push(
      excess > 0
        ? `Virksomheden har ${Math.round(excess)} beregnede merfratrædelser mod mål (${fmtPct(s.target_60d_rate)}).`
        : `Virksomheden ligger ${Math.abs(Math.round(excess))} fratrædelser under mål (${fmtPct(s.target_60d_rate)}).`,
    );
    const drivers = sortTeamsForPriority(teams, s)
      .filter((t) => (t.excessExits ?? 0) > 0 && !t.lowData)
      .slice(0, 2)
      .map((t) => t.key);
    if (drivers.length > 0) {
      sentences.push(`${drivers.join(" og ")} står for den største andel af merfrafaldet.`);
    }
  } else {
    sentences.push("Mål ikke sat — merfrafald kan ikke beregnes.");
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">{sentences.join(" ")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
