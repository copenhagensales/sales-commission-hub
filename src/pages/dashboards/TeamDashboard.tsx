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
import { Users, Trophy, Building2 } from "lucide-react";

// Team configuration - name mapping only, clients come from team_clients table
const TEAM_CONFIG: Record<string, { name: string; multiClient?: boolean }> = {
  "eesy-tm": { name: "Eesy TM" },
  "fieldmarketing": { name: "Fieldmarketing" },
  "relatel": { name: "Relatel" },
  "tdc-erhverv": { name: "TDC Erhverv" },
  "united": { name: "United", multiClient: true },
};

interface TeamClient {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ClientSalesStats {
  clientId: string;
  clientName: string;
  logoUrl: string | null;
  salesToday: number;
  salesThisMonth: number;
}

interface SellerWithClient {
  name: string;
  clientId: string;
  clientName: string;
  clientLogo: string | null;
  sales: number;
  commission: number;
}

interface TeamDashboardContentProps {
  teamSlug: string;
  teamName: string;
  multiClient?: boolean;
}

const TeamDashboardContent = ({ teamSlug, teamName, multiClient }: TeamDashboardContentProps) => {
  // Fetch team and its clients from team_clients table
  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["team-dashboard-team", teamName],
    queryFn: async () => {
      // First find the team
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", `%${teamName}%`)
        .maybeSingle();
      
      if (teamError) throw teamError;
      if (!team) return { team: null, clients: [] };

      // Then get associated clients via team_clients
      const { data: teamClients, error: clientsError } = await supabase
        .from("team_clients")
        .select(`
          client_id,
          clients (id, name, logo_url)
        `)
        .eq("team_id", team.id);
      
      if (clientsError) throw clientsError;

      const clients: TeamClient[] = (teamClients || [])
        .map((tc: any) => tc.clients)
        .filter(Boolean)
        .sort((a: TeamClient, b: TeamClient) => a.name.localeCompare(b.name, 'da'));

      return { team, clients };
    },
  });

  const clients = teamData?.clients || [];
  const clientIds = clients.map(c => c.id);

  // Fetch sales stats for ALL clients at once (for multi-client view)
  const { data: allClientStats } = useQuery({
    queryKey: ["team-dashboard-all-client-stats", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get all campaigns for all clients
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id")
        .in("client_id", clientIds);
      
      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);
      const campaignToClient = new Map(campaigns.map(c => [c.id, c.client_id]));

      // Get all sales
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, client_campaign_id")
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // Group by client
      const statsMap = new Map<string, { salesToday: number; salesThisMonth: number }>();
      clientIds.forEach(id => statsMap.set(id, { salesToday: 0, salesThisMonth: 0 }));

      (sales || []).forEach(sale => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        if (clientId && statsMap.has(clientId)) {
          const stats = statsMap.get(clientId)!;
          stats.salesThisMonth += 1;
          if (sale.sale_datetime >= todayStart) {
            stats.salesToday += 1;
          }
        }
      });

      // Convert to array, only include clients with sales
      const result: ClientSalesStats[] = clients
        .map(client => ({
          clientId: client.id,
          clientName: client.name,
          logoUrl: client.logo_url,
          salesToday: statsMap.get(client.id)?.salesToday || 0,
          salesThisMonth: statsMap.get(client.id)?.salesThisMonth || 0,
        }))
        .filter(s => s.salesThisMonth > 0)
        .sort((a, b) => b.salesThisMonth - a.salesThisMonth);

      return result;
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  // Fetch top sellers this month across ALL clients (for multi-client view)
  const { data: allMonthSellers } = useQuery({
    queryKey: ["team-dashboard-all-month-sellers", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get all campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id")
        .in("client_id", clientIds);
      
      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);
      const campaignToClient = new Map(campaigns.map(c => [c.id, c.client_id]));

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          client_campaign_id,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // Group by agent + client
      const agentClientStats = new Map<string, SellerWithClient>();
      
      (sales || []).forEach((sale: any) => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const key = `${sale.agent_name}__${clientId}`;
        if (!agentClientStats.has(key)) {
          agentClientStats.set(key, {
            name: sale.agent_name,
            clientId: client.id,
            clientName: client.name,
            clientLogo: client.logo_url,
            sales: 0,
            commission: 0,
          });
        }
        
        const stats = agentClientStats.get(key)!;
        stats.sales += 1;
        const saleCommission = (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0);
        stats.commission += saleCommission;
      });

      return Array.from(agentClientStats.values())
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  // Fetch today's sellers across ALL clients (for multi-client view)
  const { data: allTodaySellers } = useQuery({
    queryKey: ["team-dashboard-all-today-sellers", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Get all campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id")
        .in("client_id", clientIds);
      
      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);
      const campaignToClient = new Map(campaigns.map(c => [c.id, c.client_id]));

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          client_campaign_id,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", todayStart);
      
      if (error) throw error;

      // Group by agent + client
      const agentClientStats = new Map<string, SellerWithClient>();
      
      (sales || []).forEach((sale: any) => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const key = `${sale.agent_name}__${clientId}`;
        if (!agentClientStats.has(key)) {
          agentClientStats.set(key, {
            name: sale.agent_name,
            clientId: client.id,
            clientName: client.name,
            clientLogo: client.logo_url,
            sales: 0,
            commission: 0,
          });
        }
        
        const stats = agentClientStats.get(key)!;
        stats.sales += 1;
        const saleCommission = (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0);
        stats.commission += saleCommission;
      });

      return Array.from(agentClientStats.values())
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  // Fetch recent sales across ALL clients (for multi-client view)
  const { data: allRecentSales } = useQuery({
    queryKey: ["team-dashboard-all-recent-sales", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      // Get all campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id")
        .in("client_id", clientIds);
      
      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);
      const campaignToClient = new Map(campaigns.map(c => [c.id, c.client_id]));

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          agent_name,
          customer_phone,
          created_at,
          client_campaign_id,
          sale_items (mapped_commission)
        `)
        .in("client_campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        const client = clients.find(c => c.id === clientId);
        return {
          ...sale,
          clientName: client?.name || "Ukendt",
          clientLogo: client?.logo_url,
          total_commission: (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0),
        };
      });
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  if (isLoadingTeam) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{teamName}</h2>
        <p className="text-muted-foreground">Ingen kunder tilknyttet dette team endnu.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Tilføj kunder under Personale → Teams
        </p>
      </div>
    );
  }

  // Multi-client view (United style)
  if (multiClient) {
    const clientsWithSales = allClientStats || [];
    const monthSellers = allMonthSellers || [];
    const todaySellers = allTodaySellers || [];
    const recentSales = allRecentSales || [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {teamName} Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Oversigt over salg på tværs af kunder
          </p>
        </div>

        {/* Client cards grid */}
        {clientsWithSales.length > 0 ? (
          <div className="grid gap-4 grid-cols-5">
            {clientsWithSales.map((client) => (
              <Card key={client.clientId} className="relative overflow-hidden">
                <CardContent className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-8 w-full flex items-center justify-center">
                      {client.logoUrl ? (
                        <img 
                          src={client.logoUrl} 
                          alt={client.clientName} 
                          className="max-h-8 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-foreground truncate max-w-full">
                          {client.clientName}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1">
                      <div className="text-center">
                        <div className="text-xl font-bold text-foreground">{client.salesToday}</div>
                        <div className="text-xs text-muted-foreground">i dag</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-foreground">{client.salesThisMonth}</div>
                        <div className="text-xs text-muted-foreground">måned</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen salg registreret denne måned
            </CardContent>
          </Card>
        )}

        {/* Tables side by side */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Month Sellers Table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Månedens sælgere</CardTitle>
            </CardHeader>
            <CardContent>
              {monthSellers.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Sælger</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead className="text-right">Salg</TableHead>
                        <TableHead className="text-right">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthSellers.slice(0, 15).map((seller, index) => (
                        <TableRow key={`${seller.name}-${seller.clientId}`}>
                          <TableCell>
                            <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                              {index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{seller.name}</TableCell>
                          <TableCell>
                            <div className="h-6 w-20 flex items-center">
                              {seller.clientLogo ? (
                                <img 
                                  src={seller.clientLogo} 
                                  alt={seller.clientName} 
                                  className="max-h-6 max-w-20 object-contain"
                                  title={seller.clientName}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">{seller.clientName}</span>
                              )}
                            </div>
                          </TableCell>
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
              {todaySellers.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Sælger</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead className="text-right">Salg</TableHead>
                        <TableHead className="text-right">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todaySellers.map((seller, index) => (
                        <TableRow key={`${seller.name}-${seller.clientId}`}>
                          <TableCell>
                            <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                              {index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{seller.name}</TableCell>
                          <TableCell>
                            <div className="h-6 w-20 flex items-center">
                              {seller.clientLogo ? (
                                <img 
                                  src={seller.clientLogo} 
                                  alt={seller.clientName} 
                                  className="max-h-6 max-w-20 object-contain"
                                  title={seller.clientName}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">{seller.clientName}</span>
                              )}
                            </div>
                          </TableCell>
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
            {recentSales.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dato</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.created_at), "dd/MM HH:mm", { locale: da })}
                        </TableCell>
                        <TableCell>{sale.agent_name}</TableCell>
                        <TableCell>
                          <div className="h-6 w-20 flex items-center">
                            {sale.clientLogo ? (
                              <img 
                                src={sale.clientLogo} 
                                alt={sale.clientName} 
                                className="max-h-6 max-w-20 object-contain"
                                title={sale.clientName}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{sale.clientName}</span>
                            )}
                          </div>
                        </TableCell>
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
  }

  // Single client view (original behavior for other teams)
  return <SingleClientDashboard clients={clients} teamName={teamName} />;
};

// Single client dashboard component (extracted for clarity)
const SingleClientDashboard = ({ clients, teamName }: { clients: TeamClient[]; teamName: string }) => {
  const activeClient = clients[0];
  const activeClientId = activeClient?.id;

  // Fetch sales stats for selected client
  const { data: salesStats } = useQuery({
    queryKey: ["team-dashboard-sales-stats", activeClientId],
    queryFn: async () => {
      if (!activeClientId) return null;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
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
    enabled: !!activeClientId,
  });

  const { data: topSellers } = useQuery({
    queryKey: ["team-dashboard-top-sellers", activeClientId],
    queryFn: async () => {
      if (!activeClientId) return [];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`agent_name, sale_items (mapped_commission)`)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

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
    enabled: !!activeClientId,
  });

  const { data: todaySellers } = useQuery({
    queryKey: ["team-dashboard-today-sellers", activeClientId],
    queryFn: async () => {
      if (!activeClientId) return [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`agent_name, sale_items (mapped_commission)`)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", todayStart);
      
      if (error) throw error;

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
    enabled: !!activeClientId,
  });

  const { data: recentSales } = useQuery({
    queryKey: ["team-dashboard-recent-sales", activeClientId],
    queryFn: async () => {
      if (!activeClientId) return [];

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data, error } = await supabase
        .from("sales")
        .select(`id, sale_datetime, agent_name, customer_phone, created_at, sale_items (mapped_commission)`)
        .in("client_campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => ({
        ...sale,
        total_commission: (sale.sale_items || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0),
      }));
    },
    enabled: !!activeClientId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{teamName} Dashboard</h1>
          <p className="text-muted-foreground mt-1">Oversigt over salg og performance</p>
        </div>
        <div className="h-16 w-40 flex items-center justify-end">
          {activeClient?.logo_url ? (
            <img src={activeClient.logo_url} alt={activeClient.name} className="max-h-16 max-w-40 object-contain" />
          ) : (
            <div className="h-16 px-6 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-muted-foreground">{activeClient?.name || teamName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I dag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesToday || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne uge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne måned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats?.totalSales || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>{index + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{seller.commission.toLocaleString("da-DK")} kr</TableCell>
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
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>{index + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{seller.commission.toLocaleString("da-DK")} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Ingen salg i dag</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                  {recentSales.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: da })}</TableCell>
                      <TableCell>{sale.agent_name}</TableCell>
                      <TableCell className="font-mono">{sale.customer_phone || "-"}</TableCell>
                      <TableCell className="text-right font-mono">{(sale.total_commission || 0).toLocaleString("da-DK")} kr</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Ingen salg endnu</p>
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
        multiClient={config.multiClient}
      />
    </DashboardLayout>
  );
};

export default TeamDashboard;
