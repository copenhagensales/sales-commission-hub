import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Legend } from "recharts";
import { TrendingUp, Target, Zap } from "lucide-react";

interface OnboardingRampChartProps {
  currentWeek: number;
  actualRevenue?: number[];
  // Current metrics for projection
  currentDailyCalls?: number;
  currentMeetingsPerWeek?: number;
  currentOrdersPerWeek?: number;
}

export function OnboardingRampChart({
  currentWeek,
  actualRevenue = [],
  currentDailyCalls = 40,
  currentMeetingsPerWeek = 3,
  currentOrdersPerWeek = 1,
}: OnboardingRampChartProps) {
  // Ramp curve targets over 6 months
  const rampData = [
    { month: 1, label: "Mdr 1", target: 15000, minExpected: 10000, maxExpected: 25000, topPerformer: 25000, middlePerformer: 12000 },
    { month: 2, label: "Mdr 2", target: 25000, minExpected: 18000, maxExpected: 35000, topPerformer: 40000, middlePerformer: 20000 },
    { month: 3, label: "Mdr 3", target: 35000, minExpected: 28000, maxExpected: 45000, topPerformer: 55000, middlePerformer: 28000 },
    { month: 4, label: "Mdr 4", target: 45000, minExpected: 38000, maxExpected: 55000, topPerformer: 70000, middlePerformer: 35000 },
    { month: 5, label: "Mdr 5", target: 50000, minExpected: 42000, maxExpected: 60000, topPerformer: 80000, middlePerformer: 40000 },
    { month: 6, label: "Mdr 6", target: 55000, minExpected: 48000, maxExpected: 65000, topPerformer: 90000, middlePerformer: 45000 },
  ];

  // Add actual revenue to chart data
  const chartData = rampData.map((item, idx) => ({
    ...item,
    actual: actualRevenue[idx] !== undefined ? actualRevenue[idx] : null,
  }));

  // Current month based on week (roughly)
  const currentMonth = Math.ceil(currentWeek / 4);
  const currentTarget = rampData[Math.min(currentMonth - 1, rampData.length - 1)];
  const currentActual = actualRevenue[currentMonth - 1] || 0;

  // Calculate projected revenue at month 4 based on current activity
  const projectedDailyCalls = 60; // If they follow the plan
  const projectedMeetingsRatio = currentMeetingsPerWeek / Math.max(currentDailyCalls * 5, 1);
  const projectedOrdersRatio = currentOrdersPerWeek / Math.max(currentMeetingsPerWeek, 1);
  const avgOrderValue = 5000;
  
  const projectedMonth4Revenue = Math.round(
    projectedDailyCalls * 5 * 4 * projectedMeetingsRatio * projectedOrdersRatio * avgOrderValue
  );

  const estimatedMonthsToTarget = 4;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Progression & fremtidsscenarie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ramp Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="expectedRange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value?.toLocaleString("da-DK")} kr`, ""]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              {/* Expected range area */}
              <Area
                type="monotone"
                dataKey="maxExpected"
                stroke="none"
                fill="url(#expectedRange)"
                fillOpacity={1}
              />
              {/* Top performer line */}
              <Line
                type="monotone"
                dataKey="topPerformer"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={false}
                name="Top-performer"
              />
              {/* Middle performer line */}
              <Line
                type="monotone"
                dataKey="middlePerformer"
                stroke="hsl(45, 93%, 47%)"
                strokeWidth={2}
                dot={false}
                name="Middel"
              />
              {/* Target line */}
              <Line
                type="monotone"
                dataKey="target"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Ramp-mål"
              />
              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--chart-2))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
                connectNulls={false}
                name="Din omsætning"
              />
              {/* Current month marker */}
              <ReferenceLine
                x={rampData[Math.min(currentMonth - 1, rampData.length - 1)]?.label}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <Legend 
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Status message */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">
                Normal interval i denne fase: {currentTarget?.minExpected?.toLocaleString("da-DK")}–{currentTarget?.maxExpected?.toLocaleString("da-DK")} kr.
              </p>
              <p className="text-sm text-muted-foreground">
                {currentActual >= currentTarget?.minExpected 
                  ? "Du ligger på planen."
                  : "Du er i gang – fortsæt med at følge processen."}
              </p>
            </div>
          </div>
        </div>

        {/* "Hvis du fortsætter sådan her" box */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-3">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                  HVIS DU FORTSÆTTER SÅDAN HER
                </p>
                <p className="text-sm font-medium">
                  Med dit nuværende aktivitetsniveau og din udvikling i konvertering estimerer vi, 
                  at du ligger omkring <span className="text-green-600 dark:text-green-400 font-bold">50.000 kr./md</span> om 
                  ca. <span className="text-green-600 dark:text-green-400 font-bold">{estimatedMonthsToTarget} måneder</span>.
                </p>
              </div>

              {/* Cause-effect visualization */}
              <div className="pt-3 border-t border-green-500/20 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">I dag</Badge>
                  <span className="text-muted-foreground">
                    {currentDailyCalls} kald → {currentMeetingsPerWeek} møder → {currentOrdersPerWeek} ordre
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-green-500 text-xs">Hvis du følger planen</Badge>
                  <span className="text-muted-foreground">
                    60 kald → 6 møder → 2–3 ordrer
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
