import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Legend, ReferenceDot } from "recharts";
import { TrendingUp, Target, Zap, Star, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingRampChartProps {
  currentWeek: number;
  actualRevenue?: number[];
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
    { month: 1, label: "Mdr 1", topPerformer: 25000, middlePerformer: 12000, minExpected: 8000 },
    { month: 2, label: "Mdr 2", topPerformer: 40000, middlePerformer: 20000, minExpected: 14000 },
    { month: 3, label: "Mdr 3", topPerformer: 55000, middlePerformer: 28000, minExpected: 20000 },
    { month: 4, label: "Mdr 4", topPerformer: 70000, middlePerformer: 35000, minExpected: 25000 },
    { month: 5, label: "Mdr 5", topPerformer: 80000, middlePerformer: 40000, minExpected: 30000 },
    { month: 6, label: "Mdr 6", topPerformer: 90000, middlePerformer: 45000, minExpected: 35000 },
  ];

  // Add actual revenue to chart data
  const chartData = rampData.map((item, idx) => ({
    ...item,
    actual: actualRevenue[idx] !== undefined ? actualRevenue[idx] : null,
  }));

  // Current month based on week
  const currentMonth = Math.ceil(currentWeek / 4);
  const currentActual = actualRevenue[currentMonth - 1] || 20000; // Demo value
  const currentData = rampData[Math.min(currentMonth - 1, rampData.length - 1)];

  // Determine user's current tier
  const getUserTier = () => {
    if (currentActual >= currentData.topPerformer * 0.9) return "top";
    if (currentActual >= currentData.middlePerformer) return "middle";
    return "developing";
  };
  const userTier = getUserTier();

  // Project future based on current trajectory
  const projectedMonth4 = Math.round(currentActual * (70000 / currentData.middlePerformer) * 0.8);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Progression & fremtidsscenarie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Position Indicator */}
        <div className="grid grid-cols-3 gap-3">
          <PositionCard 
            icon={Trophy}
            label="Top-performer"
            value="70.000 kr"
            sublabel="ved måned 4"
            color="emerald"
            isActive={userTier === "top"}
          />
          <PositionCard 
            icon={Medal}
            label="Middel"
            value="35.000 kr"
            sublabel="ved måned 4"
            color="amber"
            isActive={userTier === "middle"}
          />
          <PositionCard 
            icon={Target}
            label="I udvikling"
            value="< 35.000 kr"
            sublabel="ved måned 4"
            color="slate"
            isActive={userTier === "developing"}
          />
        </div>

        {/* "You are here" highlight */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse">
                  <Star className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Du er her nu</p>
                <p className="text-2xl font-bold">{currentActual.toLocaleString("da-DK")} kr</p>
                <p className="text-xs text-muted-foreground">Måned {currentMonth}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Projiceret måned 4</p>
              <p className="text-xl font-semibold text-primary">{projectedMonth4.toLocaleString("da-DK")} kr</p>
              <Badge variant={userTier === "top" ? "default" : userTier === "middle" ? "secondary" : "outline"} className="mt-1">
                {userTier === "top" ? "🚀 Top-performer bane" : userTier === "middle" ? "💪 Middel bane" : "📈 I udvikling"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Enhanced Chart */}
        <div className="h-72 relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 10, bottom: 10 }}>
              <defs>
                {/* Top performer zone gradient */}
                <linearGradient id="topZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02}/>
                </linearGradient>
                {/* Middle zone gradient */}
                <linearGradient id="middleZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02}/>
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
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value / 1000}k`}
                domain={[0, 100000]}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    topPerformer: "Top-performer",
                    middlePerformer: "Middel",
                    actual: "Din omsætning",
                    minExpected: "Minimum forventet"
                  };
                  return [`${value?.toLocaleString("da-DK")} kr`, labels[name] || name];
                }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              
              {/* Zone fills */}
              <Area
                type="monotone"
                dataKey="topPerformer"
                stroke="none"
                fill="url(#topZone)"
                fillOpacity={1}
              />
              
              {/* Top performer line */}
              <Line
                type="monotone"
                dataKey="topPerformer"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                name="topPerformer"
              />
              
              {/* Middle performer line */}
              <Line
                type="monotone"
                dataKey="middlePerformer"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                name="middlePerformer"
              />
              
              {/* Minimum expected line */}
              <Line
                type="monotone"
                dataKey="minExpected"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                name="minExpected"
                opacity={0.5}
              />
              
              {/* Your actual line - prominent */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                strokeWidth={4}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 3, r: 6, stroke: 'hsl(var(--background))' }}
                connectNulls={false}
                name="actual"
              />
              
              {/* Current position marker */}
              <ReferenceLine
                x={currentData?.label}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              
              {/* "You are here" dot */}
              {currentActual && (
                <ReferenceDot
                  x={currentData?.label}
                  y={currentActual}
                  r={10}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={3}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          
          {/* Right side labels */}
          <div className="absolute right-0 top-5 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Top</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Middel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Dig</span>
            </div>
          </div>
        </div>

        {/* Motivation message based on tier */}
        <div className={cn(
          "p-4 rounded-xl border",
          userTier === "top" && "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30",
          userTier === "middle" && "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30",
          userTier === "developing" && "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30"
        )}>
          <div className="flex items-start gap-3">
            <Zap className={cn(
              "h-5 w-5 flex-shrink-0 mt-0.5",
              userTier === "top" && "text-emerald-500",
              userTier === "middle" && "text-amber-500",
              userTier === "developing" && "text-primary"
            )} />
            <div className="space-y-2">
              {userTier === "top" && (
                <>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    🎯 Du er på top-performer banen!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Fantastisk arbejde! Bliv ved med det nuværende niveau, og du rammer 70.000+ kr ved måned 4.
                  </p>
                </>
              )}
              {userTier === "middle" && (
                <>
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    💪 Du ligger solidt i midten
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Med lidt ekstra fokus på aktivitet kan du rykke op i top-performer kategorien. 
                    Øg dine daglige kald fra {currentDailyCalls} til 60 for at accelerere.
                  </p>
                </>
              )}
              {userTier === "developing" && (
                <>
                  <p className="font-medium text-primary">
                    📈 Du er i udvikling – det er helt normalt
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Fokuser på at øge din aktivitet gradvist. Fra {currentDailyCalls} til 50 daglige kald 
                    kan bringe dig op i middel-kategorien på få uger.
                  </p>
                </>
              )}
              
              {/* Quick action metrics */}
              <div className="pt-3 border-t border-current/10 grid grid-cols-3 gap-4 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold">{currentDailyCalls}</p>
                  <p className="text-xs text-muted-foreground">Kald/dag nu</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">→ 60</p>
                  <p className="text-xs text-muted-foreground">Mål kald/dag</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-500">+{60 - currentDailyCalls}</p>
                  <p className="text-xs text-muted-foreground">Ekstra kald</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Position indicator card component
function PositionCard({ 
  icon: Icon, 
  label, 
  value, 
  sublabel, 
  color, 
  isActive 
}: { 
  icon: typeof Trophy; 
  label: string; 
  value: string; 
  sublabel: string; 
  color: "emerald" | "amber" | "slate";
  isActive: boolean;
}) {
  const colorClasses = {
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-500",
      activeBg: "bg-emerald-500/20",
      ring: "ring-emerald-500/50"
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-500",
      activeBg: "bg-amber-500/20",
      ring: "ring-amber-500/50"
    },
    slate: {
      bg: "bg-muted",
      border: "border-border",
      text: "text-muted-foreground",
      activeBg: "bg-muted",
      ring: "ring-muted-foreground/50"
    }
  };

  const classes = colorClasses[color];

  return (
    <div className={cn(
      "p-3 rounded-xl border transition-all duration-300",
      classes.bg,
      classes.border,
      isActive && `${classes.activeBg} ring-2 ${classes.ring} scale-[1.02]`
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", classes.text)} />
        <span className={cn("text-xs font-medium", classes.text)}>{label}</span>
      </div>
      <p className={cn("text-lg font-bold", isActive ? classes.text : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
      {isActive && (
        <Badge className="mt-2 text-xs" variant="outline">
          ← Du er her
        </Badge>
      )}
    </div>
  );
}
