import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTvBoardContext } from "@/contexts/TvBoardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Trophy, Building2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

// Helper function to shorten names: "John Doe" -> "John D."
const shortenName = (name: string): string => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Check if we're in TV mode (accessed via TV board without auth)
  const isTvMode = typeof window !== 'undefined' && sessionStorage.getItem('tv_board_code');
  const tvAccessCode = typeof window !== 'undefined' ? sessionStorage.getItem('tv_board_code') : null;
  
  // Fetch data from edge function in TV mode (bypasses RLS)
  const { data: tvData, isLoading: isLoadingTvData } = useQuery({
    queryKey: ["tv-team-dashboard-data", teamSlug, tvAccessCode],
    queryFn: async () => {
      // Call edge function with query params
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tv-dashboard-data?dashboard=${teamSlug}&code=${tvAccessCode || ''}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch TV dashboard data');
      }
      
      return res.json();
    },
    enabled: !!isTvMode,
    refetchInterval: 30000, // Refresh every 30 seconds in TV mode
  });
  
  // Fetch team and its clients from team_clients table (only when not in TV mode)
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
    enabled: !isTvMode,
  });

  // Use TV data when in TV mode, otherwise use direct queries
  const tvClients = tvData?.clients || [];
  const tvTopSellers = tvData?.topSellers || [];
  
  const clients = isTvMode ? tvClients.map((c: any) => ({
    id: c.clientId,
    name: c.clientName,
    logo_url: c.logoUrl,
  })) : (teamData?.clients || []);
  const clientIds = clients.map((c: any) => c.id);

  // Fetch sales stats for ALL clients at once (for multi-client view) - disabled in TV mode
  const { data: allClientStats } = useQuery({
    queryKey: ["team-dashboard-all-client-stats", clientIds, selectedDate.toDateString()],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const dayStart = startOfDay(selectedDate);
      const todayStart = dayStart.toISOString();
      const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1).toISOString();

      // Get all campaigns for all clients
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id")
        .in("client_id", clientIds);
      
      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);
      const campaignToClient = new Map(campaigns.map(c => [c.id, c.client_id]));

      // Get all sales with product info for counts_as_sale filtering
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id, sale_datetime, client_campaign_id,
          sale_items (
            quantity,
            product_id,
            products (counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // Group by client
      const statsMap = new Map<string, { salesToday: number; salesThisMonth: number }>();
      clientIds.forEach(id => statsMap.set(id, { salesToday: 0, salesThisMonth: 0 }));

      (sales || []).forEach((sale: any) => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        if (clientId && statsMap.has(clientId)) {
          const stats = statsMap.get(clientId)!;
          // Count only items where counts_as_sale !== false
          const validSales = (sale.sale_items || []).filter((item: any) => 
            item.products?.counts_as_sale !== false
          ).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
          
          stats.salesThisMonth += validSales;
          if (sale.sale_datetime >= todayStart) {
            stats.salesToday += validSales;
          }
        }
      });

      // Convert to array, only include clients with sales
      const result: ClientSalesStats[] = clients
        .map((client: any) => ({
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
    enabled: clientIds.length > 0 && multiClient && !isTvMode,
  });

  // Use TV data for client stats in TV mode
  const effectiveClientStats = isTvMode ? tvClients : (allClientStats || []);

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
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (commission_dkk, counts_as_sale)
          )
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
        // Only count items where counts_as_sale !== false
        (sale.sale_items || []).forEach((item: any) => {
          if (item.products?.counts_as_sale === false) return;
          const qty = Number(item.quantity) || 1;
          stats.sales += qty;
          stats.commission += qty * (Number(item.products?.commission_dkk) || Number(item.mapped_commission) || 0);
        });
      });

      return Array.from(agentClientStats.values())
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  // Fetch today's sellers across ALL clients (for multi-client view)
  const { data: allTodaySellers } = useQuery({
    queryKey: ["team-dashboard-all-today-sellers", clientIds, selectedDate.toDateString()],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const dayStart = startOfDay(selectedDate);
      const todayStart = dayStart.toISOString();

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
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (commission_dkk, counts_as_sale)
          )
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
        // Only count items where counts_as_sale !== false
        (sale.sale_items || []).forEach((item: any) => {
          if (item.products?.counts_as_sale === false) return;
          const qty = Number(item.quantity) || 1;
          stats.sales += qty;
          stats.commission += qty * (Number(item.products?.commission_dkk) || Number(item.mapped_commission) || 0);
        });
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
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (commission_dkk, counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => {
        const clientId = campaignToClient.get(sale.client_campaign_id);
        const client = clients.find(c => c.id === clientId);
        // Only count items where counts_as_sale !== false
        const validItems = (sale.sale_items || []).filter((item: any) => item.products?.counts_as_sale !== false);
        const total_commission = validItems.reduce((sum: number, item: any) => {
          const qty = Number(item.quantity) || 1;
          return sum + qty * (Number(item.products?.commission_dkk) || Number(item.mapped_commission) || 0);
        }, 0);
        return {
          ...sale,
          clientName: client?.name || "Ukendt",
          clientLogo: client?.logo_url,
          total_commission,
        };
      });
    },
    enabled: clientIds.length > 0 && multiClient,
  });

  if (isTvMode ? isLoadingTvData : isLoadingTeam) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (clients.length === 0 && !isTvMode) {
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

  // Multi-client view (United style) - only for multiClient dashboards, NOT forced by TV mode
  if (multiClient) {
    const clientsWithSales = isTvMode ? effectiveClientStats : (allClientStats || []);
    const monthSellers = isTvMode ? tvTopSellers : (allMonthSellers || []);
    const todaySellers = isTvMode ? tvTopSellers : (allTodaySellers || []);
    const recentSales = allRecentSales || [];

    return (
      <div className="min-h-screen bg-background p-6">
        <DashboardHeader 
          title={`${teamName} Dashboard`}
          subtitle="Oversigt over salg på tværs af kunder"
          rightContent={
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal text-sm",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{format(selectedDate, "d. MMM yyyy", { locale: da })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                  locale={da}
                />
              </PopoverContent>
            </Popover>
          }
        />

        {/* Client cards grid */}
        {clientsWithSales.length > 0 ? (
          <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {clientsWithSales.map((client) => (
              <Card key={client.clientId} className="relative overflow-hidden">
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col items-center text-center gap-1 md:gap-2">
                    <div className="h-6 md:h-8 w-full flex items-center justify-center">
                      {client.logoUrl ? (
                        <img 
                          src={client.logoUrl} 
                          alt={client.clientName} 
                          className="max-h-6 md:max-h-8 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs md:text-sm font-semibold text-foreground truncate max-w-full">
                          {client.clientName}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 md:gap-6 mt-1 md:mt-2">
                      <div className="text-center">
                        <div className="text-xl md:text-3xl font-bold text-foreground">{client.salesToday}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground">i dag</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl md:text-3xl font-bold text-foreground">{client.salesThisMonth}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground">måned</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 md:py-8 text-center text-muted-foreground text-sm md:text-base">
              Ingen salg registreret denne måned
            </CardContent>
          </Card>
        )}

        {/* Tables side by side */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          {/* Month Sellers Table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 p-3 md:p-6">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
              <CardTitle className="text-base md:text-lg">Månedens sælgere</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {monthSellers.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 md:w-12 text-xs md:text-sm">#</TableHead>
                        <TableHead className="text-xs md:text-sm">Sælger</TableHead>
                        <TableHead className="hidden sm:table-cell text-xs md:text-sm">Kunde</TableHead>
                        <TableHead className="text-right text-xs md:text-sm">Salg</TableHead>
                        <TableHead className="text-right text-xs md:text-sm">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthSellers.slice(0, 15).map((seller, index) => (
                        <TableRow key={`${seller.name}-${seller.clientId}`}>
                          <TableCell className="p-2 md:p-4">
                            <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"} className="text-xs">
                              {index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm md:text-lg whitespace-nowrap p-2 md:p-4">{shortenName(seller.name)}</TableCell>
                          <TableCell className="hidden sm:table-cell p-2 md:p-4">
                            <div className="h-5 md:h-6 w-16 md:w-20 flex items-center">
                              {seller.clientLogo ? (
                                <img 
                                  src={seller.clientLogo} 
                                  alt={seller.clientName} 
                                  className="max-h-5 md:max-h-6 max-w-16 md:max-w-20 object-contain"
                                  title={seller.clientName}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">{seller.clientName}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm md:text-lg font-semibold whitespace-nowrap p-2 md:p-4">{seller.sales}</TableCell>
                          <TableCell className="text-right font-mono text-sm md:text-lg font-bold whitespace-nowrap p-2 md:p-4">
                            {seller.commission.toLocaleString("da-DK")} kr
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6 md:py-8">Ingen salg denne måned</p>
              )}
            </CardContent>
          </Card>

          {/* Today's Sellers Table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 p-3 md:p-6">
              <Trophy className="h-4 w-4 md:h-5 md:w-5 text-yellow-500 shrink-0" />
              <CardTitle className="text-base md:text-lg">Sælgere {format(selectedDate, "d. MMMM", { locale: da })}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {todaySellers.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 md:w-12 text-xs md:text-sm">#</TableHead>
                        <TableHead className="text-xs md:text-sm">Sælger</TableHead>
                        <TableHead className="hidden sm:table-cell text-xs md:text-sm">Kunde</TableHead>
                        <TableHead className="text-right text-xs md:text-sm">Salg</TableHead>
                        <TableHead className="text-right text-xs md:text-sm">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todaySellers.map((seller, index) => (
                        <TableRow key={`${seller.name}-${seller.clientId}`}>
                          <TableCell className="p-2 md:p-4">
                            <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"} className="text-xs">
                              {index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm md:text-lg whitespace-nowrap p-2 md:p-4">{shortenName(seller.name)}</TableCell>
                          <TableCell className="hidden sm:table-cell p-2 md:p-4">
                            <div className="h-5 md:h-6 w-16 md:w-20 flex items-center">
                              {seller.clientLogo ? (
                                <img 
                                  src={seller.clientLogo} 
                                  alt={seller.clientName} 
                                  className="max-h-5 md:max-h-6 max-w-16 md:max-w-20 object-contain"
                                  title={seller.clientName}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">{seller.clientName}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm md:text-lg font-semibold whitespace-nowrap p-2 md:p-4">{seller.sales}</TableCell>
                          <TableCell className="text-right font-mono text-sm md:text-lg font-bold whitespace-nowrap p-2 md:p-4">
                            {seller.commission.toLocaleString("da-DK")} kr
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6 md:py-8">
                  Ingen salg registreret i dag
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales Table */}
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-base md:text-lg">Seneste salg</CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0">
            {recentSales.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Dato</TableHead>
                      <TableHead className="text-xs md:text-sm">Sælger</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs md:text-sm">Kunde</TableHead>
                      <TableHead className="hidden md:table-cell text-xs md:text-sm">Telefon</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-sm md:text-lg whitespace-nowrap p-2 md:p-4">
                          {format(new Date(sale.created_at), "dd/MM HH:mm", { locale: da })}
                        </TableCell>
                        <TableCell className="font-medium text-sm md:text-lg whitespace-nowrap p-2 md:p-4">{shortenName(sale.agent_name)}</TableCell>
                        <TableCell className="hidden sm:table-cell p-2 md:p-4">
                          <div className="h-5 md:h-6 w-16 md:w-20 flex items-center">
                            {sale.clientLogo ? (
                              <img 
                                src={sale.clientLogo} 
                                alt={sale.clientName} 
                                className="max-h-5 md:max-h-6 max-w-16 md:max-w-20 object-contain"
                                title={sale.clientName}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{sale.clientName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-sm md:text-lg whitespace-nowrap p-2 md:p-4">{sale.customer_phone || "-"}</TableCell>
                        <TableCell className="text-right font-mono text-sm md:text-lg font-bold whitespace-nowrap p-2 md:p-4">
                          {(sale.total_commission || 0).toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6 md:py-8">
                Ingen salg registreret endnu
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Single client view (original behavior for other teams)
  return <SingleClientDashboard 
    clients={clients} 
    teamName={teamName} 
    tvData={isTvMode ? tvData : null}
    isTvMode={!!isTvMode}
  />;
};

// Single client dashboard component (extracted for clarity)
interface SingleClientDashboardProps {
  clients: TeamClient[];
  teamName: string;
  tvData?: any;
  isTvMode?: boolean;
}

const SingleClientDashboard = ({ clients, teamName, tvData, isTvMode }: SingleClientDashboardProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const activeClient = clients[0];
  const activeClientId = activeClient?.id;

  // Use TV data if available, otherwise fetch from Supabase
  const tvSalesStats = tvData ? {
    salesToday: tvData.totals?.salesToday || 0,
    salesThisWeek: tvData.totals?.salesToday || 0, // TV data doesn't have week, use today
    salesThisMonth: tvData.totals?.salesThisMonth || 0,
    totalSales: tvData.totals?.salesThisMonth || 0,
  } : null;

  const tvTopSellersMonthData = tvData?.topSellersMonth || [];
  const tvTopSellersTodayData = tvData?.topSellersToday || tvData?.topSellers || [];
  const tvRecentSalesData = tvData?.recentSales || [];

  // Fetch sales stats for selected client - disabled in TV mode
  const { data: salesStats } = useQuery({
    queryKey: ["team-dashboard-sales-stats", activeClientId, selectedDate.toDateString()],
    queryFn: async () => {
      if (!activeClientId) return null;

      const dayStart = startOfDay(selectedDate);
      const todayStart = dayStart.toISOString();
      const weekStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() - dayStart.getDay() + 1).toISOString();
      const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1).toISOString();

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return { salesToday: 0, salesThisWeek: 0, salesThisMonth: 0, totalSales: 0 };

      // Fetch sales from month start to avoid hitting row limits
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id, sale_datetime, agent_name,
          sale_items (
            quantity,
            product_id,
            products (counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // Count only items where counts_as_sale !== false
      const countValidSales = (sale: any) => {
        return (sale.sale_items || [])
          .filter((item: any) => item.products?.counts_as_sale !== false)
          .reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      };

      const allSales = sales || [];
      
      return {
        salesToday: allSales.filter(s => s.sale_datetime >= todayStart).reduce((sum, s) => sum + countValidSales(s), 0),
        salesThisWeek: allSales.filter(s => s.sale_datetime >= weekStart).reduce((sum, s) => sum + countValidSales(s), 0),
        salesThisMonth: allSales.reduce((sum, s) => sum + countValidSales(s), 0),
        totalSales: allSales.reduce((sum, s) => sum + countValidSales(s), 0),
      };
    },
    enabled: !!activeClientId && !isTvMode,
  });

  // Use TV data or fetched data
  const effectiveSalesStats = isTvMode ? tvSalesStats : salesStats;

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

      // Fetch campaign mappings for overrides
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id");
      
      const dialerCampaignToMappingId = new Map<string, string>();
      campaignMappings?.forEach(m => {
        if (m.adversus_campaign_id) {
          dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
        }
      });
      
      // Fetch product pricing rules (replaces product_campaign_overrides)
      const { data: productPricingRules } = await supabase
        .from("product_pricing_rules")
        .select("product_id, campaign_mapping_ids, commission_dkk, priority, is_active")
        .eq("is_active", true);
      
      // Helper to find best matching rule
      const findMatchingCommission = (productId: string, campaignMappingId: string | null): number | null => {
        if (!productPricingRules) return null;
        const rules = productPricingRules
          .filter(r => r.product_id === productId)
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        
        for (const rule of rules) {
          if (!rule.campaign_mapping_ids || rule.campaign_mapping_ids.length === 0) {
            return rule.commission_dkk ?? null;
          }
          if (campaignMappingId && rule.campaign_mapping_ids.includes(campaignMappingId)) {
            return rule.commission_dkk ?? null;
          }
        }
        return rules.find(r => !r.campaign_mapping_ids || r.campaign_mapping_ids.length === 0)?.commission_dkk ?? null;
      };

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          agent_email,
          dialer_campaign_id,
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;
      
      // Build agent email to employee name map - fetch all agents and mappings for this lookup
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, email");
      
      const emailToAgentId = new Map<string, string>();
      allAgents?.forEach(a => {
        if (a.email) emailToAgentId.set(a.email.toLowerCase(), a.id);
      });
      
      const { data: allMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id");
      
      const agentIdToEmployeeId = new Map<string, string>();
      allMappings?.forEach(m => agentIdToEmployeeId.set(m.agent_id, m.employee_id));
      
      const employeeIds = [...new Set(allMappings?.map(m => m.employee_id) || [])];
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", employeeIds);
      
      const employeeIdToName = new Map<string, string>();
      employees?.forEach(e => employeeIdToName.set(e.id, `${e.first_name} ${e.last_name}`.trim()));
      
      // Function to get employee name from agent email
      const getEmployeeName = (agentEmail: string | null, agentName: string): string => {
        if (!agentEmail) return agentName;
        const agentId = emailToAgentId.get(agentEmail.toLowerCase());
        if (!agentId) return agentName;
        const employeeId = agentIdToEmployeeId.get(agentId);
        if (!employeeId) return agentName;
        return employeeIdToName.get(employeeId) || agentName;
      };

      const agentStats: Record<string, { sales: number; commission: number }> = {};
      (sales || []).forEach((sale: any) => {
        const displayName = getEmployeeName(sale.agent_email, sale.agent_name);
        const campaignMappingId = sale.dialer_campaign_id ? dialerCampaignToMappingId.get(sale.dialer_campaign_id) : null;
        
        if (!agentStats[displayName]) {
          agentStats[displayName] = { sales: 0, commission: 0 };
        }
        // Only count items where counts_as_sale !== false
        (sale.sale_items || []).forEach((item: any) => {
          if (item.products?.counts_as_sale === false) return;
          const qty = Number(item.quantity) || 1;
          agentStats[displayName].sales += qty;
          
          // Check for pricing rule
          const ruleCommission = findMatchingCommission(item.product_id, campaignMappingId);
          
          if (ruleCommission !== null) {
            agentStats[displayName].commission += ruleCommission;
          } else {
            agentStats[displayName].commission += Number(item.mapped_commission) || 0;
          }
        });
      });

      return Object.entries(agentStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: !!activeClientId && !isTvMode,
  });

  // Use TV data or fetched data for top sellers (month)
  const effectiveTopSellers = isTvMode ? tvTopSellersMonthData : (topSellers || []);

  const { data: todaySellers } = useQuery({
    queryKey: ["team-dashboard-today-sellers", activeClientId, selectedDate.toDateString()],
    queryFn: async () => {
      if (!activeClientId) return [];

      const dayStart = startOfDay(selectedDate);
      const todayStart = dayStart.toISOString();

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", activeClientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      // Fetch campaign mappings for overrides
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id");
      
      const dialerCampaignToMappingId = new Map<string, string>();
      campaignMappings?.forEach(m => {
        if (m.adversus_campaign_id) {
          dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
        }
      });
      
      // Fetch product pricing rules (replaces product_campaign_overrides)
      const { data: productPricingRules } = await supabase
        .from("product_pricing_rules")
        .select("product_id, campaign_mapping_ids, commission_dkk, priority, is_active")
        .eq("is_active", true);
      
      // Helper to find best matching rule
      const findMatchingCommission = (productId: string, campaignMappingId: string | null): number | null => {
        if (!productPricingRules) return null;
        const rules = productPricingRules
          .filter(r => r.product_id === productId)
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        
        for (const rule of rules) {
          if (!rule.campaign_mapping_ids || rule.campaign_mapping_ids.length === 0) {
            return rule.commission_dkk ?? null;
          }
          if (campaignMappingId && rule.campaign_mapping_ids.includes(campaignMappingId)) {
            return rule.commission_dkk ?? null;
          }
        }
        return rules.find(r => !r.campaign_mapping_ids || r.campaign_mapping_ids.length === 0)?.commission_dkk ?? null;
      };

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          agent_email,
          dialer_campaign_id,
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", todayStart);
      
      if (error) throw error;
      
      // Build agent email to employee name map - fetch all agents and mappings for this lookup
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, email");
      
      const emailToAgentId = new Map<string, string>();
      allAgents?.forEach(a => {
        if (a.email) emailToAgentId.set(a.email.toLowerCase(), a.id);
      });
      
      const { data: allMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id");
      
      const agentIdToEmployeeId = new Map<string, string>();
      allMappings?.forEach(m => agentIdToEmployeeId.set(m.agent_id, m.employee_id));
      
      const employeeIds = [...new Set(allMappings?.map(m => m.employee_id) || [])];
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", employeeIds);
      
      const employeeIdToName = new Map<string, string>();
      employees?.forEach(e => employeeIdToName.set(e.id, `${e.first_name} ${e.last_name}`.trim()));
      
      // Function to get employee name from agent email
      const getEmployeeName = (agentEmail: string | null, agentName: string): string => {
        if (!agentEmail) return agentName;
        const agentId = emailToAgentId.get(agentEmail.toLowerCase());
        if (!agentId) return agentName;
        const employeeId = agentIdToEmployeeId.get(agentId);
        if (!employeeId) return agentName;
        return employeeIdToName.get(employeeId) || agentName;
      };

      const agentStats: Record<string, { sales: number; commission: number }> = {};
      (sales || []).forEach((sale: any) => {
        const displayName = getEmployeeName(sale.agent_email, sale.agent_name);
        const campaignMappingId = sale.dialer_campaign_id ? dialerCampaignToMappingId.get(sale.dialer_campaign_id) : null;
        
        if (!agentStats[displayName]) {
          agentStats[displayName] = { sales: 0, commission: 0 };
        }
        // Only count items where counts_as_sale !== false
        (sale.sale_items || []).forEach((item: any) => {
          if (item.products?.counts_as_sale === false) return;
          const qty = Number(item.quantity) || 1;
          agentStats[displayName].sales += qty;
          
          // Check for pricing rule
          const ruleCommission = findMatchingCommission(item.product_id, campaignMappingId);
          
          if (ruleCommission !== null) {
            agentStats[displayName].commission += ruleCommission;
          } else {
            agentStats[displayName].commission += Number(item.mapped_commission) || 0;
          }
        });
      });

      return Object.entries(agentStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.commission - a.commission);
    },
    enabled: !!activeClientId && !isTvMode,
  });

  // Use TV data or fetched data for today sellers
  const effectiveTodaySellers = isTvMode ? tvTopSellersTodayData : (todaySellers || []);

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

      // Fetch campaign mappings for overrides
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id");
      
      const dialerCampaignToMappingId = new Map<string, string>();
      campaignMappings?.forEach(m => {
        if (m.adversus_campaign_id) {
          dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
        }
      });
      
      // Fetch product pricing rules (replaces product_campaign_overrides)
      const { data: productPricingRules } = await supabase
        .from("product_pricing_rules")
        .select("product_id, campaign_mapping_ids, commission_dkk, priority, is_active")
        .eq("is_active", true);
      
      // Helper to find best matching rule
      const findMatchingCommission = (productId: string, campaignMappingId: string | null): number | null => {
        if (!productPricingRules) return null;
        const rules = productPricingRules
          .filter(r => r.product_id === productId)
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        
        for (const rule of rules) {
          if (!rule.campaign_mapping_ids || rule.campaign_mapping_ids.length === 0) {
            return rule.commission_dkk ?? null;
          }
          if (campaignMappingId && rule.campaign_mapping_ids.includes(campaignMappingId)) {
            return rule.commission_dkk ?? null;
          }
        }
        return rules.find(r => !r.campaign_mapping_ids || r.campaign_mapping_ids.length === 0)?.commission_dkk ?? null;
      };

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, sale_datetime, agent_name, agent_email, customer_phone, created_at, dialer_campaign_id,
          sale_items (
            quantity,
            mapped_commission,
            product_id,
            products (counts_as_sale)
          )
        `)
        .in("client_campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Build agent email to employee name map - fetch all agents and mappings for this lookup
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, email");
      
      const emailToAgentId = new Map<string, string>();
      allAgents?.forEach(a => {
        if (a.email) emailToAgentId.set(a.email.toLowerCase(), a.id);
      });
      
      const { data: allMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id");
      
      const agentIdToEmployeeId = new Map<string, string>();
      allMappings?.forEach(m => agentIdToEmployeeId.set(m.agent_id, m.employee_id));
      
      const employeeIds = [...new Set(allMappings?.map(m => m.employee_id) || [])];
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", employeeIds);
      
      const employeeIdToName = new Map<string, string>();
      employees?.forEach(e => employeeIdToName.set(e.id, `${e.first_name} ${e.last_name}`.trim()));
      
      // Function to get employee name from agent email
      const getEmployeeName = (agentEmail: string | null, agentName: string): string => {
        if (!agentEmail) return agentName;
        const agentId = emailToAgentId.get(agentEmail.toLowerCase());
        if (!agentId) return agentName;
        const employeeId = agentIdToEmployeeId.get(agentId);
        if (!employeeId) return agentName;
        return employeeIdToName.get(employeeId) || agentName;
      };
      
      return (data || []).map((sale: any) => {
        const campaignMappingId = sale.dialer_campaign_id ? dialerCampaignToMappingId.get(sale.dialer_campaign_id) : null;
        
        // Only count items where counts_as_sale !== false
        const validItems = (sale.sale_items || []).filter((item: any) => item.products?.counts_as_sale !== false);
        const total_commission = validItems.reduce((sum: number, item: any) => {
          const ruleCommission = findMatchingCommission(item.product_id, campaignMappingId);
          
          if (ruleCommission !== null) {
            return sum + ruleCommission;
          }
          return sum + (Number(item.mapped_commission) || 0);
        }, 0);
        return {
          ...sale,
          agent_name: getEmployeeName(sale.agent_email, sale.agent_name),
          total_commission,
        };
      });
    },
    enabled: !!activeClientId && !isTvMode,
  });

  // Use TV data for recent sales in TV mode
  const effectiveRecentSales = isTvMode ? tvRecentSalesData : (recentSales || []);

  const datePickerContent = (
    <div className="flex items-center gap-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(selectedDate, "EEEE d. MMMM yyyy", { locale: da })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            initialFocus
            className="pointer-events-auto"
            locale={da}
          />
        </PopoverContent>
      </Popover>
      <div className="h-10 w-32 flex items-center justify-end">
        {activeClient?.logo_url ? (
          <img src={activeClient.logo_url} alt={activeClient.name} className="max-h-10 max-w-32 object-contain" />
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{activeClient?.name || teamName}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title={`${teamName} Dashboard`}
        subtitle="Oversigt over salg og performance"
        rightContent={datePickerContent}
      />
      <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{format(selectedDate, "d. MMM", { locale: da })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{effectiveSalesStats?.salesToday || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne uge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{effectiveSalesStats?.salesThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne måned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{effectiveSalesStats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">salg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{effectiveSalesStats?.totalSales || 0}</div>
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
            {effectiveTopSellers && effectiveTopSellers.length > 0 ? (
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
                    {effectiveTopSellers.map((seller: any, index: number) => (
                      <TableRow key={seller.name}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>{index + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{(seller.commission || 0).toLocaleString("da-DK")} kr</TableCell>
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
          <CardTitle className="text-lg">Sælgere {format(selectedDate, "d. MMMM", { locale: da })}</CardTitle>
        </CardHeader>
        <CardContent>
          {effectiveTodaySellers && effectiveTodaySellers.length > 0 ? (
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
                  {effectiveTodaySellers.map((seller: any, index: number) => (
                    <TableRow key={seller.name}>
                      <TableCell>
                        <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>{index + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{seller.name}</TableCell>
                      <TableCell className="text-right">{seller.sales}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{(seller.commission || 0).toLocaleString("da-DK")} kr</TableCell>
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
          {effectiveRecentSales && effectiveRecentSales.length > 0 ? (
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
                  {effectiveRecentSales.map((sale: any) => {
                    // Handle both direct Supabase format and edge function format
                    const dateStr = sale.created_at || sale.saleDateTime;
                    const agentName = sale.agent_name || sale.agentName;
                    const commission = sale.total_commission ?? sale.commission ?? 0;
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>{format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: da })}</TableCell>
                        <TableCell>{agentName}</TableCell>
                        <TableCell className="font-mono">{sale.customer_phone || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{commission.toLocaleString("da-DK")} kr</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Ingen salg endnu</p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

const TeamDashboard = () => {
  const location = useLocation();
  const { overrideSlug } = useTvBoardContext();
  
  // Use override slug from TV board context, or extract from path
  const teamSlug = overrideSlug || location.pathname.split('/').pop();
  
  const config = teamSlug ? TEAM_CONFIG[teamSlug] : null;
  
  if (!config) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DashboardHeader title="Dashboard ikke fundet" />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Dashboard ikke fundet</p>
        </div>
      </div>
    );
  }

  return (
    <TeamDashboardContent 
      teamSlug={teamSlug!} 
      teamName={config.name}
      multiClient={config.multiClient}
    />
  );
};

export default TeamDashboard;
