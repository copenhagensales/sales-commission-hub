import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Phone, Clock, TrendingUp, DollarSign, Trophy, Flame, Target, Send, Crown, Zap, Users, CalendarDays, CalendarRange } from "lucide-react";
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

export const HeadToHeadComparison = ({ currentEmployeeId, currentEmployeeName }: HeadToHeadComparisonProps) => {
  const [opponentId, setOpponentId] = useState<string>("");
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

  // Fetch head-to-head history between current user and selected opponent
  const { data: battleHistory = [] } = useQuery({
    queryKey: ["h2h-history", currentEmployeeId, opponentId],
    queryFn: async () => {
      if (!currentEmployeeId || !opponentId) return [];
      
      const { data, error } = await supabase
        .from("head_to_head_battles")
        .select("*")
        .or(`and(challenger_employee_id.eq.${currentEmployeeId},opponent_employee_id.eq.${opponentId}),and(challenger_employee_id.eq.${opponentId},opponent_employee_id.eq.${currentEmployeeId})`)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEmployeeId && !!opponentId,
  });

  // Calculate W-L record
  const record = useMemo(() => {
    if (!battleHistory || battleHistory.length === 0) return { wins: 0, losses: 0, streak: 0 };
    
    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let streakType: "win" | "loss" | null = null;

    battleHistory.forEach((battle, index) => {
      const isWinner = battle.winner_employee_id === currentEmployeeId;
      if (isWinner) {
        wins++;
        if (index === 0) streakType = "win";
        if (streakType === "win") currentStreak++;
      } else if (battle.winner_employee_id) {
        losses++;
        if (index === 0) streakType = "loss";
        if (streakType === "loss") currentStreak++;
      }
    });

    return { 
      wins, 
      losses, 
      streak: streakType === "win" ? currentStreak : -currentStreak 
    };
  }, [battleHistory, currentEmployeeId]);

  // Fetch stats for current user and opponent
  const { data: stats } = useQuery({
    queryKey: ["h2h-stats", currentEmployeeName, opponentId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const monthStart = dateRange.start.toISOString();
      const monthEnd = dateRange.end.toISOString();

      // Get opponent name
      const opponent = agents.find(a => a.id === opponentId);
      const opponentName = opponent?.name || "";

      // Fetch sales stats for both
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

      // Get agent external IDs for current user and opponent
      const { data: agentMappings } = await supabase
        .from("agents")
        .select("id, name, external_adversus_id")
        .in("name", [currentEmployeeName, opponentName].filter(Boolean));

      const currentAgentExternalId = agentMappings?.find(a => a.name === currentEmployeeName)?.external_adversus_id;
      const opponentAgentExternalId = agentMappings?.find(a => a.name === opponentName)?.external_adversus_id;

      // Calculate stats for current user
      const currentSales = sales?.filter(s => s.agent_name === currentEmployeeName) || [];
      const currentSalesCount = currentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const product = item.products as any;
          if (product?.counts_as_sale === false) return itemSum;
          return itemSum + (item.quantity || 1);
        }, 0) || 0);
      }, 0);
      const currentRevenue = currentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const rev = (item.products as any)?.revenue_dkk || 0;
          return itemSum + (rev * (item.quantity || 1));
        }, 0) || 0);
      }, 0);
      const currentCommission = currentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const comm = (item.products as any)?.commission_dkk || item.mapped_commission || 0;
          return itemSum + (comm * (item.quantity || 1));
        }, 0) || 0);
      }, 0);

      const currentCalls = calls?.filter(c => c.agent_external_id === currentAgentExternalId) || [];
      const currentCallCount = currentCalls.length;
      const currentTalkTime = currentCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

      // Calculate stats for opponent
      const opponentSales = sales?.filter(s => s.agent_name === opponentName) || [];
      const opponentSalesCount = opponentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const product = item.products as any;
          if (product?.counts_as_sale === false) return itemSum;
          return itemSum + (item.quantity || 1);
        }, 0) || 0);
      }, 0);
      const opponentRevenue = opponentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const rev = (item.products as any)?.revenue_dkk || 0;
          return itemSum + (rev * (item.quantity || 1));
        }, 0) || 0);
      }, 0);
      const opponentCommission = opponentSales.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => {
          const comm = (item.products as any)?.commission_dkk || item.mapped_commission || 0;
          return itemSum + (comm * (item.quantity || 1));
        }, 0) || 0);
      }, 0);

      const opponentCalls = calls?.filter(c => c.agent_external_id === opponentAgentExternalId) || [];
      const opponentCallCount = opponentCalls.length;
      const opponentTalkTime = opponentCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

      return {
        current: {
          id: currentEmployeeId || "",
          name: currentEmployeeName || "Dig",
          salesCount: currentSalesCount,
          revenue: currentRevenue,
          commission: currentCommission,
          callCount: currentCallCount,
          talkTimeSeconds: currentTalkTime,
        } as AgentStats,
        opponent: opponentName ? {
          id: opponentId,
          name: opponentName,
          salesCount: opponentSalesCount,
          revenue: opponentRevenue,
          commission: opponentCommission,
          callCount: opponentCallCount,
          talkTimeSeconds: opponentTalkTime,
        } as AgentStats : null,
      };
    },
    enabled: !!currentEmployeeName,
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
    icon: any; 
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
          {/* Glow effect */}
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
          
          {/* Actual bars */}
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
    if (!stats?.opponent) return { left: 0, right: 0 };
    let left = 0, right = 0;
    
    if (stats.current.salesCount > stats.opponent.salesCount) left++;
    else if (stats.current.salesCount < stats.opponent.salesCount) right++;
    
    if (stats.current.revenue > stats.opponent.revenue) left++;
    else if (stats.current.revenue < stats.opponent.revenue) right++;
    
    if (stats.current.commission > stats.opponent.commission) left++;
    else if (stats.current.commission < stats.opponent.commission) right++;
    
    if (stats.current.callCount > stats.opponent.callCount) left++;
    else if (stats.current.callCount < stats.opponent.callCount) right++;
    
    if (stats.current.talkTimeSeconds > stats.opponent.talkTimeSeconds) left++;
    else if (stats.current.talkTimeSeconds < stats.opponent.talkTimeSeconds) right++;
    
    return { left, right };
  };

  const wins = calculateWins();
  const isWinning = wins.left > wins.right;
  const isLosing = wins.left < wins.right;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative space-y-6 z-10 text-white">
        {/* Player Cards */}
        <div className="grid grid-cols-3 gap-3 items-center">
          {/* Left Player (Current User) */}
          <div className="text-center group">
            <div className="relative inline-block">
              {/* Crown for winner */}
              {opponentId && isWinning && (
                <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
              )}
              {/* Glow ring */}
              <div className={`absolute inset-0 rounded-full ${isWinning ? 'bg-emerald-500' : isLosing ? 'bg-rose-500' : 'bg-blue-500'} blur-xl opacity-30 scale-110 group-hover:scale-125 transition-transform duration-500`} />
              {/* Avatar ring */}
              <div className={`relative w-18 h-18 p-1 rounded-full bg-gradient-to-br ${isWinning ? 'from-emerald-400 to-emerald-600' : isLosing ? 'from-rose-400 to-rose-600' : 'from-blue-400 to-blue-600'}`}>
                <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl font-bold shadow-inner">
                  {currentEmployeeName ? getInitials(currentEmployeeName) : "?"}
                </div>
              </div>
            </div>
            <p className="mt-3 font-bold text-sm truncate">{currentEmployeeName?.split(" ")[0] || "Dig"}</p>
            {opponentId && (
              <div className="flex flex-col items-center gap-1.5 mt-2">
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isWinning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                  isLosing ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {wins.left} / 5 kategorier
                </div>
                {record.streak > 0 && (
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1 animate-pulse">
                    <Flame className="h-3 w-3" />
                    {record.streak} streak
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* VS Badge + Record */}
          <div className="text-center relative">
            <div className="relative inline-block">
              {/* Animated ring around VS */}
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="relative w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50 flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  VS
                </span>
              </div>
            </div>
            
            {opponentId && record.wins + record.losses > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-center gap-1 text-lg font-black">
                  <span className="text-emerald-400">{record.wins}</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-rose-400">{record.losses}</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Historik</p>
              </div>
            )}
          </div>

          {/* Right Player (Opponent) */}
          <div className="text-center group">
            {opponentId ? (
              <>
                <div className="relative inline-block">
                  {/* Crown for winner */}
                  {isLosing && (
                    <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
                  )}
                  {/* Glow ring */}
                  <div className={`absolute inset-0 rounded-full ${isLosing ? 'bg-emerald-500' : isWinning ? 'bg-rose-500' : 'bg-rose-500'} blur-xl opacity-30 scale-110 group-hover:scale-125 transition-transform duration-500`} />
                  {/* Avatar ring */}
                  <div className={`relative w-18 h-18 p-1 rounded-full bg-gradient-to-br ${isLosing ? 'from-emerald-400 to-emerald-600' : isWinning ? 'from-rose-400 to-rose-600' : 'from-rose-400 to-rose-600'}`}>
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl font-bold shadow-inner">
                      {stats?.opponent?.name ? getInitials(stats.opponent.name) : "?"}
                    </div>
                  </div>
                </div>
                <p className="mt-3 font-bold text-sm truncate">{stats?.opponent?.name?.split(" ")[0] || "Modstander"}</p>
                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isLosing ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    isWinning ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {wins.right} / 5 kategorier
                  </div>
                  {record.streak < 0 && (
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1 animate-pulse">
                      <Flame className="h-3 w-3" />
                      {Math.abs(record.streak)} streak
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <div className="w-18 h-18 mx-auto rounded-full bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Users className="w-8 h-8 text-slate-500" />
                  </div>
                </div>
                <Select value={opponentId} onValueChange={setOpponentId}>
                  <SelectTrigger className="bg-slate-700/80 border-slate-600/50 text-white text-xs h-9 hover:bg-slate-600/80 transition-colors backdrop-blur-sm">
                    <SelectValue placeholder="Vælg modstander" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-48">
                    {agents
                      .filter(a => a.name !== currentEmployeeName)
                      .map(agent => (
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
        {stats?.opponent && (
          <div className="space-y-4 pt-4 border-t border-slate-700/50">
            {/* Category wins summary */}
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

            <StatBar label="Salg" icon={Target} leftValue={stats.current.salesCount} rightValue={stats.opponent.salesCount} delay={0} />
            <StatBar label="Omsætning" icon={TrendingUp} leftValue={stats.current.revenue} rightValue={stats.opponent.revenue} formatFn={formatCurrency} delay={100} />
            <StatBar label="Provision" icon={DollarSign} leftValue={stats.current.commission} rightValue={stats.opponent.commission} formatFn={formatCurrency} delay={200} />
            <StatBar label="Opkald" icon={Phone} leftValue={stats.current.callCount} rightValue={stats.opponent.callCount} delay={300} />
            <StatBar label="Taletid" icon={Clock} leftValue={stats.current.talkTimeSeconds} rightValue={stats.opponent.talkTimeSeconds} formatFn={formatTime} delay={400} />
          </div>
        )}

        {/* No opponent selected state */}
        {!opponentId && (
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
        {opponentId && (
          <div className="flex flex-col gap-3 pt-2">
            {!showInviteOptions ? (
              <Button 
                onClick={() => setShowInviteOptions(true)}
                className="relative w-full h-11 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 border-0 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Send className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform" />
                Inviter til duel
              </Button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <p className="text-center text-sm text-slate-300 font-medium">Vælg duel-periode</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => {
                      setPeriod("today");
                      toast.success(`Invitation sendt til ${stats?.opponent?.name || "modstander"}!`, {
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
                      toast.success(`Invitation sendt til ${stats?.opponent?.name || "modstander"}!`, {
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
                setOpponentId("");
                setShowInviteOptions(false);
              }}
              className="w-full text-xs text-slate-500 hover:text-white transition-colors py-2"
            >
              Vælg en anden modstander
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
