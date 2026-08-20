import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { fmtMonth, fmtPct, fmtPp, sortTeamsForPriority, type ChurnSettings, type DerivedGroup } from "@/lib/churn/metrics";

interface Props {
  teams: DerivedGroup[];
  settings: ChurnSettings;
  onSelectTeam?: (teamKey: string) => void;
  onCreateAction?: (teamKey: string) => void;
  /** Startere efter seneste modne måned — vises som "for nye til at tælle med". */
  immatureTeams?: Array<{ team_key: string; starters: number; exits_so_far: number }>;
  latestMatureMonth?: string | null;
}

/** Farvezone for rate — grå når datagrundlaget er for tyndt. */
function rateTone(rate: number | null, lowData: boolean) {
  if (rate === null || lowData) return { text: "text-foreground", bar: "bg-muted-foreground/40" };
  if (rate >= 60) return { text: "text-red-500", bar: "bg-red-500" };
  if (rate >= 40) return { text: "text-orange-400", bar: "bg-orange-400" };
  return { text: "text-emerald-500", bar: "bg-emerald-500" };
}

function TrendCell({ r }: { r: DerivedGroup }) {
  const hasBoth = r.previous.rate !== null && r.recent.rate !== null;
  const onePerson = r.recent.n <= 1 || r.previous.n <= 1;
  return (
    <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
      <span className={r.previous.rate === null ? "text-muted-foreground" : ""}>
        {r.previous.rate === null ? "ingen data" : fmtPct(r.previous.rate)}
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
      <span className={r.recent.rate === null ? "text-muted-foreground" : "font-semibold"}>
        {r.recent.rate === null ? "ingen data" : fmtPct(r.recent.rate)}
      </span>
      {hasBoth && !r.lowData && !onePerson && r.deltaPp !== null && (
        <Badge
          variant="outline"
          className={`text-[10px] ${
            r.deltaPp <= 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-red-500/30 bg-red-500/10 text-red-500"
          }`}
        >
          {fmtPp(r.deltaPp)}
        </Badge>
      )}
      {hasBoth && onePerson && (
        <span className="text-[10px] text-muted-foreground">
          {Math.max(r.recent.n, r.previous.n)} af {Math.max(r.recent.n, r.previous.n)} person
        </span>
      )}
    </div>
  );
}

function TeamRow({
  r,
  index,
  emphasize,
  hasTarget,
  immature,
  onSelectTeam,
  onCreateAction,
}: {
  r: DerivedGroup;
  index: number;
  emphasize: boolean;
  hasTarget: boolean;
  immature?: number;
  onSelectTeam?: (k: string) => void;
  onCreateAction?: (k: string) => void;
}) {
  const tone = rateTone(r.rate, r.lowData);
  const width = r.rate === null ? 0 : Math.min(100, r.rate);

  return (
    <tr
      className={`border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40 ${
        emphasize ? "bg-muted/20" : ""
      }`}
      onClick={() => onSelectTeam?.(r.key)}
    >
      <td className="py-3 pr-2 text-xs text-muted-foreground tabular-nums">{index}</td>
      <td className={`py-3 pr-4 whitespace-nowrap ${emphasize ? "font-semibold" : "font-medium text-muted-foreground"}`}>
        {r.key}
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{r.starters}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{immature ? `+${immature}` : "–"}</td>
      <td className="py-3 pr-6 text-right tabular-nums">{r.exits}</td>
      <td className="py-3 pr-6 min-w-[190px]">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-bold ${tone.text}`}>{fmtPct(r.rate)}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {r.exits} / {r.starters}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full bg-muted">
          <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
        </div>
      </td>
      <td className="py-3 pr-6 text-xs">
        <TrendCell r={r} />
      </td>
      {hasTarget && (
        <>
          <td className="py-3 pr-4 text-xs whitespace-nowrap">{fmtPp(r.gapPp)}</td>
          <td className="py-3 pr-4 text-xs tabular-nums">
            {r.excessExits === null ? "–" : r.excessExits.toFixed(1).replace(".", ",")}
          </td>
        </>
      )}
    </tr>
  );
}



/** UI-06: prioriteret teamtabel — omdesignet for klarhed. */
export function ChurnTeamTable({
  teams,
  settings,
  onSelectTeam,
  onCreateAction,
  immatureTeams,
  latestMatureMonth,
}: Props) {
  const UNKNOWN_TEAM_KEY = "Øvrige / ukendt team";
  const immatureByTeam = new Map(
    (immatureTeams ?? []).filter((t) => t.team_key !== UNKNOWN_TEAM_KEY).map((t) => [t.team_key, t.starters]),
  );
  const immatureTotal = (immatureTeams ?? [])
    .filter((t) => t.team_key !== UNKNOWN_TEAM_KEY)
    .reduce((a, t) => a + t.starters, 0);
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;
  const ordered = sortTeamsForPriority(teams, settings).filter((t) => t.key !== UNKNOWN_TEAM_KEY);
  const solid = ordered.filter((t) => !t.lowData);
  const thin = ordered.filter((t) => t.lowData);
  const rows = [...solid, ...thin];

  const total = rows.reduce(
    (acc, r) => ({
      starters: acc.starters + r.starters,
      exits: acc.exits + r.exits,
      excess: acc.excess + (r.excessExits ?? 0),
    }),
    { starters: 0, exits: 0, excess: 0 },
  );
  const totalRate = total.starters ? (total.exits / total.starters) * 100 : null;
  const colSpan = hasTarget ? 9 : 7;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Hvor mange nye stopper — pr. team</CardTitle>
            <CardDescription>
              {hasTarget
                ? "Teams med flest exits mere end målet står øverst."
                : "Teams med flest nye medarbejdere der stoppede inden for de første 60 dage står øverst."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-orange-400/40 bg-orange-400/10 text-orange-400">
            {hasTarget ? `Mål: ${fmtPct(settings.target_60d_rate)}` : "Mål ikke sat"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 divide-border rounded-lg border md:grid-cols-5 md:divide-x">
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nye startet (sidste 12 mdr.)</p>
            <p className="text-2xl font-bold">{total.starters}</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nye — for tidligt at måle</p>
            <p className="text-2xl font-bold">{immatureTotal}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              startet efter {fmtMonth(latestMatureMonth)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Stoppet inden 60 dage</p>
            <p className="text-2xl font-bold">{total.exits}</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Andel der stoppede</p>
            <p className={`text-2xl font-bold ${rateTone(totalRate, false).text}`}>{fmtPct(totalRate)}</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Teams med nok data</p>
            <p className="text-2xl font-bold">
              {solid.length} <span className="text-sm font-normal text-muted-foreground">af {rows.length}</span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2" />
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4 text-right">Nye startet</th>
                <th className="py-2 pr-4 text-right">For nye til at måle</th>
                <th className="py-2 pr-6 text-right">Stoppet inden 60 dage</th>
                <th className="py-2 pr-6">Andel der stoppede (12 mdr.)</th>
                <th className="py-2 pr-6">Udvikling: nyeste 3 mdr. startere vs. de 3 før</th>
                {hasTarget && <th className="py-2 pr-4">Afstand til mål</th>}
                {hasTarget && <th className="py-2 pr-4">Exits over mål</th>}
              </tr>

            </thead>

            <tbody>
              {solid.map((r, i) => (
                <TeamRow
                  key={r.key}
                  r={r}
                  index={i + 1}
                  emphasize
                  hasTarget={hasTarget}
                  immature={immatureByTeam.get(r.key)}
                  onSelectTeam={onSelectTeam}
                  onCreateAction={onCreateAction}
                />
              ))}

              {thin.length > 0 && (
                <tr>
                  <td colSpan={colSpan} className="pt-5 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        For få personer til at man kan konkludere noget
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </td>
                </tr>
              )}

              {thin.map((r, i) => (
                <TeamRow
                  key={r.key}
                  r={r}
                  index={solid.length + i + 1}
                  emphasize={false}
                  hasTarget={hasTarget}
                  immature={immatureByTeam.get(r.key)}
                  onSelectTeam={onSelectTeam}
                  onCreateAction={onCreateAction}
                />
              ))}

              <tr className="border-t-2 font-semibold">
                <td />
                <td className="py-3 pr-4 whitespace-nowrap">Hele virksomheden</td>
                <td className="py-3 pr-4 text-right tabular-nums">{total.starters}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                  {immatureTotal ? `+${immatureTotal}` : "–"}
                </td>
                <td className="py-3 pr-6 text-right tabular-nums">{total.exits}</td>
                <td className="py-3 pr-6">
                  <span className="mr-2">{fmtPct(totalRate)}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">i alt</span>
                </td>
                <td className="py-3 pr-6" />
                {hasTarget && (
                  <>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 tabular-nums">{total.excess.toFixed(1).replace(".", ",")}</td>
                  </>
                )}
              </tr>

            </tbody>
          </table>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-red-500" /> Mere end 60 % stopper
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-orange-400" /> 40–60 % stopper
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-emerald-500" /> Under 40 % stopper
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-muted-foreground/40" /> For få personer — ikke farvet
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Andel der stoppede</strong> er gennemsnittet for alle der er startet
              de sidste 12 måneder — ikke kun de sidste 60 dage. Hver person følges i 60 dage fra sin startdato.
            </p>
            <p>
              <strong className="text-foreground">For nye til at måle</strong> er dem der er startet efter{" "}
              {fmtMonth(latestMatureMonth)}. De er ansat og tælles med i medarbejderoversigten, men de har ikke haft
              mulighed for at nå 60 dage endnu, så de kan ikke indgå i andelen uden at gøre den kunstigt lav.
            </p>
            <p>
              <strong className="text-foreground">Udvikling</strong> sammenligner de medarbejdere der startede i de 3
              nyeste måneder (tallet efter pilen) med dem der startede i de 3 måneder før. Grøn betyder færre stopper nu.
            </p>
            <p>
              {hasTarget
                ? "Afstand til mål og exits over mål måles mod det mål der er sat."
                : "Afstand til mål vises, når der er sat et mål under Metode & datakvalitet."}{" "}
              Vi har endnu ikke historik på hvilken leder der havde teamet ved hver opstart.
            </p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
