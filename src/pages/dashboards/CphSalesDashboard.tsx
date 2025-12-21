import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Users, TrendingUp, Phone, Target, Calendar, Clock, Award, Activity } from "lucide-react";
import { ScreenResolutionIndicator } from "@/components/dashboard/ScreenResolutionIndicator";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function CphSalesDashboard() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Fetch today's sales
  const { data: todaySales = [] } = useQuery({
    queryKey: ["cph-dashboard-today-sales", todayStr],
    queryFn: async () => {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;
      
      const { data, error } = await supabase
        .from("sales")
        .select("id, agent_name, sale_datetime, status, client_campaign_id")
        .gte("sale_datetime", startOfDay)
        .lte("sale_datetime", endOfDay)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Fetch campaign and client names separately
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
    refetchInterval: 30000,
  });

  // Fetch active employees count
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
    refetchInterval: 60000,
  });

  // Fetch staff employees count
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
    refetchInterval: 60000,
  });

  // Fetch today's calls
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
    refetchInterval: 30000,
  });

  // Get sales by client
  const salesByClient = todaySales.reduce((acc: Record<string, number>, sale: any) => {
    const clientName = sale.client_name || "Ukendt";
    acc[clientName] = (acc[clientName] || 0) + 1;
    return acc;
  }, {});

  // Get confirmed sales
  const confirmedSales = todaySales.filter((s: any) => s.status === "confirmed").length;
  const pendingSales = todaySales.filter((s: any) => s.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Dagsboard CPH Sales
              </h1>
              <p className="text-muted-foreground mt-1">
                {format(today, "EEEE d. MMMM yyyy", { locale: da })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ScreenResolutionIndicator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Opdateres automatisk</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salg i dag</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-500">{todaySales.length}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600">
                {confirmedSales} bekræftet
              </Badge>
              {pendingSales > 0 && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                  {pendingSales} afventer
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opkald i dag</CardTitle>
            <Phone className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-500">{todayCalls}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Registrerede opkald
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive medarbejdere</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-500">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Sælgere
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stabsmedarbejdere</CardTitle>
            <Award className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-500">{staffEmployees}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Aktive stabsmedarbejdere
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Client */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Salg per kunde i dag
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(salesByClient).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(salesByClient)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([client, count]) => (
                    <div key={client} className="flex items-center justify-between">
                      <span className="font-medium">{client}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(((count as number) / todaySales.length) * 100, 100)}%` }}
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
            {todaySales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {todaySales.slice(0, 10).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{sale.agent_name}</p>
                      <p className="text-sm text-muted-foreground">{sale.client_name || "Ukendt kunde"}</p>
                    </div>
                    <Badge 
                      variant={sale.status === "confirmed" ? "default" : "secondary"}
                      className={sale.status === "confirmed" ? "bg-emerald-500" : ""}
                    >
                      {sale.status === "confirmed" ? "Bekræftet" : sale.status === "pending" ? "Afventer" : sale.status}
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
    </DashboardLayout>
  );
}
