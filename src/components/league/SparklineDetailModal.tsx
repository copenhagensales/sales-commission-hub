import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";

interface SparklineDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: number[];
  divisionAvg?: number[];
  playerName?: string;
  dayLabels: string[];
  isRising: boolean;
  isFalling: boolean;
}

export function SparklineDetailModal({
  open,
  onOpenChange,
  data,
  divisionAvg,
  playerName,
  dayLabels,
  isRising,
  isFalling,
}: SparklineDetailModalProps) {
  const chartData = data.map((v, i) => ({
    day: dayLabels[i],
    provision: v,
    ...(divisionAvg ? { avg: divisionAvg[i] } : {}),
  }));

  const strokeColor = isRising
    ? "hsl(142 71% 45%)"
    : isFalling
    ? "hsl(0 84% 60%)"
    : "hsl(217 91% 60%)";

  const totalAvg = divisionAvg
    ? divisionAvg.reduce((a, b) => a + b, 0) / divisionAvg.length
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {playerName ? `${playerName} – 7-dages provision` : "7-dages provision"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Daglig provision de seneste 7 dage
          </DialogDescription>
        </DialogHeader>

        <div className="h-48 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="detail-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString("da-DK")} kr`,
                  name === "avg" ? "Div. gns." : "Provision",
                ]}
              />
              {totalAvg && (
                <ReferenceLine
                  y={totalAvg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 3"
                  opacity={0.5}
                  label={{
                    value: "Div. gns.",
                    position: "right",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              {divisionAvg && (
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  fill="none"
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="provision"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#detail-grad)"
                dot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: strokeColor, strokeWidth: 2, stroke: "hsl(var(--background))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
          <span>Total: {data.reduce((a, b) => a + b, 0).toLocaleString("da-DK")} kr</span>
          <span>
            Højest: {Math.max(...data).toLocaleString("da-DK")} kr
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
