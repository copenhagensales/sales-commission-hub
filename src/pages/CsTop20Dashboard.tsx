import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { Trophy, Calendar, Clock } from "lucide-react";

// Check if we're in TV mode
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') || 
         window.location.pathname.startsWith('/t/') || 
         sessionStorage.getItem('tv_board_code') !== null;
};

// Auto-reload page every 5 minutes to pick up code/layout changes
const useAutoReload = (enabled: boolean, intervalMs = 5 * 60 * 1000) => {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      window.location.reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
};

interface TvCsTop20Data {
  sellersToday: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
  sellersWeek: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
  sellersPayroll: Array<{ name: string; sales: number; commission: number; avatarUrl?: string; employeeId?: string; goalTarget?: number | null }>;
}

// Calculate payroll period (15th to 14th)
function calculatePayrollPeriod(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  
  if (currentDay >= 15) {
    const start = new Date(today.getFullYear(), today.getMonth(), 15);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
    return { start, end };
  } else {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const end = new Date(today.getFullYear(), today.getMonth(), 14);
    return { start, end };
  }
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value);

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Format name as "Firstname L." for better display
const getDisplayName = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}`;
  }
  return name;
};

// Commission color thresholds based on period type
const getCommissionColor = (commission: number, period: 'day' | 'week' | 'payroll') => {
  const thresholds = {
    day: { green: 1250, yellow: 1000 },
    week: { green: 6250, yellow: 5000 },
    payroll: { green: 26250, yellow: 21000 }
  };
  const { green, yellow } = thresholds[period];
  if (commission >= green) return "bg-green-500";
  if (commission >= yellow) return "bg-yellow-500";
  return "bg-red-500";
};

// Get rank badge for top 3
const getRankBadge = (index: number) => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return null;
};

export default function CsTop20Dashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Fetch TV data from edge function (bypasses RLS for TV mode)
  const { data: tvData } = useQuery<TvCsTop20Data>({
    queryKey: ["tv-cs-top-20-data"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/tv-dashboard-data?action=cs-top-20-data`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch TV data");
      }
      return response.json();
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

  // Fetch sales for today (all clients)
  const dailySalesData = useDashboardSalesData({
    startDate: today,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch sales for this week (all clients)
  const weeklySalesData = useDashboardSalesData({
    startDate: weekStart,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch sales for payroll period (all clients)
  const payrollSalesData = useDashboardSalesData({
    startDate: payrollPeriod.start,
    endDate: new Date(),
    enabled: !tvMode,
    refetchInterval: 30000
  });

  // Fetch employee avatars and IDs
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data-cs-top-20"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true);
      
      const avatarMap = new Map<string, string>();
      const nameToIdMap = new Map<string, string>();
      (data || []).forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        nameToIdMap.set(fullName.toLowerCase(), emp.id);
        if (emp.avatar_url) {
          avatarMap.set(fullName.toLowerCase(), emp.avatar_url);
        }
      });
      return { avatarMap, nameToIdMap };
    },
    enabled: !tvMode
  });

  // Sort employees by commission for each period - TOP 20
  const sortedDailySellers = useMemo(() => {
    if (tvMode && tvData?.sellersToday) return tvData.sellersToday.slice(0, 20);
    return [...dailySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [dailySalesData.employeeStats, tvMode, tvData]);

  const sortedWeeklySellers = useMemo(() => {
    if (tvMode && tvData?.sellersWeek) return tvData.sellersWeek.slice(0, 20);
    return [...weeklySalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [weeklySalesData.employeeStats, tvMode, tvData]);

  const sortedPayrollSellers = useMemo(() => {
    if (tvMode && tvData?.sellersPayroll) return tvData.sellersPayroll.slice(0, 20);
    return [...payrollSalesData.employeeStats]
      .filter(emp => emp.totalSales > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 20);
  }, [payrollSalesData.employeeStats, tvMode, tvData]);

  const getAvatarUrl = (name: string) => {
    if (!employeeData?.avatarMap) return undefined;
    return employeeData.avatarMap.get(name.toLowerCase());
  };

  const isLoading = dailySalesData.isLoading || weeklySalesData.isLoading || payrollSalesData.isLoading;

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // Leaderboard card component - TV optimized
  const LeaderboardCard = ({ 
    title, 
    icon: Icon, 
    sellers, 
    period,
    accentColor
  }: { 
    title: string; 
    icon: React.ElementType; 
    sellers: typeof sortedPayrollSellers; 
    period: 'day' | 'week' | 'payroll';
    accentColor: string;
  }) => (
    <Card className={`overflow-hidden border-0 shadow-2xl ${tvMode ? 'bg-slate-800/90' : 'bg-gradient-to-b from-card to-card/95'}`}>
      <CardHeader className={`pb-4 bg-gradient-to-r ${accentColor} text-white`}>
        <CardTitle className={`flex items-center justify-center gap-2 font-bold uppercase tracking-wider ${tvMode ? 'text-xl' : 'text-lg'}`}>
          <Icon className={tvMode ? "h-6 w-6" : "h-5 w-5"} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {(tvMode ? false : isLoading) ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse text-muted-foreground">Indlæser...</div>
          </div>
        ) : sellers.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${tvMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
            <Trophy className="h-8 w-8 mb-2 opacity-50" />
            <span>Ingen salg endnu</span>
          </div>
        ) : (
          <div className={`divide-y ${tvMode ? 'divide-slate-700/50' : 'divide-border/50'}`}>
            {sellers.map((seller, index) => {
              const name = 'employeeName' in seller ? seller.employeeName : seller.name;
              const sales = 'totalSales' in seller ? seller.totalSales : seller.sales;
              const commission = 'totalCommission' in seller ? seller.totalCommission : seller.commission;
              const avatarUrl = 'avatarUrl' in seller ? seller.avatarUrl : getAvatarUrl(name);
              const rankBadge = getRankBadge(index);
              const displayName = getDisplayName(name);
              
              return (
                <div 
                  key={name} 
                  className={`flex items-center gap-3 transition-colors ${
                    tvMode ? 'px-5 py-3.5' : 'px-4 py-3 hover:bg-muted/50'
                  } ${
                    index < 3 ? (tvMode ? 'bg-slate-700/40' : 'bg-muted/30') : ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex-shrink-0 text-center ${tvMode ? 'w-10' : 'w-8'}`}>
                    {rankBadge ? (
                      <span className={tvMode ? "text-2xl" : "text-xl"}>{rankBadge}</span>
                    ) : (
                      <span className={`font-semibold ${tvMode ? 'text-base text-slate-400' : 'text-sm text-muted-foreground'}`}>{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className={`flex-shrink-0 ring-2 ${tvMode ? 'h-12 w-12' : 'h-10 w-10'} ${index === 0 ? 'ring-yellow-400' : index < 3 ? 'ring-primary/30' : 'ring-transparent'}`}>
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback className={`font-semibold bg-primary/20 text-primary ${tvMode ? 'text-sm' : 'text-xs'}`}>
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Name & Sales */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${tvMode ? 'text-base text-white' : 'text-sm'}`}>{displayName}</div>
                    <div className={tvMode ? 'text-sm text-slate-400' : 'text-xs text-muted-foreground'}>{sales} salg</div>
                  </div>
                  
                  {/* Commission */}
                  <div className={`rounded-full font-bold text-white ${getCommissionColor(commission, period)} ${tvMode ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm'}`}>
                    {formatCurrency(commission)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={`min-h-screen ${tvMode ? 'bg-slate-900 p-8' : 'bg-gradient-to-br from-background via-background to-muted/30 p-6'}`}>
      {/* TV Mode Header */}
      {tvMode ? (
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">CS Top 20</h1>
          <p className="text-lg text-slate-400 mt-2">Top 20 på tværs af alle teams • {periodLabel}</p>
        </div>
      ) : (
        <DashboardHeader 
          title="CS Top 20" 
          subtitle={`Top 20 på tværs af alle teams og opgaver • ${periodLabel}`}
        />
      )}
      
      <div className={`grid grid-cols-1 gap-6 lg:grid-cols-3 ${tvMode ? 'mt-0' : 'mt-6'}`}>
        <LeaderboardCard 
          title="Top Løn Periode" 
          icon={Trophy}
          sellers={sortedPayrollSellers}
          period="payroll"
          accentColor="from-amber-500 to-orange-600"
        />
        
        <LeaderboardCard 
          title="Top Uge" 
          icon={Calendar}
          sellers={sortedWeeklySellers}
          period="week"
          accentColor="from-blue-500 to-indigo-600"
        />
        
        <LeaderboardCard 
          title="Top Dag" 
          icon={Clock}
          sellers={sortedDailySellers}
          period="day"
          accentColor="from-emerald-500 to-teal-600"
        />
      </div>
    </div>
  );
}
