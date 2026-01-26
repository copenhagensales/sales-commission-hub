import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCachedLeaderboards, getInitials as getInitialsFromHook, type LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
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

const getInitials = (name: string) => getInitialsFromHook(name);

// Get rank badge for top 3
const getRankBadge = (index: number) => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return null;
};

// Get short team name (first word or abbreviation)
const getShortTeamName = (teamName?: string | null) => {
  if (!teamName) return null;
  // Common abbreviations
  if (teamName.toLowerCase().includes('tdc')) return 'TDC';
  if (teamName.toLowerCase().includes('eesy')) return 'Eesy';
  if (teamName.toLowerCase().includes('relatel')) return 'Relatel';
  if (teamName.toLowerCase().includes('united')) return 'United';
  // Default: first word
  return teamName.split(' ')[0];
};

export default function CsTop20Dashboard() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  // Use cached leaderboards - massively reduces database queries
  const { sellersToday, sellersWeek, sellersPayroll, isLoading } = useCachedLeaderboards(
    { type: "global" },
    { enabled: true, limit: 20 }
  );

  // For TV mode, also fetch from edge function as fallback (will be phased out)
  const { data: tvData } = useQuery<{
    sellersToday: LeaderboardEntry[];
    sellersWeek: LeaderboardEntry[];
    sellersPayroll: LeaderboardEntry[];
  }>({
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
    enabled: tvMode && sellersPayroll.length === 0, // Only use edge function if cache is empty
    refetchInterval: 120000,
    staleTime: 60000,
  });

  // Use cached data, fallback to TV data for TV mode
  const sortedPayrollSellers = useMemo(() => {
    if (sellersPayroll.length > 0) return sellersPayroll;
    if (tvMode && tvData?.sellersPayroll) return tvData.sellersPayroll;
    return [];
  }, [sellersPayroll, tvMode, tvData]);

  const sortedWeeklySellers = useMemo(() => {
    if (sellersWeek.length > 0) return sellersWeek;
    if (tvMode && tvData?.sellersWeek) return tvData.sellersWeek;
    return [];
  }, [sellersWeek, tvMode, tvData]);

  const sortedDailySellers = useMemo(() => {
    if (sellersToday.length > 0) return sellersToday;
    if (tvMode && tvData?.sellersToday) return tvData.sellersToday;
    return [];
  }, [sellersToday, tvMode, tvData]);

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} - ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  // Leaderboard card component - Clean, modern design
  const LeaderboardCard = ({ 
    title, 
    icon: Icon, 
    sellers, 
    accentClass
  }: { 
    title: string; 
    icon: React.ElementType; 
    sellers: LeaderboardEntry[]; 
    accentClass: string;
  }) => (
    <Card className={`overflow-hidden border shadow-lg flex flex-col ${
      tvMode 
        ? 'bg-slate-800/95 border-slate-700/50 h-full' 
        : 'bg-card border-border/50'
    }`}>
      <CardHeader className={`pb-3 flex-shrink-0 border-b ${
        tvMode ? 'border-slate-700/50 bg-slate-800' : 'border-border/30 bg-muted/30'
      }`}>
        <CardTitle className={`flex items-center justify-center gap-2.5 font-semibold tracking-wide ${
          tvMode ? 'text-lg text-white' : 'text-base text-foreground'
        }`}>
          <div className={`p-1.5 rounded-lg ${accentClass}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={`p-0 ${tvMode ? 'flex-1 overflow-y-auto' : ''}`}>
        {(tvMode ? false : isLoading) ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse text-muted-foreground text-sm">Indlæser...</div>
          </div>
        ) : sellers.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${
            tvMode ? 'text-slate-400' : 'text-muted-foreground'
          }`}>
            <Trophy className="h-8 w-8 mb-2 opacity-40" />
            <span className="text-sm">Ingen salg endnu</span>
          </div>
        ) : (
          <div className={`divide-y ${tvMode ? 'divide-slate-700/30' : 'divide-border/40'}`}>
            {sellers.map((seller, index) => {
              const name = seller.employeeName;
              const sales = seller.salesCount;
              const commission = seller.commission;
              const avatarUrl = seller.avatarUrl;
              const rankBadge = getRankBadge(index);
              const displayName = seller.displayName;
              
              // Top 3 get subtle highlight
              const isTopThree = index < 3;
              
              return (
                <div 
                  key={seller.employeeId || name} 
                  className={`flex items-center gap-3 transition-all duration-150 ${
                    tvMode ? 'px-3 py-2.5' : 'px-4 py-3 hover:bg-muted/40'
                  } ${
                    isTopThree 
                      ? (tvMode ? 'bg-slate-700/20' : 'bg-primary/[0.03]') 
                      : ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex-shrink-0 text-center font-medium ${tvMode ? 'w-7' : 'w-8'}`}>
                    {rankBadge ? (
                      <span className={tvMode ? "text-lg" : "text-xl"}>{rankBadge}</span>
                    ) : (
                      <span className={`tabular-nums ${
                        tvMode 
                          ? 'text-sm text-slate-500' 
                          : 'text-sm text-muted-foreground/70'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className={`flex-shrink-0 ${tvMode ? 'h-9 w-9' : 'h-10 w-10'} ${
                    index === 0 
                      ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-background' 
                      : index < 3 
                        ? 'ring-1 ring-border/50' 
                        : ''
                  }`}>
                    <AvatarImage src={avatarUrl || undefined} alt={name} />
                    <AvatarFallback className={`font-medium text-xs ${
                      tvMode 
                        ? 'bg-slate-700 text-slate-300' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Name & Sales & Team */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium truncate ${
                        tvMode ? 'text-sm text-white' : 'text-sm text-foreground'
                      }`}>
                        {displayName}
                      </span>
                      {(() => {
                        const shortTeam = getShortTeamName(seller.teamName);
                        return shortTeam ? (
                          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 font-medium ${
                            tvMode 
                              ? 'bg-slate-600/60 text-slate-400 text-[10px]' 
                              : 'bg-muted/80 text-muted-foreground text-[10px]'
                          }`}>
                            {shortTeam}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className={`text-xs ${
                      tvMode ? 'text-slate-500' : 'text-muted-foreground/80'
                    }`}>
                      {sales} salg
                    </div>
                  </div>
                  
                  {/* Commission - Clean, neutral styling */}
                  <div className={`rounded-full font-semibold tabular-nums ${
                    tvMode 
                      ? 'bg-slate-700/80 text-white px-3 py-1.5 text-sm' 
                      : 'bg-primary/10 text-primary px-3 py-1.5 text-sm'
                  }`}>
                    {formatCurrency(commission)} kr
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
    <div className={tvMode 
      ? 'w-[1920px] h-[1080px] bg-slate-900 p-6 flex flex-col overflow-hidden' 
      : 'min-h-screen bg-background p-6'
    }>
      {/* TV Mode Header */}
      {tvMode ? (
        <div className="mb-5 text-center flex-shrink-0">
          <h1 className="text-3xl font-bold text-white tracking-tight">CS Top 20</h1>
          <p className="text-sm text-slate-400 mt-1.5">Top 20 på tværs af alle teams • {periodLabel}</p>
        </div>
      ) : (
        <DashboardHeader 
          title="CS Top 20" 
          subtitle={`Top 20 på tværs af alle teams • ${periodLabel}`}
        />
      )}
      
      <div className={tvMode 
        ? 'grid grid-cols-3 gap-5 flex-1 min-h-0' 
        : 'grid grid-cols-1 gap-6 lg:grid-cols-3 mt-6'
      }>
        <LeaderboardCard 
          title="Løn Periode" 
          icon={Trophy}
          sellers={sortedPayrollSellers}
          accentClass="bg-amber-500"
        />
        
        <LeaderboardCard 
          title="Denne Uge" 
          icon={Calendar}
          sellers={sortedWeeklySellers}
          accentClass="bg-blue-500"
        />
        
        <LeaderboardCard 
          title="I Dag" 
          icon={Clock}
          sellers={sortedDailySellers}
          accentClass="bg-emerald-500"
        />
      </div>
    </div>
  );
}
