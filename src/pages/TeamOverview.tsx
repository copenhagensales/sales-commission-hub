import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Building2, ShoppingCart, TrendingUp, CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TeamData {
  teamId: string;
  teamName: string;
  clients: ClientData[];
  totalSalesToday: number;
  totalSalesMonth: number;
  totalCommissionToday: number;
  totalCommissionMonth: number;
}

interface ClientData {
  clientId: string;
  clientName: string;
  salesToday: number;
  salesMonth: number;
  commissionToday: number;
  commissionMonth: number;
}

const formatNumber = (value: number) => 
  new Intl.NumberFormat('da-DK').format(value);

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' kr';

export default function TeamOverview() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const { data: teamsData, isLoading } = useQuery({
    queryKey: ["team-overview", selectedDate.toDateString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const monthStart = startOfMonth(selectedDate);

      // Get teams with their clients
      const { data: teamsWithClients } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          team_clients (
            client_id,
            clients (
              id,
              name
            )
          )
        `)
        .order("name");

      if (!teamsWithClients?.length) return [];

      // Get all client campaigns for mapping
      const { data: allCampaigns } = await supabase
        .from("client_campaigns")
        .select("id, client_id");

      const campaignToClient = new Map<string, string>();
      (allCampaigns || []).forEach(c => {
        campaignToClient.set(c.id, c.client_id);
      });

      const campaignIds = (allCampaigns || []).map(c => c.id);
      if (campaignIds.length === 0) return [];

      // Fetch today's sales
      const { data: todaySales } = await supabase
        .from("sales")
        .select(`
          id,
          client_campaign_id,
          sale_items (
            quantity,
            mapped_commission,
            products (
              commission_dkk,
              counts_as_sale
            )
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", dayStart.toISOString())
        .lt("sale_datetime", dayEnd.toISOString());

      // Fetch month's sales
      const { data: monthSales } = await supabase
        .from("sales")
        .select(`
          id,
          client_campaign_id,
          sale_items (
            quantity,
            mapped_commission,
            products (
              commission_dkk,
              counts_as_sale
            )
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart.toISOString())
        .lt("sale_datetime", dayEnd.toISOString());

      // Aggregate sales by client
      const aggregateSales = (sales: any[]) => {
        const clientStats = new Map<string, { sales: number; commission: number }>();
        
        sales.forEach((sale: any) => {
          const clientId = campaignToClient.get(sale.client_campaign_id);
          if (!clientId) return;

          (sale.sale_items || []).forEach((item: any) => {
            const countsAsSale = item.products?.counts_as_sale !== false;
            if (!countsAsSale) return;

            const qty = Number(item.quantity) || 1;
            const commission = qty * (Number(item.products?.commission_dkk) || Number(item.mapped_commission) || 0);

            const existing = clientStats.get(clientId) || { sales: 0, commission: 0 };
            existing.sales += qty;
            existing.commission += commission;
            clientStats.set(clientId, existing);
          });
        });

        return clientStats;
      };

      const todayStats = aggregateSales(todaySales || []);
      const monthStats = aggregateSales(monthSales || []);

      // Build team data
      const teamData: TeamData[] = teamsWithClients.map(team => {
        const clients: ClientData[] = (team.team_clients || [])
          .filter((tc: any) => tc.clients)
          .map((tc: any) => {
            const clientId = tc.clients.id;
            const todayData = todayStats.get(clientId) || { sales: 0, commission: 0 };
            const monthData = monthStats.get(clientId) || { sales: 0, commission: 0 };

            return {
              clientId,
              clientName: tc.clients.name,
              salesToday: todayData.sales,
              salesMonth: monthData.sales,
              commissionToday: todayData.commission,
              commissionMonth: monthData.commission,
            };
          })
          .sort((a: ClientData, b: ClientData) => b.salesMonth - a.salesMonth);

        return {
          teamId: team.id,
          teamName: team.name,
          clients,
          totalSalesToday: clients.reduce((sum, c) => sum + c.salesToday, 0),
          totalSalesMonth: clients.reduce((sum, c) => sum + c.salesMonth, 0),
          totalCommissionToday: clients.reduce((sum, c) => sum + c.commissionToday, 0),
          totalCommissionMonth: clients.reduce((sum, c) => sum + c.commissionMonth, 0),
        };
      }).sort((a, b) => b.totalSalesMonth - a.totalSalesMonth);

      return teamData;
    },
    refetchInterval: 30000,
  });

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!teamsData?.length) return { salesToday: 0, salesMonth: 0, commissionToday: 0, commissionMonth: 0 };
    return {
      salesToday: teamsData.reduce((sum, t) => sum + t.totalSalesToday, 0),
      salesMonth: teamsData.reduce((sum, t) => sum + t.totalSalesMonth, 0),
      commissionToday: teamsData.reduce((sum, t) => sum + t.totalCommissionToday, 0),
      commissionMonth: teamsData.reduce((sum, t) => sum + t.totalCommissionMonth, 0),
    };
  }, [teamsData]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teamsoverblik</h1>
            <p className="text-muted-foreground">
              Salgsstatistik fordelt på teams og kunder
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{formatNumber(totals.salesToday)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne måned</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{formatNumber(totals.salesMonth)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision i dag</CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{formatCurrency(totals.commissionToday)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision denne måned</CardTitle>
              <Building2 className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-violet-600">{formatCurrency(totals.commissionMonth)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Teams Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-16 bg-muted/30" />
                <CardContent className="h-32 bg-muted/10" />
              </Card>
            ))}
          </div>
        ) : teamsData?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ingen teams fundet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teamsData?.map(team => (
              <Card key={team.teamId} className="overflow-hidden transition-shadow hover:shadow-lg">
                <Collapsible
                  open={expandedTeams.has(team.teamId)}
                  onOpenChange={() => toggleTeam(team.teamId)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer bg-gradient-to-r from-muted/50 to-transparent hover:from-muted/70 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{team.teamName}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {team.clients.length} {team.clients.length === 1 ? 'kunde' : 'kunder'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{formatNumber(team.totalSalesToday)}</div>
                            <div className="text-xs text-muted-foreground">salg i dag</div>
                          </div>
                          {expandedTeams.has(team.teamId) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CardContent className="pt-4">
                    {/* Team Summary */}
                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Måned</div>
                        <div className="text-xl font-semibold">{formatNumber(team.totalSalesMonth)} salg</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Provision måned</div>
                        <div className="text-xl font-semibold">{formatCurrency(team.totalCommissionMonth)}</div>
                      </div>
                    </div>

                    <CollapsibleContent>
                      {/* Clients List */}
                      <div className="space-y-2 mt-4 border-t pt-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Kunder</div>
                        {team.clients.map(client => (
                          <div 
                            key={client.clientId} 
                            className="flex items-center justify-between p-3 rounded-lg bg-background border hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="font-medium">{client.clientName}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary" className="tabular-nums">
                                {client.salesToday} i dag
                              </Badge>
                              <Badge variant="outline" className="tabular-nums">
                                {client.salesMonth} måned
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
