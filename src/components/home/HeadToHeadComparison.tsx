import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Phone, Clock, TrendingUp, DollarSign, Trophy, Flame, Target, Send, Crown, Zap, Users, CalendarDays, CalendarRange, Plus, X, Sparkles, Timer, Activity, MessageSquare, Bell, Check, XCircle, EyeOff } from "lucide-react";
import { startOfWeek, startOfDay, endOfDay, endOfWeek, differenceInHours, differenceInDays, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LiveScoreboard } from "@/components/h2h/LiveScoreboard";
import { H2HAchievementBadges } from "@/components/h2h/H2HAchievementBadges";
import { EnhancedMomentumBar } from "@/components/h2h/EnhancedMomentumBar";
import { MatchCountdownTimer } from "@/components/h2h/MatchCountdownTimer";
import { H2HConfettiEffect, SparkleEffect } from "@/components/h2h/H2HConfettiEffect";
import { H2HMatchHistory } from "@/components/h2h/H2HMatchHistory";
import { H2HPlayerStats } from "@/components/h2h/H2HPlayerStats";

interface EmployeeForH2H {
  id: string;
  name: string;
  teamName: string | null;
}

interface TeamStats {
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
  onHide?: () => void;
}

type PeriodType = "today" | "week" | "target";
type BattleMode = "1v1" | "team";

// Player role types based on performance
type PlayerRole = "closer" | "grinder" | "consistent" | "comeback" | "hot_streak" | null;

const STORAGE_KEY = "h2h-battle-state";

interface StoredBattleState {
  battleMode: BattleMode;
  myTeam: string[];
  opponentTeam: string[];
  period: PeriodType;
  matchStarted: boolean;
  matchComment: string;
  activeChallengeId?: string;
  matchStartTime?: string;
}

interface ActiveChallenge {
  id: string;
  period: PeriodType;
  battle_mode: BattleMode;
  comment: string | null;
  accepted_at: string;
  challenger_employee_id: string;
  opponent_employee_id: string;
}

export const HeadToHeadComparison = ({ currentEmployeeId, currentEmployeeName, onHide }: HeadToHeadComparisonProps) => {
  // Load initial state from localStorage
  const getInitialState = (): StoredBattleState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load battle state:", e);
    }
    return null;
  };

  const initialState = getInitialState();

  const [battleMode, setBattleMode] = useState<BattleMode>(initialState?.battleMode ?? "1v1");
  const [myTeam, setMyTeam] = useState<string[]>(initialState?.myTeam ?? []);
  const [opponentTeam, setOpponentTeam] = useState<string[]>(initialState?.opponentTeam ?? []);
  const [period, setPeriod] = useState<PeriodType>(initialState?.period ?? "today");
  const [matchStarted, setMatchStarted] = useState(initialState?.matchStarted ?? false);
  const [momentum, setMomentum] = useState(50);
  const [animateScore, setAnimateScore] = useState<'left' | 'right' | null>(null);
  const [matchComment, setMatchComment] = useState(initialState?.matchComment ?? "");
  const [showPendingChallenges, setShowPendingChallenges] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupOpponent, setSetupOpponent] = useState<string>("");
  const [setupPeriod, setSetupPeriod] = useState<PeriodType>("today");
  const [setupComment, setSetupComment] = useState("");
  const [setupTargetCommission, setSetupTargetCommission] = useState<number>(1000);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(initialState?.activeChallengeId ?? null);
  const [matchStartTime, setMatchStartTime] = useState<string | null>(initialState?.matchStartTime ?? null);
  
  // Gamification state
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiType, setConfettiType] = useState<"lead_taken" | "big_sale" | "first_blood" | "comeback">("lead_taken");
  const [showSparkles, setShowSparkles] = useState(false);
  const prevCommissionRef = useRef<{ my: number; opponent: number } | null>(null);

  const queryClient = useQueryClient();

  // Fetch pending challenges received
  const { data: pendingChallenges = [] } = useQuery({
    queryKey: ["h2h-pending-challenges", currentEmployeeId],
    queryFn: async () => {
      if (!currentEmployeeId) return [];
      const { data, error } = await supabase
        .from("h2h_challenges")
        .select(`
          id, battle_mode, period, comment, created_at, status,
          challenger:challenger_employee_id(id, first_name, last_name)
        `)
        .eq("opponent_employee_id", currentEmployeeId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEmployeeId,
    refetchInterval: 30000,
  });

  // Fetch all active challenges for current employee (multi-battle support)
  const { data: activeChallenges = [] } = useQuery({
    queryKey: ["h2h-active-challenges", currentEmployeeId],
    queryFn: async () => {
      if (!currentEmployeeId) return [];
      const { data, error } = await supabase
        .from("h2h_challenges")
        .select(`
          id, battle_mode, period, comment, accepted_at, status,
          challenger_employee_id, opponent_employee_id,
          challenger:challenger_employee_id(id, first_name, last_name),
          opponent:opponent_employee_id(id, first_name, last_name)
        `)
        .eq("status", "accepted")
        .is("forfeited_at", null)
        .or(`challenger_employee_id.eq.${currentEmployeeId},opponent_employee_id.eq.${currentEmployeeId}`)
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEmployeeId,
    refetchInterval: 30000,
  });

  // Create challenge mutation
  const createChallengeMutation = useMutation({
    mutationFn: async ({ opponentId, battleMode, period, comment, targetCommission }: { opponentId: string; battleMode: string; period: string; comment: string; targetCommission?: number }) => {
      const { error } = await supabase.from("h2h_challenges").insert({
        challenger_employee_id: currentEmployeeId,
        opponent_employee_id: opponentId,
        battle_mode: battleMode,
        period: period,
        comment: comment || null,
        target_commission: period === "target" ? targetCommission : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["h2h-pending-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["h2h-active-challenges"] });
    },
  });

  // Respond to challenge mutation - sets accepted_at for fair start
  const respondChallengeMutation = useMutation({
    mutationFn: async ({ challengeId, accept, challenge }: { challengeId: string; accept: boolean; challenge?: any }) => {
      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from("h2h_challenges")
        .update({ 
          status: accept ? "accepted" : "declined",
          responded_at: acceptedAt,
          accepted_at: accept ? acceptedAt : null
        })
        .eq("id", challengeId);
      if (error) throw error;
      
      if (accept && challenge) {
        return { acceptedAt, challenge };
      }
      return null;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["h2h-pending-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["h2h-active-challenges"] });
      if (data?.acceptedAt && data?.challenge) {
        setMatchStartTime(data.acceptedAt);
        setActiveChallengeId(data.challenge.id);
        setPeriod(data.challenge.period as PeriodType);
        setBattleMode(data.challenge.battle_mode as BattleMode);
        setMatchComment(data.challenge.comment || "");
        setMatchStarted(true);
      }
    },
  });

  // Forfeit/withdraw mutation
  const forfeitMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from("h2h_challenges")
        .update({ 
          forfeited_at: new Date().toISOString(),
          forfeited_by: currentEmployeeId
        })
        .eq("id", challengeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["h2h-active-challenges"] });
      toast.info("Du har trukket dig fra duellen");
      // Reset local state if this was the selected battle
      if (activeChallengeId) {
        setMatchStarted(false);
        setActiveChallengeId(null);
        setMatchStartTime(null);
        setOpponentTeam([]);
      }
    },
  });

  // Sync active challenge from database to local state on mount
  useEffect(() => {
    if (!currentEmployeeId) return;
    
    // If we have active challenges in DB but no local activeChallengeId, sync from DB
    if (activeChallenges.length > 0 && !activeChallengeId) {
      const activeChallenge = activeChallenges[0];
      const isChallenger = activeChallenge.challenger_employee_id === currentEmployeeId;
      const opponentId = isChallenger 
        ? activeChallenge.opponent_employee_id 
        : activeChallenge.challenger_employee_id;
      
      setActiveChallengeId(activeChallenge.id);
      setOpponentTeam([opponentId]);
      setMatchStartTime(activeChallenge.accepted_at);
      setPeriod(activeChallenge.period as PeriodType);
      setBattleMode(activeChallenge.battle_mode as BattleMode);
      setMatchComment(activeChallenge.comment || "");
      setMatchStarted(true);
    }
    
    // Validate: If localStorage says match is active but no active challenge in DB, clear stale state
    if (matchStarted && activeChallenges.length === 0 && activeChallengeId) {
      setMatchStarted(false);
      setActiveChallengeId(null);
      setMatchStartTime(null);
      setOpponentTeam([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeChallenges, currentEmployeeId, activeChallengeId, matchStarted]);

  // Persist state to localStorage
  useEffect(() => {
    const state: StoredBattleState = {
      battleMode,
      myTeam,
      opponentTeam,
      period,
      matchStarted,
      matchComment,
      activeChallengeId: activeChallengeId ?? undefined,
      matchStartTime: matchStartTime ?? undefined,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save battle state:", e);
    }
  }, [battleMode, myTeam, opponentTeam, period, matchStarted, matchComment, activeChallengeId, matchStartTime]);

  // Calculate date range based on period - uses matchStartTime for fair start
  const dateRange = useMemo(() => {
    const now = new Date();
    
    // If match is active and we have a start time, use that as the start
    if (matchStarted && matchStartTime) {
      const startTime = new Date(matchStartTime);
      const endTime = period === "today" 
        ? endOfDay(startTime) 
        : endOfWeek(startTime, { weekStartsOn: 1 });
      return { 
        start: startTime, 
        end: endTime, 
        label: period === "today" ? "I dag" : "Denne uge" 
      };
    }
    
    // Default behavior for preview/no active match
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now), label: "I dag" };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: "Denne uge" };
      default:
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: "Denne uge" };
    }
  }, [period, matchStarted, matchStartTime]);

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

  // Fetch all employees for selection with team info (excluding Stab employees)
  const { data: employees = [] } = useQuery({
    queryKey: ["h2h-employees"],
    queryFn: async (): Promise<EmployeeForH2H[]> => {
      // Use secure view that only exposes non-sensitive columns
      const { data: employeesData } = await supabase
        .from("employee_basic_info")
        .select(`
          id, 
          first_name, 
          last_name,
          team_id
        `)
        .order("first_name");
      
      // Get team names separately
      const teamIds = [...new Set((employeesData || []).map(e => e.team_id).filter(Boolean))];
      const { data: teams } = teamIds.length > 0 
        ? await supabase.from("teams").select("id, name").in("id", teamIds)
        : { data: [] };
      
      const teamMap = new Map((teams || []).map(t => [t.id, t.name]));
      
      return (employeesData || [])
        .map(emp => ({
          id: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          teamName: emp.team_id ? teamMap.get(emp.team_id) || null : null
        }))
        // Exclude Stab employees from duel opponents
        .filter(emp => emp.teamName !== "Stab");
    },
  });

  // Get team member names from employee IDs
  const getTeamNames = (employeeIds: string[]) => {
    return employeeIds.map(id => employees.find(e => e.id === id)?.name).filter(Boolean) as string[];
  };

  const myTeamNames = useMemo(() => {
    const names = [currentEmployeeName, ...getTeamNames(myTeam)].filter(Boolean) as string[];
    return names;
  }, [currentEmployeeName, myTeam, employees]);

  // Fix: Use challenge data for opponent name when match is active
  const opponentTeamNames = useMemo(() => {
    // If we have an active challenge, use its opponent data for correct name
    if (activeChallengeId && activeChallenges.length > 0) {
      const challenge = activeChallenges.find(c => c.id === activeChallengeId);
      if (challenge) {
        const isChallenger = challenge.challenger_employee_id === currentEmployeeId;
        const opponent = isChallenger ? (challenge as any).opponent : (challenge as any).challenger;
        if (opponent) {
          return [`${opponent.first_name} ${opponent.last_name}`];
        }
      }
    }
    return getTeamNames(opponentTeam);
  }, [opponentTeam, employees, activeChallengeId, activeChallenges, currentEmployeeId]);

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
      const calculateTeamStats = (teamNames: string[]): TeamStats => {
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
            const qty = item.quantity || 1;
            // Use products.revenue_dkk (base) × qty, or mapped_revenue directly (already includes qty)
            const rev = (item.products as any)?.revenue_dkk 
              ? qty * Number((item.products as any).revenue_dkk)
              : (Number((item as any).mapped_revenue) || 0);
            return itemSum + rev;
          }, 0) || 0);
        }, 0);

        const commission = teamSales.reduce((sum, s) => {
          return sum + (s.sale_items?.reduce((itemSum, item) => {
            const qty = item.quantity || 1;
            // Use products.commission_dkk (base) × qty, or mapped_commission directly (already includes qty)
            const comm = (item.products as any)?.commission_dkk 
              ? qty * Number((item.products as any).commission_dkk)
              : (Number(item.mapped_commission) || 0);
            return itemSum + comm;
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

  // Trigger confetti on lead changes
  useEffect(() => {
    if (!stats?.myTeam || !stats?.opponentTeam || !hasOpponents) return;
    
    const prev = prevCommissionRef.current;
    const myComm = stats.myTeam.commission;
    const oppComm = stats.opponentTeam.commission;
    
    if (prev) {
      // Detect lead taken
      const wasLosing = prev.my < prev.opponent;
      const nowWinning = myComm > oppComm;
      
      if (wasLosing && nowWinning) {
        setConfettiType("lead_taken");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 100);
      }
      
      // Detect big sale (commission jumped by 300+)
      const myCommDiff = myComm - prev.my;
      if (myCommDiff >= 300) {
        setShowSparkles(true);
        setTimeout(() => setShowSparkles(false), 100);
      }
    }
    
    prevCommissionRef.current = { my: myComm, opponent: oppComm };
  }, [stats?.myTeam?.commission, stats?.opponentTeam?.commission, hasOpponents]);

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

  const availableForMyTeam = employees.filter(e => 
    e.name !== currentEmployeeName && 
    !myTeam.includes(e.id) && 
    !opponentTeam.includes(e.id)
  );

  const availableForOpponentTeam = employees.filter(e => 
    e.name !== currentEmployeeName && 
    !myTeam.includes(e.id) && 
    !opponentTeam.includes(e.id)
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
        <div className="flex items-center justify-between gap-2">
          {/* Left value */}
          <div className={`min-w-[100px] flex items-center justify-end gap-1.5 transition-all duration-500 ${
            winner === 'left' ? 'scale-[1.02]' : ''
          }`}>
            {winner === 'left' && (
              <div className="relative shrink-0">
                <Trophy className="w-4 h-4 text-amber-400" />
                <div className="absolute inset-0 animate-ping">
                  <Trophy className="w-4 h-4 text-amber-400/50" />
                </div>
              </div>
            )}
            <span className={`font-bold text-sm tabular-nums whitespace-nowrap transition-colors duration-300 ${
              winner === 'left' ? 'text-emerald-400' : 
              winner === 'tie' ? 'text-amber-300' : 
              'text-slate-400'
            }`}>
              {formatFn(leftValue)}
            </span>
          </div>
          
          {/* Center label with icon */}
          <div className={`shrink-0 flex items-center justify-center gap-2 px-3 py-2 rounded-xl min-w-[110px] transition-all duration-300 ${
            winner === 'left' ? 'bg-emerald-500/10 border border-emerald-500/30' :
            winner === 'right' ? 'bg-rose-500/10 border border-rose-500/30' :
            winner === 'tie' ? 'bg-amber-500/10 border border-amber-500/30' :
            'bg-slate-800/50 border border-slate-700/50'
          }`}>
            <Icon className={`w-4 h-4 shrink-0 ${
              winner === 'left' ? 'text-emerald-400' :
              winner === 'right' ? 'text-rose-400' :
              winner === 'tie' ? 'text-amber-400' :
              'text-slate-400'
            }`} />
            <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{label}</span>
          </div>
          
          {/* Right value */}
          <div className={`min-w-[100px] flex items-center gap-1.5 transition-all duration-500 ${
            winner === 'right' ? 'scale-[1.02]' : ''
          }`}>
            <span className={`font-bold text-sm tabular-nums whitespace-nowrap transition-colors duration-300 ${
              winner === 'right' ? 'text-emerald-400' : 
              winner === 'tie' ? 'text-amber-300' : 
              'text-slate-400'
            }`}>
              {formatFn(rightValue)}
            </span>
            {winner === 'right' && (
              <div className="relative shrink-0">
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
          <div className="ml-auto flex items-center gap-2">
            {/* Active battles count */}
            {activeChallenges.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <span className="text-[10px] font-medium text-emerald-400">{activeChallenges.length} aktiv{activeChallenges.length > 1 ? 'e' : ''}</span>
              </div>
            )}
            
            {/* Pending challenges notification */}
            {pendingChallenges.length > 0 && (
              <button
                onClick={() => setShowPendingChallenges(!showPendingChallenges)}
                className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-5">
                  {pendingChallenges.length}
                </Badge>
              </button>
            )}

            {/* Forfeit button - only when match is ongoing */}
            {isMatchOngoing && activeChallengeId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Er du sikker på at du vil trække dig? Det tæller som et tab.")) {
                    forfeitMutation.mutate(activeChallengeId);
                  }
                }}
                className="h-9 bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/40 text-rose-400"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Træk dig
              </Button>
            )}

            {/* New battle button - always show to allow multiple battles */}
            <Button
              size="sm"
              onClick={() => setShowSetupDialog(true)}
              className="h-9 bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ny duel
            </Button>
            
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

            {/* Hide button */}
            {onHide && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onHide}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <EyeOff className="w-4 h-4 mr-1" />
                Skjul
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative space-y-5 z-10 text-white">
        {/* Pending challenges dropdown */}
        {showPendingChallenges && pendingChallenges.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-800/80 border border-amber-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-400">Modtagne udfordringer</h4>
              <button onClick={() => setShowPendingChallenges(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {pendingChallenges.map((challenge: any) => (
              <div key={challenge.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600/30">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-white">
                    {challenge.challenger?.first_name} {challenge.challenger?.last_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {challenge.period === 'today' ? 'I dag' : 'Denne uge'} • {challenge.battle_mode}
                    {challenge.comment && ` • "${challenge.comment}"`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/40 text-emerald-400"
                    onClick={() => {
                      respondChallengeMutation.mutate({ 
                        challengeId: challenge.id, 
                        accept: true,
                        challenge: challenge 
                      });
                      toast.success("⚔️ Duel startet! Begge starter på 0-0");
                      setShowPendingChallenges(false);
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/40 text-rose-400"
                    onClick={() => {
                      respondChallengeMutation.mutate({ challengeId: challenge.id, accept: false });
                      toast.info("Udfordring afvist");
                      setShowPendingChallenges(false);
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Battles List - when multiple battles exist */}
        {activeChallenges.length > 1 && (
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-2">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Dine aktive dueller</h4>
            <div className="flex flex-wrap gap-2">
              {activeChallenges.map((challenge: any) => {
                const isChallenger = challenge.challenger_employee_id === currentEmployeeId;
                const opponentData = isChallenger ? challenge.opponent : challenge.challenger;
                const isSelected = challenge.id === activeChallengeId;
                
                return (
                  <button
                    key={challenge.id}
                    onClick={() => {
                      setActiveChallengeId(challenge.id);
                      setMatchStartTime(challenge.accepted_at);
                      setPeriod(challenge.period as PeriodType);
                      setBattleMode(challenge.battle_mode as BattleMode);
                      setMatchStarted(true);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      isSelected 
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                        : "bg-slate-700/50 border-slate-600/50 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <Swords className="w-3 h-3" />
                    <span className="text-sm font-medium">
                      vs {opponentData?.first_name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {challenge.period === 'today' ? 'i dag' : 'uge'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Confetti & Sparkle Effects */}
        <H2HConfettiEffect trigger={showConfetti} type={confettiType} />
        <SparkleEffect trigger={showSparkles} />

        {/* Enhanced Countdown Timer */}
        {hasOpponents && (
          <MatchCountdownTimer 
            endTime={dateRange.end} 
            periodLabel={dateRange.label} 
            percentComplete={timeInfo.percentComplete} 
          />
        )}

        {/* Live Scoreboard - Main attraction */}
        {hasOpponents && stats?.opponentTeam && (
          <LiveScoreboard
            myCommission={stats.myTeam.commission}
            opponentCommission={stats.opponentTeam.commission}
            myName={myTeamNames.length === 1 ? myTeamNames[0] : "Dit hold"}
            opponentName={opponentTeamNames.length === 1 ? opponentTeamNames[0] : "Modstander"}
            isLeading={isWinning}
            isLosing={isLosing}
            isTied={isTied}
          />
        )}

        {/* Achievement Badges */}
        {hasOpponents && stats?.opponentTeam && (
          <H2HAchievementBadges
            isLeading={isWinning}
            isLosing={isLosing}
            hasMoreCalls={stats.myTeam.callCount > stats.opponentTeam.callCount}
            hasMoreTalkTime={stats.myTeam.talkTimeSeconds > stats.opponentTeam.talkTimeSeconds}
            consecutiveWins={wins.left}
            commissionPerSale={{
              my: stats.myTeam.salesCount > 0 ? stats.myTeam.commission / stats.myTeam.salesCount : 0,
              opponent: stats.opponentTeam.salesCount > 0 ? stats.opponentTeam.commission / stats.opponentTeam.salesCount : 0,
            }}
            callsRatio={stats.opponentTeam.callCount > 0 ? stats.myTeam.callCount / stats.opponentTeam.callCount : 1}
            recentActivityRatio={momentum / 100}
          />
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

        {/* Enhanced Momentum Bar */}
        {hasOpponents && stats?.recentActivity && (
          <EnhancedMomentumBar
            momentum={momentum}
            myName={myTeamNames.length === 1 ? myTeamNames[0] : "Dig"}
            opponentName={opponentTeamNames.length === 1 ? opponentTeamNames[0] : "Modstander"}
            myRecentActivity={stats.recentActivity.my}
            opponentRecentActivity={stats.recentActivity.opponent}
          />
        )}

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
                    const emp = employees.find(e => e.id === id);
                    if (!emp) return null;
                    return (
                      <TeamMemberBadge 
                        key={id} 
                        name={emp.name}
                        teamName={emp.teamName}
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
          <div className="text-center relative pt-2 flex flex-col items-center">
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
                  teamName={opponentTeam.length === 1 ? employees.find(e => e.id === opponentTeam[0])?.teamName : null}
                />
                
                {/* Opponent team members */}
                {battleMode === "team" && opponentTeam.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap justify-center gap-1">
                      {opponentTeam.map(id => {
                        const emp = employees.find(e => e.id === id);
                        if (!emp) return null;
                        return (
                          <TeamMemberBadge 
                            key={id} 
                            name={emp.name}
                            teamName={emp.teamName}
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
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center">
                  <Users className="w-8 h-8 text-slate-500" />
                </div>
                <span className="text-xs text-slate-500">Ingen modstander</span>
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

        {/* Match History - Show when no active match */}
        {currentEmployeeId && !matchStarted && (
          <div className="pt-4 border-t border-slate-700/50">
            <H2HMatchHistory employeeId={currentEmployeeId} compact />
          </div>
        )}

        {/* No opponent selected - show Start Duel button */}
        {!hasOpponents && !matchStarted && (
          <div className="text-center py-6">
            <Button 
              onClick={() => setShowSetupDialog(true)}
              className="h-14 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all text-base"
            >
              <Swords className="w-5 h-5 mr-2" />
              Start ny duel
            </Button>
            <p className="text-slate-500 text-xs mt-3">Vælg modstander, periode og indsats i ét trin</p>
          </div>
        )}

        {/* Match in progress */}
        {matchStarted && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-300 font-medium">Kamp i gang • {dateRange.label}</span>
            </div>
            <button 
              onClick={() => {
                setMatchStarted(false);
                setOpponentTeam([]);
                setMyTeam([]);
                setMatchComment("");
                setMatchStartTime(null);
                setActiveChallengeId(null);
              }}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors py-1"
            >
              Afslut kamp
            </button>
          </div>
        )}
      </CardContent>

      {/* Setup Dialog - All options in one place */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Swords className="w-5 h-5 text-amber-400" />
              Start ny duel
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Vælg modstander, periode og evt. indsats
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 pt-4">
            {/* Opponent Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Modstander</label>
              <Select value={setupOpponent} onValueChange={setSetupOpponent}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Vælg modstander" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {employees.filter(e => e.name !== currentEmployeeName).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <span>{emp.name}</span>
                        {emp.teamName && (
                          <span className="text-xs text-slate-500">({emp.teamName})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Kampperiode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSetupPeriod("today")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    setupPeriod === "today" 
                      ? "bg-blue-500/20 border-blue-400/50 text-blue-400" 
                      : "bg-slate-800/50 border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <CalendarDays className="w-5 h-5" />
                  <span className="text-xs font-medium">I dag</span>
                  <span className="text-[9px] text-slate-500">Til midnat</span>
                </button>
                <button
                  onClick={() => setSetupPeriod("week")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    setupPeriod === "week" 
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400" 
                      : "bg-slate-800/50 border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <CalendarRange className="w-5 h-5" />
                  <span className="text-xs font-medium">Denne uge</span>
                  <span className="text-[9px] text-slate-500">Til søndag</span>
                </button>
                <button
                  onClick={() => setSetupPeriod("target")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    setupPeriod === "target" 
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-400" 
                      : "bg-slate-800/50 border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <Target className="w-5 h-5" />
                  <span className="text-xs font-medium">Først til mål</span>
                  <span className="text-[9px] text-slate-500">Provision</span>
                </button>
              </div>
              
              {/* Target commission input */}
              {setupPeriod === "target" && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                  <label className="text-xs font-medium text-amber-300 block mb-2">
                    Provisionsmål (DKK)
                  </label>
                  <Input
                    type="number"
                    min={100}
                    step={100}
                    value={setupTargetCommission}
                    onChange={(e) => setSetupTargetCommission(parseInt(e.target.value) || 1000)}
                    className="bg-slate-800 border-amber-500/30 text-white text-center font-bold"
                    placeholder="1000"
                  />
                  <p className="text-[10px] text-amber-400/70 mt-1 text-center">
                    Første til {setupTargetCommission.toLocaleString()} kr i provision vinder!
                  </p>
                </div>
              )}
            </div>

            {/* Comment/Stake */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Indsats (valgfrit)</label>
              <Input
                value={setupComment}
                onChange={(e) => setSetupComment(e.target.value)}
                placeholder="fx 'Taberen giver kaffe'"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                maxLength={50}
              />
            </div>

            {/* Send Button */}
            <Button 
              onClick={async () => {
                if (!setupOpponent) {
                  toast.error("Vælg en modstander først");
                  return;
                }
                
                const opponent = employees.find(e => e.id === setupOpponent);
                
                if (setupOpponent && currentEmployeeId) {
                  try {
                    await createChallengeMutation.mutateAsync({
                      opponentId: setupOpponent,
                      battleMode: battleMode,
                      period: setupPeriod,
                      comment: setupComment,
                      targetCommission: setupPeriod === "target" ? setupTargetCommission : undefined
                    });
                    const periodText = setupPeriod === "target" 
                      ? `Først til ${setupTargetCommission.toLocaleString()} kr!` 
                      : setupPeriod === "today" ? "i dag" : "denne uge";
                    toast.success(`⚔️ Invitation sendt!`, {
                      description: `${opponent?.name} vil modtage din udfordring (${periodText}). Duellen starter når de accepterer.`
                    });
                    
                    // Only set up local state if no match is currently active
                    // This allows multiple pending challenges
                    if (!isMatchOngoing) {
                      setOpponentTeam([setupOpponent]);
                      setPeriod(setupPeriod);
                      setMatchStartTime(new Date().toISOString());
                      setMatchStarted(true);
                    }
                    
                    setShowSetupDialog(false);
                    
                    // Reset setup state
                    setSetupOpponent("");
                    setSetupComment("");
                  } catch (error) {
                    console.error("Failed to send challenge:", error);
                    toast.error("Kunne ikke sende invitation");
                  }
                }
              }}
              disabled={!setupOpponent || createChallengeMutation.isPending}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold"
            >
              <Send className="w-4 h-4 mr-2" />
              Send invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
