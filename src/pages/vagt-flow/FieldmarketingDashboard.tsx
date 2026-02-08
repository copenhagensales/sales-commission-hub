import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  useFieldmarketingSales, 
  useFieldmarketingSalesStats,
  FIELDMARKETING_CLIENTS 
} from "@/hooks/useFieldmarketingSales";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { TrendingUp, Users, Calendar, Package, Trophy, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCommission {
  name: string;
  commission_dkk: number;
}

const ClientDashboard = ({ clientId, clientName, selectedDate }: { clientId: string; clientName: string; selectedDate: Date }) => {
  const { data: sales, isLoading: salesLoading } = useFieldmarketingSales(clientId);
  const { data: stats, isLoading: statsLoading } = useFieldmarketingSalesStats(clientId);
  
  const dayStart = startOfDay(selectedDate).toISOString();
  const dayEnd = endOfDay(selectedDate).toISOString();

  // Fetch product commissions - use product_pricing_rules (same as DailyReports)
  const { data: productCommissions } = useQuery({
    queryKey: ["fieldmarketing-product-commissions", clientId],
    queryFn: async () => {
      // 1. Get base commissions from products table for this client
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, name, commission_dkk, client_campaign:client_campaign_id(client_id)")
        .not("client_campaign_id", "is", null);
      
      if (productError) throw productError;
      
      // Create base commission map from products
      const commissionMap: Record<string, number> = {};
      const productIdToName: Record<string, string> = {};
      
      (products || []).forEach((p: any) => {
        if (p.client_campaign?.client_id === clientId) {
          commissionMap[p.name] = p.commission_dkk || 0;
          productIdToName[p.id] = p.name;
        }
      });
      
      // 2. Get product_pricing_rules - these OVERRIDE base commissions (same as DailyReports)
      const { data: pricingRules, error: rulesError } = await supabase
        .from("product_pricing_rules")
        .select("product_id, commission_dkk, priority")
        .eq("is_active", true);
      
      if (rulesError) throw rulesError;
      
      // Group rules by product_id and keep highest priority rule for each
      const bestRuleByProduct: Record<string, { commission: number; priority: number }> = {};
      
      (pricingRules || []).forEach((rule: any) => {
        if (!rule.product_id) return;
        
        const existing = bestRuleByProduct[rule.product_id];
        const rulePriority = rule.priority || 0;
        
        if (!existing || rulePriority > existing.priority) {
          bestRuleByProduct[rule.product_id] = {
            commission: rule.commission_dkk || 0,
            priority: rulePriority,
          };
        }
      });
      
      // Apply pricing rules to override base commissions
      Object.entries(bestRuleByProduct).forEach(([productId, { commission }]) => {
        const productName = productIdToName[productId];
        if (productName) {
          commissionMap[productName] = commission;
        }
      });
      
      return commissionMap;
    },
  });

  // Fetch ALL sellers with sales this month and calculate commission
  const { data: topSellers } = useQuery({
    queryKey: ["fieldmarketing-month-sellers", clientId, productCommissions],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: monthSales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          raw_payload,
          sale_datetime
        `)
        .eq("source", "fieldmarketing")
        .contains("raw_payload", { fm_client_id: clientId })
        .gte("sale_datetime", monthStart);
      
      if (error) throw error;

      // We need to fetch employee names separately
      const sellerIds = [...new Set((monthSales || []).map((s: any) => (s.raw_payload as any)?.fm_seller_id).filter(Boolean))] as string[];
      const { data: employeeData } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", sellerIds.length > 0 ? sellerIds : ["_"]);
      
      const employeeMap = new Map((employeeData || []).map(e => [e.id, e]));
      
      // Group by seller
      const sellerStats: Record<string, { name: string; count: number; commission: number }> = {};
      (monthSales || []).forEach((sale: any) => {
        const rawPayload = sale.raw_payload as any;
        const sellerId = rawPayload?.fm_seller_id;
        const employee = employeeMap.get(sellerId);
        const sellerName = employee ? `${employee.first_name} ${employee.last_name}` : (sale.agent_name || "Ukendt");
        const productName = rawPayload?.fm_product_name;
        const commission = productCommissions?.[productName] || 0;
        
        if (!sellerId) return;
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, count: 0, commission: 0 };
        }
        sellerStats[sellerId].count += 1;
        sellerStats[sellerId].commission += commission;
      });

      // Convert to array and sort by commission
      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

  // Calculate selected day's sellers with sales and commission
  const { data: daySellers } = useQuery({
    queryKey: ["fieldmarketing-day-sellers", clientId, productCommissions, dayStart],
    queryFn: async () => {
      const { data: daySales, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          raw_payload,
          sale_datetime
        `)
        .eq("source", "fieldmarketing")
        .contains("raw_payload", { fm_client_id: clientId })
        .gte("sale_datetime", dayStart)
        .lte("sale_datetime", dayEnd);
      
      if (error) throw error;

      // Fetch employee names
      const sellerIds = [...new Set((daySales || []).map((s: any) => (s.raw_payload as any)?.fm_seller_id).filter(Boolean))] as string[];
      const { data: employeeData } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", sellerIds.length > 0 ? sellerIds : ["_"]);
      
      const employeeMap = new Map((employeeData || []).map(e => [e.id, e]));

      // Group by seller
      const sellerStats: Record<string, { name: string; sales: number; commission: number }> = {};
      (daySales || []).forEach((sale: any) => {
        const rawPayload = sale.raw_payload as any;
        const sellerId = rawPayload?.fm_seller_id;
        const employee = employeeMap.get(sellerId);
        const sellerName = employee ? `${employee.first_name} ${employee.last_name}` : (sale.agent_name || "Ukendt");
        const productName = rawPayload?.fm_product_name;
        const commission = productCommissions?.[productName] || 0;
        
        if (!sellerId) return;
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, sales: 0, commission: 0 };
        }
        sellerStats[sellerId].sales += 1;
        sellerStats[sellerId].commission += commission;
      });

      // Convert to array and sort by commission
      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

  // Calculate commission for each sale
  const salesWithCommission = sales?.map(sale => ({
    ...sale,
    commission: productCommissions?.[sale.product_name] || 0,
  }));

  if (salesLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I dag</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesToday || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne uge</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne måned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSales || 0}</div>
            <p className="text-xs text-muted-foreground">salg i alt</p>
          </CardContent>
        </Card>
      </div>

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
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.count}</TableCell>
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

        {/* Selected Day's Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">
              {format(selectedDate, "d. MMMM", { locale: da })} - Sælgere
            </CardTitle>
          </CardHeader>
          <CardContent>
            {daySellers && daySellers.length > 0 ? (
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
                    {daySellers.map((seller, index) => (
                      <TableRow key={index}>
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
                Ingen salg registreret denne dag
              </p>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Recent Sales Table with Commission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seneste salg</CardTitle>
        </CardHeader>
        <CardContent>
          {salesWithCommission && salesWithCommission.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesWithCommission.slice(0, 10).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.registered_at), "dd/MM/yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell>
                        {sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}` : "-"}
                      </TableCell>
                      <TableCell>{sale.location?.name || "-"}</TableCell>
                      <TableCell>{sale.product_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {sale.commission.toLocaleString("da-DK")} kr
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

const TAB_TO_CLIENT_ID: Record<string, string> = {
  "eesy-fm": FIELDMARKETING_CLIENTS.EESY_FM,
  "yousee": FIELDMARKETING_CLIENTS.YOUSEE,
};

const FieldmarketingDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("eesy-fm");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Fetch client logos dynamically from the database
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients", Object.values(FIELDMARKETING_CLIENTS)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", Object.values(FIELDMARKETING_CLIENTS));
      
      if (error) throw error;
      return data || [];
    },
  });

  const activeClientId = TAB_TO_CLIENT_ID[activeTab];
  const activeClient = clients?.find(c => c.id === activeClientId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Fieldmarketing Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Oversigt over salg fra fieldmarketing events
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "EEEE d. MMMM", { locale: da })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    locale={da}
                  />
                </PopoverContent>
              </Popover>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={goToNextDay}
                disabled={isToday}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                  I dag
                </Button>
              )}
            </div>
            <div className="h-14 w-36 flex items-center justify-center">
              {activeClient?.logo_url ? (
                <img 
                  src={activeClient.logo_url} 
                  alt={activeClient.name} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="h-16 px-6 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-xl font-bold text-muted-foreground">{activeClient?.name || "..."}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="eesy-fm">Eesy FM</TabsTrigger>
            <TabsTrigger value="yousee">Yousee</TabsTrigger>
          </TabsList>

          <TabsContent value="eesy-fm" className="mt-6">
            <ClientDashboard 
              clientId={FIELDMARKETING_CLIENTS.EESY_FM} 
              clientName="Eesy FM"
              selectedDate={selectedDate}
            />
          </TabsContent>

          <TabsContent value="yousee" className="mt-6">
            <ClientDashboard 
              clientId={FIELDMARKETING_CLIENTS.YOUSEE} 
              clientName="Yousee"
              selectedDate={selectedDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default FieldmarketingDashboard;
