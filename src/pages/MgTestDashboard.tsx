import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, Building2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TvPreviewOverlay } from "@/components/tv-preview/TvPreviewOverlay";

// Client brand colors for visual distinction
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

export default function MgTestDashboard() {
  const { data: clientStats, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["mg-test-dashboard-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_sales_stats");
      if (error) throw error;
      
      // Map the response to properly type top_sellers
      return (data || []).map((item: any) => ({
        client_id: item.client_id,
        client_name: item.client_name,
        sales_today: item.sales_today,
        sales_month: item.sales_month,
        revenue_today: item.revenue_today,
        revenue_month: item.revenue_month,
        commission_today: item.commission_today,
        commission_month: item.commission_month,
        top_sellers: (item.top_sellers || []) as TopSeller[],
      })) as ClientStats[];
    },
    refetchInterval: 30000,
    staleTime: 0, // Always consider data stale to ensure fresh fetches
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("da-DK") : "";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sort by sales this month descending
  const allClients = [...(clientStats || [])].sort((a, b) => b.sales_month - a.sales_month);
  const totalSalesToday = allClients.reduce((sum, c) => sum + c.sales_today, 0);
  const totalSalesMonth = allClients.reduce((sum, c) => sum + c.sales_month, 0);

  return (
    <MainLayout>
      <TvPreviewOverlay>
      <div className="h-full flex flex-col p-[5%] overflow-hidden box-border">
        {/* Compact Header */}
        <div className="flex-shrink-0 rounded-xl bg-gradient-to-r from-primary/10 to-background border border-primary/20 px-4 py-2 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold">Test Dashboard</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-6 px-2"
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground">Opdateret: {lastUpdated}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">I dag</p>
                <p className="text-xl font-bold text-primary">{isLoading ? "..." : totalSalesToday}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Denne måned</p>
                <p className="text-xl font-bold">{isLoading ? "..." : totalSalesMonth}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client cards grid - fills remaining space */}
        {isLoading ? (
          <div className="grid gap-1.5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 flex-1 min-h-0">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="animate-pulse min-h-0">
                <CardContent className="p-2">
                  <div className="h-3 bg-muted rounded w-1/2 mb-1" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-1.5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 flex-1 min-h-0 overflow-hidden">
            {allClients.map((client, index) => {
              const colors = clientColors[client.client_name] || defaultColors;
              const medals = ["🥇", "🥈", "🥉"];
              
              return (
                <Card 
                  key={client.client_id} 
                  className={`relative overflow-hidden border-0 bg-gradient-to-br ${colors.bg} backdrop-blur-sm min-h-0 flex flex-col`}
                >
                  {/* Accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${colors.accent}`} />
                  
                  {/* Rank badge */}
                  {index < 3 && (
                    <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] px-1 py-0 font-bold bg-background/80">
                      #{index + 1}
                    </Badge>
                  )}
                  
                  <CardContent className="p-2 space-y-1 flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Client name and revenue */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-6 h-6 rounded ${colors.accent} flex items-center justify-center flex-shrink-0`}>
                        <Building2 className="w-3 h-3 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{client.client_name}</p>
                        <p className={`text-[10px] ${colors.text}`}>{formatCurrency(client.revenue_month)}</p>
                      </div>
                    </div>
                    
                    {/* Sales stats - compact */}
                    <div className="grid grid-cols-2 gap-1 flex-shrink-0">
                      <div className="bg-background/30 rounded px-1.5 py-1 text-center">
                        <p className="text-[8px] text-muted-foreground uppercase">I dag</p>
                        <p className="text-sm font-bold leading-tight">{client.sales_today}</p>
                      </div>
                      <div className="bg-background/30 rounded px-1.5 py-1 text-center">
                        <p className="text-[8px] text-muted-foreground uppercase">Måned</p>
                        <p className="text-sm font-bold leading-tight">{client.sales_month}</p>
                      </div>
                    </div>
                    
                    {/* Top sellers - compact list */}
                    {client.top_sellers && client.top_sellers.length > 0 && (
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
                          <Trophy className="w-2.5 h-2.5" />
                          <span>Top</span>
                        </div>
                        <div className="space-y-0.5">
                          {client.top_sellers.slice(0, 3).map((seller, i) => (
                            <div 
                              key={`${client.client_id}-${seller.agent_name}-${i}`} 
                              className="flex items-center justify-between bg-background/20 rounded px-1 py-0.5 text-[10px]"
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allClients.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <h3 className="text-sm font-medium">Ingen salgsdata fundet</h3>
          </div>
        )}
      </div>
      </TvPreviewOverlay>
    </MainLayout>
  );
}
