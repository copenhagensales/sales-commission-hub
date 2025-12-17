import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Phone, Clock, TrendingUp, DollarSign, Trophy, Flame, Target, Send, Crown, Zap, Users, CalendarDays, CalendarRange, Plus, X, UserPlus } from "lucide-react";
import { startOfWeek, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

interface AgentStats {
  id: string;
  name: string;
  salesCount: number;
  revenue: number;
  commission: number;
  callCount: number;
  talkTimeSeconds: number;
}

interface HeadToHeadComparisonProps {
  currentEmployeeId?: string;
  currentEmployeeName?: string;
}

type PeriodType = "today" | "week";
type BattleMode = "1v1" | "team";

export const HeadToHeadComparison = ({ currentEmployeeId, currentEmployeeName }: HeadToHeadComparisonProps) => {
  const [battleMode, setBattleMode] = useState<BattleMode>("1v1");
  const [myTeam, setMyTeam] = useState<string[]>([]); // Additional teammates (not including self)
  const [opponentTeam, setOpponentTeam] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [showInviteOptions, setShowInviteOptions] = useState(false);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now), label: "I dag" };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now), label: "Denne uge" };
      default:
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now), label: "Denne uge" };
    }
  }, [period]);

  // Fetch all agents for selection
  const { data: agents = [] } = useQuery({
    queryKey: ["h2h-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, name, email, external_adversus_id")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Get team member names
  const getTeamNames = (teamIds: string[]) => {
    return teamIds.map(id => agents.find(a => a.id === id)?.name).filter(Boolean) as string[];
  };

  const myTeamNames = useMemo(() => {
    const names = [currentEmployeeName, ...getTeamNames(myTeam)].filter(Boolean) as string[];
    return names;
  }, [currentEmployeeName, myTeam, agents]);

  const opponentTeamNames = useMemo(() => getTeamNames(opponentTeam), [opponentTeam, agents]);

  // Fetch stats for teams
  const { data: stats } = useQuery({
    queryKey: ["h2h-stats", myTeamNames.join(","), opponentTeamNames.join(","), dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const monthStart = dateRange.start.toISOString();
      const monthEnd = dateRange.end.toISOString();

      // Fetch sales stats
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id,
          agent_name,
          sale_items (
            id,
            mapped_commission,
            quantity,
            products:product_id (
              revenue_dkk,
              commission_dkk,
              counts_as_sale
            )
          )
        `)
        .gte("sale_datetime", monthStart)
        .lte("sale_datetime", monthEnd);

      // Fetch call stats
      const { data: calls } = await supabase
        .from("dialer_calls")
        .select("agent_external_id, duration_seconds, total_duration_seconds")
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd);

      // Get agent external IDs for all team members
      const allNames = [...myTeamNames, ...opponentTeamNames];
      const { data: agentMappings } = await supabase
        .from("agents")
        .select("id, name, external_adversus_id")
        .in("name", allNames.filter(Boolean));

      // Helper function to calculate team stats
      const calculateTeamStats = (teamNames: string[]): AgentStats => {
        const teamExternalIds = teamNames.map(name => 
          agentMappings?.find(a => a.name === name)?.external_adversus_id
        ).filter(Boolean);

        const teamSales = sales?.filter(s => teamNames.includes(s.agent_name || "")) || [];
        
        const salesCount = teamSales.reduce((sum, s) => {
          return sum + (s.sale_items?.reduce((itemSum, item) => {
            const product = item.products as any;
            if (product?.counts_as_sale === false) return itemSum;
            return itemSum + (item.quantity || 1);
          }, 0) || 0);
        }, 0);

        const revenue = teamSales.reduce((sum, s) => {
          return sum + (s.sale_items?.reduce((itemSum, item) => {
            const rev = (item.products as any)?.revenue_dkk || 0;
            return itemSum + (rev * (item.quantity || 1));
          }, 0) || 0);
        }, 0);

        const commission = teamSales.reduce((sum, s) => {
          return sum + (s.sale_items?.reduce((itemSum, item) => {
            const comm = (item.products as any)?.commission_dkk || item.mapped_commission || 0;
            return itemSum + (comm * (item.quantity || 1));
          }, 0) || 0);
        }, 0);

        const teamCalls = calls?.filter(c => teamExternalIds.includes(c.agent_external_id)) || [];
        const callCount = teamCalls.length;
        const talkTimeSeconds = teamCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

        return {
          id: teamNames.join(","),
          name: teamNames.length === 1 ? teamNames[0] : `Hold (${teamNames.length})`,
          salesCount,
          revenue,
          commission,
          callCount,
          talkTimeSeconds,
        };
      };

      return {
        myTeam: calculateTeamStats(myTeamNames),
        opponentTeam: opponentTeamNames.length > 0 ? calculateTeamStats(opponentTeamNames) : null,
      };
    },
    enabled: myTeamNames.length > 0,
  });

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}t ${mins}m`;
    return `${mins}m`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("da-DK").format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(num);
  };

  const StatBar = ({ 
    label, 
    icon: Icon, 
    leftValue, 
    rightValue, 
    formatFn = formatNumber,
    delay = 0
  }: { 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    leftValue: number; 
    rightValue: number; 
    formatFn?: (n: number) => string;
    delay?: number;
  }) => {
    const total = leftValue + rightValue || 1;
    const leftPercent = (leftValue / total) * 100;
    const rightPercent = (rightValue / total) * 100;
    
    const leftWins = leftValue > rightValue;
    const rightWins = rightValue > leftValue;
    const tie = leftValue === rightValue;

    return (
      <div className="group relative" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-2 transition-all duration-300 ${leftWins ? "scale-105" : ""}`}>
            {leftWins && <Zap className="w-3 h-3 text-amber-400 animate-pulse" />}
            <span className={`font-bold text-sm tabular-nums ${leftWins ? "text-emerald-400" : tie ? "text-amber-300" : "text-slate-400"}`}>
              {formatFn(leftValue)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-700/50 backdrop-blur-sm">
            <Icon className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </div>
          
          <div className={`flex items-center gap-2 transition-all duration-300 ${rightWins ? "scale-105" : ""}`}>
            <span className={`font-bold text-sm tabular-nums ${rightWins ? "text-emerald-400" : tie ? "text-amber-300" : "text-slate-400"}`}>
              {formatFn(rightValue)}
            </span>
            {rightWins && <Zap className="w-3 h-3 text-amber-400 animate-pulse" />}
          </div>
        </div>
        
        <div className="relative h-3 rounded-full overflow-hidden bg-slate-800/80 border border-slate-700/50">
          <div className="absolute inset-0 opacity-30">
            <div 
              className={`absolute left-0 top-0 h-full ${leftWins ? "bg-emerald-500" : tie ? "bg-amber-500" : "bg-rose-500"} blur-md`}
              style={{ width: `${leftPercent}%` }}
            />
            <div 
              className={`absolute right-0 top-0 h-full ${rightWins ? "bg-emerald-500" : tie ? "bg-amber-500" : "bg-rose-500"} blur-md`}
              style={{ width: `${rightPercent}%` }}
            />
          </div>
          
          <div className="relative flex h-full">
            <div 
              className={`transition-all duration-700 ease-out ${
                leftWins 
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-400" 
                  : tie 
                    ? "bg-gradient-to-r from-amber-600 to-amber-400" 
                    : "bg-gradient-to-r from-rose-600 to-rose-500"
              }`}
              style={{ 
                width: `${leftPercent}%`,
                boxShadow: leftWins ? '0 0 20px rgba(52, 211, 153, 0.5)' : 'none'
              }}
            />
            <div className="w-0.5 bg-slate-900 z-10" />
            <div 
              className={`transition-all duration-700 ease-out ${
                rightWins 
                  ? "bg-gradient-to-l from-emerald-600 to-emerald-400" 
                  : tie 
                    ? "bg-gradient-to-l from-amber-600 to-amber-400" 
                    : "bg-gradient-to-l from-rose-600 to-rose-500"
              }`}
              style={{ 
                width: `${rightPercent}%`,
                boxShadow: rightWins ? '0 0 20px rgba(52, 211, 153, 0.5)' : 'none'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Calculate wins
  const calculateWins = () => {
    if (!stats?.opponentTeam) return { left: 0, right: 0 };
    let left = 0, right = 0;
    
    if (stats.myTeam.salesCount > stats.opponentTeam.salesCount) left++;
    else if (stats.myTeam.salesCount < stats.opponentTeam.salesCount) right++;
    
    if (stats.myTeam.revenue > stats.opponentTeam.revenue) left++;
    else if (stats.myTeam.revenue < stats.opponentTeam.revenue) right++;
    
    if (stats.myTeam.commission > stats.opponentTeam.commission) left++;
    else if (stats.myTeam.commission < stats.opponentTeam.commission) right++;
    
    if (stats.myTeam.callCount > stats.opponentTeam.callCount) left++;
    else if (stats.myTeam.callCount < stats.opponentTeam.callCount) right++;
    
    if (stats.myTeam.talkTimeSeconds > stats.opponentTeam.talkTimeSeconds) left++;
    else if (stats.myTeam.talkTimeSeconds < stats.opponentTeam.talkTimeSeconds) right++;
    
    return { left, right };
  };

  const wins = calculateWins();
  const isWinning = wins.left > wins.right;
  const isLosing = wins.left < wins.right;
  const hasOpponents = opponentTeam.length > 0;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const addToMyTeam = (agentId: string) => {
    if (!myTeam.includes(agentId)) {
      setMyTeam([...myTeam, agentId]);
    }
  };

  const removeFromMyTeam = (agentId: string) => {
    setMyTeam(myTeam.filter(id => id !== agentId));
  };

  const addToOpponentTeam = (agentId: string) => {
    if (!opponentTeam.includes(agentId)) {
      setOpponentTeam([...opponentTeam, agentId]);
    }
  };

  const removeFromOpponentTeam = (agentId: string) => {
    setOpponentTeam(opponentTeam.filter(id => id !== agentId));
  };

  const availableForMyTeam = agents.filter(a => 
    a.name !== currentEmployeeName && 
    !myTeam.includes(a.id) && 
    !opponentTeam.includes(a.id)
  );

  const availableForOpponentTeam = agents.filter(a => 
    a.name !== currentEmployeeName && 
    !myTeam.includes(a.id) && 
    !opponentTeam.includes(a.id)
  );

  // Team member badge component
  const TeamMemberBadge = ({ name, onRemove }: { name: string; onRemove?: () => void }) => (
    <div className="relative group">
      <div className="px-3 py-1.5 rounded-lg bg-slate-700/80 border border-slate-600/50 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-200 truncate max-w-[80px]">{name.split(" ")[0]}</span>
        {onRemove && (
          <button 
            onClick={onRemove}
            className="w-4 h-4 bg-rose-500/80 rounded-full flex items-center justify-center hover:bg-rose-500 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
    </div>
  );

  // Player card component
  const PlayerCard = ({ 
    name, 
    isWinner, 
    isLoser, 
    score, 
    showCrown,
    colorScheme
  }: { 
    name: string; 
    isWinner: boolean; 
    isLoser: boolean; 
    score?: number;
    showCrown?: boolean;
    colorScheme: 'blue' | 'rose' | 'emerald';
  }) => {
    const gradients = {
      blue: 'from-blue-500/20 to-blue-600/10 border-blue-400/30',
      rose: 'from-rose-500/20 to-rose-600/10 border-rose-400/30',
      emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-400/30'
    };
    
    const glowColor = isWinner ? 'bg-emerald-500' : isLoser ? 'bg-rose-500' : `bg-${colorScheme}-500`;
    const actualGradient = isWinner ? gradients.emerald : isLoser ? gradients.rose : gradients[colorScheme];
    
    return (
      <div className="relative">
        {showCrown && (
          <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 animate-bounce z-20" style={{ animationDuration: '2s' }} />
        )}
        <div className={`absolute inset-0 ${glowColor} blur-xl opacity-20 scale-110 rounded-xl`} />
        <div className={`relative px-4 py-3 rounded-xl bg-gradient-to-br ${actualGradient} border backdrop-blur-sm`}>
          <div className="flex flex-col items-center gap-1">
            <Zap className={`w-5 h-5 ${isWinner ? 'text-emerald-400' : isLoser ? 'text-rose-400' : 'text-blue-400'}`} />
            <p className="font-bold text-sm text-white text-center leading-tight">
              {name.split(" ")[0]}
            </p>
            <p className="text-[10px] text-slate-400 truncate max-w-full">
              {name.split(" ").slice(1).join(" ")}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="relative border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-rose-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <CardHeader className="relative pb-2 z-10">
        <CardTitle className="flex items-center gap-3 text-lg font-bold text-white">
          <div className="relative">
            <Swords className="w-6 h-6 text-amber-400" />
            <div className="absolute inset-0 text-amber-400 blur-sm opacity-50">
              <Swords className="w-6 h-6" />
            </div>
          </div>
          <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Head to Head
          </span>
          
          {/* Mode toggle */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-slate-800/80 rounded-full p-0.5 border border-slate-700/50">
              <button
                onClick={() => {
                  setBattleMode("1v1");
                  setMyTeam([]);
                  setOpponentTeam(opponentTeam.slice(0, 1));
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  battleMode === "1v1" 
                    ? "bg-amber-500 text-white" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                1v1
              </button>
              <button
                onClick={() => setBattleMode("team")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  battleMode === "team" 
                    ? "bg-amber-500 text-white" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Hold
              </button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative space-y-6 z-10 text-white">
        {/* Team Display */}
        <div className="grid grid-cols-3 gap-3 items-start">
          {/* Left Team (My Team) */}
          <div className="text-center">
            <PlayerCard 
              name={currentEmployeeName || "Dig"} 
              isWinner={hasOpponents && isWinning}
              isLoser={hasOpponents && isLosing}
              showCrown={hasOpponents && isWinning}
              colorScheme="blue"
            />
            
            {/* Team members */}
            {battleMode === "team" && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap justify-center gap-1">
                  {myTeam.map(id => {
                    const agent = agents.find(a => a.id === id);
                    if (!agent) return null;
                    return (
                      <TeamMemberBadge 
                        key={id} 
                        name={agent.name} 
                        onRemove={() => removeFromMyTeam(id)}
                      />
                    );
                  })}
                </div>
                {availableForMyTeam.length > 0 && myTeam.length < 3 && (
                  <Select onValueChange={addToMyTeam}>
                    <SelectTrigger className="h-8 text-xs bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50">
                      <Plus className="w-3 h-3 mr-1" />
                      <span>Tilføj</span>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {availableForMyTeam.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            
            {hasOpponents && (
              <div className="flex flex-col items-center gap-1.5 mt-2">
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isWinning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                  isLosing ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {wins.left} / 5
                </div>
              </div>
            )}
          </div>

          {/* VS Badge */}
          <div className="text-center relative pt-2">
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="relative w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50 flex items-center justify-center backdrop-blur-sm">
                <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  VS
                </span>
              </div>
            </div>
            {battleMode === "team" && (
              <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider">
                {myTeamNames.length}v{opponentTeamNames.length}
              </p>
            )}
          </div>

          {/* Right Team (Opponent Team) */}
          <div className="text-center">
            {hasOpponents ? (
              <>
                <PlayerCard 
                  name={opponentTeamNames.length === 1 ? opponentTeamNames[0] : `Hold (${opponentTeamNames.length})`} 
                  isWinner={isLosing}
                  isLoser={isWinning}
                  showCrown={isLosing}
                  colorScheme="rose"
                />
                
                {/* Opponent team members */}
                {battleMode === "team" && opponentTeam.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap justify-center gap-1">
                      {opponentTeam.map(id => {
                        const agent = agents.find(a => a.id === id);
                        if (!agent) return null;
                        return (
                          <TeamMemberBadge 
                            key={id} 
                            name={agent.name} 
                            onRemove={() => removeFromOpponentTeam(id)}
                          />
                        );
                      })}
                    </div>
                    {availableForOpponentTeam.length > 0 && opponentTeam.length < 4 && (
                      <Select onValueChange={addToOpponentTeam}>
                        <SelectTrigger className="h-8 text-xs bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50">
                          <Plus className="w-3 h-3 mr-1" />
                          <span>Tilføj</span>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {availableForOpponentTeam.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isLosing ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    isWinning ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {wins.right} / 5
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <div className="w-16 h-16 mx-auto rounded-full bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Users className="w-8 h-8 text-slate-500" />
                  </div>
                </div>
                <Select onValueChange={(id) => setOpponentTeam([id])}>
                  <SelectTrigger className="bg-slate-700/80 border-slate-600/50 text-white text-xs h-9 hover:bg-slate-600/80 transition-colors backdrop-blur-sm">
                    <SelectValue placeholder="Vælg modstander" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-48">
                    {availableForOpponentTeam.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Stats Comparison Bars */}
        {stats?.opponentTeam && (
          <div className="space-y-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center justify-center gap-6 pb-2">
              <div className="flex items-center gap-2">
                <Trophy className={`h-5 w-5 ${isWinning ? "text-amber-400" : "text-slate-500"} transition-colors`} />
                <span className={`text-lg font-black tabular-nums ${isWinning ? "text-amber-400" : "text-slate-500"}`}>
                  {wins.left}
                </span>
              </div>
              <div className="px-4 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Kategorier</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black tabular-nums ${isLosing ? "text-amber-400" : "text-slate-500"}`}>
                  {wins.right}
                </span>
                <Trophy className={`h-5 w-5 ${isLosing ? "text-amber-400" : "text-slate-500"} transition-colors`} />
              </div>
            </div>

            <StatBar label="Salg" icon={Target} leftValue={stats.myTeam.salesCount} rightValue={stats.opponentTeam.salesCount} delay={0} />
            <StatBar label="Omsætning" icon={TrendingUp} leftValue={stats.myTeam.revenue} rightValue={stats.opponentTeam.revenue} formatFn={formatCurrency} delay={100} />
            <StatBar label="Provision" icon={DollarSign} leftValue={stats.myTeam.commission} rightValue={stats.opponentTeam.commission} formatFn={formatCurrency} delay={200} />
            <StatBar label="Opkald" icon={Phone} leftValue={stats.myTeam.callCount} rightValue={stats.opponentTeam.callCount} delay={300} />
            <StatBar label="Taletid" icon={Clock} leftValue={stats.myTeam.talkTimeSeconds} rightValue={stats.opponentTeam.talkTimeSeconds} formatFn={formatTime} delay={400} />
          </div>
        )}

        {/* No opponent selected state */}
        {!hasOpponents && (
          <div className="text-center py-8">
            <div className="relative inline-block mb-4">
              <Target className="h-12 w-12 text-slate-600" />
              <div className="absolute inset-0 animate-ping">
                <Target className="h-12 w-12 text-slate-700/50" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">Vælg en modstander for at starte duellen</p>
          </div>
        )}

        {/* Action buttons when opponent is selected */}
        {hasOpponents && (
          <div className="flex flex-col gap-3 pt-2">
            {!showInviteOptions ? (
              <Button 
                onClick={() => setShowInviteOptions(true)}
                className="relative w-full h-11 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 border-0 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Send className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform" />
                {battleMode === "team" ? `Inviter alle (${myTeamNames.length + opponentTeamNames.length} spillere)` : "Inviter til duel"}
              </Button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <p className="text-center text-sm text-slate-300 font-medium">Vælg duel-periode</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => {
                      setPeriod("today");
                      const teamLabel = battleMode === "team" ? ` (${myTeamNames.length}v${opponentTeamNames.length})` : "";
                      toast.success(`Invitation sendt!${teamLabel}`, {
                        description: "Duellen gælder for i dag."
                      });
                      setShowInviteOptions(false);
                    }}
                    variant="outline"
                    className="h-16 flex flex-col gap-1 bg-slate-800/80 border-slate-600/50 hover:bg-blue-500/20 hover:border-blue-400/50 text-white transition-all group"
                  >
                    <CalendarDays className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">I dag</span>
                  </Button>
                  <Button 
                    onClick={() => {
                      setPeriod("week");
                      const teamLabel = battleMode === "team" ? ` (${myTeamNames.length}v${opponentTeamNames.length})` : "";
                      toast.success(`Invitation sendt!${teamLabel}`, {
                        description: "Duellen gælder for denne uge."
                      });
                      setShowInviteOptions(false);
                    }}
                    variant="outline"
                    className="h-16 flex flex-col gap-1 bg-slate-800/80 border-slate-600/50 hover:bg-emerald-500/20 hover:border-emerald-400/50 text-white transition-all group"
                  >
                    <CalendarRange className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Denne uge</span>
                  </Button>
                </div>
                <button 
                  onClick={() => setShowInviteOptions(false)}
                  className="w-full text-xs text-slate-500 hover:text-white transition-colors py-1"
                >
                  Annuller
                </button>
              </div>
            )}
            <button 
              onClick={() => {
                setOpponentTeam([]);
                setMyTeam([]);
                setShowInviteOptions(false);
              }}
              className="w-full text-xs text-slate-500 hover:text-white transition-colors py-2"
            >
              Nulstil hold
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
