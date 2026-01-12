import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Users, TrendingUp, Phone, Target, Award, Activity } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
interface TvDashboardData {
  date: string;
  timestamp: string;
  sales: {
    total: number;
    confirmed: number;
    pending: number;
    byClient: Record<string, number>;
    recent: Array<{
      id: string;
      agent_name: string;
      sale_datetime: string;
      status: string | null;
      client_name: string;
    }>;
  };
  employees: {
    active: number;
    staff: number;
  };
  calls: {
    today: number;
  };
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
      const code = sessionStorage.getItem('tv_board_code') || '';
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
  const { data: todaySales = [] } = useQuery({
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
            products (counts_as_sale)
          )
        `)
        .gte("sale_datetime", startOfDay)
        .lte("sale_datetime", endOfDay)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const campaignIds = [...new Set((data || []).map(s => s.client_campaign_id).filter(Boolean))] as string[];
      let campaignClientMap: Record<string, string> = {};
      
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
            .select("id, name")
            .in("id", clientIds);
          clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.name]));
        }
        
        campaignClientMap = Object.fromEntries(
          (campaigns || []).map(c => [c.id, clientMap[c.client_id] || "Ukendt"])
        );
      }
      
      return (data || []).map(s => ({
        ...s,
        client_name: s.client_campaign_id ? campaignClientMap[s.client_campaign_id] || "Ukendt" : "Ukendt"
      }));
    },
    enabled: !tvMode,
    refetchInterval: 30000,
  });

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

  const { data: staffEmployees = 0 } = useQuery({
    queryKey: ["cph-dashboard-staff-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_staff_employee", true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  const { data: todayCalls = 0 } = useQuery({
    queryKey: ["cph-dashboard-today-calls", todayStr],
    queryFn: async () => {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;
      
      const { count, error } = await supabase
        .from("dialer_calls")
        .select("*", { count: "exact", head: true })
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode,
    refetchInterval: 30000,
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

  // Filter TV data to exclude unknown clients
  const filterTvSales = (sales: typeof tvData.sales.recent) => 
    sales.filter(s => s.client_name && s.client_name !== "Ukendt");
  
  const filterTvSalesByClient = (byClient: Record<string, number>) => {
    const result: Record<string, number> = {};
    for (const [client, count] of Object.entries(byClient)) {
      if (client !== "Ukendt") {
        result[client] = count;
      }
    }
    return result;
  };

  // Use TV data if in TV mode, otherwise use regular queries
  const displaySales = tvMode && tvData ? filterTvSales(tvData.sales.recent) : knownClientSales;
  const displaySalesTotal = tvMode && tvData ? tvData.sales.total : calculateCountedSales(knownClientSales);
  const displaySalesByClient = tvMode && tvData ? filterTvSalesByClient(tvData.sales.byClient) : calculateSalesByClient(knownClientSales);
  const displayConfirmed = tvMode && tvData ? tvData.sales.confirmed : calculateConfirmedSales(knownClientSales);
  const displayPending = tvMode && tvData ? tvData.sales.pending : calculatePendingSales(knownClientSales);
  const displayActiveEmployees = tvMode && tvData ? tvData.employees.active : activeEmployees;
  const displayStaffEmployees = tvMode && tvData ? tvData.employees.staff : staffEmployees;
  const displayCalls = tvMode && tvData ? tvData.calls.today : todayCalls;

  // Skip layout wrapper in TV mode to avoid lock checks
  const content = (
    <div className="space-y-6">
      <DashboardHeader 
        title="Dagsboard CPH Sales" 
        subtitle={format(today, "EEEE d. MMMM yyyy", { locale: da })}
      />

      {/* KPI Cards - Compact for TV */}
      <div className={`grid grid-cols-4 ${tvMode ? 'gap-3' : 'gap-6'}`}>
        <Card className={`bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Salg i dag</CardTitle>
            <TrendingUp className={`text-emerald-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-emerald-500 ${tvMode ? 'text-2xl' : 'text-4xl'}`}>{displaySalesTotal}</div>
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

        <Card className={`bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Opkald i dag</CardTitle>
            <Phone className={`text-blue-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-blue-500 ${tvMode ? 'text-2xl' : 'text-4xl'}`}>{displayCalls}</div>
            {!tvMode && <p className="text-xs text-muted-foreground mt-2">Registrerede opkald</p>}
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Aktive sælgere</CardTitle>
            <Users className={`text-purple-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-purple-500 ${tvMode ? 'text-2xl' : 'text-4xl'}`}>{displayActiveEmployees}</div>
            {!tvMode && <p className="text-xs text-muted-foreground mt-2">Sælgere</p>}
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Backoffice</CardTitle>
            <Award className={`text-orange-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-orange-500 ${tvMode ? 'text-2xl' : 'text-4xl'}`}>{displayStaffEmployees}</div>
            {!tvMode && <p className="text-xs text-muted-foreground mt-2">Aktive backoffice</p>}
          </CardContent>
        </Card>
      </div>

      {/* Sales by Client */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Salg per kunde i dag
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(displaySalesByClient).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(displaySalesByClient)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([client, count]) => (
                    <div key={client} className="flex items-center justify-between">
                      <span className="font-medium">{client}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(((count as number) / displaySalesTotal) * 100, 100)}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="min-w-[40px] justify-center">
                          {count as number}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Seneste salg
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displaySales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {displaySales.slice(0, 10).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{sale.agent_name}</p>
                      <p className="text-sm text-muted-foreground">{sale.client_name || "Ukendt kunde"}</p>
                    </div>
                    <Badge 
                      variant={sale.status === "confirmed" ? "default" : "secondary"}
                      className={sale.status === "confirmed" ? "bg-emerald-500" : ""}
                    >
                      {sale.status === "confirmed" ? "Bekræftet" : sale.status === "pending" ? "Afventer" : sale.status || "-"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>CPH Sales Dashboard • {format(today, "HH:mm", { locale: da })}</p>
      </div>
    </div>
  );

  // In TV mode, render without layout to skip lock checks
  if (tvMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
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
