import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Users, TrendingUp, Target, Activity, Trophy, Medal } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface TopSeller {
  name: string;
  commission: number;
  rank: number;
}

interface RecentSale {
  id: string;
  agent_name: string;
  sale_datetime: string;
  status: string | null;
  client_name: string;
  commission?: number;
}

interface TvDashboardData {
  date: string;
  timestamp: string;
  sales: {
    total: number;
    confirmed: number;
    pending: number;
    byClient: Record<string, { count: number; logoUrl: string | null }>;
    recent: RecentSale[];
  };
  employees: {
    active: number;
    staff: number;
  };
  calls: {
    today: number;
  };
  sellersOnBoard: number;
  topSellers: TopSeller[];
  clientLogos?: Record<string, string | null>;
}

// Check if we're in TV mode (accessed via /tv route with sessionStorage code)
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') || sessionStorage.getItem('tv_board_code') !== null;
};

export default function CphSalesDashboard() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tvMode = isTvMode();

  // Use edge function for TV mode (bypasses RLS)
  const { data: tvData } = useQuery<TvDashboardData>({
    queryKey: ["tv-dashboard-data", todayStr],
    queryFn: async () => {
      const response = await supabase.functions.invoke('tv-dashboard-data', {
        body: null,
        method: 'GET',
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

  // Regular authenticated queries for non-TV mode
  const { data: todaySalesData } = useQuery({
    queryKey: ["cph-dashboard-today-sales", todayStr],
    queryFn: async () => {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, agent_name, sale_datetime, status, client_campaign_id,
          sale_items (
            quantity,
            product_id,
            mapped_commission,
            products (counts_as_sale)
          )
        `)
        .gte("sale_datetime", startOfDay)
        .lte("sale_datetime", endOfDay)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const campaignIds = [...new Set((data || []).map(s => s.client_campaign_id).filter(Boolean))] as string[];
      let campaignClientMap: Record<string, string> = {};
      let clientLogoMap: Record<string, string | null> = {};
      
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id, name, client_id")
          .in("id", campaignIds);
        
        const clientIds = [...new Set((campaigns || []).map(c => c.client_id).filter(Boolean))];
        let clientMap: Record<string, string> = {};
        
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name, logo_url")
            .in("id", clientIds);
          clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.name]));
          clientLogoMap = Object.fromEntries((clients || []).map(c => [c.name, c.logo_url]));
        }
        
        campaignClientMap = Object.fromEntries(
          (campaigns || []).map(c => [c.id, clientMap[c.client_id] || "Ukendt"])
        );
      }
      
      return {
        sales: (data || []).map(s => ({
          ...s,
          client_name: s.client_campaign_id ? campaignClientMap[s.client_campaign_id] || "Ukendt" : "Ukendt"
        })),
        clientLogos: clientLogoMap
      };
    },
    enabled: !tvMode,
    refetchInterval: 30000,
  });

  const todaySales = todaySalesData?.sales || [];
  const clientLogos = todaySalesData?.clientLogos || {};

  // Fetch active employees count for display
  const { data: activeEmployees = 0 } = useQuery({
    queryKey: ["cph-dashboard-active-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  // Filter out sales with unknown clients
  const knownClientSales = todaySales.filter(sale => 
    sale.client_name && sale.client_name !== "Ukendt"
  );

  // Calculate counted sales (only products with counts_as_sale = true)
  const calculateCountedSales = (sales: typeof todaySales) => {
    return sales.reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  const calculateSalesByClient = (sales: typeof todaySales) => {
    const result: Record<string, number> = {};
    for (const sale of sales) {
      const saleItems = (sale as any).sale_items || [];
      let saleCount = 0;
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          saleCount += item.quantity || 1;
        }
      }
      if (saleCount > 0) {
        const clientName = sale.client_name;
        if (clientName && clientName !== "Ukendt") {
          result[clientName] = (result[clientName] || 0) + saleCount;
        }
      }
    }
    return result;
  };

  const calculateConfirmedSales = (sales: typeof todaySales) => {
    return sales.filter((s: any) => s.status === "confirmed").reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  const calculatePendingSales = (sales: typeof todaySales) => {
    return sales.filter((s: any) => s.status === "pending").reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  // Calculate sellers on board (unique sellers with at least 1 sale)
  const calculateSellersOnBoard = (sales: typeof todaySales) => {
    const sellersWithSales = new Set<string>();
    for (const sale of sales) {
      const saleItems = (sale as any).sale_items || [];
      const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
      if (hasCountedSale && sale.agent_name) {
        sellersWithSales.add(sale.agent_name.toLowerCase());
      }
    }
    return sellersWithSales.size;
  };

  // Calculate top 20 sellers by commission
  const calculateTopSellers = (sales: typeof todaySales): TopSeller[] => {
    const sellerCommission = new Map<string, number>();
    
    for (const sale of sales) {
      const agentName = sale.agent_name || "Ukendt";
      const saleItems = (sale as any).sale_items || [];
      
      const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
      if (!hasCountedSale) continue;
      
      const commission = saleItems.reduce(
        (sum: number, item: any) => sum + (item.mapped_commission || 0), 0
      );
      
      sellerCommission.set(
        agentName.toLowerCase(), 
        (sellerCommission.get(agentName.toLowerCase()) || 0) + commission
      );
    }
    
    const nameMap = new Map<string, string>();
    for (const sale of sales) {
      if (sale.agent_name) {
        nameMap.set(sale.agent_name.toLowerCase(), sale.agent_name);
      }
    }
    
    return Array.from(sellerCommission.entries())
      .map(([lowerName, commission]) => ({ 
        name: nameMap.get(lowerName) || lowerName, 
        commission,
        rank: 0
      }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 20)
      .map((seller, index) => ({ ...seller, rank: index + 1 }));
  };

  // Calculate recent sales with commission
  const calculateRecentSalesWithCommission = (sales: typeof todaySales): RecentSale[] => {
    return sales
      .filter(sale => sale.client_name && sale.client_name !== "Ukendt")
      .map(sale => {
        const saleItems = (sale as any).sale_items || [];
        const commission = saleItems.reduce(
          (sum: number, item: any) => sum + (item.mapped_commission || 0), 0
        );
        return {
          id: sale.id,
          agent_name: sale.agent_name,
          sale_datetime: sale.sale_datetime,
          status: sale.status,
          client_name: sale.client_name,
          commission
        };
      })
      .slice(0, 30);
  };

  // Filter TV data to exclude unknown clients
  const filterTvSales = (sales: RecentSale[]) => 
    sales.filter(s => s.client_name && s.client_name !== "Ukendt");
  
  const filterTvSalesByClient = (byClient: Record<string, { count: number; logoUrl: string | null }>) => {
    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, data] of Object.entries(byClient)) {
      if (client !== "Ukendt") {
        result[client] = data;
      }
    }
    return result;
  };

  // Convert regular sales by client to include logo
  const getSalesByClientWithLogos = (): Record<string, { count: number; logoUrl: string | null }> => {
    const byClient = calculateSalesByClient(knownClientSales);
    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, count] of Object.entries(byClient)) {
      result[client] = { 
        count, 
        logoUrl: clientLogos[client] || null 
      };
    }
    return result;
  };

  // Use TV data if in TV mode, otherwise use regular queries
  const displaySales = tvMode && tvData ? filterTvSales(tvData.sales.recent) : calculateRecentSalesWithCommission(knownClientSales);
  const displaySalesTotal = tvMode && tvData ? tvData.sales.total : calculateCountedSales(knownClientSales);
  const displaySalesByClient = tvMode && tvData ? filterTvSalesByClient(tvData.sales.byClient) : getSalesByClientWithLogos();
  const displayConfirmed = tvMode && tvData ? tvData.sales.confirmed : calculateConfirmedSales(knownClientSales);
  const displayPending = tvMode && tvData ? tvData.sales.pending : calculatePendingSales(knownClientSales);
  const displaySellersOnBoard = tvMode && tvData ? tvData.sellersOnBoard : calculateSellersOnBoard(knownClientSales);
  const displayActiveEmployees = tvMode && tvData ? tvData.employees.active : activeEmployees;
  const displayTopSellers = tvMode && tvData ? tvData.topSellers : calculateTopSellers(knownClientSales);

  // Format commission as DKK
  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  // Get rank medal/icon
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className={`font-bold ${tvMode ? 'text-sm' : 'text-base'}`}>{rank}</span>;
  };

  // Client colors for visual distinction
  const clientColors = [
    'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    'from-orange-500/20 to-orange-500/5 border-orange-500/30',
    'from-pink-500/20 to-pink-500/5 border-pink-500/30',
    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30',
  ];

  // Skip layout wrapper in TV mode to avoid lock checks
  const content = (
    <div className={`space-y-4 ${tvMode ? 'space-y-3' : 'space-y-6'}`}>
      <DashboardHeader 
        title="Dagsboard CPH Sales" 
        subtitle={format(today, "EEEE d. MMMM yyyy", { locale: da })}
      />

      {/* Top KPI Row - Compact */}
      <div className={`grid grid-cols-2 ${tvMode ? 'gap-3' : 'gap-4'}`}>
        <Card className={`bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Salg i dag</CardTitle>
            <TrendingUp className={`text-emerald-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-emerald-500 ${tvMode ? 'text-3xl' : 'text-4xl'}`}>{displaySalesTotal}</div>
            <div className={`flex gap-1 ${tvMode ? 'mt-1' : 'mt-2'}`}>
              <Badge variant="secondary" className={`bg-emerald-500/20 text-emerald-600 ${tvMode ? 'text-[10px] px-1.5 py-0' : ''}`}>
                {displayConfirmed} bekræftet
              </Badge>
              {displayPending > 0 && (
                <Badge variant="secondary" className={`bg-amber-500/20 text-amber-600 ${tvMode ? 'text-[10px] px-1.5 py-0' : ''}`}>
                  {displayPending} afventer
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Sælgere på tavlen</CardTitle>
            <Users className={`text-purple-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className="flex items-baseline gap-2">
              <span className={`font-bold text-purple-500 ${tvMode ? 'text-3xl' : 'text-4xl'}`}>{displaySellersOnBoard}</span>
              <span className={`text-muted-foreground ${tvMode ? 'text-sm' : 'text-lg'}`}>
                ({displayActiveEmployees})
              </span>
            </div>
            <p className={`text-muted-foreground ${tvMode ? 'text-[10px] mt-1' : 'text-xs mt-2'}`}>
              Sælgere med salg af {displayActiveEmployees} aktive
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Client - Cards with colors */}
      <div>
        <div className={`flex items-center gap-2 mb-3 ${tvMode ? 'mb-2' : ''}`}>
          <Target className={`text-primary ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          <h3 className={`font-semibold ${tvMode ? 'text-sm' : 'text-base'}`}>Salg per opgave</h3>
        </div>
        {Object.keys(displaySalesByClient).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Ingen salg registreret i dag</p>
        ) : (
          <div className={`grid ${tvMode ? 'grid-cols-4 gap-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'}`}>
            {Object.entries(displaySalesByClient)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data], index) => (
                <Card 
                  key={client} 
                  className={`bg-gradient-to-br ${clientColors[index % clientColors.length]} ${tvMode ? 'py-2' : 'py-3'}`}
                >
                  <CardContent className={`flex flex-col items-center justify-center ${tvMode ? 'p-2' : 'p-3'}`}>
                    {/* Client logo */}
                    {data.logoUrl && (
                      <div className={`flex items-center justify-center bg-white rounded-lg shadow-sm ${tvMode ? 'h-10 w-20 mb-2 p-1.5' : 'h-12 w-24 mb-3 p-2'}`}>
                        <img 
                          src={data.logoUrl} 
                          alt={client} 
                          className="object-contain max-h-full max-w-full"
                        />
                      </div>
                    )}
                    <span className={`font-bold ${tvMode ? 'text-2xl' : 'text-3xl'}`}>{data.count}</span>
                    <span className={`text-muted-foreground text-center truncate w-full ${tvMode ? 'text-[10px]' : 'text-xs'}`}>
                      {client}
                    </span>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Main content: Top 20 Sellers + Recent Sales - Equal size */}
      <div className={`grid ${tvMode ? 'grid-cols-2 gap-3' : 'grid-cols-1 lg:grid-cols-2 gap-6'}`}>
        {/* Top 20 Sellers */}
        <Card className="flex flex-col">
          <CardHeader className={tvMode ? 'pb-2 pt-3 px-4' : ''}>
            <CardTitle className={`flex items-center gap-2 ${tvMode ? 'text-sm' : ''}`}>
              <Trophy className={`text-yellow-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
              Top 20 Sælgere i dag
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex-1 ${tvMode ? 'px-4 pb-3 pt-0' : ''}`}>
            {displayTopSellers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className={`space-y-1.5 overflow-y-auto ${tvMode ? 'max-h-[500px]' : 'max-h-[400px]'}`}>
                {displayTopSellers.map((seller) => (
                  <div 
                    key={seller.name} 
                    className={`flex items-center justify-between rounded-lg ${
                      seller.rank <= 3 
                        ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' 
                        : 'bg-muted/30'
                    } ${tvMode ? 'p-1.5 px-2' : 'p-3'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center ${tvMode ? 'w-5' : 'w-8'}`}>
                        {getRankDisplay(seller.rank)}
                      </div>
                      <span className={`font-medium truncate ${tvMode ? 'text-xs max-w-[120px]' : 'text-sm'}`}>
                        {seller.name}
                      </span>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`bg-emerald-500/20 text-emerald-600 font-mono ${tvMode ? 'text-[10px] px-1.5' : ''}`}
                    >
                      {formatCommission(seller.commission)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales - Same size as Top Sellers */}
        <Card className="flex flex-col">
          <CardHeader className={tvMode ? 'pb-2 pt-3 px-4' : ''}>
            <CardTitle className={`flex items-center gap-2 ${tvMode ? 'text-sm' : ''}`}>
              <Activity className={`text-primary ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
              Seneste salg
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex-1 ${tvMode ? 'px-4 pb-3 pt-0' : ''}`}>
            {displaySales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className={`space-y-1.5 overflow-y-auto ${tvMode ? 'max-h-[500px]' : 'max-h-[400px]'}`}>
                {displaySales.slice(0, tvMode ? 25 : 15).map((sale: RecentSale) => (
                  <div 
                    key={sale.id} 
                    className={`flex items-center justify-between rounded-lg bg-muted/50 ${tvMode ? 'p-1.5 px-2' : 'p-2.5'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${tvMode ? 'text-xs' : 'text-sm'}`}>{sale.agent_name}</p>
                        <Badge 
                          variant={sale.status === "confirmed" ? "default" : "secondary"}
                          className={`shrink-0 ${sale.status === "confirmed" ? "bg-emerald-500" : ""} ${tvMode ? 'text-[8px] px-1 py-0 h-4' : 'text-[10px] px-1.5'}`}
                        >
                          {sale.status === "confirmed" ? "✓" : sale.status === "pending" ? "⏳" : "-"}
                        </Badge>
                      </div>
                      <p className={`text-muted-foreground truncate ${tvMode ? 'text-[10px]' : 'text-xs'}`}>
                        {sale.client_name}
                      </p>
                    </div>
                    {sale.commission !== undefined && sale.commission > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`ml-2 shrink-0 font-mono text-emerald-600 border-emerald-500/30 ${tvMode ? 'text-[9px] px-1.5' : 'text-xs'}`}
                      >
                        {formatCommission(sale.commission)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className={`text-center text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>
        <p>CPH Sales Dashboard • {format(today, "HH:mm", { locale: da })}</p>
      </div>
    </div>
  );

  // In TV mode, render without layout to skip lock checks
  if (tvMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        {content}
      </div>
    );
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
