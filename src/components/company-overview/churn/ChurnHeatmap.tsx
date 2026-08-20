import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UNKNOWN_LEADER_KEY,
  bandsSum,
  fmtPct,
  fmtPp,
  rate,
  sortTeamsForPriority,
  statusFor,
  STATUS_CLASSES,
  type ChurnMetricsPayload,
  type DerivedGroup,
} from "@/lib/churn/metrics";

interface Props {
  payload: ChurnMetricsPayload;
  teams: DerivedGroup[];
  dimension: "teams" | "leaders";
  onSelectCell?: (key: string, month: string | null) => void;
}

const MONTH_LABELS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`;
}

const CELL_BG: Record<string, string> = {
  green: "bg-emerald-500/20 text-emerald-500",
  yellow: "bg-yellow-500/20 text-yellow-600",
  orange: "bg-orange-500/25 text-orange-500",
  red: "bg-red-500/25 text-red-500",
  grey: "bg-muted text-muted-foreground",
  neutral: "bg-primary/10 text-foreground",
};

/** H-01 til H-10: team/leder × startmåned heatmap med faste statusfarver. */
export function ChurnHeatmap({ payload, teams, dimension, onSelectCell }: Props) {
  const months = payload.mature_months;
  const settings = payload.settings;
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;

  const cellIndex = useMemo(() => {
    const map = new Map<string, ChurnMetricsPayload["team_months"][number]>();
    payload.team_months.forEach((c) => map.set(`${c.team_key}|${c.m.slice(0, 10)}`, c));
    return map;
  }, [payload.team_months]);

  const rows = useMemo(() => sortTeamsForPriority(teams, settings), [teams, settings]);

  const leaderRows = useMemo(
    () =>
      payload.leader_totals.map((l) => ({
        key: l.leader_key === "unknown" ? UNKNOWN_LEADER_KEY : l.leader_key,
        starters: l.starters,
        exits: l.exits,
      })),
    [payload.leader_totals],
  );

  const monthTotals = useMemo(() => {
    const map = new Map<string, { starters: number; exits: number }>();
    months.forEach((m) => map.set(m, { starters: 0, exits: 0 }));
    payload.team_months.forEach((c) => {
      const key = c.m.slice(0, 10);
      const cur = map.get(key);
      if (cur) {
        cur.starters += c.starters;
        cur.exits += c.exits;
      }
    });
    return map;
  }, [months, payload.team_months]);

  if (dimension === "leaders") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lederheatmap — leder ved start</CardTitle>
          <CardDescription>Samme månedskolonner og formler som teamvisningen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Historisk lederdata mangler.</strong> Datakilden indeholder ingen effective-dated ledertilknytning
              pr. ansættelsesforløb, og leder ved start må ikke udledes fra nuværende leder. Alle gyldige
              ansættelsesforløb vises derfor under &quot;{UNKNOWN_LEADER_KEY}&quot;, så totalen fortsat afstemmer.
            </AlertDescription>
          </Alert>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Leder ved start</th>
                  <th className="py-2 pr-4">Modne startere</th>
                  <th className="py-2 pr-4">Exits dag 0-60</th>
                  <th className="py-2 pr-4">60-dages rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((l) => (
                  <tr key={l.key} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{l.key}</td>
                    <td className="py-2 pr-4">{l.starters}</td>
                    <td className="py-2 pr-4">{l.exits}</td>
                    <td className="py-2 pr-4">
                      {fmtPct(rate(l.exits, l.starters))} · {l.exits}/{l.starters}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4">{leaderRows.reduce((s, l) => s + l.starters, 0)}</td>
                  <td className="py-2 pr-4">{leaderRows.reduce((s, l) => s + l.exits, 0)}</td>
                  <td className="py-2 pr-4">{fmtPct(payload.company.starters ? (payload.company.exits / payload.company.starters) * 100 : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team × startmåned — 60-dages tidligt frafald</CardTitle>
        <CardDescription>
          {months.length} fuldt modne startmåneder. Hver celle viser rate og exits/startere. Klik en celle for
          drilldown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasTarget && (
          <Alert>
            <AlertDescription>
              <strong>Mål ikke sat.</strong> Heatmappet bruger neutral skala indtil et mål for 60-dages tidligt frafald
              er konfigureret under Metode &amp; datakvalitet.
            </AlertDescription>
          </Alert>
        )}
        <div className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left font-medium border-b">Team</th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-2 text-center font-medium border-b whitespace-nowrap">
                    {formatMonth(m)}
                    <div className="text-[10px] font-normal text-muted-foreground">
                      n={monthTotals.get(m)?.starters ?? 0}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 border-b whitespace-nowrap">12-mdr</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Seneste 3</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Foregå. 3</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Ændring</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Gap til mål</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Merfrafald</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Startere</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Gap til bedste</th>
                <th className="px-2 py-2 border-b whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium border-b whitespace-nowrap">
                    {row.key}
                  </th>
                  {months.map((m) => {
                    const cell = cellIndex.get(`${row.key}|${m}`);
                    if (!cell) {
                      return (
                        <td key={m} className="border-b px-1 py-1">
                          <div className="rounded bg-muted/40 text-muted-foreground text-center py-1">–</div>
                        </td>
                      );
                    }
                    const r = rate(cell.exits, cell.starters);
                    const st = statusFor(r, cell.starters, settings);
                    return (
                      <td key={m} className="border-b px-1 py-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onSelectCell?.(row.key, m)}
                              className={`w-full rounded px-1 py-1 text-center focus:outline-none focus:ring-2 focus:ring-ring ${CELL_BG[st.key]}`}
                            >
                              <div className="font-semibold">{r === null ? "–" : `${Math.round(r)} %`}</div>
                              <div className="text-[10px] opacity-80">
                                {cell.exits}/{cell.starters}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs space-y-0.5">
                            <div className="font-semibold">
                              {row.key} · {formatMonth(m)}
                            </div>
                            <div>Startere: {cell.starters}</div>
                            <div>Dag 0-7: {cell.b0_7}</div>
                            <div>Dag 8-14: {cell.b8_14}</div>
                            <div>Dag 15-30: {cell.b15_30}</div>
                            <div>Dag 31-60: {cell.b31_60}</div>
                            <div>
                              60-dages rate: {fmtPct(r)} · {cell.exits}/{cell.starters}
                            </div>
                            <div>Fastholdte: {cell.starters - cell.exits}</div>
                            <div>
                              Gap til mål:{" "}
                              {hasTarget && r !== null ? fmtPp(r - (settings.target_60d_rate as number)) : "Mål ikke sat"}
                            </div>
                            <div>{st.label}</div>
                            {bandsSum(cell) !== cell.exits && <div>Bemærk: exitperioder afviger fra tælleren</div>}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {fmtPct(row.rate)}
                    <div className="text-[10px] text-muted-foreground">
                      {row.exits}/{row.starters}
                    </div>
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {fmtPct(row.recent.rate)}
                    <div className="text-[10px] text-muted-foreground">
                      {row.recent.x}/{row.recent.n}
                    </div>
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {fmtPct(row.previous.rate)}
                    <div className="text-[10px] text-muted-foreground">
                      {row.previous.x}/{row.previous.n}
                    </div>
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">{fmtPp(row.deltaPp)}</td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {hasTarget ? fmtPp(row.gapPp) : "–"}
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {row.excessExits === null ? "–" : row.excessExits.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">{row.starters}</td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    {row.gapToBestPeerPp === null ? "Ikke tilgængelig" : fmtPp(row.gapToBestPeerPp)}
                  </td>
                  <td className="border-b px-2 text-center whitespace-nowrap">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[row.status.key]}`}>
                      {row.status.label}
                    </Badge>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">Total</th>
                {months.map((m) => {
                  const t = monthTotals.get(m);
                  const r = rate(t?.exits ?? 0, t?.starters ?? 0);
                  return (
                    <td key={m} className="px-1 py-1 text-center">
                      {r === null ? "–" : `${Math.round(r)} %`}
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {t?.exits ?? 0}/{t?.starters ?? 0}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 text-center">
                  {fmtPct(rate(payload.company.exits, payload.company.starters))}
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {payload.company.exits}/{payload.company.starters}
                  </div>
                </td>
                <td colSpan={7} />
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
