import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Trophy, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface H2HPlayerStatsProps {
  employeeId: string;
  showElo?: boolean;
}

export const H2HPlayerStats = ({ employeeId, showElo = true }: H2HPlayerStatsProps) => {
  const { data: stats } = useQuery({
    queryKey: ['h2h-player-stats', employeeId],
    queryFn: async () => {
      // First try existing stats
      const { data: existingStats } = await supabase
        .from('h2h_employee_stats')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (existingStats) {
        return existingStats;
      }

      // Calculate from completed matches
      const { data: matches } = await supabase
        .from('h2h_challenges')
        .select('winner_employee_id, is_draw, completed_at')
        .or(`challenger_employee_id.eq.${employeeId},opponent_employee_id.eq.${employeeId}`)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (!matches || matches.length === 0) {
        return null;
      }

      const wins = matches.filter(m => m.winner_employee_id === employeeId).length;
      const draws = matches.filter(m => m.is_draw).length;
      const losses = matches.length - wins - draws;

      // Calculate current streak
      let currentStreak = 0;
      for (const match of matches) {
        if (match.winner_employee_id === employeeId) {
          currentStreak++;
        } else {
          break;
        }
      }

      return {
        wins,
        losses,
        draws,
        total_matches: matches.length,
        current_win_streak: currentStreak,
        longest_win_streak: currentStreak,
        elo_rating: 1000,
      };
    },
    enabled: !!employeeId,
  });

  if (!stats || stats.total_matches === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">Ny spiller</span>
    );
  }

  const winRate = stats.total_matches > 0 
    ? Math.round((stats.wins / stats.total_matches) * 100) 
    : 0;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Win/Loss record */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs">
              <Trophy className="w-3 h-3 mr-1 text-yellow-500" />
              {stats.wins}W-{stats.losses}L{stats.draws > 0 && `-${stats.draws}D`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{stats.total_matches} kampe i alt</p>
            <p>Win rate: {winRate}%</p>
          </TooltipContent>
        </Tooltip>

        {/* Current streak */}
        {stats.current_win_streak >= 2 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                className={`text-xs ${
                  stats.current_win_streak >= 5 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse' 
                    : stats.current_win_streak >= 3 
                    ? 'bg-orange-500/20 text-orange-500 border-orange-500'
                    : 'bg-green-500/20 text-green-500 border-green-500'
                }`}
                variant="outline"
              >
                <Flame className="w-3 h-3 mr-1" />
                {stats.current_win_streak} streak
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{stats.current_win_streak} sejre i træk!</p>
              <p className="text-muted-foreground">Bedste: {stats.longest_win_streak}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* ELO rating */}
        {showElo && stats.elo_rating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                {stats.elo_rating}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>ELO Rating</p>
              <p className="text-muted-foreground">Rangering baseret på kampe</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Win rate indicator */}
        {stats.total_matches >= 5 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  winRate >= 60 ? 'border-green-500 text-green-500' :
                  winRate >= 40 ? 'border-yellow-500 text-yellow-500' :
                  'border-red-500 text-red-500'
                }`}
              >
                <Target className="w-3 h-3 mr-1" />
                {winRate}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Win rate over {stats.total_matches} kampe</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
