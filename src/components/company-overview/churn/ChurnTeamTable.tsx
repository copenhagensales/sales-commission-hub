import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtPct, fmtPp, sortTeamsForPriority, STATUS_CLASSES, type ChurnSettings, type DerivedGroup } from "@/lib/churn/metrics";

interface Props {
  teams: DerivedGroup[];
  settings: ChurnSettings;
  onSelectTeam?: (teamKey: string) => void;
  onCreateAction?: (teamKey: string) => void;
}

/** UI-06: prioriteret teamtabel. */
export function ChurnTeamTable({ teams, settings, onSelectTeam, onCreateAction }: Props) {
  const rows = sortTeamsForPriority(teams, settings);
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;

  const total = rows.reduce(
    (acc, r) => ({
      starters: acc.starters + r.starters,
      exits: acc.exits + r.exits,
      excess: acc.excess + (r.excessExits ?? 0),
    }),
    { starters: 0, exits: 0, excess: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prioriteret teamtabel</CardTitle>
        <CardDescription>
          {hasTarget
            ? "Sorteret efter positivt merfrafald mod mål, derefter antal faktiske exits."
            : "Mål ikke sat — sorteret efter estimeret personpåvirkning, derefter 12-måneders rate og antal startere."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">Ansvarlig leder ved start</th>
                <th className="py-2 pr-3">Modne startere</th>
                <th className="py-2 pr-3">Exits dag 0-60</th>
                <th className="py-2 pr-3">60-dages rate</th>
                <th className="py-2 pr-3">Seneste 3</th>
                <th className="py-2 pr-3">Foregående 3</th>
                <th className="py-2 pr-3">Udvikling</th>
                <th className="py-2 pr-3">Mål-gap</th>
                <th className="py-2 pr-3">Merfrafald</th>
                <th className="py-2 pr-3">Andel af merfrafald</th>
                <th className="py-2 pr-3">Datagrundlag</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Handling</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => onSelectTeam?.(r.key)}
                >
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.key}</td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">Historisk lederdata mangler</td>
                  <td className="py-2 pr-3">{r.starters}</td>
                  <td className="py-2 pr-3">{r.exits}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {fmtPct(r.rate)} · {r.exits}/{r.starters}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {fmtPct(r.recent.rate)} · {r.recent.x}/{r.recent.n}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {fmtPct(r.previous.rate)} · {r.previous.x}/{r.previous.n}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.lowData ? "–" : fmtPp(r.deltaPp)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{hasTarget ? fmtPp(r.gapPp) : "Mål ikke sat"}</td>
                  <td className="py-2 pr-3">{r.excessExits === null ? "–" : r.excessExits.toFixed(1).replace(".", ",")}</td>
                  <td className="py-2 pr-3">{r.shareOfCompanyExcess === null ? "–" : fmtPct(r.shareOfCompanyExcess, 0)}</td>
                  <td className="py-2 pr-3">{r.starters < settings.minimum_n ? "Lavt" : "Tilstrækkeligt"}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[r.status.key]}`}>
                      {r.status.label}
                    </Badge>
                  </td>
                  <td className="py-2">
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
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-3">Total (inkl. ukendt)</td>
                <td />
                <td className="py-2 pr-3">{total.starters}</td>
                <td className="py-2 pr-3">{total.exits}</td>
                <td className="py-2 pr-3">{fmtPct(total.starters ? (total.exits / total.starters) * 100 : null)}</td>
                <td colSpan={4} />
                <td className="py-2 pr-3">{hasTarget ? total.excess.toFixed(1).replace(".", ",") : "–"}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
