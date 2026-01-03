import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, X, Minus, Flame, TrendingUp, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface H2HMatchHistoryProps {
  employeeId: string;
  compact?: boolean;
}

interface MatchResult {
  id: string;
  result: 'W' | 'L' | 'D';
  opponent_name: string;
  my_commission: number;
  opponent_commission: number;
  completed_at: string;
  period: string;
}

export const H2HMatchHistory = ({ employeeId, compact = false }: H2HMatchHistoryProps) => {
  // Fetch completed matches for this employee
  const { data: matches, isLoading } = useQuery({
    queryKey: ['h2h-match-history', employeeId],
    queryFn: async () => {
      // Get completed challenges where this employee participated
      const { data, error } = await supabase
        .from('h2h_challenges')
        .select(`
          id,
          challenger_employee_id,
          opponent_employee_id,
          winner_employee_id,
          challenger_final_commission,
          opponent_final_commission,
          is_draw,
          completed_at,
          period,
          challenger:employee_master_data!h2h_challenges_challenger_employee_id_fkey(first_name, last_name),
          opponent:employee_master_data!h2h_challenges_opponent_employee_id_fkey(first_name, last_name)
        `)
        .or(`challenger_employee_id.eq.${employeeId},opponent_employee_id.eq.${employeeId}`)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform to match results
      return (data || []).map((match: any): MatchResult => {
        const isChallenger = match.challenger_employee_id === employeeId;
        const myCommission = isChallenger 
          ? match.challenger_final_commission 
          : match.opponent_final_commission;
        const opponentCommission = isChallenger 
          ? match.opponent_final_commission 
          : match.challenger_final_commission;
        const opponentData = isChallenger ? match.opponent : match.challenger;

        let result: 'W' | 'L' | 'D';
        if (match.is_draw) {
          result = 'D';
        } else if (match.winner_employee_id === employeeId) {
          result = 'W';
        } else {
          result = 'L';
        }

        return {
          id: match.id,
          result,
          opponent_name: opponentData ? `${opponentData.first_name} ${opponentData.last_name}` : 'Ukendt',
          my_commission: myCommission || 0,
          opponent_commission: opponentCommission || 0,
          completed_at: match.completed_at,
          period: match.period,
        };
      });
    },
    enabled: !!employeeId,
  });

  // Fetch or calculate stats
  const { data: stats } = useQuery({
    queryKey: ['h2h-stats', employeeId],
    queryFn: async () => {
      // First try to get from h2h_employee_stats
      const { data: existingStats } = await supabase
        .from('h2h_employee_stats')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (existingStats) {
        return existingStats;
      }

      // Calculate from matches if no stats exist
      const wins = matches?.filter(m => m.result === 'W').length || 0;
      const losses = matches?.filter(m => m.result === 'L').length || 0;
      const draws = matches?.filter(m => m.result === 'D').length || 0;

      // Calculate current win streak
      let currentStreak = 0;
      for (const match of matches || []) {
        if (match.result === 'W') {
          currentStreak++;
        } else {
          break;
        }
      }

      return {
        wins,
        losses,
        draws,
        total_matches: wins + losses + draws,
        current_win_streak: currentStreak,
        longest_win_streak: currentStreak,
        elo_rating: 1000,
      };
    },
    enabled: !!employeeId && !!matches,
  });

  const getResultBadge = (result: 'W' | 'L' | 'D') => {
    switch (result) {
      case 'W':
        return (
          <div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold text-sm animate-pulse">
            W
          </div>
        );
      case 'L':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-500 font-bold text-sm">
            L
          </div>
        );
      case 'D':
        return (
          <div className="w-8 h-8 rounded-full bg-muted border-2 border-muted-foreground/50 flex items-center justify-center text-muted-foreground font-bold text-sm">
            D
          </div>
        );
    }
  };

  const getResultIcon = (result: 'W' | 'L' | 'D') => {
    switch (result) {
      case 'W':
        return <Trophy className="w-4 h-4 text-green-500" />;
      case 'L':
        return <X className="w-4 h-4 text-red-500" />;
      case 'D':
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Ingen afsluttede kampe endnu
      </div>
    );
  }

  // Compact mode: just show W/L/D badges in a row
  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {/* Win streak badge */}
          {stats && stats.current_win_streak >= 3 && (
            <Badge variant="outline" className="mr-2 bg-orange-500/10 border-orange-500 text-orange-500 animate-pulse">
              <Flame className="w-3 h-3 mr-1" />
              {stats.current_win_streak} streak
            </Badge>
          )}
          
          {/* Recent matches */}
          {matches.slice(0, 5).map((match, index) => (
            <Tooltip key={match.id}>
              <TooltipTrigger asChild>
                <div 
                  className="transition-transform hover:scale-110 cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {getResultBadge(match.result)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p className="font-medium">
                    {match.result === 'W' ? 'Sejr' : match.result === 'L' ? 'Tab' : 'Uafgjort'} mod {match.opponent_name}
                  </p>
                  <p className="text-muted-foreground">
                    {match.my_commission.toLocaleString('da-DK')} kr vs {match.opponent_commission.toLocaleString('da-DK')} kr
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(match.completed_at), 'dd. MMM yyyy', { locale: da })}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          
          {/* Stats summary */}
          {stats && (
            <div className="ml-2 text-sm text-muted-foreground">
              <span className="text-green-500 font-medium">{stats.wins}W</span>
              {' - '}
              <span className="text-red-500 font-medium">{stats.losses}L</span>
              {stats.draws > 0 && (
                <>
                  {' - '}
                  <span className="text-muted-foreground font-medium">{stats.draws}D</span>
                </>
              )}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Full mode: card with match history
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Kamphistorik
          {stats && stats.current_win_streak >= 3 && (
            <Badge className="ml-auto bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse">
              <Flame className="w-3 h-3 mr-1" />
              {stats.current_win_streak} sejre i træk!
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick stats */}
        {stats && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{stats.wins}</div>
                <div className="text-xs text-muted-foreground">Sejre</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{stats.losses}</div>
                <div className="text-xs text-muted-foreground">Tab</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{stats.draws}</div>
                <div className="text-xs text-muted-foreground">Uafgjort</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span>Bedste streak: {stats.longest_win_streak}</span>
              </div>
              {stats.elo_rating && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>ELO: {stats.elo_rating}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent form */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Seneste form:</span>
          <div className="flex gap-1">
            {matches.slice(0, 5).map((match) => (
              <TooltipProvider key={match.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {getResultBadge(match.result)}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">
                      {match.result === 'W' ? 'Sejr' : match.result === 'L' ? 'Tab' : 'Uafgjort'} mod {match.opponent_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {match.my_commission.toLocaleString('da-DK')} kr vs {match.opponent_commission.toLocaleString('da-DK')} kr
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Match list */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {matches.map((match) => (
            <div 
              key={match.id}
              className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getResultIcon(match.result)}
                <div>
                  <div className="font-medium text-sm">{match.opponent_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(match.completed_at), 'dd. MMM yyyy', { locale: da })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-medium text-sm ${
                  match.result === 'W' ? 'text-green-500' : 
                  match.result === 'L' ? 'text-red-500' : 
                  'text-muted-foreground'
                }`}>
                  {match.my_commission.toLocaleString('da-DK')} kr
                </div>
                <div className="text-xs text-muted-foreground">
                  vs {match.opponent_commission.toLocaleString('da-DK')} kr
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
