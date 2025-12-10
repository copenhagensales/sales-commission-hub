import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle, AlertTriangle, Database, RefreshCw, ChevronLeft, ChevronRight, CalendarIcon, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Sale {
  id: string;
  adversus_external_id: string | null;
  agent_name: string | null;
  sale_datetime: string | null;
  adversus_opp_number: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  source: string | null;
  integration_type: string | null;
}

const PAGE_SIZE = 50;

type SortColumn = "integration_type" | "source" | "adversus_external_id" | "agent_name" | "customer_company" | "sale_datetime" | "adversus_opp_number";
type SortDirection = "asc" | "desc";

export default function DialerData() {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
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

      // Get OPP present count
      let oppQuery = supabase.from("sales").select("id", { count: "exact", head: true }).not("adversus_opp_number", "is", null);
      if (fromDate) oppQuery = oppQuery.gte("sale_datetime", fromDate);
      if (toDate) oppQuery = oppQuery.lte("sale_datetime", toDate);
      const { count: withOpp } = await oppQuery;

      return {
        total: total || 0,
        adversus: adversus || 0,
        enreach: enreach || 0,
        withOpp: withOpp || 0,
        missingOpp: (total || 0) - (withOpp || 0),
      };
    },
  });

  const { data: salesData, isLoading, refetch } = useQuery({
    queryKey: ["dialer-sales", sourceFilter, page, dateFrom, dateTo, searchTerm, sortColumn, sortDirection],
    queryFn: async () => {
      const fromDate = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
      const toDate = dateTo ? endOfDay(dateTo).toISOString() : undefined;

      let query = supabase
        .from("sales")
        .select("id, adversus_external_id, agent_name, sale_datetime, adversus_opp_number, customer_company, customer_phone, source, integration_type", { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc", nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (sourceFilter !== "all") {
        query = query.eq("integration_type", sourceFilter);
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
      return { sales: data as Sale[], totalCount: count || 0 };
    },
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dialer Data Overview</h1>
            <p className="text-muted-foreground">Oversigt over salgsdata fra alle dialer-kilder</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Salg</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">OPP Status</CardTitle>
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

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Salgsdata
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {/* Date Presets */}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)}>7 dage</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)}>30 dage</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDatePreset(90)}>90 dage</Button>
                </div>

                {/* Date From */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Fra"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} />
                  </PopoverContent>
                </Popover>

                {/* Date To */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Til"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} />
                  </PopoverContent>
                </Popover>

                {/* Source Filter */}
                <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Kilde" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle kilder</SelectItem>
                    <SelectItem value="adversus">Adversus</SelectItem>
                    <SelectItem value="enreach">Enreach</SelectItem>
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg ID, agent, kunde..."
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
                Indlæser...
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("integration_type")}>
                          <div className="flex items-center">Integration<SortIcon column="integration_type" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("source")}>
                          <div className="flex items-center">Dialer<SortIcon column="source" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("adversus_external_id")}>
                          <div className="flex items-center">Dialer ID<SortIcon column="adversus_external_id" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("agent_name")}>
                          <div className="flex items-center">Agent<SortIcon column="agent_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("customer_company")}>
                          <div className="flex items-center">Kunde<SortIcon column="customer_company" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("sale_datetime")}>
                          <div className="flex items-center">Tidspunkt<SortIcon column="sale_datetime" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("adversus_opp_number")}>
                          <div className="flex items-center">OPP Status<SortIcon column="adversus_opp_number" /></div>
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
                        <TableCell className="font-mono text-sm">
                          {sale.adversus_external_id || "-"}
                        </TableCell>
                          <TableCell>{sale.agent_name || "-"}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{sale.customer_company || "-"}</TableCell>
                          <TableCell>
                            {sale.sale_datetime
                              ? format(new Date(sale.sale_datetime), "dd. MMM yyyy HH:mm", { locale: da })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {sale.adversus_opp_number ? (
                              <div className="flex items-center gap-2 text-green-500">
                                <CheckCircle className="h-4 w-4" />
                                <span className="font-mono text-xs">{sale.adversus_opp_number}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-yellow-500">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs">Mangler</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    {sales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Ingen salg fundet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Viser {sales.length} af {totalCount} salg
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Forrige
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Side {page + 1} af {Math.max(1, totalPages)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Næste
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sale Detail Dialog */}
        <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                Salgsdetaljer
                {selectedSale && getIntegrationBadge(selectedSale.integration_type)}
              </DialogTitle>
            </DialogHeader>
            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Dialer ID:</span>
                    <p className="font-mono">{selectedSale.adversus_external_id || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Agent:</span>
                    <p>{selectedSale.agent_name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kunde:</span>
                    <p>{selectedSale.customer_company || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefon:</span>
                    <p>{selectedSale.customer_phone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tidspunkt:</span>
                    <p>
                      {selectedSale.sale_datetime
                        ? format(new Date(selectedSale.sale_datetime), "dd. MMMM yyyy HH:mm:ss", { locale: da })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">OPP Nummer:</span>
                    <p className="font-mono">{selectedSale.adversus_opp_number || "Ikke tilgængelig"}</p>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <h4 className="font-medium mb-2">Produkter</h4>
                  {saleItems && saleItems.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produkt</TableHead>
                            <TableHead className="text-right">Antal</TableHead>
                            <TableHead className="text-right">Provision</TableHead>
                            <TableHead>Mapping</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.adversus_product_title || "Ukendt produkt"}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{item.mapped_commission} DKK</TableCell>
                              <TableCell>
                                {item.needs_mapping ? (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    Mangler mapping
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    Mappet
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Ingen produkter registreret</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
