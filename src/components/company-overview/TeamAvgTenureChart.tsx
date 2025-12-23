import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInMonths, differenceInDays, parseISO } from "date-fns";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Normalize team names to handle variations
const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  // Merge "Eesy FM" into "Fieldmarketing"
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Fieldmarketing";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  if (lower.includes("stab")) return "Stab";
  return name;
};

// Teams to exclude from the overview
const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

export function TeamAvgTenureChart() {
  // Fetch current employees with team memberships
  const { data: currentData, isLoading: loadingCurrent } = useQuery({
    queryKey: ["team-tenure-current-employees"],
    queryFn: async () => {
      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date")
        .eq("is_active", true)
        .not("employment_start_date", "is", null);
      if (empError) throw empError;
      
      // Get team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Create a map of employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });
      
      const today = new Date();
      return (employees || []).map(emp => {
        const startDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : today;
        const tenureDays = differenceInDays(today, startDate);
        return {
          id: emp.id,
          team_name: normalizeTeamName(employeeTeamMap.get(emp.id) || null),
          start_date: emp.employment_start_date,
          tenure_days: Math.max(0, tenureDays),
          is_current: true
        };
      });
    },
  });

  // Fetch historical employees
  const { data: historicalData, isLoading: loadingHistorical } = useQuery({
    queryKey: ["team-tenure-historical-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_employment")
        .select("id, employee_name, team_name, start_date, end_date, tenure_days");
      if (error) throw error;
      return (data || []).map(emp => ({
        id: emp.id,
        team_name: normalizeTeamName(emp.team_name),
        start_date: emp.start_date,
        tenure_days: emp.tenure_days,
        is_current: false
      }));
    },
  });

  const isLoading = loadingCurrent || loadingHistorical;

  const chartData = useMemo(() => {
    if (!currentData && !historicalData) return [];

    // Combine all employees
    const allEmployees = [
      ...(currentData || []),
      ...(historicalData || [])
    ];

    // Group by team and calculate stats
    const teamMap = new Map<string, { 
      totalDays: number; 
      count: number;
      currentCount: number;
      leftCount: number;
    }>();

    allEmployees.forEach(emp => {
      const teamName = emp.team_name;
      
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { totalDays: 0, count: 0, currentCount: 0, leftCount: 0 });
      }
      
      const teamData = teamMap.get(teamName)!;
      teamData.totalDays += emp.tenure_days;
      teamData.count++;
      if (emp.is_current) {
        teamData.currentCount++;
      } else {
        teamData.leftCount++;
      }
    });

    // Convert to array with averages, exclude Stab and Ukendt
    return Array.from(teamMap.entries())
      .filter(([name]) => !EXCLUDED_TEAMS.includes(name))
      .map(([name, data]) => {
        const avgDays = data.count > 0 ? data.totalDays / data.count : 0;
        const avgMonths = Math.round(avgDays / 30);
        
        return {
          name,
          avgMonths,
          avgDays: Math.round(avgDays),
          count: data.count,
          currentCount: data.currentCount,
          leftCount: data.leftCount,
        };
      })
      .filter(t => t.count > 0)
      .sort((a, b) => b.avgMonths - a.avgMonths);
  }, [currentData, historicalData]);

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

  const getBarColor = (index: number) => {
    const colors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
    ];
    return colors[index % colors.length];
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
            Alle ansatte (nuværende + tidligere)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {chartData.map((team, index) => {
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
                        backgroundColor: getBarColor(index),
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
                
                {/* Employee counts */}
                <div className="flex items-center gap-1 w-28 shrink-0 justify-end text-xs text-muted-foreground">
                  <span className="text-green-600">{team.currentCount}</span>
                  <span>/</span>
                  <span>{team.leftCount}</span>
                  <span className="ml-1">(n={team.count})</span>
                </div>
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute left-32 -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border border-border rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none">
                <div className="text-xs space-y-1">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-muted-foreground">
                    Gns. anciennitet: {formatMonths(team.avgMonths)}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-green-600">{team.currentCount} nuværende</span> • {team.leftCount} stoppet
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-border mt-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 font-medium">Nuværende</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">Stoppet</span>
            <span className="text-muted-foreground ml-1">(total)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
