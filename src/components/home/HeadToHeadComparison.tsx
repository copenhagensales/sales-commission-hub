import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Phone, Clock, TrendingUp, DollarSign, Trophy, Flame, Target, Calendar, Send } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, startOfDay, endOfDay } from "date-fns";
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

type PeriodType = "today" | "week" | "month";

export const HeadToHeadComparison = ({ currentEmployeeId, currentEmployeeName }: HeadToHeadComparisonProps) => {
  const [opponentId, setOpponentId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodType>("week");

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now), label: "I dag" };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now), label: "Denne uge" };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now), label: "Denne måned" };
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
    reverseWinner = false 
  }: { 
    label: string; 
    icon: any; 
    leftValue: number; 
    rightValue: number; 
    formatFn?: (n: number) => string;
    reverseWinner?: boolean;
  }) => {
    const total = leftValue + rightValue || 1;
    const leftPercent = (leftValue / total) * 100;
    const rightPercent = (rightValue / total) * 100;
    
    const leftWins = reverseWinner ? leftValue < rightValue : leftValue > rightValue;
    const rightWins = reverseWinner ? rightValue < leftValue : rightValue > leftValue;
    const tie = leftValue === rightValue;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className={`font-semibold ${leftWins && !tie ? "text-emerald-500" : ""}`}>
            {formatFn(leftValue)}
          </span>
          <span className="flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {label}
          </span>
          <span className={`font-semibold ${rightWins && !tie ? "text-emerald-500" : ""}`}>
            {formatFn(rightValue)}
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          <div 
            className={`transition-all duration-500 ${leftWins ? "bg-emerald-500" : tie ? "bg-amber-400" : "bg-rose-400"}`}
            style={{ width: `${leftPercent}%` }}
          />
          <div 
            className={`transition-all duration-500 ${rightWins ? "bg-emerald-500" : tie ? "bg-amber-400" : "bg-rose-400"}`}
            style={{ width: `${rightPercent}%` }}
          />
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

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <Swords className="w-5 h-5 text-amber-400" />
          Head to Head
          {/* Period selector */}
          <div className="ml-auto flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[120px] h-7 bg-slate-700 border-slate-600 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">I dag</SelectItem>
                <SelectItem value="week">Denne uge</SelectItem>
                <SelectItem value="month">Denne måned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Player Cards */}
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Left Player (Current User) */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/30">
              {currentEmployeeName ? getInitials(currentEmployeeName) : "?"}
            </div>
            <p className="mt-2 font-semibold text-sm truncate">{currentEmployeeName?.split(" ")[0] || "Dig"}</p>
            <Badge className={`mt-1 ${wins.left > wins.right ? "bg-emerald-500" : wins.left < wins.right ? "bg-rose-500" : "bg-amber-500"}`}>
              {wins.left} sejre
            </Badge>
            {record.streak > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-400 bg-orange-500/10">
                  <Flame className="h-3 w-3 mr-1" />
                  {record.streak} streak
                </Badge>
              </div>
            )}
          </div>

          {/* VS Badge + Record */}
          <div className="text-center">
            <div className="text-3xl font-black text-amber-400 drop-shadow-lg">VS</div>
            {opponentId && record.wins + record.losses > 0 && (
              <div className="mt-2">
                <p className="text-lg font-bold">
                  <span className="text-emerald-400">{record.wins}</span>
                  <span className="text-slate-500 mx-1">-</span>
                  <span className="text-rose-400">{record.losses}</span>
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Historik</p>
              </div>
            )}
          </div>

          {/* Right Player (Opponent) */}
          <div className="text-center">
            {opponentId ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-xl font-bold shadow-lg shadow-rose-500/30">
                  {stats?.opponent?.name ? getInitials(stats.opponent.name) : "?"}
                </div>
                <p className="mt-2 font-semibold text-sm truncate">{stats?.opponent?.name?.split(" ")[0] || "Modstander"}</p>
                <Badge className={`mt-1 ${wins.right > wins.left ? "bg-emerald-500" : wins.right < wins.left ? "bg-rose-500" : "bg-amber-500"}`}>
                  {wins.right} sejre
                </Badge>
                {record.streak < 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-400 bg-orange-500/10">
                      <Flame className="h-3 w-3 mr-1" />
                      {Math.abs(record.streak)} streak
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-700 flex items-center justify-center text-2xl text-slate-500">
                  ?
                </div>
                <Select value={opponentId} onValueChange={setOpponentId}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-xs h-8">
                    <SelectValue placeholder="Vælg modstander" />
                  </SelectTrigger>
                  <SelectContent>
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
          <div className="space-y-3 pt-4 border-t border-slate-700">
            {/* Category wins summary */}
            <div className="flex items-center justify-center gap-4 pb-2">
              <div className="flex items-center gap-1">
                <Trophy className={`h-4 w-4 ${wins.left > wins.right ? "text-amber-400" : "text-slate-500"}`} />
                <span className={`font-bold ${wins.left > wins.right ? "text-amber-400" : "text-slate-500"}`}>
                  {wins.left}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Kategorier</span>
              <div className="flex items-center gap-1">
                <span className={`font-bold ${wins.right > wins.left ? "text-amber-400" : "text-slate-500"}`}>
                  {wins.right}
                </span>
                <Trophy className={`h-4 w-4 ${wins.right > wins.left ? "text-amber-400" : "text-slate-500"}`} />
              </div>
            </div>

            <StatBar 
              label="Salg" 
              icon={Target} 
              leftValue={stats.current.salesCount} 
              rightValue={stats.opponent.salesCount} 
            />
            <StatBar 
              label="Omsætning" 
              icon={TrendingUp} 
              leftValue={stats.current.revenue} 
              rightValue={stats.opponent.revenue}
              formatFn={formatCurrency}
            />
            <StatBar 
              label="Provision" 
              icon={DollarSign} 
              leftValue={stats.current.commission} 
              rightValue={stats.opponent.commission}
              formatFn={formatCurrency}
            />
            <StatBar 
              label="Opkald" 
              icon={Phone} 
              leftValue={stats.current.callCount} 
              rightValue={stats.opponent.callCount} 
            />
            <StatBar 
              label="Taletid" 
              icon={Clock} 
              leftValue={stats.current.talkTimeSeconds} 
              rightValue={stats.opponent.talkTimeSeconds}
              formatFn={formatTime}
            />
          </div>
        )}

        {/* No opponent selected state */}
        {!opponentId && (
          <div className="text-center py-4 text-slate-400">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Vælg en modstander for at starte duellen</p>
          </div>
        )}

        {/* Action buttons when opponent is selected */}
        {opponentId && (
          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={() => {
                toast.success(`Invitation sendt til ${stats?.opponent?.name || "modstander"}!`, {
                  description: "De vil modtage en notifikation om din udfordring."
                });
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
            >
              <Send className="h-4 w-4 mr-2" />
              Inviter til duel
            </Button>
            <button 
              onClick={() => setOpponentId("")}
              className="w-full text-xs text-slate-400 hover:text-white transition-colors"
            >
              Vælg en anden modstander
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
