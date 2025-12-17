import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Building2, Maximize, Minimize, Lock, Link, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

const PIN_CODE = "1234"; // Change this to your desired PIN

const clientColors: Record<string, { bg: string; accent: string; text: string }> = {
  "TDC Erhverv": { bg: "from-violet-600/20 to-violet-900/40", accent: "bg-violet-500", text: "text-violet-300" },
  "CODAN": { bg: "from-emerald-600/20 to-emerald-900/40", accent: "bg-emerald-500", text: "text-emerald-300" },
  "Finansforbundet": { bg: "from-blue-600/20 to-blue-900/40", accent: "bg-blue-500", text: "text-blue-300" },
  "Business DK": { bg: "from-amber-600/20 to-amber-900/40", accent: "bg-amber-500", text: "text-amber-300" },
  "Tryg": { bg: "from-rose-600/20 to-rose-900/40", accent: "bg-rose-500", text: "text-rose-300" },
  "Yousee": { bg: "from-cyan-600/20 to-cyan-900/40", accent: "bg-cyan-500", text: "text-cyan-300" },
  "Relatel": { bg: "from-orange-600/20 to-orange-900/40", accent: "bg-orange-500", text: "text-orange-300" },
  "Ase": { bg: "from-pink-600/20 to-pink-900/40", accent: "bg-pink-500", text: "text-pink-300" },
  "AKA": { bg: "from-indigo-600/20 to-indigo-900/40", accent: "bg-indigo-500", text: "text-indigo-300" },
  "A&Til": { bg: "from-teal-600/20 to-teal-900/40", accent: "bg-teal-500", text: "text-teal-300" },
  "eesy FM Gaden": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
  "Eesy FM Marked": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
  "Eesy TM": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
};

const defaultColors = { bg: "from-slate-600/20 to-slate-900/40", accent: "bg-slate-500", text: "text-slate-300" };

interface TopSeller {
  agent_name: string;
  count: number;
}

interface ClientStats {
  client_id: string;
  client_name: string;
  sales_today: number;
  sales_month: number;
  revenue_today: number;
  revenue_month: number;
  commission_today: number;
  commission_month: number;
  top_sellers: TopSeller[];
}

export default function SalesDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check sessionStorage for existing unlock
  useEffect(() => {
    const unlocked = sessionStorage.getItem("sales-dashboard-unlocked");
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handlePinComplete = (value: string) => {
    if (value === PIN_CODE) {
      setIsUnlocked(true);
      sessionStorage.setItem("sales-dashboard-unlocked", "true");
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  const { data: clientStats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["sales-dashboard-tv"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_sales_stats");
      if (error) throw error;
      return (data || []).map((item: any) => ({
        client_id: item.client_id,
        client_name: item.client_name,
        sales_today: item.sales_today,
        sales_month: item.sales_month,
        revenue_today: item.revenue_today,
        revenue_month: item.revenue_month,
        commission_today: item.commission_today,
        commission_month: item.commission_month,
        top_sellers: (item.top_sellers || []).map((s: any) => ({
          agent_name: s.name,
          count: s.count,
        })) as TopSeller[],
      })) as ClientStats[];
    },
    refetchInterval: 30000,
    staleTime: 0,
    enabled: isUnlocked,
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("da-DK") : "";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const allClients = [...(clientStats || [])].sort((a, b) => b.sales_month - a.sales_month);
  const totalSalesToday = allClients.reduce((sum, c) => sum + c.sales_today, 0);
  const totalSalesMonth = allClients.reduce((sum, c) => sum + c.sales_month, 0);
  const totalRevenueMonth = allClients.reduce((sum, c) => sum + c.revenue_month, 0);

  // PIN Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700">
              <Lock className="w-10 h-10 text-slate-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Sales Dashboard</h1>
            <p className="text-slate-400">Indtast PIN-kode for at fortsætte</p>
          </div>
          <div className="flex justify-center">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(value) => {
                setPin(value);
                setError(false);
                if (value.length === 4) {
                  handlePinComplete(value);
                }
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-14 h-14 text-2xl bg-slate-800 border-slate-700 text-white" />
                <InputOTPSlot index={1} className="w-14 h-14 text-2xl bg-slate-800 border-slate-700 text-white" />
                <InputOTPSlot index={2} className="w-14 h-14 text-2xl bg-slate-800 border-slate-700 text-white" />
                <InputOTPSlot index={3} className="w-14 h-14 text-2xl bg-slate-800 border-slate-700 text-white" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <p className="text-red-400 text-sm">Forkert PIN-kode. Prøv igen.</p>
          )}
        </div>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-[5%] flex flex-col overflow-hidden box-border">
      {/* Compact Header */}
      <header className="flex-shrink-0 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 px-4 py-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/images/cph-sales-logo-light.png" 
              alt="Copenhagen Sales" 
              className="h-8"
            />
            <h1 className="text-lg font-bold">Sales Dashboard</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">I dag</p>
              <p className="text-2xl font-bold text-emerald-400">{isLoading ? "..." : totalSalesToday}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Denne måned</p>
              <p className="text-2xl font-bold">{isLoading ? "..." : totalSalesMonth}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">
                {currentTime.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-slate-400 text-[10px]">
                {currentTime.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 border-slate-700 bg-slate-800/50 hover:bg-slate-700"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Client cards grid */}
      {isLoading ? (
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 flex-1 min-h-0">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 flex-1 min-h-0 overflow-hidden">
          {allClients.map((client, index) => {
            const colors = clientColors[client.client_name] || defaultColors;
            
            return (
              <div 
                key={client.client_id} 
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colors.bg} backdrop-blur-sm border border-white/10 p-2 lg:p-3 flex flex-col min-h-0`}
              >
                {/* Accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${colors.accent}`} />
                
                {/* Rank badge */}
                {index < 3 && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className="text-[10px] px-1.5 py-0 font-bold bg-black/50 backdrop-blur border-0">
                      #{index + 1}
                    </Badge>
                  </div>
                )}
                
                {/* Header */}
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg ${colors.accent} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Building2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm lg:text-base font-bold truncate">{client.client_name}</h3>
                    <p className={`text-[10px] ${colors.text} truncate`}>
                      {formatCurrency(client.revenue_month)}
                    </p>
                  </div>
                </div>
                
                {/* Sales stats */}
                <div className="grid grid-cols-2 gap-1.5 mb-2 flex-shrink-0">
                  <div className="bg-black/20 backdrop-blur rounded-lg p-1.5 text-center">
                    <p className="text-[8px] text-slate-400 uppercase">I dag</p>
                    <p className="text-lg lg:text-xl font-bold">{client.sales_today}</p>
                  </div>
                  <div className="bg-black/20 backdrop-blur rounded-lg p-1.5 text-center">
                    <p className="text-[8px] text-slate-400 uppercase">Måned</p>
                    <p className="text-lg lg:text-xl font-bold">{client.sales_month}</p>
                  </div>
                </div>
                
                {/* Top sellers - show top 3 with medals */}
                {client.top_sellers && client.top_sellers.length > 0 && (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 mb-0.5">
                      <Trophy className="w-2.5 h-2.5 text-amber-400" />
                      <span>Top</span>
                    </div>
                    <div className="space-y-0.5">
                      {client.top_sellers.slice(0, 3).map((seller, i) => (
                        <div 
                          key={`${client.client_id}-${seller.agent_name}-${i}`}
                          className="flex items-center justify-between bg-black/20 rounded px-1 py-0.5 text-[10px]"
                        >
                          <div className="flex items-center gap-0.5 min-w-0">
                            <span className="text-[8px]">{medals[i]}</span>
                            <span className="truncate">{seller.agent_name}</span>
                          </div>
                          <span className="font-semibold text-[8px] flex-shrink-0 ml-0.5">{seller.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-2 text-center text-slate-500 text-xs flex-shrink-0">
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Live opdatering hvert 30. sekund
          {lastUpdated && <span className="ml-2">• Opdateret: {lastUpdated}</span>}
          <span className="ml-2">• v2.2</span>
        </div>
      </footer>
    </div>
  );
}
