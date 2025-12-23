import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInMonths, subDays } from "date-fns";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function TeamAvgTenureChart() {
  const { data: tenureData, isLoading } = useQuery({
    queryKey: ["company-overview-team-avg-tenure"],
    queryFn: async () => {
      const { data: teamMembers, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          team_id,
          teams(name),
          employee_master_data(employment_start_date, is_active)
        `);
      
      if (error) throw error;
      
      return teamMembers;
    },
  });

  const chartData = useMemo(() => {
    if (!tenureData) return [];

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Group by team and calculate average tenure (now and 30 days ago)
    const teamMap = new Map<string, { 
      totalMonthsNow: number; 
      totalMonthsThen: number; 
      countNow: number; 
      countThen: number;
    }>();

    tenureData.forEach((tm: any) => {
      const teamName = tm.teams?.name || "Ukendt team";
      const employee = tm.employee_master_data;
      
      if (!employee?.is_active || !employee?.employment_start_date) return;
      
      const startDate = new Date(employee.employment_start_date);
      const monthsNow = differenceInMonths(now, startDate);
      
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { totalMonthsNow: 0, totalMonthsThen: 0, countNow: 0, countThen: 0 });
      }
      
      const teamData = teamMap.get(teamName)!;
      teamData.totalMonthsNow += monthsNow;
      teamData.countNow++;
      
      // Only count for 30 days ago if employee was employed then
      if (startDate <= thirtyDaysAgo) {
        const monthsThen = differenceInMonths(thirtyDaysAgo, startDate);
        teamData.totalMonthsThen += monthsThen;
        teamData.countThen++;
      }
    });

    // Convert to array with average and trend, exclude "Stab"
    return Array.from(teamMap.entries())
      .filter(([name]) => name.toLowerCase() !== "stab")
      .map(([name, data]) => {
        const avgMonthsNow = data.countNow > 0 ? data.totalMonthsNow / data.countNow : 0;
        const avgMonthsThen = data.countThen > 0 ? data.totalMonthsThen / data.countThen : 0;
        const change = avgMonthsNow - avgMonthsThen;
        
        return {
          name,
          avgMonths: Math.round(avgMonthsNow),
          avgMonthsThen: Math.round(avgMonthsThen),
          change: Math.round(change * 10) / 10,
          count: data.countNow,
        };
      })
      .filter(t => t.count > 0)
      .sort((a, b) => b.avgMonths - a.avgMonths);
  }, [tenureData]);

  const maxMonths = useMemo(() => {
    if (chartData.length === 0) return 100;
    return Math.max(...chartData.map(d => d.avgMonths)) * 1.1;
  }, [chartData]);

  const formatMonths = (months: number) => {
    if (months < 12) return `${months} mdr`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} år`;
    return `${years} år ${remainingMonths} mdr`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0.5) return TrendingUp;
    if (change < -0.5) return TrendingDown;
    return Minus;
  };

  const getTrendColor = (change: number) => {
    if (change > 0.5) return "text-green-500";
    if (change < -0.5) return "text-red-500";
    return "text-muted-foreground";
  };

  const getBarColor = (change: number, index: number) => {
    if (change > 0.5) return "hsl(142 76% 36%)"; // green
    if (change < -0.5) return "hsl(0 84% 60%)"; // red
    return `hsl(var(--chart-${(index % 5) + 1}))`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gennemsnitlig anciennitet pr. team</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gennemsnitlig anciennitet pr. team</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Ingen data tilgængelig</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Gennemsnitlig anciennitet pr. team</span>
          <span className="text-xs font-normal text-muted-foreground">
            Udvikling: sidste 30 dage
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {chartData.map((team, index) => {
          const TrendIcon = getTrendIcon(team.change);
          const widthPercent = (team.avgMonths / maxMonths) * 100;
          
          return (
            <div 
              key={team.name} 
              className="group relative"
            >
              <div className="flex items-center gap-3">
                {/* Team name */}
                <div className="w-28 shrink-0 text-sm font-medium truncate" title={team.name}>
                  {team.name}
                </div>
                
                {/* Bar container */}
                <div className="flex-1 relative">
                  <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                    {/* Main bar */}
                    <div 
                      className="h-full rounded-md transition-all duration-300 group-hover:brightness-110"
                      style={{ 
                        width: `${widthPercent}%`,
                        backgroundColor: getBarColor(team.change, index),
                      }}
                    />
                  </div>
                  
                  {/* Value label on bar */}
                  <div 
                    className="absolute inset-y-0 flex items-center px-2 text-xs font-medium"
                    style={{ 
                      left: widthPercent > 30 ? '8px' : `${widthPercent}%`,
                      color: widthPercent > 30 ? 'white' : 'hsl(var(--foreground))',
                      marginLeft: widthPercent > 30 ? 0 : '8px'
                    }}
                  >
                    {formatMonths(team.avgMonths)}
                  </div>
                </div>
                
                {/* Trend indicator */}
                <div className={`flex items-center gap-1 w-24 shrink-0 justify-end ${getTrendColor(team.change)}`}>
                  <TrendIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {team.change > 0 ? "+" : ""}{team.change} mdr
                  </span>
                </div>
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute left-32 -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border border-border rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none">
                <div className="text-xs space-y-1">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-muted-foreground">
                    Nu: {formatMonths(team.avgMonths)} • For 30 dage siden: {formatMonths(team.avgMonthsThen)}
                  </div>
                  <div className={getTrendColor(team.change)}>
                    {team.change > 0 ? "↑" : team.change < 0 ? "↓" : "→"} {Math.abs(team.change)} mdr ændring
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-border mt-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142 76% 36%)" }} />
            <span className="text-muted-foreground">Positiv trend</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0 84% 60%)" }} />
            <span className="text-muted-foreground">Negativ trend</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span className="text-muted-foreground">Stabil</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
