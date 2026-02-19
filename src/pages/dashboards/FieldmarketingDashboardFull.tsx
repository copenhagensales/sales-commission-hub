import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { format } from "date-fns";
import { fetchAllRows } from "@/utils/supabasePagination";

import { getPayrollPeriod } from "@/utils/payrollPeriod";
import { da } from "date-fns/locale";
import { TrendingUp, Users, Calendar, Package, Trophy, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { DateRange } from "react-day-picker";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";

const TAB_TO_CLIENT_ID: Record<string, string> = {
  "eesy-fm": FIELDMARKETING_CLIENTS.EESY_FM,
  "yousee": FIELDMARKETING_CLIENTS.YOUSEE,
};

// Tab configuration with permission keys
const allTabs = [
  { value: "eesy-fm", label: "Eesy FM", permissionKey: "tab_fm_eesy" },
  { value: "yousee", label: "Yousee", permissionKey: "tab_fm_yousee" },
];

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  dateRange: DateRange | undefined;
  isPayrollPeriod: boolean;
}

const ClientDashboard = ({ clientId, clientName, dateRange, isPayrollPeriod }: ClientDashboardProps) => {
  const { data: sales, isLoading: salesLoading } = useFieldmarketingSales(clientId);
  const { data: stats, isLoading: statsLoading } = useFieldmarketingSalesStats(clientId);

  // Fetch product commissions for this client
  const { data: productCommissions } = useQuery({
    queryKey: ["fieldmarketing-product-commissions", clientId],
    staleTime: 120000, // 2 minutter
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          name,
          commission_dkk,
          client_campaign:client_campaign_id (
            client_id
          )
        `)
        .not("client_campaign_id", "is", null);
      
      if (error) throw error;
      
      const commissionMap: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.client_campaign?.client_id === clientId) {
          commissionMap[p.name] = p.commission_dkk || 0;
        }
      });
      return commissionMap;
    },
  });

  // Fetch ALL sellers with sales in the selected period and calculate commission
  const { data: topSellers } = useQuery({
    queryKey: ["fieldmarketing-period-sellers", clientId, productCommissions, dateRange?.from, dateRange?.to],
    staleTime: 120000, // 2 minutter
    queryFn: async () => {
      const defaultPayrollPeriod = getPayrollPeriod(new Date());
      const periodStart = dateRange?.from?.toISOString() || defaultPayrollPeriod.start.toISOString();
      const periodEnd = dateRange?.to?.toISOString() || defaultPayrollPeriod.end.toISOString();
      
      const periodSales = await fetchAllRows<{id: string; sale_datetime: string; raw_payload: any}>(
        "sales",
        "id, sale_datetime, raw_payload",
        (q) => q
          .eq("source", "fieldmarketing")
          .contains("raw_payload", { fm_client_id: clientId })
          .gte("sale_datetime", periodStart)
          .lte("sale_datetime", periodEnd),
        { orderBy: "sale_datetime", ascending: false }
      );

      // Fetch seller info separately
      const sellerIds = [...new Set((periodSales || []).map((s: any) => s.raw_payload?.fm_seller_id).filter(Boolean))];
      const { data: sellers } = sellerIds.length > 0 
        ? await supabase.from("employee_master_data").select("id, first_name, last_name").in("id", sellerIds)
        : { data: [] };
      const sellerMap = new Map((sellers || []).map(s => [s.id, s]));

      const sellerStats: Record<string, { name: string; count: number; commission: number }> = {};
      (periodSales || []).forEach((sale: any) => {
        const sellerId = sale.raw_payload?.fm_seller_id;
        const seller = sellerMap.get(sellerId);
        const sellerName = seller ? `${seller.first_name} ${seller.last_name}` : "Ukendt";
        const productName = sale.raw_payload?.fm_product_name;
        const commission = productCommissions?.[productName] || 0;
        
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, count: 0, commission: 0 };
        }
        sellerStats[sellerId].count += 1;
        sellerStats[sellerId].commission += commission;
      });

      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

  // Calculate today's sellers with sales and commission
  const { data: todaySellers } = useQuery({
    queryKey: ["fieldmarketing-today-sellers", clientId, productCommissions],
    staleTime: 120000, // 2 minutter
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      const todaySales = await fetchAllRows<{id: string; sale_datetime: string; raw_payload: any}>(
        "sales",
        "id, sale_datetime, raw_payload",
        (q) => q
          .eq("source", "fieldmarketing")
          .contains("raw_payload", { fm_client_id: clientId })
          .gte("sale_datetime", todayStart),
        { orderBy: "sale_datetime", ascending: false }
      );

      // Fetch seller info separately
      const sellerIds = [...new Set((todaySales || []).map((s: any) => s.raw_payload?.fm_seller_id).filter(Boolean))];
      const { data: sellers } = sellerIds.length > 0 
        ? await supabase.from("employee_master_data").select("id, first_name, last_name").in("id", sellerIds)
        : { data: [] };
      const sellerMap = new Map((sellers || []).map(s => [s.id, s]));

      const sellerStats: Record<string, { name: string; sales: number; commission: number }> = {};
      (todaySales || []).forEach((sale: any) => {
        const sellerId = sale.raw_payload?.fm_seller_id;
        const seller = sellerMap.get(sellerId);
        const sellerName = seller ? `${seller.first_name} ${seller.last_name}` : "Ukendt";
        const productName = sale.raw_payload?.fm_product_name;
        const commission = productCommissions?.[productName] || 0;
        
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, sales: 0, commission: 0 };
        }
        sellerStats[sellerId].sales += 1;
        sellerStats[sellerId].commission += commission;
      });

      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

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
        {/* Period Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {isPayrollPeriod ? "Lønperiode" : "Valgt periode"}
            </CardTitle>
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
              <p className="text-muted-foreground text-sm text-center py-8">Ingen salg i perioden</p>
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

const FieldmarketingDashboardFull = () => {
  // Runtime access check - redirects if user doesn't have team-based permission
  const { canView: hasDashboardAccess, isLoading: accessLoading } = useRequireDashboardAccess("fieldmarketing");
  
  
  // Date range state - default to payroll period (15th to 14th)
  const defaultPayrollPeriod = getPayrollPeriod(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultPayrollPeriod.start,
    to: defaultPayrollPeriod.end,
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const allSales = await fetchAllRows<{
        id: string; sale_datetime: string; agent_name: string; customer_phone: string;
        validation_status: string; raw_payload: any; client_campaign_id: string;
      }>(
        "sales",
        "id, sale_datetime, agent_name, customer_phone, validation_status, raw_payload, client_campaign_id",
        (q) => q.eq("source", "fieldmarketing"),
        { orderBy: "sale_datetime", ascending: false }
      );

      // Fetch client names via client_campaigns
      const campaignIds = [...new Set(allSales.map(s => s.client_campaign_id).filter(Boolean))];
      let clientMap: Record<string, string> = {};
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id, client:client_id(name)")
          .in("id", campaignIds);
        (campaigns || []).forEach((cc: any) => {
          clientMap[cc.id] = cc.client?.name || "";
        });
      }

      const rows = allSales.map(s => ({
        Dato: s.sale_datetime ? format(new Date(s.sale_datetime), "yyyy-MM-dd HH:mm") : "",
        Sælger: s.agent_name || "",
        Telefonnummer: s.customer_phone || "",
        Produkt: s.raw_payload?.fm_product_name || "",
        Klient: clientMap[s.client_campaign_id] || "",
        Validering: s.validation_status || "",
        Kommentar: s.raw_payload?.fm_comment || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "FM Salg");
      XLSX.writeFile(wb, `FM_salg_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setIsCustomRange(true);
  };
  
  const defaultTab = allTabs[0]?.value || "eesy-fm";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Fetch client logos dynamically from the database
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients", Object.values(FIELDMARKETING_CLIENTS)],
    staleTime: 300000, // 5 minutter - client data ændrer sig sjældent
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", Object.values(FIELDMARKETING_CLIENTS));
      
      if (error) throw error;
      return data || [];
    },
  });

  if (accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Access check handled by hook - this is extra safety
  if (!hasDashboardAccess) {
    return null;
  }

  const activeClientId = TAB_TO_CLIENT_ID[activeTab];
  const activeClient = clients?.find(c => c.id === activeClientId);

  // Use static class names so Tailwind can find them at build-time
  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };
  const gridColsClass = gridColsMap[allTabs.length] || "grid-cols-2";

  return (
    <DashboardLayout>
      <DashboardHeader 
        title="Fieldmarketing Dashboard" 
        subtitle="Oversigt over salg fra fieldmarketing events"
        rightContent={
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Excel
            </Button>
            <DashboardDateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange} 
            />
            <div className="h-10 flex items-center">
              {activeClient?.logo_url ? (
                <img 
                  src={activeClient.logo_url} 
                  alt={activeClient.name} 
                  className="max-h-10 max-w-32 object-contain"
                />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">{activeClient?.name || "..."}</span>
              )}
            </div>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-md ${gridColsClass}`}>
          {allTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {allTabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <ClientDashboard 
              clientId={TAB_TO_CLIENT_ID[tab.value]} 
              clientName={tab.label}
              dateRange={dateRange}
              isPayrollPeriod={!isCustomRange}
            />
          </TabsContent>
        ))}
      </Tabs>
    </DashboardLayout>
  );
};

export default FieldmarketingDashboardFull;