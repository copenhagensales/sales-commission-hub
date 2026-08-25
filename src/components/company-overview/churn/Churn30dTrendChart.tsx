import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useChurn30dTrend } from "@/hooks/useChurnDashboard";
import { fmtMonth, fmtPct, rate } from "@/lib/churn/metrics";

const MONTH_OPTIONS = [6, 12, 16, 24] as const;

/**
 * Udvikling i 30-dages churn pr. startmåned.
 * Datagrundlag: RPC `get_churn_30d_monthly_trend` — samme rensede
 * ansættelsesforløb som resten af churn-dashboardet. Kun måneder hvor
 * alle startere har haft fulde 30 dage vises (ingen kunstig udfyldning).
 */
export function Churn30dTrendChart({ months = 6 }: { months?: number }) {
  const [selectedMonths, setSelectedMonths] = useState<number>(months);
  const { data, isLoading, error } = useChurn30dTrend(selectedMonths);


  const points = (data?.months ?? []).map((row) => ({
    label: fmtMonth(row.m).replace(/ (\d{4})$/, " $1"),
    starters: row.starters,
    exits: row.exits,
    churnRate: rate(row.exits, row.starters),
  }));

  const withData = points.filter((p) => p.churnRate !== null);
  const avg =
    withData.length > 0 ? withData.reduce((sum, p) => sum + (p.churnRate as number), 0) / withData.length : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Udvikling i 30-dages churn</CardTitle>
          <CardDescription>
            Andel af nye medarbejdere der stopper inden for 30 dage fra startdato, pr. startmåned. Kun måneder hvor alle
            startere har haft fulde 30 dage. Samme population som churn-nævneren (ekskl. stab).
          </CardDescription>
        </div>
        <Select value={String(selectedMonths)} onValueChange={(v) => setSelectedMonths(Number(v))}>
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                Sidste {m} mdr.
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Kunne ikke indlæse 30-dages udviklingen. {error instanceof Error ? error.message : "Ukendt fejl."}
            </AlertDescription>
          </Alert>
        ) : withData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen modne startmåneder med startere — intet at vise.</p>
        ) : (
          <>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 20, right: 40, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as (typeof points)[number];
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-foreground">{label}</p>
                          <p className="text-sm text-primary mt-1">
                            30-dages churn: <span className="font-semibold">{fmtPct(d.churnRate)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.exits} af {d.starters} nye stoppede inden for 30 dage
                          </p>
                        </div>
                      );
                    }}
                  />
                  {avg !== null && (
                    <ReferenceLine
                      y={avg}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      label={{
                        value: `Gns: ${fmtPct(avg)}`,
                        position: "right",
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="churnRate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    connectNulls
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Faldende linje = færre nye stopper tidligt. Måneder med få startere svinger meget — læs tendensen, ikke
              enkeltmåneder.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
