import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  ShoppingCart,
  User,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRightIcon,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Columns3
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SalesDataTableProps {
  provider: string;
  providerColor: string;
  iconColor: string;
  sales: any[];
  isLoading: boolean;
}

interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

const PAGE_SIZE = 50;

export default function SalesDataTable({ provider, providerColor, iconColor, sales, isLoading }: SalesDataTableProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: "sale_datetime", direction: "desc" });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    external_id: true,
    agent: true,
    customer: true,
    status: true,
    sale_datetime: true,
  });

  const columns = [
    { id: "external_id", label: "External ID", sortable: true, minWidth: "120px" },
    { id: "agent", label: "Agent", sortable: true, minWidth: "150px" },
    { id: "customer", label: "Customer", sortable: false, minWidth: "150px", mobileHidden: true },
    { id: "status", label: "Status", sortable: true, minWidth: "100px" },
    { id: "sale_datetime", label: "Sale Date", sortable: true, minWidth: "130px", mobileHidden: true },
  ];

  const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);

  // Get unique statuses
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    sales?.forEach(sale => {
      if (sale.validation_status) statuses.add(sale.validation_status);
      if (sale.status) statuses.add(sale.status);
    });
    return Array.from(statuses).sort();
  }, [sales]);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let result = sales || [];
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(sale =>
        sale.agent_name?.toLowerCase().includes(searchLower) ||
        sale.agent_email?.toLowerCase().includes(searchLower) ||
        sale.adversus_external_id?.toLowerCase().includes(searchLower) ||
        sale.customer_phone?.toLowerCase().includes(searchLower) ||
        sale.customer_company?.toLowerCase().includes(searchLower)
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(sale => 
        sale.validation_status === statusFilter || sale.status === statusFilter
      );
    }

    if (dateFrom) {
      result = result.filter(sale => sale.sale_datetime && sale.sale_datetime >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(sale => sale.sale_datetime && sale.sale_datetime <= `${dateTo}T23:59:59`);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal = sortConfig.column === "agent" ? a.agent_name : 
                 sortConfig.column === "status" ? (a.validation_status || a.status) :
                 sortConfig.column === "external_id" ? a.adversus_external_id :
                 a[sortConfig.column];
      let bVal = sortConfig.column === "agent" ? b.agent_name : 
                 sortConfig.column === "status" ? (b.validation_status || b.status) :
                 sortConfig.column === "external_id" ? b.adversus_external_id :
                 b[sortConfig.column];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === "string") {
        const comparison = aVal.localeCompare(bVal);
        return sortConfig.direction === "desc" ? -comparison : comparison;
      }
      
      return sortConfig.direction === "desc" ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });

    return result;
  }, [sales, search, statusFilter, dateFrom, dateTo, sortConfig]);

  const paginatedSales = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, page]);

  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((columnId: string) => {
    setSortConfig(prev => ({
      column: columnId,
      direction: prev.column === columnId && prev.direction === "desc" ? "asc" : "desc",
    }));
    setPage(0);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (statusFilter !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [search, statusFilter, dateFrom, dateTo]);

  const FilterPanelContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Agent, phone, company..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Date Range
        </label>
        <div className="space-y-2">
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} placeholder="From" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} placeholder="To" />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Columns3 className="h-4 w-4" />
          Visible Columns
        </label>
        <div className="space-y-2">
          {columns.map(col => (
            <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox 
                checked={columnVisibility[col.id] !== false}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))}
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {activeFilterCount > 0 && (
        <Button variant="outline" className="w-full" onClick={clearAllFilters}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear All Filters ({activeFilterCount})
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className={cn("bg-gradient-to-br border", providerColor)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className={cn("capitalize flex items-center gap-2 text-lg", iconColor)}>
              <ShoppingCart className="h-5 w-5" />
              Sales from {provider}
              <Badge variant="outline" className="ml-2 text-xs">
                {filteredSales.length.toLocaleString()}
              </Badge>
            </CardTitle>

            <div className="flex items-center gap-2">
              <div className="relative hidden md:block w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Quick search..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 h-9"
                />
              </div>

              <Button
                variant={filterPanelOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                className="hidden md:flex gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
                  <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filters & Columns
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100%-60px)]">
                    <FilterPanelContent />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="gap-1">
                  From: {dateFrom}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDateFrom("")} />
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1">
                  To: {dateTo}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDateTo("")} />
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="flex gap-4">
        {filterPanelOpen && (
          <Card className="hidden md:block w-72 shrink-0 h-fit sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFilterPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <FilterPanelContent />
            </CardContent>
          </Card>
        )}

        <Card className="flex-1 min-w-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !paginatedSales.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No sales found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {activeFilterCount > 0 ? "Try adjusting your filters" : `No sales from ${provider} yet`}
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10" />
                        {visibleColumns.map(col => (
                          <TableHead 
                            key={col.id} 
                            style={{ minWidth: col.minWidth }}
                            className={cn(col.sortable && "cursor-pointer select-none hover:bg-muted/50")}
                            onClick={() => col.sortable && handleSort(col.id)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {col.sortable && (
                                sortConfig.column === col.id ? (
                                  sortConfig.direction === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                                )
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSales.map((sale) => (
                        <SaleTableRow
                          key={sale.id}
                          sale={sale}
                          columns={visibleColumns}
                          isExpanded={expandedSales.has(sale.id)}
                          onToggle={() => toggleExpand(sale.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                  {paginatedSales.map((sale) => (
                    <MobileSaleCard
                      key={sale.id}
                      sale={sale}
                      isExpanded={expandedSales.has(sale.id)}
                      onToggle={() => toggleExpand(sale.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                      Page {page + 1} of {totalPages} ({filteredSales.length.toLocaleString()} sales)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                          if (pageNum >= totalPages) return null;
                          return (
                            <Button key={pageNum} variant={page === pageNum ? "default" : "ghost"} size="sm" className="w-8 h-8 p-0" onClick={() => setPage(pageNum)}>
                              {pageNum + 1}
                            </Button>
                          );
                        })}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRightIcon className="h-4 w-4 sm:ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SaleTableRow({ sale, columns, isExpanded, onToggle }: { sale: any; columns: any[]; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow className={cn("cursor-pointer transition-colors", isExpanded && "bg-muted/30")} onClick={onToggle}>
        <TableCell className="w-10">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        {columns.map(col => (
          <TableCell key={col.id}>
            {col.id === "external_id" && <span className="font-mono text-xs">{sale.adversus_external_id || "-"}</span>}
            {col.id === "agent" && (
              <div>
                <div className="font-medium text-sm">{sale.agent_name || "-"}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{sale.agent_email || "-"}</div>
              </div>
            )}
            {col.id === "customer" && (
              <div>
                <div className="font-medium text-sm">{sale.customer_company || "-"}</div>
                <div className="text-xs text-muted-foreground font-mono">{sale.customer_phone || "-"}</div>
              </div>
            )}
            {col.id === "status" && (
              <Badge variant={getStatusVariant(sale.validation_status)} className="text-xs">
                {sale.validation_status || sale.status || "unknown"}
              </Badge>
            )}
            {col.id === "sale_datetime" && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yy HH:mm") : "-"}
              </span>
            )}
          </TableCell>
        ))}
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={columns.length + 1} className="bg-muted/10 p-0">
            <ExpandedSaleDetails sale={sale} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MobileSaleCard({ sale, isExpanded, onToggle }: { sale: any; isExpanded: boolean; onToggle: () => void }) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{sale.adversus_external_id || sale.id?.slice(0, 8)}</span>
                <Badge variant={getStatusVariant(sale.validation_status)} className="text-xs">
                  {sale.validation_status || sale.status || "unknown"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3" />
                  {sale.agent_name || "-"}
                </span>
                <span className="text-xs">
                  {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yy HH:mm") : "-"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate font-mono">
                  <Phone className="h-3 w-3" />
                  {sale.customer_phone || "-"}
                </span>
              </div>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          <ExpandedSaleDetails sale={sale} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExpandedSaleDetails({ sale }: { sale: any }) {
  return (
    <div className="p-4 space-y-3 border-l-2 border-primary/30 ml-2 md:ml-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">External ID</p>
          <p className="text-sm font-mono">{sale.adversus_external_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Agent Name</p>
          <p className="text-sm">{sale.agent_name || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Agent Email</p>
          <p className="text-sm font-mono truncate">{sale.agent_email || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Agent External ID</p>
          <p className="text-sm font-mono">{sale.agent_external_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Customer Company</p>
          <p className="text-sm">{sale.customer_company || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Customer Phone</p>
          <p className="text-sm font-mono">{sale.customer_phone || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm capitalize">{sale.validation_status || sale.status || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Source</p>
          <p className="text-sm capitalize">{sale.source || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Integration Type</p>
          <p className="text-sm capitalize">{sale.integration_type || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Campaign ID</p>
          <p className="text-sm font-mono">{sale.dialer_campaign_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Sale Date</p>
          <p className="text-sm">{sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm") : "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Created At</p>
          <p className="text-sm">{sale.created_at ? format(new Date(sale.created_at), "dd/MM/yyyy HH:mm") : "-"}</p>
        </div>
      </div>
    </div>
  );
}

function getStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "validated":
    case "approved":
      return "default";
    case "pending":
      return "outline";
    case "cancelled":
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}
