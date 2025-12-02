import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { Loader2, Thermometer } from "lucide-react";

interface MonthlyData {
  month: string;
  sickDays: number;
  sickPercentage: number;
}

export function SickLeaveChart() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get number of active agents
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id')
          .eq('is_active', true);
        
        const agentCount = agentsData?.length || 1;

        // Get last 6 months of data
        const months: MonthlyData[] = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          
          const monthName = monthStart.toLocaleDateString('da-DK', { month: 'short' });
          const daysInMonth = monthEnd.getDate();
          const workDaysInMonth = Math.round(daysInMonth * (5/7));

          // Fetch sick absences for this month
          const { data: absencesData } = await supabase
            .from('absences')
            .select('hours')
            .eq('type', 'sick')
            .gte('date', monthStart.toISOString().split('T')[0])
            .lte('date', monthEnd.toISOString().split('T')[0]);

          const sickDays = absencesData?.reduce((sum, a) => sum + ((a.hours || 7.5) / 7.5), 0) || 0;
          const totalPossibleWorkDays = agentCount * workDaysInMonth;
          const sickPercentage = totalPossibleWorkDays > 0 
            ? (sickDays / totalPossibleWorkDays) * 100 
            : 0;

          months.push({
            month: monthName,
            sickDays: Math.round(sickDays * 10) / 10,
            sickPercentage: Math.round(sickPercentage * 10) / 10
          });
        }

        setData(months);
      } catch (error) {
        console.error('Error fetching sick leave data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getBarColor = (percentage: number) => {
    if (percentage > 5) return 'hsl(var(--danger))';
    if (percentage > 3) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Thermometer className="h-5 w-5 text-warning" />
        <h3 className="text-lg font-semibold text-foreground">Sygefravær</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Seneste 6 måneder</p>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="month" 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))'
              }}
              formatter={(value: number, name: string) => [
                name === 'sickPercentage' ? `${value}%` : `${value} dage`,
                name === 'sickPercentage' ? 'Sygeprocent' : 'Sygedage'
              ]}
            />
            <Bar 
              dataKey="sickPercentage" 
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.sickPercentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">&lt;3%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-warning" />
          <span className="text-xs text-muted-foreground">3-5%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-danger" />
          <span className="text-xs text-muted-foreground">&gt;5%</span>
        </div>
      </div>
    </div>
  );
}
