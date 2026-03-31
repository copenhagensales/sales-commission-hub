import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { formatNumber } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCachedLeaderboard, useCachedLeaderboards, getInitials as getInitialsFromHook, type LeaderboardEntry, type LeaderboardPeriod } from "@/hooks/useCachedLeaderboard";
import { Trophy, Calendar, Clock } from "lucide-react";
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection, type PeriodType, mapPeriodTypeToCache } from "@/components/dashboard/DashboardPeriodSelector";
import { supabase } from "@/integrations/supabase/client";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { isTvMode, useAutoReload, REFRESH_PROFILES } from "@/utils/tvMode";

// formatNumber imported from @/lib/calculations - alias as formatCurrency for dashboard display
const formatCurrency = formatNumber;

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

// Get team badge styling based on team name - high contrast for all views
const getTeamBadgeStyle = (teamName: string | null | undefined): string => {
  if (!teamName) return '';
  const lower = teamName.toLowerCase();
  
  if (lower.includes('tdc')) {
    return 'bg-red-500 text-white';
  }
  if (lower.includes('eesy')) {
    return 'bg-violet-500 text-white';
  }
  if (lower.includes('relatel')) {
    return 'bg-amber-500 text-white';
  }
  if (lower.includes('united')) {
    return 'bg-indigo-500 text-white';
  }
  if (lower.includes('field')) {
    return 'bg-emerald-500 text-white';
  }
  if (lower.includes('tryg')) {
    return 'bg-teal-500 text-white';
  }
  if (lower.includes('ase')) {
    return 'bg-pink-500 text-white';
  }
  
  // Default gray
  return 'bg-slate-500 text-white';
};

// Hook for fetching custom period leaderboard data through RPC (bypasses sales RLS for dashboard users)
function useCustomPeriodLeaderboard(
  period: PeriodSelection,
  options: { enabled: boolean; limit: number }
) {
  return useQuery({
    queryKey: ["custom-leaderboard", period.from.toISOString(), period.to.toISOString(), options.limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase.rpc("get_cs_top20_custom_period_leaderboard", {
        p_from: period.from.toISOString(),
        p_to: period.to.toISOString(),
        p_limit: options.limit,
      });

      if (error) {
        console.error("Error fetching custom period leaderboard:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        displayName: formatDisplayName(row.employee_name),
        avatarUrl: row.avatar_url,
        teamName: row.team_name,
        salesCount: row.sales_count || 0,
        crossSaleCount: 0,
        commission: row.commission || 0,
        goalTarget: null,
      }));
    },
    enabled: options.enabled,
    ...REFRESH_PROFILES.dashboard,
  });
}

function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return fullName;
}

export default function CsTop20Dashboard() {
  // Runtime access check - redirects if user doesn't have team-based permission
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("cs-top-20");
  
  const tvMode = isTvMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));
  
  // Auto-reload for TV mode to pick up layout/code changes
  useAutoReload(tvMode);

  // Determine if we can use cached data
  const cachePeriod = mapPeriodTypeToCache(selectedPeriod.type) as LeaderboardPeriod | null;
  const canUseCache = cachePeriod !== null;

  // Cached leaderboard for standard periods (single period - used in normal mode)
  const { data: cachedLeaderboard, isLoading: cachedLoading } = useCachedLeaderboard(
    cachePeriod || "payroll_period",
    { type: "global" },
    { enabled: canUseCache && !tvMode, limit: 20 }
  );

  // TV mode: fetch all 3 periods at once
  const { sellersToday, sellersWeek, sellersPayroll, isLoading: tvCachedLoading } = useCachedLeaderboards(
    { type: "global" },
    { enabled: tvMode, limit: 20 }
  );

  // Custom period leaderboard for non-standard periods
  const { data: customLeaderboard, isLoading: customLoading } = useCustomPeriodLeaderboard(
    selectedPeriod,
    { enabled: !canUseCache && !tvMode, limit: 20 }
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
    enabled: tvMode && !cachedLeaderboard?.length && !customLeaderboard?.length,
    ...REFRESH_PROFILES.dashboard,
  });

  // Get the active leaderboard data
  const leaderboardData = useMemo(() => {
    if (canUseCache && cachedLeaderboard?.length) {
      return cachedLeaderboard;
    }
    if (!canUseCache && customLeaderboard?.length) {
      return customLeaderboard;
    }
    // TV mode fallback - map to selected period
    if (tvMode && tvData) {
      if (selectedPeriod.type === "today") return tvData.sellersToday;
      if (selectedPeriod.type === "this_week") return tvData.sellersWeek;
      return tvData.sellersPayroll;
    }
    return [];
  }, [canUseCache, cachedLeaderboard, customLeaderboard, tvMode, tvData, selectedPeriod.type]);

  const isLoading = canUseCache ? cachedLoading : customLoading;

  const periodLabel = useMemo(() => {
    if (selectedPeriod.type === "custom") {
      return `${format(selectedPeriod.from, "d. MMM", { locale: da })} - ${format(selectedPeriod.to, "d. MMM", { locale: da })}`;
    }
    return selectedPeriod.label;
  }, [selectedPeriod]);

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
                  className={`flex items-center gap-2 sm:gap-3 transition-all duration-150 ${
                    tvMode ? 'px-3 py-2.5' : 'px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/40'
                  } ${
                    isTopThree 
                      ? (tvMode ? 'bg-slate-700/20' : 'bg-primary/[0.03]') 
                      : ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex-shrink-0 text-center font-medium ${tvMode ? 'w-7' : 'w-6 sm:w-8'}`}>
                    {rankBadge ? (
                      <span className={tvMode ? "text-lg" : "text-base sm:text-xl"}>{rankBadge}</span>
                    ) : (
                      <span className={`tabular-nums ${
                        tvMode 
                          ? 'text-sm text-slate-500' 
                          : 'text-xs sm:text-sm text-muted-foreground/70'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className={`flex-shrink-0 ${tvMode ? 'h-9 w-9' : 'h-8 w-8 sm:h-10 sm:w-10'} ${
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
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      <span className={`font-medium truncate max-w-[80px] sm:max-w-none ${
                        tvMode ? 'text-sm text-white' : 'text-xs sm:text-sm text-foreground'
                      }`}>
                        {displayName}
                      </span>
                      {(() => {
                        const shortTeam = getShortTeamName(seller.teamName);
                        return shortTeam ? (
                          <span className={`flex-shrink-0 rounded px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium ${getTeamBadgeStyle(seller.teamName)}`}>
                            {shortTeam}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className={`text-[10px] sm:text-xs ${
                      tvMode ? 'text-slate-500' : 'text-muted-foreground/80'
                    }`}>
                      {sales} salg
                    </div>
                  </div>
                  
                  {/* Commission - Clean, neutral styling */}
                  <div className={`flex-shrink-0 rounded-full font-semibold tabular-nums ${
                    tvMode 
                      ? 'bg-slate-700/80 text-white px-3 py-1.5 text-sm' 
                      : 'bg-primary/10 text-primary px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm'
                  }`}>
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
          subtitle={`Top 20 på tværs af alle teams`}
          rightContent={
            <DashboardPeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
          }
        />
      )}
      
      <div className={tvMode 
        ? 'grid grid-cols-1 gap-5 flex-1 min-h-0' 
        : 'grid grid-cols-1 gap-6 mt-6'
      }>
        <LeaderboardCard 
          title={`Top 20 – ${periodLabel}`}
          icon={Trophy}
          sellers={leaderboardData}
          accentClass="bg-amber-500"
        />
      </div>
    </div>
  );
}
