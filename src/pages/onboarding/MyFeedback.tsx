import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCoachingTasks, useOnboardingDays, useOnboardingDrills, useCurrentEmployeeId, CoachingTask, OnboardingDay, OnboardingDrill } from "@/hooks/useOnboarding";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MessageSquare, TrendingUp, Award, Target, Lightbulb, Quote, Dumbbell, Calendar, Star } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score === 0) return "bg-destructive text-destructive-foreground";
  if (score === 1) return "bg-yellow-500 text-white";
  return "bg-green-500 text-white";
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "Ingen score";
  if (score === 0) return "Ikke godkendt";
  if (score === 1) return "Godkendt";
  return "Stærk præstation";
}

interface FeedbackCardProps {
  task: CoachingTask;
  day: OnboardingDay | undefined;
  drill: OnboardingDrill | undefined;
}

function FeedbackCard({ task, day, drill }: FeedbackCardProps) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: task.score === 2 ? '#22c55e' : task.score === 1 ? '#eab308' : '#ef4444' }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Dag {day?.day || "?"} - Uge {day?.week || "?"}
            </CardTitle>
            <CardDescription className="mt-1">
              {day?.focus_title || "Ukendt fokus"}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getScoreColor(task.score)}>
              {getScoreLabel(task.score)}
            </Badge>
            {task.completed_at && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(task.completed_at), "d. MMM yyyy", { locale: da })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.strength && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Award className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Styrke</p>
              <p className="text-sm text-muted-foreground">{task.strength}</p>
            </div>
          </div>
        )}
        
        {task.improvement && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Target className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Forbedringspunkt</p>
              <p className="text-sm text-muted-foreground">{task.improvement}</p>
            </div>
          </div>
        )}
        
        {task.suggested_phrase && (
          <div className="flex gap-3 bg-muted/50 rounded-lg p-3">
            <div className="flex-shrink-0 mt-0.5">
              <Quote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Sig denne sætning næste gang</p>
              <p className="text-sm italic">"{task.suggested_phrase}"</p>
            </div>
          </div>
        )}
        
        {drill && (
          <div className="flex gap-3 bg-primary/5 rounded-lg p-3">
            <div className="flex-shrink-0 mt-0.5">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Tildelt øvelse</p>
              <p className="text-sm">{drill.title}</p>
              <p className="text-xs text-muted-foreground">{drill.duration_min} min · {drill.focus}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyFeedback() {
  const { data: employeeId, isLoading: employeeLoading } = useCurrentEmployeeId();
  const { data: tasks = [], isLoading: tasksLoading } = useCoachingTasks({ 
    employeeId: employeeId || undefined, 
    includeAll: true 
  });
  const { data: days = [] } = useOnboardingDays();
  const { data: drills = [] } = useOnboardingDrills();

  const completedTasks = tasks
    .filter(t => t.status === "done" && t.score !== null)
    .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());

  const getDayForTask = (task: CoachingTask) => days.find(d => d.id === task.onboarding_day_id);
  const getDrillForTask = (task: CoachingTask) => drills.find(d => d.id === task.assigned_drill_id);

  // Prepare chart data - chronological order for the chart
  const chartData = completedTasks
    .slice()
    .reverse()
    .map((task, index) => {
      const day = getDayForTask(task);
      return {
        index: index + 1,
        label: `Dag ${day?.day || "?"}`,
        score: task.score ?? 0,
        date: task.completed_at ? format(new Date(task.completed_at), "d/M", { locale: da }) : "",
      };
    });

  // Calculate stats
  const avgScore = completedTasks.length > 0 
    ? completedTasks.reduce((sum, t) => sum + (t.score || 0), 0) / completedTasks.length 
    : 0;
  const strongPerformances = completedTasks.filter(t => t.score === 2).length;
  const approvedCount = completedTasks.filter(t => t.score === 1).length;
  const needsWorkCount = completedTasks.filter(t => t.score === 0).length;

  // Recent trend (last 5 vs previous 5)
  const recentFive = completedTasks.slice(0, 5);
  const previousFive = completedTasks.slice(5, 10);
  const recentAvg = recentFive.length > 0 ? recentFive.reduce((s, t) => s + (t.score || 0), 0) / recentFive.length : 0;
  const prevAvg = previousFive.length > 0 ? previousFive.reduce((s, t) => s + (t.score || 0), 0) / previousFive.length : 0;
  const trendUp = recentAvg > prevAvg;
  const trendFlat = recentAvg === prevAvg;

  const isLoading = employeeLoading || tasksLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Min Feedback
          </h1>
          <p className="text-muted-foreground mt-1">
            Se al din coaching-feedback og følg din udvikling over tid
          </p>
        </div>

        {completedTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Ingen feedback endnu</h3>
              <p className="text-muted-foreground">
                Du vil se din coaching-feedback her, når din leder har gennemført coaching-sessioner med dig.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Star className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{avgScore.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Gns. score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Award className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{strongPerformances}</p>
                      <p className="text-xs text-muted-foreground">Stærke præstationer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{approvedCount}</p>
                      <p className="text-xs text-muted-foreground">Godkendt</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${trendUp ? 'bg-green-500/10' : trendFlat ? 'bg-muted' : 'bg-amber-500/10'}`}>
                      <TrendingUp className={`h-5 w-5 ${trendUp ? 'text-green-500' : trendFlat ? 'text-muted-foreground' : 'text-amber-500 rotate-180'}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{trendUp ? '+' : trendFlat ? '=' : '-'}</p>
                      <p className="text-xs text-muted-foreground">Seneste trend</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Score Development Chart */}
            {chartData.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Score-udvikling
                  </CardTitle>
                  <CardDescription>
                    Din score over tid (0 = Ikke godkendt, 1 = Godkendt, 2 = Stærk)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      score: {
                        label: "Score",
                        theme: {
                          light: "hsl(var(--primary))",
                          dark: "hsl(var(--primary))",
                        },
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          domain={[0, 2]} 
                          ticks={[0, 1, 2]}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => value === 0 ? "❌" : value === 1 ? "✓" : "⭐"}
                          className="text-muted-foreground"
                        />
                        <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value) => [getScoreLabel(value as number), "Score"]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Feedback History */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Feedback-historik
              </h2>
              <div className="space-y-4">
                {completedTasks.map((task) => (
                  <FeedbackCard 
                    key={task.id} 
                    task={task} 
                    day={getDayForTask(task)}
                    drill={getDrillForTask(task)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
