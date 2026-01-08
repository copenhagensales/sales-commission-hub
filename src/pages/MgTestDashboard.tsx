import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Building2, RefreshCw, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TvPreviewOverlay } from "@/components/tv-preview/TvPreviewOverlay";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";

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

interface ClientDashboardData {
  clientId: string;
  clientName: string;
  salesToday: number;
  salesMonth: number;
  commissionToday: number;
  commissionMonth: number;
  revenueMonth: number;
  hoursMonth: number;
  topSellers: { name: string; sales: number; commission: number }[];
}

export default function MgTestDashboard() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const today = new Date();
  const todayStart = startOfDay(today);
  const monthStart = startOfMonth(today);

  // Fetch all clients
  const { data: clients = [] } = useQuery({
    queryKey: ["mg-test-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  // Get dashboard data for all clients using the unified hook pattern
  // We need to fetch per client, so we use a combined query
  const { data: allClientData, isLoading, isFetching } = useQuery({
    queryKey: ["mg-test-dashboard-all-clients", clients.map((c) => c.id).join(",")],
    queryFn: async () => {
      if (clients.length === 0) return [];

      const results: ClientDashboardData[] = [];

      for (const client of clients) {
        // This would be better with parallel fetching but keeping simple for now
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token || supabaseKey;
        const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}` };

        const monthStartStr = monthStart.toISOString().split("T")[0];
        const todayStr = todayStart.toISOString().split("T")[0];
        const nowStr = today.toISOString().split("T")[0];

        // Get campaigns for this client
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", client.id);

        if (!campaigns || campaigns.length === 0) continue;

        const campaignIds = campaigns.map((c) => c.id);

        // Get sales for this month with employee mapping
        const salesUrl = `${supabaseUrl}/rest/v1/sales?select=agent_email,sale_datetime,sale_items(quantity,mapped_commission,mapped_revenue,products(counts_as_sale))&client_campaign_id=in.(${campaignIds.join(",")})&sale_datetime=gte.${monthStartStr}T00:00:00&sale_datetime=lte.${nowStr}T23:59:59`;

        const salesRes = await fetch(salesUrl, { headers: { ...headers, Accept: "application/json" } });
        const salesData = salesRes.ok ? await salesRes.json() : [];

        // Get agent mappings to filter only mapped sales
        const { data: agentMappings } = await supabase
          .from("employee_agent_mapping")
          .select("employee_id, agents(email)");

        const mappedEmails = new Set(
          (agentMappings || []).map((m: any) => m.agents?.email?.toLowerCase()).filter(Boolean)
        );

        // Get employee names for mapped agents
        const employeeMap = new Map<string, string>();
        if (agentMappings && agentMappings.length > 0) {
          const empIds = [...new Set((agentMappings || []).map((m) => m.employee_id))];
          const { data: employees } = await supabase
            .from("employee_master_data")
            .select("id, first_name, last_name")
            .in("id", empIds);

          (employees || []).forEach((e) => {
            employeeMap.set(e.id, `${e.first_name} ${e.last_name}`.trim());
          });

          // Map email to employee name
          (agentMappings || []).forEach((m: any) => {
            if (m.agents?.email) {
              const empName = employeeMap.get(m.employee_id);
              if (empName) {
                employeeMap.set(m.agents.email.toLowerCase(), empName);
              }
            }
          });
        }

        // Aggregate
        let salesToday = 0;
        let salesMonth = 0;
        let commissionToday = 0;
        let commissionMonth = 0;
        let revenueMonth = 0;

        const sellerStats = new Map<string, { sales: number; commission: number }>();

        for (const sale of salesData) {
          const email = (sale.agent_email || "").toLowerCase();
          if (!mappedEmails.has(email)) continue;

          const employeeName = employeeMap.get(email) || email;
          const isToday = sale.sale_datetime >= `${todayStr}T00:00:00`;

          for (const item of sale.sale_items || []) {
            if (item.products?.counts_as_sale === false) continue;

            const qty = Number(item.quantity) || 1;
            const commission = Number(item.mapped_commission) || 0;
            const revenue = Number(item.mapped_revenue) || 0;

            salesMonth += qty;
            commissionMonth += commission;
            revenueMonth += revenue;

            if (isToday) {
              salesToday += qty;
              commissionToday += commission;
            }

            const existing = sellerStats.get(employeeName) || { sales: 0, commission: 0 };
            existing.sales += qty;
            existing.commission += commission;
            sellerStats.set(employeeName, existing);
          }
        }

        const topSellers = Array.from(sellerStats.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.commission - a.commission)
          .slice(0, 3);

        if (salesMonth > 0) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            salesToday,
            salesMonth,
            commissionToday: Math.round(commissionToday),
            commissionMonth: Math.round(commissionMonth),
            revenueMonth: Math.round(revenueMonth),
            hoursMonth: 0, // Would need separate calculation
            topSellers,
          });
        }
      }

      setLastUpdated(new Date().toLocaleTimeString("da-DK"));
      return results.sort((a, b) => b.salesMonth - a.salesMonth);
    },
    enabled: clients.length > 0,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const allClients = allClientData || [];
  const totalSalesToday = allClients.reduce((sum, c) => sum + c.salesToday, 0);
  const totalSalesMonth = allClients.reduce((sum, c) => sum + c.salesMonth, 0);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["mg-test-dashboard-all-clients"] });
  };

  const statsContent = (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="sm" onClick={refetch} disabled={isFetching} className="h-8 px-2">
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
      {lastUpdated && <span className="text-xs text-muted-foreground">Opdateret: {lastUpdated}</span>}
      <div className="text-right">
        <p className="text-xs text-muted-foreground">I dag</p>
        <p className="text-xl font-bold text-primary">{isLoading ? "..." : totalSalesToday}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Denne måned</p>
        <p className="text-xl font-bold">{isLoading ? "..." : totalSalesMonth}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader title="Test Dashboard" subtitle="Data fra dagsrapporter (kun mappede medarbejdere)" rightContent={statsContent} />
      <TvPreviewOverlay>
        <div className="flex flex-col overflow-hidden box-border">
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
                const colors = clientColors[client.clientName] || defaultColors;
                const medals = ["🥇", "🥈", "🥉"];

                return (
                  <Card
                    key={client.clientId}
                    className={`relative overflow-hidden border-0 bg-gradient-to-br ${colors.bg} backdrop-blur-sm min-h-0 flex flex-col`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${colors.accent}`} />
                    {index < 3 && (
                      <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] px-1 py-0 font-bold bg-background/80">
                        #{index + 1}
                      </Badge>
                    )}

                    <CardContent className="p-2 space-y-1 flex-1 flex flex-col min-h-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-6 h-6 rounded ${colors.accent} flex items-center justify-center flex-shrink-0`}>
                          <Building2 className="w-3 h-3 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{client.clientName}</p>
                          <p className={`text-[10px] ${colors.text}`}>{formatCurrency(client.revenueMonth)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 flex-shrink-0">
                        <div className="bg-background/30 rounded px-1.5 py-1 text-center">
                          <p className="text-[8px] text-muted-foreground uppercase">I dag</p>
                          <p className="text-sm font-bold leading-tight">{client.salesToday}</p>
                        </div>
                        <div className="bg-background/30 rounded px-1.5 py-1 text-center">
                          <p className="text-[8px] text-muted-foreground uppercase">Måned</p>
                          <p className="text-sm font-bold leading-tight">{client.salesMonth}</p>
                        </div>
                      </div>

                      {client.topSellers && client.topSellers.length > 0 && (
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
                            <Trophy className="w-2.5 h-2.5" />
                            <span>Top</span>
                          </div>
                          <div className="space-y-0.5">
                            {client.topSellers.slice(0, 3).map((seller, i) => (
                              <div
                                key={`${client.clientId}-${seller.name}-${i}`}
                                className="flex items-center justify-between bg-background/20 rounded px-1 py-0.5 text-[10px]"
                              >
                                <div className="flex items-center gap-0.5 min-w-0">
                                  <span className="text-[8px]">{medals[i]}</span>
                                  <span className="truncate">{seller.name}</span>
                                </div>
                                <span className="font-semibold text-[8px] flex-shrink-0 ml-0.5">{seller.sales}</span>
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

          {!isLoading && allClients.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-sm font-medium">Ingen salgsdata fundet</h3>
              <p className="text-xs text-muted-foreground">Kun mappede medarbejdere vises</p>
            </div>
          )}
        </div>
      </TvPreviewOverlay>
    </div>
  );
}
