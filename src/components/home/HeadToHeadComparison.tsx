import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Phone, Clock, TrendingUp, DollarSign, Trophy, Flame, Target, Send, Crown, Zap, Users, CalendarDays, CalendarRange, Plus, X, Sparkles, Timer, Activity } from "lucide-react";
import { startOfWeek, startOfDay, endOfDay, differenceInHours, differenceInDays, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
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

// Player role types based on performance
type PlayerRole = "closer" | "grinder" | "consistent" | "comeback" | "hot_streak" | null;

export const HeadToHeadComparison = ({ currentEmployeeId, currentEmployeeName }: HeadToHeadComparisonProps) => {
  const [battleMode, setBattleMode] = useState<BattleMode>("1v1");
  const [myTeam, setMyTeam] = useState<string[]>([]);
  const [opponentTeam, setOpponentTeam] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [showInviteOptions, setShowInviteOptions] = useState(true); // Start with period selection visible
  const [matchStarted, setMatchStarted] = useState(false); // Track if match has actually started
  const [momentum, setMomentum] = useState(50); // 0-100, 50 = neutral
  const [animateScore, setAnimateScore] = useState<'left' | 'right' | null>(null);

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

  // Calculate time remaining
  const timeInfo = useMemo(() => {
    const now = new Date();
    const endTime = dateRange.end;
    const totalDuration = period === "today" ? 24 : 7 * 24; // hours
    const elapsed = period === "today" 
      ? differenceInHours(now, dateRange.start)
      : differenceInHours(now, dateRange.start);
    const percentComplete = Math.min(100, Math.round((elapsed / totalDuration) * 100));
    
    const hoursRemaining = differenceInHours(endTime, now);
    const daysRemaining = differenceInDays(endTime, now);
    
    let timeRemainingText = "";
    if (daysRemaining > 0) {
      timeRemainingText = `${daysRemaining}d ${hoursRemaining % 24}t`;
    } else {
      timeRemainingText = `${hoursRemaining}t`;
    }
    
    return { percentComplete, timeRemainingText };
  }, [dateRange, period]);

  // Fetch all agents for selection with team info
  const { data: agents = [] } = useQuery({
    queryKey: ["h2h-agents"],
    queryFn: async () => {
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, name, email, external_adversus_id")
        .eq("is_active", true)
        .order("name");
      
      // Get employee-agent mappings and team info
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, employee_id");
      
      const employeeIds = mappings?.map(m => m.employee_id) || [];
      
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, team_id, teams:team_id(id, name)")
        .in("id", employeeIds.length > 0 ? employeeIds : ['none']);
      
      // Build agent -> team mapping
      const agentTeamMap: Record<string, string> = {};
      mappings?.forEach(m => {
        const employee = employees?.find(e => e.id === m.employee_id);
        if (employee?.teams) {
          agentTeamMap[m.agent_id] = (employee.teams as any).name || '';
        }
      });
      
      return (agentsData || []).map(agent => ({
        ...agent,
        teamName: agentTeamMap[agent.id] || null
      }));
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
  const { data: stats, dataUpdatedAt } = useQuery({
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
          sale_datetime,
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
        .select("agent_external_id, duration_seconds, total_duration_seconds, start_time")
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd);

      // Get agent external IDs for all team members
      const allNames = [...myTeamNames, ...opponentTeamNames];
      const { data: agentMappings } = await supabase
        .from("agents")
        .select("id, name, external_adversus_id")
        .in("name", allNames.filter(Boolean));

      // Calculate recent activity for momentum
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentSales = sales?.filter(s => s.sale_datetime && s.sale_datetime >= oneHourAgo) || [];
      
      let myRecentActivity = 0;
      let opponentRecentActivity = 0;
      recentSales.forEach(s => {
        if (myTeamNames.includes(s.agent_name || "")) myRecentActivity++;
        if (opponentTeamNames.includes(s.agent_name || "")) opponentRecentActivity++;
      });

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
        recentActivity: { my: myRecentActivity, opponent: opponentRecentActivity },
      };
    },
    enabled: myTeamNames.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds for live feel
  });

  // Update momentum based on recent activity
  useEffect(() => {
    if (stats?.recentActivity) {
      const { my, opponent } = stats.recentActivity;
      const total = my + opponent;
      if (total > 0) {
        const newMomentum = Math.round((my / total) * 100);
        setMomentum(newMomentum);
      } else {
        setMomentum(50);
      }
    }
  }, [stats?.recentActivity]);

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

  // Calculate wins per KPI (without revenue)
  const calculateKpiWins = () => {
    if (!stats?.opponentTeam) return { sales: 'none', commission: 'none', calls: 'none', talkTime: 'none' };
    
    const getWinner = (left: number, right: number): 'left' | 'right' | 'tie' => {
      if (left > right) return 'left';
      if (right > left) return 'right';
      return 'tie';
    };
    
    return {
      sales: getWinner(stats.myTeam.salesCount, stats.opponentTeam.salesCount),
      commission: getWinner(stats.myTeam.commission, stats.opponentTeam.commission),
      calls: getWinner(stats.myTeam.callCount, stats.opponentTeam.callCount),
      talkTime: getWinner(stats.myTeam.talkTimeSeconds, stats.opponentTeam.talkTimeSeconds),
    };
  };

  const kpiWins = calculateKpiWins();

  // Calculate total wins
  const calculateWins = () => {
    if (!stats?.opponentTeam) return { left: 0, right: 0 };
    let left = 0, right = 0;
    
    Object.values(kpiWins).forEach(winner => {
      if (winner === 'left') left++;
      else if (winner === 'right') right++;
    });
    
    return { left, right };
  };

  const wins = calculateWins();
  
  // Winner is determined by commission (provision) only
  const isWinning = stats?.opponentTeam ? stats.myTeam.commission > stats.opponentTeam.commission : false;
  const isLosing = stats?.opponentTeam ? stats.myTeam.commission < stats.opponentTeam.commission : false;
  const isTied = stats?.opponentTeam ? stats.myTeam.commission === stats.opponentTeam.commission : false;
  
  // Check if match is ongoing (has opponent AND period selected = matchStarted)
  const isMatchOngoing = matchStarted && opponentTeam.length > 0;
  const hasOpponents = opponentTeam.length > 0;

  // Generate dynamic match narrative with pep-talk
  const getMatchNarrative = () => {
    if (!stats?.opponentTeam) return null;
    
    const leftName = myTeamNames.length === 1 ? myTeamNames[0].split(" ")[0] : "Dit hold";
    const rightName = opponentTeamNames.length === 1 ? opponentTeamNames[0].split(" ")[0] : "Modstanderen";
    
    // Check for close battles
    const commissionDiff = Math.abs(stats.myTeam.commission - stats.opponentTeam.commission);
    const hasMoreCalls = stats.myTeam.callCount > stats.opponentTeam.callCount;
    const hasMoreTalkTime = stats.myTeam.talkTimeSeconds > stats.opponentTeam.talkTimeSeconds;
    
    if (isTied) {
      return { text: "Lige provision – næste salg afgør!", type: "intense" };
    }
    
    if (isWinning) {
      if (commissionDiff > 1000) return { text: `${leftName} fører stort på provision! 💪`, type: "winning" };
      return { text: `${leftName} fører på provision – hold momentum!`, type: "winning" };
    }
    
    if (isLosing) {
      // Pep-talk based on activity
      if (hasMoreCalls && hasMoreTalkTime) {
        return { text: `Din aktivitet er stærk! 📞 Flere opkald og taletid – det skal nok vende!`, type: "comeback" };
      }
      if (hasMoreCalls) {
        return { text: `Du har flere opkald – indsatsen er god! 💪 Bliv ved, det vender snart!`, type: "comeback" };
      }
      if (hasMoreTalkTime) {
        return { text: `Din taletid er højere – gode samtaler betaler sig! 🎯`, type: "comeback" };
      }
      if (commissionDiff < 500) {
        return { text: `Kun ${formatCurrency(commissionDiff)} fra at vende kampen!`, type: "comeback" };
      }
      return { text: `${rightName} fører på provision – du kan stadig vinde!`, type: "losing" };
    }
    
    return { text: "Kampen er i gang", type: "neutral" };
  };

  const narrative = hasOpponents ? getMatchNarrative() : null;

  // Determine player role based on stats
  const getPlayerRole = (name: string, isMyTeam: boolean): PlayerRole => {
    if (!stats?.opponentTeam) return null;
    const teamStats = isMyTeam ? stats.myTeam : stats.opponentTeam;
    const otherStats = isMyTeam ? stats.opponentTeam : stats.myTeam;
    
    // Hot streak: winning in 3+ categories
    const myWins = isMyTeam ? wins.left : wins.right;
    if (myWins >= 3) return "hot_streak";
    
    // Closer: high commission per sale
    if (teamStats.salesCount > 0 && teamStats.commission / teamStats.salesCount > (otherStats.commission / (otherStats.salesCount || 1))) {
      return "closer";
    }
    
    // Grinder: high call volume
    if (teamStats.callCount > otherStats.callCount * 1.2) return "grinder";
    
    // Comeback: losing but with recent activity
    if (!isMyTeam && isWinning && momentum < 50) return "comeback";
    if (isMyTeam && isLosing && momentum > 50) return "comeback";
    
    // Consistent: similar performance across metrics
    return "consistent";
  };

  const roleLabels: Record<NonNullable<PlayerRole>, { label: string; icon: typeof Flame }> = {
    hot_streak: { label: "Hot Streak", icon: Flame },
    closer: { label: "Closer", icon: Target },
    grinder: { label: "Grinder", icon: Activity },
    comeback: { label: "Comeback", icon: Sparkles },
    consistent: { label: "Konsistent", icon: Trophy },
  };

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

  // KPI Battle Row Component
  const KpiBattleRow = ({ 
    label, 
    icon: Icon, 
    leftValue, 
    rightValue, 
    winner,
    formatFn = formatNumber,
  }: { 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    leftValue: number; 
    rightValue: number; 
    winner: 'left' | 'right' | 'tie' | string;
    formatFn?: (n: number) => string;
  }) => {
    const total = leftValue + rightValue || 1;
    const leftPercent = Math.min((leftValue / total) * 100, 100);
    const rightPercent = Math.min((rightValue / total) * 100, 100);
    
    // Scale to max 45% so bars don't meet in the middle
    const maxBarWidth = 45;
    const leftBarWidth = (leftPercent / 100) * maxBarWidth;
    const rightBarWidth = (rightPercent / 100) * maxBarWidth;
    
    return (
      <div className="group relative">
        <div className="flex items-center gap-3">
          {/* Left value */}
          <div className={`flex-1 flex items-center justify-end gap-2 transition-all duration-500 ${
            winner === 'left' ? 'scale-105' : ''
          }`}>
            {winner === 'left' && (
              <div className="relative">
                <Trophy className="w-4 h-4 text-amber-400" />
                <div className="absolute inset-0 animate-ping">
                  <Trophy className="w-4 h-4 text-amber-400/50" />
                </div>
              </div>
            )}
            <span className={`font-bold text-sm tabular-nums transition-colors duration-300 ${
              winner === 'left' ? 'text-emerald-400' : 
              winner === 'tie' ? 'text-amber-300' : 
              'text-slate-400'
            }`}>
              {formatFn(leftValue)}
            </span>
          </div>
          
          {/* Center label with icon */}
          <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl min-w-[120px] transition-all duration-300 ${
            winner === 'left' ? 'bg-emerald-500/10 border border-emerald-500/30' :
            winner === 'right' ? 'bg-rose-500/10 border border-rose-500/30' :
            winner === 'tie' ? 'bg-amber-500/10 border border-amber-500/30' :
            'bg-slate-800/50 border border-slate-700/50'
          }`}>
            <Icon className={`w-4 h-4 ${
              winner === 'left' ? 'text-emerald-400' :
              winner === 'right' ? 'text-rose-400' :
              winner === 'tie' ? 'text-amber-400' :
              'text-slate-400'
            }`} />
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </div>
          
          {/* Right value */}
          <div className={`flex-1 flex items-center gap-2 transition-all duration-500 ${
            winner === 'right' ? 'scale-105' : ''
          }`}>
            <span className={`font-bold text-sm tabular-nums transition-colors duration-300 ${
              winner === 'right' ? 'text-emerald-400' : 
              winner === 'tie' ? 'text-amber-300' : 
              'text-slate-400'
            }`}>
              {formatFn(rightValue)}
            </span>
            {winner === 'right' && (
              <div className="relative">
                <Trophy className="w-4 h-4 text-amber-400" />
                <div className="absolute inset-0 animate-ping">
                  <Trophy className="w-4 h-4 text-amber-400/50" />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Progress bar - bars start from each side */}
        <div className="relative h-2.5 mt-2 rounded-full overflow-hidden bg-slate-800/80">
          {/* Center divider */}
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-slate-600 z-10 -translate-x-1/2" />
          
          {/* Left bar - grows from left edge toward center */}
          <div 
            className={`absolute left-0 top-0 h-full rounded-l-full transition-all duration-700 ease-out ${
              winner === 'left' 
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' 
                : winner === 'tie' 
                  ? 'bg-gradient-to-r from-amber-600 to-amber-400' 
                  : 'bg-gradient-to-r from-blue-600/80 to-blue-400/80'
            }`}
            style={{ 
              width: `${leftBarWidth}%`,
              boxShadow: winner === 'left' ? '0 0 15px rgba(52, 211, 153, 0.4)' : 'none'
            }}
          />
          
          {/* Right bar - grows from right edge toward center */}
          <div 
            className={`absolute right-0 top-0 h-full rounded-r-full transition-all duration-700 ease-out ${
              winner === 'right' 
                ? 'bg-gradient-to-l from-emerald-600 to-emerald-400' 
                : winner === 'tie' 
                  ? 'bg-gradient-to-l from-amber-600 to-amber-400' 
                  : 'bg-gradient-to-l from-rose-600/80 to-rose-400/80'
            }`}
            style={{ 
              width: `${rightBarWidth}%`,
              boxShadow: winner === 'right' ? '0 0 15px rgba(52, 211, 153, 0.4)' : 'none'
            }}
          />
        </div>
      </div>
    );
  };

  // Team member badge component
  const TeamMemberBadge = ({ name, teamName, onRemove }: { name: string; teamName?: string | null; onRemove?: () => void }) => (
    <div className="relative group">
      <div className="px-3 py-1.5 rounded-lg bg-slate-700/80 border border-slate-600/50 flex flex-col items-start gap-0.5">
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs font-medium text-slate-200 truncate max-w-[80px]">{name.split(" ")[0]}</span>
          {onRemove && !isMatchOngoing && (
            <button 
              onClick={onRemove}
              className="w-4 h-4 bg-rose-500/80 rounded-full flex items-center justify-center hover:bg-rose-500 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
        {teamName && (
          <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{teamName}</span>
        )}
      </div>
    </div>
  );

  // Player card component
  const PlayerCard = ({ 
    name, 
    isWinner, 
    isLoser, 
    showCrown,
    role,
    colorScheme,
    teamName
  }: { 
    name: string; 
    isWinner: boolean; 
    isLoser: boolean; 
    showCrown?: boolean;
    role?: PlayerRole;
    colorScheme: 'blue' | 'rose' | 'emerald';
    teamName?: string | null;
  }) => {
    const gradients = {
      blue: 'from-blue-500/20 to-blue-600/10 border-blue-400/30',
      rose: 'from-rose-500/20 to-rose-600/10 border-rose-400/30',
      emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-400/30'
    };
    
    const actualGradient = isWinner ? gradients.emerald : isLoser ? gradients.rose : gradients[colorScheme];
    const roleInfo = role ? roleLabels[role] : null;
    
    return (
      <div className="relative">
        {showCrown && (
          <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 z-20" style={{ animation: 'bounce 2s ease-in-out infinite' }} />
        )}
        <div className={`absolute inset-0 ${isWinner ? 'bg-emerald-500' : isLoser ? 'bg-rose-500' : 'bg-blue-500'} blur-xl opacity-20 scale-110 rounded-xl`} />
        <div className={`relative px-4 py-3 rounded-xl bg-gradient-to-br ${actualGradient} border backdrop-blur-sm`}>
          <div className="flex flex-col items-center gap-1">
            <Zap className={`w-5 h-5 ${isWinner ? 'text-emerald-400' : isLoser ? 'text-rose-400' : 'text-blue-400'}`} />
            <p className="font-bold text-sm text-white text-center leading-tight">
              {name.split(" ")[0]}
            </p>
            <p className="text-[10px] text-slate-400 truncate max-w-full">
              {name.split(" ").slice(1).join(" ")}
            </p>
            {/* Team tag */}
            {teamName && (
              <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                <Users className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-medium text-blue-300">{teamName}</span>
              </div>
            )}
            {roleInfo && (
              <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50">
                <roleInfo.icon className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-medium text-slate-300">{roleInfo.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Momentum Bar Component
  const MomentumBar = () => {
    const leftName = myTeamNames.length === 1 ? myTeamNames[0].split(" ")[0] : "Dig";
    const rightName = opponentTeamNames.length === 1 ? opponentTeamNames[0].split(" ")[0] : "Modstander";
    
    return (
      <div className="relative">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span className={momentum > 60 ? 'text-emerald-400 font-medium' : ''}>{leftName}</span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Momentum
          </span>
          <span className={momentum < 40 ? 'text-emerald-400 font-medium' : ''}>{rightName}</span>
        </div>
        <div className="relative h-2 rounded-full bg-slate-800/80 overflow-hidden">
          {/* Center marker */}
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-slate-600 z-10" />
          
          {/* Momentum indicator */}
          <div 
            className="absolute top-0 h-full transition-all duration-1000 ease-out"
            style={{ 
              left: `${Math.min(momentum, 50)}%`,
              right: `${Math.min(100 - momentum, 50)}%`,
              background: momentum > 50 
                ? 'linear-gradient(to right, transparent, rgba(52, 211, 153, 0.6))' 
                : 'linear-gradient(to left, transparent, rgba(52, 211, 153, 0.6))'
            }}
          />
          
          {/* Energy ball */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ 
              left: `${momentum}%`,
              transform: 'translate(-50%, -50%)',
              background: momentum > 55 ? '#34d399' : momentum < 45 ? '#f87171' : '#fbbf24',
              boxShadow: `0 0 10px ${momentum > 55 ? 'rgba(52, 211, 153, 0.8)' : momentum < 45 ? 'rgba(248, 113, 113, 0.8)' : 'rgba(251, 191, 36, 0.8)'}`
            }}
          >
            <Zap className="w-2 h-2 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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
          
          {/* Mode toggle - more prominent (disabled during match) */}
          <div className="ml-auto flex items-center gap-3">
            <div className={`flex bg-slate-800 rounded-xl p-1 border border-slate-600/50 shadow-lg ${isMatchOngoing ? 'opacity-50' : ''}`}>
              <button
                onClick={() => {
                  if (isMatchOngoing) return;
                  setBattleMode("1v1");
                  setMyTeam([]);
                  setOpponentTeam(opponentTeam.slice(0, 1));
                }}
                disabled={isMatchOngoing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  battleMode === "1v1" 
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                } ${isMatchOngoing ? 'cursor-not-allowed' : ''}`}
              >
                <Swords className="w-4 h-4" />
                <span>1v1</span>
              </button>
              <button
                onClick={() => {
                  if (isMatchOngoing) return;
                  setBattleMode("team");
                }}
                disabled={isMatchOngoing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  battleMode === "team" 
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                } ${isMatchOngoing ? 'cursor-not-allowed' : ''}`}
              >
                <Users className="w-4 h-4" />
                <span>Hold</span>
              </button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative space-y-5 z-10 text-white">
        {/* Time & Progress Bar */}
        {hasOpponents && (
          <div className="flex items-center justify-between gap-4 px-2 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">{dateRange.label}</span>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                  style={{ width: `${timeInfo.percentComplete}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">{timeInfo.percentComplete}%</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-medium">{timeInfo.timeRemainingText} tilbage</span>
            </div>
          </div>
        )}

        {/* Match Narrative */}
        {narrative && (
          <div className={`text-center py-3 px-4 rounded-xl border transition-all duration-500 ${
            narrative.type === 'winning' ? 'bg-emerald-500/10 border-emerald-500/30' :
            narrative.type === 'losing' ? 'bg-rose-500/10 border-rose-500/30' :
            narrative.type === 'intense' ? 'bg-amber-500/10 border-amber-500/30 animate-pulse' :
            narrative.type === 'comeback' ? 'bg-blue-500/10 border-blue-500/30' :
            'bg-slate-800/40 border-slate-700/30'
          }`}>
            <p className={`text-sm font-medium ${
              narrative.type === 'winning' ? 'text-emerald-400' :
              narrative.type === 'losing' ? 'text-rose-400' :
              narrative.type === 'intense' ? 'text-amber-400' :
              narrative.type === 'comeback' ? 'text-blue-400' :
              'text-slate-300'
            }`}>
              {narrative.text}
            </p>
          </div>
        )}

        {/* Momentum Bar */}
        {hasOpponents && <MomentumBar />}

        {/* Team Display */}
        <div className="grid grid-cols-3 gap-3 items-start">
          {/* Left Team (My Team) */}
          <div className="text-center">
            <PlayerCard 
              name={currentEmployeeName || "Dig"} 
              isWinner={hasOpponents && isWinning}
              isLoser={hasOpponents && isLosing}
              showCrown={hasOpponents && isWinning}
              role={hasOpponents ? getPlayerRole(currentEmployeeName || "", true) : null}
              colorScheme="blue"
              teamName={null} // Current employee team could be fetched separately if needed
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
                        teamName={agent.teamName}
                        onRemove={!isMatchOngoing ? () => removeFromMyTeam(id) : undefined}
                      />
                    );
                  })}
                </div>
                {availableForMyTeam.length > 0 && myTeam.length < 3 && !isMatchOngoing && (
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
                  {wins.left} / 4
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
                  role={getPlayerRole(opponentTeamNames[0] || "", false)}
                  colorScheme="rose"
                  teamName={opponentTeam.length === 1 ? agents.find(a => a.id === opponentTeam[0])?.teamName : null}
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
                            teamName={agent.teamName}
                            onRemove={!isMatchOngoing ? () => removeFromOpponentTeam(id) : undefined}
                          />
                        );
                      })}
                    </div>
                    {availableForOpponentTeam.length > 0 && opponentTeam.length < 4 && !isMatchOngoing && (
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
                    {wins.right} / 4
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

        {/* KPI Battles */}
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
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">KPI Kampe</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black tabular-nums ${isLosing ? "text-amber-400" : "text-slate-500"}`}>
                  {wins.right}
                </span>
                <Trophy className={`h-5 w-5 ${isLosing ? "text-amber-400" : "text-slate-500"} transition-colors`} />
              </div>
            </div>

            <KpiBattleRow label="Salg" icon={Target} leftValue={stats.myTeam.salesCount} rightValue={stats.opponentTeam.salesCount} winner={kpiWins.sales} />
            <KpiBattleRow label="Provision" icon={DollarSign} leftValue={stats.myTeam.commission} rightValue={stats.opponentTeam.commission} winner={kpiWins.commission} formatFn={formatCurrency} />
            <KpiBattleRow label="Opkald" icon={Phone} leftValue={stats.myTeam.callCount} rightValue={stats.opponentTeam.callCount} winner={kpiWins.calls} />
            <KpiBattleRow label="Taletid" icon={Clock} leftValue={stats.myTeam.talkTimeSeconds} rightValue={stats.opponentTeam.talkTimeSeconds} winner={kpiWins.talkTime} formatFn={formatTime} />
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
            {/* Show period selection only if match not yet started */}
            {!matchStarted ? (
              <div className="space-y-3 animate-fade-in">
                <p className="text-center text-sm text-slate-300 font-medium">Vælg kampperiode</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => {
                      setPeriod("today");
                      setMatchStarted(true);
                      const teamLabel = battleMode === "team" ? ` (${myTeamNames.length}v${opponentTeamNames.length})` : "";
                      toast.success(`⚔️ Duel startet!${teamLabel}`, {
                        description: "Kampen gælder for i dag."
                      });
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
                      setMatchStarted(true);
                      const teamLabel = battleMode === "team" ? ` (${myTeamNames.length}v${opponentTeamNames.length})` : "";
                      toast.success(`⚔️ Duel startet!${teamLabel}`, {
                        description: "Kampen gælder for denne uge."
                      });
                    }}
                    variant="outline"
                    className="h-16 flex flex-col gap-1 bg-slate-800/80 border-slate-600/50 hover:bg-emerald-500/20 hover:border-emerald-400/50 text-white transition-all group"
                  >
                    <CalendarRange className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Denne uge</span>
                  </Button>
                </div>
                <button 
                  onClick={() => {
                    setOpponentTeam([]);
                    setMyTeam([]);
                  }}
                  className="w-full text-xs text-slate-500 hover:text-white transition-colors py-1"
                >
                  Annuller
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {/* Match status indicator */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-slate-300 font-medium">Kamp i gang • {dateRange.label}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
