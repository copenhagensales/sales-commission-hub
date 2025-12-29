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
  Phone,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRightIcon,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Columns3,
  User
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CallsDataTableProps {
  provider: string;
  providerColor: string;
  iconColor: string;
  calls: any[];
  isLoading: boolean;
}

interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

export default function CallsDataTable({ provider, providerColor, iconColor, calls, isLoading }: CallsDataTableProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: "start_time", direction: "desc" });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    external_id: true,
    agent_id: true,
    campaign: true,
    duration: true,
    status: true,
    start_time: true,
  });

  const columns = [
    { id: "external_id", label: "External ID", sortable: true, minWidth: "120px" },
    { id: "agent_id", label: "Agent ID", sortable: true, minWidth: "120px" },
    { id: "campaign", label: "Campaign", sortable: true, minWidth: "120px", mobileHidden: true },
    { id: "duration", label: "Duration", sortable: true, minWidth: "100px" },
    { id: "status", label: "Status", sortable: true, minWidth: "100px" },
    { id: "start_time", label: "Start Time", sortable: true, minWidth: "130px", mobileHidden: true },
  ];

  const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);

  // Get unique statuses
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    calls?.forEach(call => {
      if (call.status) statuses.add(call.status);
    });
    return Array.from(statuses).sort();
  }, [calls]);

  // Filter and sort calls
  const filteredCalls = useMemo(() => {
    let result = calls || [];
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(call =>
        call.external_id?.toLowerCase().includes(searchLower) ||
        call.agent_external_id?.toLowerCase().includes(searchLower) ||
        call.campaign_external_id?.toLowerCase().includes(searchLower) ||
        call.status?.toLowerCase().includes(searchLower)
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(call => call.status === statusFilter);
    }

    if (dateFrom) {
      result = result.filter(call => call.start_time && call.start_time >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(call => call.start_time && call.start_time <= `${dateTo}T23:59:59`);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal = sortConfig.column === "agent_id" ? a.agent_external_id : 
                 sortConfig.column === "campaign" ? a.campaign_external_id :
                 sortConfig.column === "duration" ? a.duration_seconds :
                 a[sortConfig.column];
      let bVal = sortConfig.column === "agent_id" ? b.agent_external_id : 
                 sortConfig.column === "campaign" ? b.campaign_external_id :
                 sortConfig.column === "duration" ? b.duration_seconds :
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
  }, [calls, search, statusFilter, dateFrom, dateTo, sortConfig]);

  const paginatedCalls = useMemo(() => {
    const start = page * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, page, pageSize]);

  const totalPages = Math.ceil(filteredCalls.length / pageSize);

  const toggleExpand = useCallback((id: string) => {
    setExpandedCalls(prev => {
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const FilterPanelContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ID, agent, campaign..."
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
              <Phone className="h-5 w-5" />
              Calls from {provider}
              <Badge variant="outline" className="ml-2 text-xs">
                {filteredCalls.length.toLocaleString()}
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
            ) : !paginatedCalls.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Phone className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No calls found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {activeFilterCount > 0 ? "Try adjusting your filters" : `No calls from ${provider} yet`}
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
                      {paginatedCalls.map((call) => (
                        <CallTableRow
                          key={call.id}
                          call={call}
                          columns={visibleColumns}
                          isExpanded={expandedCalls.has(call.id)}
                          onToggle={() => toggleExpand(call.id)}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                  {paginatedCalls.map((call) => (
                    <MobileCallCard
                      key={call.id}
                      call={call}
                      isExpanded={expandedCalls.has(call.id)}
                      onToggle={() => toggleExpand(call.id)}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                      {filteredCalls.length.toLocaleString()} calls
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground hidden sm:inline">Show</span>
                      <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map(size => (
                            <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground hidden sm:inline">per page</span>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground mr-2">
                        Page {page + 1} of {totalPages}
                      </span>
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
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CallTableRow({ call, columns, isExpanded, onToggle, formatDuration }: { call: any; columns: any[]; isExpanded: boolean; onToggle: () => void; formatDuration: (s: number) => string }) {
  return (
    <>
      <TableRow className={cn("cursor-pointer transition-colors", isExpanded && "bg-muted/30")} onClick={onToggle}>
        <TableCell className="w-10">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        {columns.map(col => (
          <TableCell key={col.id}>
            {col.id === "external_id" && <span className="font-mono text-xs">{call.external_id || "-"}</span>}
            {col.id === "agent_id" && <span className="font-mono text-xs">{call.agent_external_id || "-"}</span>}
            {col.id === "campaign" && <span className="font-mono text-xs">{call.campaign_external_id || "-"}</span>}
            {col.id === "duration" && (
              <span className="text-sm">{call.duration_seconds ? formatDuration(call.duration_seconds) : "-"}</span>
            )}
            {col.id === "status" && (
              <Badge variant="outline" className="text-xs">{call.status || "unknown"}</Badge>
            )}
            {col.id === "start_time" && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {call.start_time ? format(new Date(call.start_time), "dd/MM/yy HH:mm") : "-"}
              </span>
            )}
          </TableCell>
        ))}
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={columns.length + 1} className="bg-muted/10 p-0">
            <ExpandedCallDetails call={call} formatDuration={formatDuration} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MobileCallCard({ call, isExpanded, onToggle, formatDuration }: { call: any; isExpanded: boolean; onToggle: () => void; formatDuration: (s: number) => string }) {
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
                <span className="font-mono text-xs text-muted-foreground">{call.external_id || call.id?.slice(0, 8)}</span>
                <Badge variant="outline" className="text-xs">{call.status || "unknown"}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {call.agent_external_id || "-"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {call.duration_seconds ? formatDuration(call.duration_seconds) : "-"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {call.start_time ? format(new Date(call.start_time), "dd/MM/yy HH:mm") : "-"}
              </div>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          <ExpandedCallDetails call={call} formatDuration={formatDuration} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExpandedCallDetails({ call, formatDuration }: { call: any; formatDuration: (s: number) => string }) {
  return (
    <div className="p-4 space-y-3 border-l-2 border-primary/30 ml-2 md:ml-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">External ID</p>
          <p className="text-sm font-mono">{call.external_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Agent External ID</p>
          <p className="text-sm font-mono">{call.agent_external_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Campaign External ID</p>
          <p className="text-sm font-mono">{call.campaign_external_id || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Dialer Name</p>
          <p className="text-sm capitalize">{call.dialer_name || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Integration Type</p>
          <p className="text-sm capitalize">{call.integration_type || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm capitalize">{call.status || "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-sm">{call.duration_seconds ? formatDuration(call.duration_seconds) : "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Total Duration</p>
          <p className="text-sm">{call.total_duration_seconds ? formatDuration(call.total_duration_seconds) : "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Start Time</p>
          <p className="text-sm">{call.start_time ? format(new Date(call.start_time), "dd/MM/yyyy HH:mm:ss") : "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">End Time</p>
          <p className="text-sm">{call.end_time ? format(new Date(call.end_time), "dd/MM/yyyy HH:mm:ss") : "-"}</p>
        </div>
        <div className="border border-border/50 rounded p-2 bg-card/20">
          <p className="text-xs text-muted-foreground">Created At</p>
          <p className="text-sm">{call.created_at ? format(new Date(call.created_at), "dd/MM/yyyy HH:mm") : "-"}</p>
        </div>
        {call.recording_url && (
          <div className="border border-border/50 rounded p-2 bg-card/20 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Recording</p>
            <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
              View Recording
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
