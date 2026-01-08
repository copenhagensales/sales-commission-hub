import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Target, TrendingUp, Crown, Swords, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface H2HPerformanceDashboardProps {
  employeeId?: string;
}

interface RankTier {
  name: string;
  icon: string;
  minElo: number;
  maxElo: number;
  color: string;
  bgGradient: string;
  glowColor: string;
}

const RANK_TIERS: RankTier[] = [
  { name: "Bronze", icon: "🥉", minElo: 0, maxElo: 1099, color: "text-amber-600", bgGradient: "from-amber-900/30 to-amber-700/20", glowColor: "shadow-amber-500/20" },
  { name: "Sølv", icon: "🥈", minElo: 1100, maxElo: 1299, color: "text-slate-300", bgGradient: "from-slate-600/30 to-slate-400/20", glowColor: "shadow-slate-400/20" },
  { name: "Guld", icon: "🥇", minElo: 1300, maxElo: 1499, color: "text-yellow-400", bgGradient: "from-yellow-600/30 to-yellow-400/20", glowColor: "shadow-yellow-400/30" },
  { name: "Platin", icon: "💎", minElo: 1500, maxElo: 1699, color: "text-cyan-300", bgGradient: "from-cyan-600/30 to-cyan-400/20", glowColor: "shadow-cyan-400/30" },
  { name: "Diamant", icon: "👑", minElo: 1700, maxElo: 9999, color: "text-purple-300", bgGradient: "from-purple-600/30 to-pink-400/20", glowColor: "shadow-purple-400/40" },
];

const getRankTier = (elo: number): RankTier => {
  return RANK_TIERS.find(tier => elo >= tier.minElo && elo <= tier.maxElo) || RANK_TIERS[0];
};

export const H2HPerformanceDashboard = ({ employeeId }: H2HPerformanceDashboardProps) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['h2h-performance-dashboard', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;

      // Get existing stats
      const { data: existingStats } = await supabase
        .from('h2h_employee_stats')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      // Get recent matches for form display
      const { data: recentMatches } = await supabase
        .from('h2h_challenges')
        .select(`
          id,
          winner_employee_id,
          is_draw,
          completed_at,
          challenger_employee_id,
          opponent_employee_id,
          challenger_final_commission,
          opponent_final_commission
        `)
        .or(`challenger_employee_id.eq.${employeeId},opponent_employee_id.eq.${employeeId}`)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (existingStats) {
        return {
          ...existingStats,
          recentMatches: recentMatches || [],
        };
      }

      // Calculate from matches if no stats exist
      const { data: allMatches } = await supabase
        .from('h2h_challenges')
        .select('winner_employee_id, is_draw, completed_at, challenger_employee_id, opponent_employee_id, challenger_final_commission, opponent_final_commission')
        .or(`challenger_employee_id.eq.${employeeId},opponent_employee_id.eq.${employeeId}`)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (!allMatches || allMatches.length === 0) {
        return null;
      }

      const wins = allMatches.filter(m => m.winner_employee_id === employeeId).length;
      const draws = allMatches.filter(m => m.is_draw).length;
      const losses = allMatches.length - wins - draws;

      // Calculate total commission won
      let totalCommissionWon = 0;
      allMatches.forEach(match => {
        if (match.winner_employee_id === employeeId) {
          const isChallenger = match.challenger_employee_id === employeeId;
          totalCommissionWon += isChallenger 
            ? (match.challenger_final_commission || 0) 
            : (match.opponent_final_commission || 0);
        }
      });

      // Calculate current streak
      let currentStreak = 0;
      for (const match of allMatches) {
        if (match.winner_employee_id === employeeId) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 0;
      for (const match of allMatches) {
        if (match.winner_employee_id === employeeId) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      return {
        wins,
        losses,
        draws,
        total_matches: allMatches.length,
        current_win_streak: currentStreak,
        longest_win_streak: longestStreak,
        elo_rating: 1000,
        total_commission_won: totalCommissionWon,
        recentMatches: recentMatches || [],
      };
    },
    enabled: !!employeeId,
  });

  if (!employeeId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!stats || stats.total_matches === 0) {
    return (
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
        <div className="text-center">
          <Swords className="w-12 h-12 mx-auto mb-3 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-300">Ingen dueller endnu</h3>
          <p className="text-sm text-slate-500 mt-1">Udfordr en kollega for at starte din duel-rejse!</p>
        </div>
      </div>
    );
  }

  const winRate = stats.total_matches > 0 
    ? Math.round((stats.wins / stats.total_matches) * 100) 
    : 0;

  const rankTier = getRankTier(stats.elo_rating || 1000);

  // Build recent form array
  const recentForm = (stats.recentMatches || []).slice(0, 5).map((match: any) => {
    if (match.is_draw) return 'D';
    if (match.winner_employee_id === employeeId) return 'W';
    return 'L';
  });

  return (
    <div className="mb-6">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${rankTier.bgGradient} border border-slate-700/50 ${rankTier.glowColor} shadow-lg`}>
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-white/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-white/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        
        <div className="relative z-10 p-5">
          {/* Header with rank */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`text-3xl ${stats.current_win_streak >= 3 ? 'animate-pulse' : ''}`}>
                {rankTier.icon}
              </div>
              <div>
                <h3 className={`text-lg font-bold ${rankTier.color}`}>{rankTier.name} Rank</h3>
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{stats.elo_rating || 1000} ELO</span>
                </div>
              </div>
            </div>
            
            {/* Current streak badge */}
            {stats.current_win_streak >= 2 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                stats.current_win_streak >= 5 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 animate-pulse' 
                  : 'bg-orange-500/20 border border-orange-500/40'
              }`}>
                <Flame className={`w-4 h-4 ${stats.current_win_streak >= 5 ? 'text-white' : 'text-orange-400'}`} />
                <span className={`text-sm font-bold ${stats.current_win_streak >= 5 ? 'text-white' : 'text-orange-400'}`}>
                  {stats.current_win_streak} streak!
                </span>
              </div>
            )}
          </div>
          
          {/* Main stats grid */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {/* Wins */}
            <div className="text-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
              <div className="text-xs text-slate-400">Sejre</div>
            </div>
            
            {/* Losses */}
            <div className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <X className="w-5 h-5 mx-auto mb-1 text-red-400" />
              <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
              <div className="text-xs text-slate-400">Tab</div>
            </div>
            
            {/* Draws */}
            <div className="text-center p-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
              <Minus className="w-5 h-5 mx-auto mb-1 text-slate-400" />
              <div className="text-2xl font-bold text-slate-300">{stats.draws}</div>
              <div className="text-xs text-slate-400">Uafgjort</div>
            </div>
            
            {/* Win rate */}
            <div className={`text-center p-3 rounded-xl ${
              winRate >= 60 ? 'bg-green-500/10 border-green-500/20' :
              winRate >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-red-500/10 border-red-500/20'
            } border`}>
              <Target className={`w-5 h-5 mx-auto mb-1 ${
                winRate >= 60 ? 'text-green-400' :
                winRate >= 40 ? 'text-yellow-400' :
                'text-red-400'
              }`} />
              <div className={`text-2xl font-bold ${
                winRate >= 60 ? 'text-green-400' :
                winRate >= 40 ? 'text-yellow-400' :
                'text-red-400'
              }`}>{winRate}%</div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
          </div>
          
          {/* Bottom row: Recent form + Best streak */}
          <div className="flex items-center justify-between">
            {/* Recent form */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-1">Seneste:</span>
              <div className="flex gap-1">
                {recentForm.length > 0 ? recentForm.map((result: string, idx: number) => (
                  <Badge 
                    key={idx}
                    className={`w-6 h-6 flex items-center justify-center text-xs font-bold p-0 ${
                      result === 'W' ? 'bg-green-500/80 text-white hover:bg-green-500' :
                      result === 'L' ? 'bg-red-500/80 text-white hover:bg-red-500' :
                      'bg-slate-500/80 text-white hover:bg-slate-500'
                    }`}
                  >
                    {result}
                  </Badge>
                )) : (
                  <span className="text-xs text-slate-500">Ingen kampe</span>
                )}
              </div>
            </div>
            
            {/* Best streak & total matches */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span>Bedste: <strong className="text-white">{stats.longest_win_streak}</strong></span>
              </div>
              <div className="text-slate-500">
                {stats.total_matches} kampe
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
