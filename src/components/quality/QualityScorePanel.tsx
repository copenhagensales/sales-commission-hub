import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, TrendingUp, Minus, ChevronDown } from "lucide-react";
import type { QualityOverview, QualityPeriodStats } from "@/hooks/useQualityControl";

interface Props {
  overview: QualityOverview | undefined;
  teamId: string | null; // null = Alle
  minReviewsForPercentage: number;
}

const EMPTY: QualityPeriodStats = { total_sales: 0, reviewed: 0, rejected: 0, remarked: 0 };

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function formatPct(value: number | null): string {
  return value === null ? "–" : `${value.toString().replace(".", ",")} %`;
}

function Trend({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  return diff > 0 ? (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <TrendingUp className="h-4 w-4" />
      {`${diff.toString().replace(".", ",")} pct.point`}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-primary">
      <TrendingDown className="h-4 w-4" />
      {`${Math.abs(diff).toString().replace(".", ",")} pct.point`}
    </span>
  );
}

export function QualityScorePanel({ overview, teamId, minReviewsForPercentage }: Props) {
  if (!overview) return null;

  const source = teamId
    ? overview.teams.find((t) => t.team_id === teamId)?.stats ?? {}
    : overview.totals;

  const day = source.day ?? EMPTY;
  const prevDay = source.prev_day ?? EMPTY;
  const d30 = source.d30 ?? EMPTY;
  const prev30 = source.prev_d30 ?? EMPTY;

  const sellers = overview.sellers.filter((s) => !teamId || s.team_id === teamId);

  const codes = overview.error_codes
    .map((c) => ({
      ...c,
      dayCount: c.counts.day ?? 0,
      d30Count: c.counts.d30 ?? 0,
    }))
    .filter((c) => c.dayCount > 0 || c.d30Count > 0)
    .sort((a, b) => b.d30Count - a.d30Count);

  const metrics = [
    {
      title: "Afvisningsprocent",
      dayValue: pct(day.rejected, day.reviewed),
      prevDayValue: pct(prevDay.rejected, prevDay.reviewed),
      d30Value: pct(d30.rejected, d30.reviewed),
      prev30Value: pct(prev30.rejected, prev30.reviewed),
    },
    {
      title: "Bemærkningsprocent",
      dayValue: pct(day.remarked, day.reviewed),
      prevDayValue: pct(prevDay.remarked, prevDay.reviewed),
      d30Value: pct(d30.remarked, d30.reviewed),
      prev30Value: pct(prev30.remarked, prev30.reviewed),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">{formatPct(m.dayValue)}</span>
                <Trend current={m.dayValue} previous={m.prevDayValue} />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>30 dage: {formatPct(m.d30Value)}</span>
                <Trend current={m.d30Value} previous={m.prev30Value} />
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kontrollerede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{day.reviewed}</div>
            <p className="text-sm text-muted-foreground">30 dage: {d30.reviewed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dækningsgrad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">
              {formatPct(pct(day.reviewed, day.total_sales))}
            </div>
            <p className="text-sm text-muted-foreground">
              30 dage: {formatPct(pct(d30.reviewed, d30.total_sales))} ({d30.reviewed} af{" "}
              {d30.total_sales})
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Collapsible open={codesOpen} onOpenChange={setCodesOpen}>
          <Card>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-6 text-left">
              <div>
                <p className="text-base font-semibold leading-none">Fordeling pr. fejlkode</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {codes.length === 0 ? "Ingen fejlkoder endnu" : `${codes.length} fejlkoder`}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${codesOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {codes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen fejlkoder registreret endnu.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fejlkode</TableHead>
                          <TableHead className="text-right">I dag</TableHead>
                          <TableHead className="text-right">30 dage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {codes.map((c) => (
                          <TableRow key={c.code}>
                            <TableCell>{c.label}</TableCell>
                            <TableCell className="text-right">
                              {formatPct(pct(c.dayCount, day.reviewed))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPct(pct(c.d30Count, d30.reviewed))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={sellersOpen} onOpenChange={setSellersOpen}>
          <Card>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-6 text-left">
              <div>
                <p className="text-base font-semibold leading-none">Pr. sælger, 30 dage</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sellers.length === 0 ? "Ingen kontroller i perioden" : `${sellers.length} sælgere`}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${sellersOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {sellers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen kontroller i perioden.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sælger</TableHead>
                          <TableHead className="text-right">Kontrollerede</TableHead>
                          <TableHead className="text-right">Afvist</TableHead>
                          <TableHead className="text-right">Bemærkning</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...sellers]
                          .sort(
                            (a, b) =>
                              (b.stats.d30?.reviewed ?? 0) - (a.stats.d30?.reviewed ?? 0),
                          )
                          .map((s) => {
                            const stats = s.stats.d30 ?? EMPTY;
                            const showPct = stats.reviewed >= minReviewsForPercentage;
                            return (
                              <TableRow key={s.employee_id}>
                                <TableCell>{s.seller_name ?? "Ukendt"}</TableCell>
                                <TableCell className="text-right">{stats.reviewed}</TableCell>
                                <TableCell className="text-right">
                                  {showPct
                                    ? formatPct(pct(stats.rejected, stats.reviewed))
                                    : stats.rejected}
                                </TableCell>
                                <TableCell className="text-right">
                                  {showPct
                                    ? formatPct(pct(stats.remarked, stats.reviewed))
                                    : stats.remarked}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Procent vises først ved mindst {minReviewsForPercentage} kontrollerede salg i
                  perioden. Ellers vises kun antal.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
