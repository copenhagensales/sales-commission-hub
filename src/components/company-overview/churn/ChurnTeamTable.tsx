import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fmtPct, fmtPp, sortTeamsForPriority, type ChurnSettings, type DerivedGroup } from "@/lib/churn/metrics";

interface Props {
  teams: DerivedGroup[];
  settings: ChurnSettings;
  onSelectTeam?: (teamKey: string) => void;
  onCreateAction?: (teamKey: string) => void;
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
  onSelectTeam,
  onCreateAction,
}: {
  r: DerivedGroup;
  index: number;
  emphasize: boolean;
  hasTarget: boolean;
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
      <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
        {r.lowData ? "Lavt" : "Tilstrækkeligt"}
      </td>
      <td className="py-3">
        {onCreateAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onCreateAction(r.key);
            }}
          >
            Opret
          </Button>
        )}
      </td>
    </tr>
  );
}

/** UI-06: prioriteret teamtabel — omdesignet for klarhed. */
export function ChurnTeamTable({ teams, settings, onSelectTeam, onCreateAction }: Props) {
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;
  const ordered = sortTeamsForPriority(teams, settings);
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
  const colSpan = hasTarget ? 10 : 8;

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
        <div className="grid grid-cols-2 divide-border rounded-lg border md:grid-cols-4 md:divide-x">
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nye startet (sidste 12 mdr.)</p>
            <p className="text-2xl font-bold">{total.starters}</p>
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
                <th className="py-2 pr-6 text-right">Stoppet inden 60 dage</th>
                <th className="py-2 pr-6">Andel der stoppede (12 mdr.)</th>
                <th className="py-2 pr-6">Udvikling: nyeste 3 mdr. startere vs. de 3 før</th>
                {hasTarget && <th className="py-2 pr-4">Afstand til mål</th>}
                {hasTarget && <th className="py-2 pr-4">Exits over mål</th>}
                <th className="py-2 pr-4">Nok data?</th>
                <th className="py-2">Handling</th>
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
                  onSelectTeam={onSelectTeam}
                  onCreateAction={onCreateAction}
                />
              ))}

              {thin.length > 0 && (
                <tr>
                  <td colSpan={colSpan} className="pt-5 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        For lidt data til at konkludere
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
                  onSelectTeam={onSelectTeam}
                  onCreateAction={onCreateAction}
                />
              ))}

              <tr className="border-t-2 font-semibold">
                <td />
                <td className="py-3 pr-4 whitespace-nowrap">Total (inkl. ukendt)</td>
                <td className="py-3 pr-4 text-right tabular-nums">{total.starters}</td>
                <td className="py-3 pr-6 text-right tabular-nums">{total.exits}</td>
                <td className="py-3 pr-6">
                  <span className="mr-2">{fmtPct(totalRate)}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">samlet rate</span>
                </td>
                <td className="py-3 pr-6" />
                {hasTarget && (
                  <>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 tabular-nums">{total.excess.toFixed(1).replace(".", ",")}</td>
                  </>
                )}
                <td className="py-3 pr-4" />
                <td className="py-3" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-red-500" /> Rate over 60 %
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-orange-400" /> 40–60 %
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-emerald-500" /> Under 40 %
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-muted-foreground/40" /> Lavt datagrundlag — ikke farvet
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasTarget
              ? "Mål-gap og merfrafald måles mod det konfigurerede mål."
              : "Mål-gap og merfrafald vises, når et mål er sat under Metode & datakvalitet."}{" "}
            Historisk lederdata mangler for alle teams.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
