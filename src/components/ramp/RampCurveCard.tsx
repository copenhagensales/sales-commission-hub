import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Info, TrendingUp } from "lucide-react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useEmployeeRamp, type RampData } from "@/hooks/useEmployeeRamp";

interface RampCurveCardProps {
  /** Undlad for den indloggede bruger selv. */
  employeeId?: string;
  /** Skjul kortet når opstarten er gennemført (bruges på forsiden). */
  hideWhenCompleted?: boolean;
  className?: string;
}

const MILESTONES = [
  { label: "Første salg", target: 1 },
  { label: "10 salg", target: 10 },
  { label: "25 salg", target: 25 },
  { label: "50 salg", target: 50 },
];

function firstDayReaching(points: { day_no: number; value: number }[], target: number) {
  const hit = points.find((p) => p.value >= target);
  return hit ? hit.day_no : null;
}

export function RampCurveCard({ employeeId, hideWhenCompleted, className }: RampCurveCardProps) {
  const { data, isLoading } = useEmployeeRamp(employeeId);

  const view = useMemo(() => {
    if (!data) return null;
    return buildView(data);
  }, [data]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Din opstart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !view) return null;
  if (hideWhenCompleted && !data.er_aktiv) return null;

  const {
    chartData,
    dayLabel,
    myTotal,
    typicalRange,
    positionText,
    milestones,
    lastPoint,
  } = view;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Din opstart
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{dayLabel}</Badge>
            {data.campaign_name && <span className="truncate">{data.campaign_name}</span>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!data.er_aktiv && (
          <p className="text-sm text-muted-foreground">
            Din opstart er gennemført. Her er hele forløbet.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Dine salg i alt</p>
            <p className="text-2xl font-bold">{myTotal}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Typisk på dag {Math.min(data.current_day_no, 40)}
            </p>
            <p className="text-2xl font-bold">{typicalRange}</p>
          </div>
          <div className="rounded-xl border bg-primary/5 border-primary/20 p-3">
            <p className="text-xs text-muted-foreground">Du ligger</p>
            <p className="text-lg font-semibold text-primary">{positionText}</p>
          </div>
        </div>

        <div className="h-64 sm:h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="day_no"
                type="number"
                domain={[1, 40]}
                ticks={[1, 10, 20, 30, 40]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => `Dag ${label}`}
                formatter={(value: number | number[], name) => {
                  if (name === "band" && Array.isArray(value)) {
                    return [`${Math.round(value[0])}–${Math.round(value[1])}`, "Typisk spænd"];
                  }
                  if (name === "p50") return [Math.round(Number(value)), "Typisk (median)"];
                  if (name === "mine") return [Number(value), "Dine salg"];
                  return [value as number, name];
                }}
              />
              <Area
                dataKey="band"
                name="band"
                stroke="none"
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                dataKey="p50"
                name="p50"
                type="monotone"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="mine"
                name="mine"
                type="monotone"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                connectNulls={false}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: { day_no?: number } }) => {
                  const isLast = props.payload?.day_no === lastPoint;
                  if (!isLast || props.cx == null || props.cy == null) {
                    return <g key={`d-${props.payload?.day_no}`} />;
                  }
                  return (
                    <circle
                      key={`d-${props.payload?.day_no}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            De fleste oplever, at dagene omkring dag 10 til 25 føles tungest. Kurven stiger typisk
            hurtigere derefter.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {milestones.map((m) => (
            <div
              key={m.label}
              className={cn(
                "rounded-lg border p-3",
                m.reachedDay ? "bg-primary/5 border-primary/20" : "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2">
                {m.reachedDay ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium truncate",
                    !m.reachedDay && "text-muted-foreground"
                  )}
                >
                  {m.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {m.reachedDay
                  ? `Nået på dag ${m.reachedDay}`
                  : m.typicalDay
                    ? `Nås typisk på dag ${m.typicalDay}`
                    : "Nås typisk efter dag 40"}
              </p>
            </div>
          ))}
        </div>

        {data.n_sellers ? (
          <p className="text-[11px] text-muted-foreground">
            Baseret på {data.n_sellers} sælgere der er kommet igennem opstarten.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildView(data: RampData) {
  const myByDay = new Map(data.my_days.map((d) => [d.day_no, d.cum_sales]));
  const lastPoint = data.my_days.length ? Math.max(...data.my_days.map((d) => d.day_no)) : 0;

  const chartData = data.band.map((b) => ({
    day_no: b.day_no,
    band: [Number(b.p25), Number(b.p75)] as [number, number],
    p50: Number(b.p50),
    mine: myByDay.has(b.day_no) ? myByDay.get(b.day_no) : null,
  }));

  const currentDay = Math.min(Math.max(data.current_day_no, 1), 40);
  const bandNow = data.band.find((b) => b.day_no === currentDay) ?? data.band[data.band.length - 1];
  const myTotal = myByDay.get(lastPoint) ?? 0;

  const p25 = Math.round(Number(bandNow?.p25 ?? 0));
  const p75 = Math.round(Number(bandNow?.p75 ?? 0));
  const typicalRange = `${p25}–${p75}`;

  const positionText =
    myTotal > p75 ? "over det typiske" : myTotal < p25 ? "under det typiske" : "midt i feltet";

  const minePoints = data.my_days.map((d) => ({ day_no: d.day_no, value: d.cum_sales }));
  const medianPoints = data.band.map((b) => ({ day_no: b.day_no, value: Number(b.p50) }));

  const milestones = MILESTONES.map((m) => ({
    label: m.label,
    reachedDay: firstDayReaching(minePoints, m.target),
    typicalDay: firstDayReaching(medianPoints, m.target),
  }));

  return {
    chartData,
    dayLabel: `Dag ${currentDay} af 40`,
    myTotal,
    typicalRange,
    positionText,
    milestones,
    lastPoint,
  };
}
