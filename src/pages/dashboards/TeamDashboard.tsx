import { useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { TrendingUp, Users, Calendar, Package, Trophy } from "lucide-react";

// Team configuration
const TEAM_CONFIG: Record<string, { name: string; clientId?: string }> = {
  "eesy-tm": { name: "Eesy TM", clientId: "c37fbb01-a8b0-4ac5-a927-c96d63d6a6b7" }, // Eesy client
  "fieldmarketing": { name: "Fieldmarketing" },
  "relatel": { name: "Relatel", clientId: "d8a6e3b4-5c2f-4a1e-9b8d-7c6e5f4a3b2c" },
  "tdc-erhverv": { name: "TDC Erhverv", clientId: "7d3e8a9b-6c5f-4d2e-a1b0-9c8d7e6f5a4b" },
  "united": { name: "United" },
};

interface TeamDashboardContentProps {
  teamSlug: string;
  teamName: string;
  clientId?: string;
}

const TeamDashboardContent = ({ teamSlug, teamName, clientId }: TeamDashboardContentProps) => {
  // Fetch team info with logo
  const { data: teamInfo } = useQuery({
    queryKey: ["team-dashboard-info", teamName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", `%${teamName}%`)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch client info with logo if clientId is provided
  const { data: clientInfo } = useQuery({
    queryKey: ["team-dashboard-client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("id", clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch sales stats for this client
  const { data: salesStats } = useQuery({
    queryKey: ["team-dashboard-sales-stats", clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get client campaigns first
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return { salesToday: 0, salesThisWeek: 0, salesThisMonth: 0, totalSales: 0 };

      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, agent_name")
        .in("client_campaign_id", campaignIds);
      
      if (error) throw error;

      const allSales = sales || [];
      
      return {
        salesToday: allSales.filter(s => s.sale_datetime >= todayStart).length,
        salesThisWeek: allSales.filter(s => s.sale_datetime >= weekStart).length,
        salesThisMonth: allSales.filter(s => s.sale_datetime >= monthStart).length,
        totalSales: allSales.length,
      };
    },
    enabled: !!clientId,
  });

  // Fetch top sellers this month with commission from sale_items
  const { data: topSellers } = useQuery({
    queryKey: ["team-dashboard-top-sellers", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get client campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // Group by agent
      const agentStats: Record<string, { sales: number; commission: number }> = {};
      (sales || []).forEach((sale: any) => {
        if (!agentStats[sale.agent_name]) {
          agentStats[sale.agent_name] = { sales: 0, commission: 0 };
        }
        agentStats[sale.agent_name].sales += 1;
        const saleCommission = (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0);
        agentStats[sale.agent_name].commission += saleCommission;
      });

      return Object.entries(agentStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: !!clientId,
  });

  // Fetch today's sellers
  const { data: todaySellers } = useQuery({
    queryKey: ["team-dashboard-today-sellers", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Get client campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", todayStart);
      
      if (error) throw error;

      // Group by agent
      const agentStats: Record<string, { sales: number; commission: number }> = {};
      (sales || []).forEach((sale: any) => {
        if (!agentStats[sale.agent_name]) {
          agentStats[sale.agent_name] = { sales: 0, commission: 0 };
        }
        agentStats[sale.agent_name].sales += 1;
        const saleCommission = (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0);
        agentStats[sale.agent_name].commission += saleCommission;
      });

      return Object.entries(agentStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: !!clientId,
  });

  // Fetch recent sales
  const { data: recentSales } = useQuery({
    queryKey: ["team-dashboard-recent-sales", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // Get client campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          agent_name,
          customer_phone,
          created_at,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => ({
        ...sale,
        total_commission: (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0),
      }));
    },
    enabled: !!clientId,
  });

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="h-20 w-40 flex items-center justify-center mb-4">
          <span className="text-3xl font-bold text-muted-foreground">{teamName}</span>
        </div>
        <p className="text-muted-foreground">Dashboard kommer snart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with logo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {teamName} Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Oversigt over salg og performance
          </p>
        </div>
        <div className="h-16 w-40 flex items-center justify-end">
          {clientInfo?.logo_url ? (
            <img 
              src={clientInfo.logo_url} 
              alt={clientInfo.name} 
              className="max-h-16 max-w-40 object-contain"
            />
          ) : (
            <div className="h-16 px-6 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-muted-foreground">{teamName}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I dag</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesToday || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne uge</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne måned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.totalSales || 0}</div>
            <p className="text-xs text-muted-foreground">salg i alt</p>
          </CardContent>
        </Card>
      </div>

      {/* Tables side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Month Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Månedens sælgere</CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers && topSellers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSellers.map((seller, index) => (
                      <TableRow key={seller.name}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {seller.commission.toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Ingen salg denne måned</p>
            )}
          </CardContent>
        </Card>

        {/* Today's Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Dagens sælgere</CardTitle>
          </CardHeader>
          <CardContent>
            {todaySellers && todaySellers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySellers.map((seller, index) => (
                      <TableRow key={seller.name}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {seller.commission.toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Ingen salg registreret i dag
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seneste salg</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales && recentSales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell>{sale.agent_name}</TableCell>
                      <TableCell className="font-mono">{sale.customer_phone || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {(sale.total_commission || 0).toLocaleString("da-DK")} kr
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              Ingen salg registreret endnu
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TeamDashboard = () => {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  
  const config = teamSlug ? TEAM_CONFIG[teamSlug] : null;
  
  if (!config) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Dashboard ikke fundet</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TeamDashboardContent 
        teamSlug={teamSlug!} 
        teamName={config.name}
        clientId={config.clientId}
      />
    </DashboardLayout>
  );
};

export default TeamDashboard;
