import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertTriangle, Database, RefreshCw, ChevronLeft, ChevronRight, CalendarIcon, Search, ArrowUpDown, ArrowUp, ArrowDown, Code } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Sale {
  id: string;
  adversus_external_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  sale_datetime: string | null;
  adversus_opp_number: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  source: string | null;
  integration_type: string | null;
  campaign_name: string | null;
  dialer_campaign_id: string | null;
  raw_payload: Record<string, unknown> | null;
}

const PAGE_SIZE = 50;

type SortColumn = "integration_type" | "source" | "adversus_external_id" | "agent_name" | "customer_company" | "sale_datetime" | "adversus_opp_number" | "campaign_name";
type SortDirection = "asc" | "desc";

export default function DialerData() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "da" ? da : enUS;
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showRawJson, setShowRawJson] = useState<Sale | null>(null);
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("sale_datetime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch real counts from database
  const { data: stats } = useQuery({
    queryKey: ["dialer-stats", dateFrom, dateTo],
    queryFn: async () => {
      const fromDate = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
      const toDate = dateTo ? endOfDay(dateTo).toISOString() : undefined;

      // Get total count
      let totalQuery = supabase.from("sales").select("id", { count: "exact", head: true });
      if (fromDate) totalQuery = totalQuery.gte("sale_datetime", fromDate);
      if (toDate) totalQuery = totalQuery.lte("sale_datetime", toDate);
      const { count: total } = await totalQuery;

      // Get adversus count (by integration_type)
      let adversusQuery = supabase.from("sales").select("id", { count: "exact", head: true }).eq("integration_type", "adversus");
      if (fromDate) adversusQuery = adversusQuery.gte("sale_datetime", fromDate);
      if (toDate) adversusQuery = adversusQuery.lte("sale_datetime", toDate);
      const { count: adversus } = await adversusQuery;

      // Get enreach count (by integration_type)
      let enreachQuery = supabase.from("sales").select("id", { count: "exact", head: true }).eq("integration_type", "enreach");
      if (fromDate) enreachQuery = enreachQuery.gte("sale_datetime", fromDate);
      if (toDate) enreachQuery = enreachQuery.lte("sale_datetime", toDate);
      const { count: enreach } = await enreachQuery;

      // Get OPP present count (only for Adversus sales)
      let oppQuery = supabase.from("sales").select("id", { count: "exact", head: true })
        .eq("integration_type", "adversus")
        .not("adversus_opp_number", "is", null);
      if (fromDate) oppQuery = oppQuery.gte("sale_datetime", fromDate);
      if (toDate) oppQuery = oppQuery.lte("sale_datetime", toDate);
      const { count: withOpp } = await oppQuery;

      // Missing OPP only counts Adversus sales without OPP (Enreach doesn't use OPP)
      const missingOpp = (adversus || 0) - (withOpp || 0);

      return {
        total: total || 0,
        adversus: adversus || 0,
        enreach: enreach || 0,
        withOpp: withOpp || 0,
        missingOpp: missingOpp,
      };
    },
  });

  // Fetch campaign mappings for lookup
  const { data: campaignMappings } = useQuery({
    queryKey: ["campaign-mappings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("adversus_campaign_mappings")
        .select("adversus_campaign_id, adversus_campaign_name");
      return new Map((data || []).map(m => [m.adversus_campaign_id, m.adversus_campaign_name]));
    },
  });

  const { data: salesData, isLoading, refetch } = useQuery({
    queryKey: ["dialer-sales", activeTab, sourceFilter, page, dateFrom, dateTo, searchTerm, sortColumn, sortDirection, campaignMappings],
    queryFn: async () => {
      const fromDate = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
      const toDate = dateTo ? endOfDay(dateTo).toISOString() : undefined;

      let query = supabase
        .from("sales")
        .select(`
          id, adversus_external_id, agent_name, agent_email, sale_datetime, adversus_opp_number, 
          customer_company, customer_phone, source, integration_type, dialer_campaign_id, raw_payload,
          client_campaigns(name)
        `, { count: "exact" })
        .order(sortColumn === "campaign_name" ? "sale_datetime" : sortColumn, { ascending: sortDirection === "asc", nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Apply tab filter
      if (activeTab !== "all") {
        query = query.eq("integration_type", activeTab);
      }

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      if (fromDate) {
        query = query.gte("sale_datetime", fromDate);
      }

      if (toDate) {
        query = query.lte("sale_datetime", toDate);
      }

      if (searchTerm) {
        query = query.or(`adversus_external_id.ilike.%${searchTerm}%,agent_name.ilike.%${searchTerm}%,customer_company.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Transform data to include campaign_name from either client_campaigns or adversus_campaign_mappings
      const transformedData = (data || []).map((sale: any) => ({
        ...sale,
        campaign_name: sale.client_campaigns?.name || 
                       (sale.dialer_campaign_id && campaignMappings?.get(sale.dialer_campaign_id)) || 
                       null,
        client_campaigns: undefined
      }));
      
      return { sales: transformedData as Sale[], totalCount: count || 0 };
    },
    enabled: !!campaignMappings,
  });

  const sales = salesData?.sales || [];
  const totalCount = salesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch sale items for the dialog
  const { data: saleItems } = useQuery({
    queryKey: ["sale-items", selectedSale?.id],
    queryFn: async () => {
      if (!selectedSale) return [];
      const { data, error } = await supabase
        .from("sale_items")
        .select("id, adversus_product_title, quantity, unit_price, mapped_commission, mapped_revenue, needs_mapping")
        .eq("sale_id", selectedSale.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSale,
  });

  const getIntegrationBadge = (integrationType: string | null) => {
    if (integrationType === "enreach") {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Enreach</Badge>;
    }
    return <Badge className="bg-blue-600 hover:bg-blue-700">Adversus</Badge>;
  };

  const handleDatePreset = (days: number) => {
    setDateFrom(subDays(new Date(), days));
    setDateTo(new Date());
    setPage(0);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setPage(0);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Get unique dialer names for filter
  const { data: dialerNames } = useQuery({
    queryKey: ["dialer-names", activeTab],
    queryFn: async () => {
      let query = supabase.from("sales").select("source").not("source", "is", null);
      if (activeTab !== "all") {
        query = query.eq("integration_type", activeTab);
      }
      const { data } = await query;
      const uniqueNames = [...new Set((data || []).map(s => s.source).filter(Boolean))];
      return uniqueNames as string[];
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dialerData.title")}</h1>
            <p className="text-muted-foreground">{t("dialerData.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            {t("dialerData.refresh")}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dialerData.totalSales")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Badge className="bg-blue-600 text-xs">Adversus</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.adversus || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Badge className="bg-purple-600 text-xs">Enreach</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.enreach || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dialerData.oppStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-bold">{stats?.withOpp || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-bold">{stats?.missingOpp || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); setSourceFilter("all"); }}>

          <TabsList>
            <TabsTrigger value="all">{t("dialerData.all")} ({stats?.total || 0})</TabsTrigger>
            <TabsTrigger value="adversus" className="gap-2">
              <Badge className="bg-blue-600 text-xs">Adversus</Badge>
              {stats?.adversus || 0}
            </TabsTrigger>
            <TabsTrigger value="enreach" className="gap-2">
              <Badge className="bg-purple-600 text-xs">Enreach</Badge>
              {stats?.enreach || 0}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {t("dialerData.salesData")}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {/* Date Presets */}
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)}>{t("dialerData.days7")}</Button>
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)}>{t("dialerData.days30")}</Button>
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(90)}>{t("dialerData.days90")}</Button>
                    </div>

                    {/* Date From */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : t("dialerData.from")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} locale={dateLocale} />
                      </PopoverContent>
                    </Popover>

                    {/* Date To */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : t("dialerData.to")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} locale={dateLocale} />
                      </PopoverContent>
                    </Popover>

                    {/* Dialer Filter */}
                    <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder={t("dialerData.dialer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("dialerData.allDialers")}</SelectItem>
                        {dialerNames?.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("dialerData.searchPlaceholder")}
                    className="pl-9 w-[200px]"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                {t("dialerData.loading")}
              </div>
            ) : (
              <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("integration_type")}>
                              <div className="flex items-center">{t("dialerData.integration")}<SortIcon column="integration_type" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("source")}>
                              <div className="flex items-center">{t("dialerData.dialer")}<SortIcon column="source" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("campaign_name")}>
                              <div className="flex items-center">{t("dialerData.campaign")}<SortIcon column="campaign_name" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("adversus_external_id")}>
                              <div className="flex items-center">{t("dialerData.dialerId")}<SortIcon column="adversus_external_id" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("agent_name")}>
                              <div className="flex items-center">{t("dialerData.agent")}<SortIcon column="agent_name" /></div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center">{t("dialerData.email")}</div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("customer_company")}>
                              <div className="flex items-center">{t("dialerData.customer")}<SortIcon column="customer_company" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("sale_datetime")}>
                              <div className="flex items-center">{t("dialerData.timestamp")}<SortIcon column="sale_datetime" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("adversus_opp_number")}>
                              <div className="flex items-center">{t("dialerData.oppStatus")}<SortIcon column="adversus_opp_number" /></div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center">JSON</div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => (
                            <TableRow
                              key={sale.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedSale(sale)}
                            >
                              <TableCell>{getIntegrationBadge(sale.integration_type)}</TableCell>
                              <TableCell className="text-sm">{sale.source || "-"}</TableCell>
                              <TableCell className="text-sm max-w-[120px] truncate">{sale.campaign_name || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {sale.adversus_external_id || "-"}
                              </TableCell>
                              <TableCell>{sale.agent_name || "-"}</TableCell>
                              <TableCell className="text-sm max-w-[150px] truncate">{sale.agent_email || "-"}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{sale.customer_company || "-"}</TableCell>
                              <TableCell>
                                {sale.sale_datetime
                                  ? format(new Date(sale.sale_datetime), "dd. MMM yyyy HH:mm", { locale: dateLocale })
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {sale.integration_type === "enreach" ? (
                                  <Badge variant="secondary" className="text-xs">{t("dialerData.notRelevant")}</Badge>
                                ) : sale.adversus_opp_number ? (
                                  <div className="flex items-center gap-2 text-green-500">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="font-mono text-xs">{sale.adversus_opp_number}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-yellow-500">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="text-xs">{t("dialerData.missing")}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {sale.raw_payload ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowRawJson(sale)}
                                    className="h-7 px-2"
                                  >
                                    <Code className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {sales.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                {t("dialerData.noSalesFound")}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        {t("dialerData.showingOf", { count: sales.length, total: totalCount })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          {t("dialerData.previous")}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {t("dialerData.pageOf", { page: page + 1, totalPages: Math.max(1, totalPages) })}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => p + 1)}
                          disabled={page >= totalPages - 1}
                        >
                          {t("dialerData.next")}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sale Detail Dialog */}
        <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {t("dialerData.saleDetails")}
                {selectedSale && getIntegrationBadge(selectedSale.integration_type)}
              </DialogTitle>
              <DialogDescription>
                {selectedSale?.adversus_external_id || ""}
              </DialogDescription>
            </DialogHeader>
            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.dialerId")}:</span>
                    <p className="font-mono">{selectedSale.adversus_external_id || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.agent")}:</span>
                    <p>{selectedSale.agent_name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.agentEmail")}:</span>
                    <p className="text-sm">{selectedSale.agent_email || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.customer")}:</span>
                    <p>{selectedSale.customer_company || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.phone")}:</span>
                    <p>{selectedSale.customer_phone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.timestamp")}:</span>
                    <p>
                      {selectedSale.sale_datetime
                        ? format(new Date(selectedSale.sale_datetime), "dd. MMMM yyyy HH:mm:ss", { locale: dateLocale })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("dialerData.oppNumber")}:</span>
                    <p className="font-mono">{selectedSale.adversus_opp_number || t("dialerData.notAvailable")}</p>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <h4 className="font-medium mb-2">{t("dialerData.products")}</h4>
                  {saleItems && saleItems.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("dialerData.product")}</TableHead>
                            <TableHead className="text-right">{t("dialerData.quantity")}</TableHead>
                            <TableHead className="text-right">{t("dialerData.commission")}</TableHead>
                            <TableHead>{t("dialerData.mapping")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.adversus_product_title || t("dialerData.unknownProduct")}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{item.mapped_commission} DKK</TableCell>
                              <TableCell>
                                {item.needs_mapping ? (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    {t("dialerData.needsMapping")}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    {t("dialerData.mapped")}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("dialerData.noProducts")}</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Raw JSON Dialog */}
        <Dialog open={!!showRawJson} onOpenChange={() => setShowRawJson(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Code className="h-5 w-5" />
                {t("dialerData.rawJson")}
                {showRawJson && getIntegrationBadge(showRawJson.integration_type)}
              </DialogTitle>
              <DialogDescription>
                {showRawJson?.adversus_external_id || ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-[60vh]">
                {showRawJson?.raw_payload ? JSON.stringify(showRawJson.raw_payload, null, 2) : t("dialerData.noRawData")}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
