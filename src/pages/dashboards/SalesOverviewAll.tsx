import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Target } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";

// Check if we're in TV mode
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') || sessionStorage.getItem('tv_board_code') !== null;
};

interface TvDashboardData {
  date: string;
  timestamp: string;
  sales: {
    total: number;
    confirmed: number;
    pending: number;
    byClient: Record<string, { count: number; logoUrl: string | null }>;
    recent: any[];
  };
  employees: {
    active: number;
    staff: number;
  };
  sellersOnBoard: number;
}

export default function SalesOverviewAll() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("sales-overview-all");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tvMode = isTvMode();

  // Fetch global cached KPIs
  const { data: globalKpis } = usePrecomputedKpis(
    ["active_employees"],
    "today",
    "global"
  );

  // TV mode edge function
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
    refetchInterval: 60000,
    staleTime: 60000,
  });

  // Today's sales (TM)
  const { data: todaySalesData } = useQuery({
    queryKey: ["sales-overview-all-today-sales", todayStr],
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
        .neq("validation_status", "rejected")
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
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // FM sales today
  const { data: fmTodaySales = [] } = useQuery({
    queryKey: ["sales-overview-all-fm-sales", todayStr],
    queryFn: async () => {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;

      const { data, error } = await supabase
        .from("sales")
        .select(`id, agent_name, normalized_data, sale_datetime, client_campaign_id`)
        .eq("source", "fieldmarketing")
        .gte("sale_datetime", startOfDay)
        .lte("sale_datetime", endOfDay)
        .neq("validation_status", "rejected");

      if (error) throw error;

      const campaignIds = [...new Set((data || []).map(s => s.client_campaign_id).filter(Boolean))];
      let fmClientMap: Record<string, { name: string; logo_url: string | null }> = {};

      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id, name, client_id, clients(id, name, logo_url)")
          .in("id", campaignIds);

        for (const c of campaigns || []) {
          const clientData = c.clients as any;
          if (clientData) {
            fmClientMap[c.id] = { name: clientData.name, logo_url: clientData.logo_url };
          }
        }
      }

      return (data || []).map(sale => ({
        ...sale,
        _clientName: sale.client_campaign_id ? fmClientMap[sale.client_campaign_id]?.name : null,
        _clientLogo: sale.client_campaign_id ? fmClientMap[sale.client_campaign_id]?.logo_url : null,
        _sellerName: sale.agent_name || (sale.normalized_data as any)?.seller_name || null,
      }));
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  const todaySales = todaySalesData?.sales || [];
  const clientLogos = todaySalesData?.clientLogos || {};

  const cachedActiveEmployees = getKpiValue(globalKpis?.active_employees, 0);

  const { data: activeEmployeesQuery = 0 } = useQuery({
    queryKey: ["sales-overview-all-active-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode && cachedActiveEmployees === 0,
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const activeEmployees = cachedActiveEmployees > 0 ? cachedActiveEmployees : activeEmployeesQuery;

  const knownClientSales = todaySales.filter(sale =>
    sale.client_name && sale.client_name !== "Ukendt"
  );

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

  const calculateSellersOnBoard = (sales: typeof todaySales) => {
    const sellersWithSales = new Set<string>();
    for (const sale of sales) {
      const saleItems = (sale as any).sale_items || [];
      const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
      if (hasCountedSale && sale.agent_name) {
        sellersWithSales.add(sale.agent_name.toLowerCase());
      }
    }
    for (const fmSale of fmTodaySales) {
      const sellerName = (fmSale as any)._sellerName;
      if (sellerName) {
        sellersWithSales.add(sellerName.toLowerCase());
      }
    }
    return sellersWithSales.size;
  };

  const getSalesByClientWithLogos = (): Record<string, { count: number; logoUrl: string | null }> => {
    const byClient = calculateSalesByClient(knownClientSales);

    for (const fmSale of fmTodaySales) {
      const clientName = (fmSale as any)._clientName;
      if (clientName) {
        byClient[clientName] = (byClient[clientName] || 0) + 1;
      }
    }

    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, count] of Object.entries(byClient)) {
      const fmClientLogo = fmTodaySales.find(s => (s as any)._clientName === client)?._clientLogo;
      result[client] = {
        count,
        logoUrl: clientLogos[client] || fmClientLogo || null
      };
    }
    return result;
  };

  const filterTvSalesByClient = (byClient: Record<string, { count: number; logoUrl: string | null }>) => {
    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, data] of Object.entries(byClient)) {
      if (client !== "Ukendt") {
        result[client] = data;
      }
    }
    return result;
  };

  const displaySalesTotal = tvMode && tvData ? tvData.sales.total : calculateCountedSales(knownClientSales) + fmTodaySales.length;
  const displaySalesByClientToday = tvMode && tvData ? filterTvSalesByClient(tvData.sales.byClient) : getSalesByClientWithLogos();
  const displayConfirmed = tvMode && tvData ? tvData.sales.confirmed : calculateConfirmedSales(knownClientSales);
  const displayPending = tvMode && tvData ? tvData.sales.pending : calculatePendingSales(knownClientSales);
  const displaySellersOnBoard = tvMode && tvData ? tvData.sellersOnBoard : calculateSellersOnBoard(knownClientSales);
  const displayActiveEmployees = tvMode && tvData ? tvData.employees.active : activeEmployees;

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

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // TV mode content
  const tvContent = (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Clock */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4">
        <span className="text-[120px] font-extralight tabular-nums tracking-tight leading-none text-white">
          {format(now, "HH:mm:ss")}
        </span>
        <span className="text-xl font-light uppercase tracking-[0.3em] text-white/40 mt-4">
          {format(now, "EEEE d. MMMM yyyy", { locale: da })}
        </span>
      </div>

      {/* Total Sales Hero */}
      <div className="flex flex-col items-center justify-center">
        <span className="text-[96px] font-extralight tabular-nums leading-none text-white">
          {displaySalesTotal}
        </span>
        <span className="text-sm font-medium uppercase tracking-[0.4em] text-white/30 mt-3">
          Salg i dag
        </span>
      </div>

      {/* Client Grid - Glassmorphism */}
      <div className="px-8">
        {Object.keys(displaySalesByClientToday).length === 0 ? (
          <p className="text-white/30 text-center py-8 text-lg">Ingen salg registreret i dag</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Object.entries(displaySalesByClientToday)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data]) => (
                <div
                  key={client}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 animate-fade-in"
                >
                  {data.logoUrl && (
                    <div className="flex items-center justify-center rounded-xl bg-zinc-800/80 h-16 w-32 p-3">
                      <img
                        src={data.logoUrl}
                        alt={client}
                        className="object-contain max-h-full max-w-full"
                      />
                    </div>
                  )}
                  <span className="text-5xl font-light tabular-nums text-white">{data.count}</span>
                  <span className="text-sm uppercase tracking-[0.2em] text-white/40 text-center truncate w-full">
                    {client}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-3 text-white/25 text-sm pt-4">
        <span className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          LIVE
        </span>
        <span>•</span>
        <span>{format(now, "HH:mm:ss")}</span>
      </div>
    </div>
  );

  // Normal dashboard content
  const normalContent = (
    <div className="space-y-6">
      {/* Unified header with clock */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salgsoversigt alle</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(today, "EEEE d. MMMM yyyy", { locale: da })}
          </p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">
            {format(now, "HH:mm:ss")}
          </span>
        </div>
      </div>

      {/* Client grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Salg per klient i dag</h3>
          <Badge variant="secondary" className="ml-auto">{displaySalesTotal} total</Badge>
        </div>
        {Object.keys(displaySalesByClientToday).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Ingen salg registreret i dag</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(displaySalesByClientToday)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data], index) => (
                <Card
                  key={client}
                  className={`bg-gradient-to-br ${clientColors[index % clientColors.length]} py-3`}
                >
                  <CardContent className="flex flex-col items-center justify-center p-3">
                    {data.logoUrl && (
                      <div className="flex items-center justify-center rounded-xl shadow-sm bg-zinc-700/90 h-16 w-32 mb-3 p-2.5">
                        <img
                          src={data.logoUrl}
                          alt={client}
                          className="object-contain max-h-full max-w-full"
                        />
                      </div>
                    )}
                    <span className="font-bold text-3xl">{data.count}</span>
                    <span className="text-muted-foreground text-center truncate w-full text-xs">
                      {client}
                    </span>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  if (tvMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4" style={{ background: 'radial-gradient(ellipse at center, #111111 0%, #0a0a0a 70%)' }}>
        {tvContent}
      </div>
    );
  }

  return (
    <DashboardLayout>
      {normalContent}
    </DashboardLayout>
  );
}
