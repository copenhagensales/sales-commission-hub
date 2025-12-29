import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Filter, 
  FileJson, 
  User, 
  Link2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRightIcon,
  Database,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
  Columns3,
  Phone
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface EventDataTableProps {
  provider: string;
  providerColor: string;
  iconColor: string;
}

// Campaign status enum mapping - canonical source of truth
const CAMPAIGN_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  automaticRedial: { label: "Auto Redial", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  privateRedial: { label: "Private Redial", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  notInterested: { label: "Not Interested", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  success: { label: "Success", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  invalid: { label: "Invalid", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  unqualified: { label: "Unqualified", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  // Additional common statuses
  pending: { label: "Pending", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  callback: { label: "Callback", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  noAnswer: { label: "No Answer", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  busy: { label: "Busy", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  voicemail: { label: "Voicemail", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
};

// Helper to get campaign status enum from payload (canonical source of truth)
// IMPORTANT: We ONLY use the structured enum field (campaign_status / campaignStatus).
function getCampaignStatus(payload: Record<string, any> | null): string | null {
  if (!payload) return null;
  
  // First check top-level (where we now store it in webhook processing)
  const topLevel = payload.campaign_status ?? payload.campaignStatus ?? payload.CampaignStatus;
  if (topLevel) return topLevel;
  
  // Also check in _parsed_webhook_data if present
  const parsed = payload._parsed_webhook_data;
  if (parsed) {
    return parsed.campaignStatus ?? parsed.campaign_status ?? null;
  }
  
  return null;
}

// Helper to get raw result text from payload (human-readable/localized, NOT used for logic)
function getRawResultText(payload: Record<string, any> | null): string | null {
  if (!payload) return null;

  // First check top-level (where we now store it)
  if (payload.raw_result_text) return payload.raw_result_text;
  
  // Check in _parsed_webhook_data
  const parsed = payload._parsed_webhook_data;
  if (parsed?.rawResultText) return parsed.rawResultText;

  // Explicit common keys (including capitalized variants)
  if (Object.prototype.hasOwnProperty.call(payload, "Resultat Af Samtalen")) {
    return payload["Resultat Af Samtalen"] ?? "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "Result")) {
    return payload["Result"] ?? "";
  }

  const direct =
    payload.result ??
    payload.resultText ??
    payload.result_text ??
    payload.resultatAfSamtalen ??
    payload.humanReadableResult ??
    null;

  if (direct !== null && direct !== undefined) return direct;

  return null;
}

// Get display info for a campaign status
function getCampaignStatusInfo(status: string | null): { label: string; color: string; isKnown: boolean } {
  if (!status) return { label: "-", color: "bg-muted text-muted-foreground", isKnown: false };
  
  const info = CAMPAIGN_STATUS_LABELS[status];
  if (info) {
    return { ...info, isKnown: true };
  }
  
  // Handle unknown status gracefully - display as-is with neutral styling
  return { 
    label: status, 
    color: "bg-muted/50 text-foreground border-border", 
    isKnown: false 
  };
}

interface ColumnConfig {
  id: string;
  label: string;
  accessor: (event: any) => any;
  render?: (value: any, event: any) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "select" | "date";
  visible?: boolean;
  minWidth?: string;
  mobileHidden?: boolean;
}

interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

interface FilterConfig {
  [key: string]: string | undefined;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

export default function EventDataTable({ provider, providerColor, iconColor }: EventDataTableProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: "received_at", direction: "desc" });
  const [filters, setFilters] = useState<FilterConfig>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    id: true,
    event_type: true,
    campaign_status: true,
    received_at: true,
    status: true,
    agent: true,
    customer: true,
    external_id: false,
  });

  // Column definitions
  const columns: ColumnConfig[] = useMemo(() => [
    {
      id: "id",
      label: "Event ID",
      accessor: (e) => e.external_id || e.id?.slice(0, 8),
      render: (value) => <span className="font-mono text-xs">{value}</span>,
      sortable: true,
      filterable: true,
      filterType: "text",
      minWidth: "120px",
    },
    {
      id: "event_type",
      label: "Type",
      accessor: (e) => e.event_type,
      render: (value) => (
        <Badge className={getEventTypeColor(value)} variant="outline">
          {value}
        </Badge>
      ),
      sortable: true,
      filterable: true,
      filterType: "select",
      minWidth: "100px",
    },
    {
      id: "campaign_status",
      label: "Campaign Outcome",
      accessor: (e) => getCampaignStatus(e.payload as Record<string, any> | null),
      render: (value) => {
        const statusInfo = getCampaignStatusInfo(value);
        return (
          <Badge className={cn(statusInfo.color, !statusInfo.isKnown && "border-dashed")} variant="outline">
            {statusInfo.label}
            {!statusInfo.isKnown && value && (
              <span className="ml-1 text-[10px] opacity-60">(?)</span>
            )}
          </Badge>
        );
      },
      sortable: true,
      filterable: true,
      filterType: "select",
      minWidth: "130px",
    },
    {
      id: "received_at",
      label: "Received",
      accessor: (e) => e.received_at,
      render: (value) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {value ? format(new Date(value), "dd/MM/yy HH:mm") : "-"}
        </span>
      ),
      sortable: true,
      filterable: true,
      filterType: "date",
      minWidth: "130px",
    },
    {
      id: "status",
      label: "Status",
      accessor: (e) => e.processed,
      render: (value) => (
        <div className="flex items-center gap-1.5">
          {value ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Clock className="h-4 w-4 text-amber-400" />
          )}
          <span className="text-xs">{value ? "Processed" : "Pending"}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      filterType: "select",
      minWidth: "100px",
    },
    {
      id: "agent",
      label: "Agent",
      accessor: (e) => {
        const payload = e.payload as Record<string, any> | null;
        return e._agent?.name || payload?.agentName || payload?.agent_name || "-";
      },
      render: (value) => <span className="text-sm truncate max-w-[150px] block">{value}</span>,
      sortable: true,
      filterable: true,
      filterType: "text",
      minWidth: "120px",
      mobileHidden: true,
    },
    {
      id: "customer",
      label: "Customer",
      accessor: (e) => {
        const payload = e.payload as Record<string, any> | null;
        return e._customer?.phone || payload?.customerPhone || payload?.phone || "-";
      },
      render: (value) => <span className="font-mono text-xs truncate max-w-[120px] block">{value}</span>,
      sortable: false,
      filterable: true,
      filterType: "text",
      minWidth: "120px",
      mobileHidden: true,
    },
    {
      id: "external_id",
      label: "External ID",
      accessor: (e) => e.external_id,
      render: (value) => <span className="font-mono text-xs truncate max-w-[100px] block">{value || "-"}</span>,
      sortable: true,
      filterable: true,
      filterType: "text",
      minWidth: "100px",
      mobileHidden: true,
    },
  ], []);

  const visibleColumns = useMemo(() => 
    columns.filter(col => columnVisibility[col.id] !== false),
  [columns, columnVisibility]);

  // Fetch event types for filter dropdown
  const { data: eventTypes } = useQuery({
    queryKey: ["event-types-v2", provider],
    queryFn: async () => {
      if (provider.toLowerCase() !== "adversus") {
        return ["sale"];
      }
      const { data, error } = await supabase
        .from("adversus_events")
        .select("event_type")
        .order("event_type");
      
      if (error) throw error;
      const unique = [...new Set(data?.map(e => e.event_type) || [])];
      return unique.filter(Boolean).sort();
    },
  });

  // Fetch events with pagination
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["events-table-v2", provider, dateFrom, dateTo, search, page, pageSize, sortConfig, filters],
    queryFn: async () => {
      if (provider.toLowerCase() !== "adversus") {
        let query = supabase
          .from("sales")
          .select(`
            id,
            adversus_external_id,
            agent_name,
            agent_email,
            agent_external_id,
            customer_phone,
            customer_company,
            sale_datetime,
            validation_status,
            status,
            source,
            integration_type,
            dialer_campaign_id,
            raw_payload,
            created_at
          `, { count: "exact" })
          .ilike("source", provider)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Apply sorting
        if (sortConfig.column === "received_at") {
          query = query.order("created_at", { ascending: sortConfig.direction === "asc" });
        } else {
          query = query.order("created_at", { ascending: false });
        }

        if (search) {
          query = query.or(`agent_name.ilike.%${search}%,agent_email.ilike.%${search}%,customer_phone.ilike.%${search}%,adversus_external_id.ilike.%${search}%`);
        }
        if (dateFrom) {
          query = query.gte("created_at", dateFrom);
        }
        if (dateTo) {
          query = query.lte("created_at", `${dateTo}T23:59:59`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return {
          events: (data || []).map(sale => ({
            id: sale.id,
            external_id: sale.adversus_external_id,
            event_type: "sale",
            payload: sale.raw_payload,
            processed: sale.validation_status === "validated",
            received_at: sale.created_at,
            created_at: sale.created_at,
            _agent: { name: sale.agent_name, email: sale.agent_email, external_id: sale.agent_external_id },
            _customer: { phone: sale.customer_phone, company: sale.customer_company },
            _sale: sale,
          })),
          total: count || 0,
        };
      }

      let query = supabase
        .from("adversus_events")
        .select("*", { count: "exact" })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply sorting
      if (sortConfig.column === "received_at") {
        query = query.order("received_at", { ascending: sortConfig.direction === "asc" });
      } else if (sortConfig.column === "event_type") {
        query = query.order("event_type", { ascending: sortConfig.direction === "asc" });
      } else {
        query = query.order("received_at", { ascending: false });
      }

      // Apply filters
      if (filters.event_type && filters.event_type !== "all") {
        query = query.eq("event_type", filters.event_type);
      }
      if (filters.status) {
        query = query.eq("processed", filters.status === "processed");
      }

      if (search) {
        query = query.or(`external_id.ilike.%${search}%,event_type.ilike.%${search}%`);
      }
      if (dateFrom) {
        query = query.gte("received_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("received_at", `${dateTo}T23:59:59`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        events: data || [],
        total: count || 0,
      };
    },
  });

  // Fetch linked data for expanded events
  const { data: linkedDataMap } = useQuery({
    queryKey: ["event-linked-data-v2", Array.from(expandedEvents)],
    queryFn: async () => {
      if (expandedEvents.size === 0) return {};

      const eventIds = Array.from(expandedEvents);
      const linkedData: Record<string, any> = {};

      await Promise.all(
        eventIds.map(async (eventId) => {
          const event = eventsData?.events.find(e => e.id === eventId);
          if (!event) return;

          const externalId = event.external_id;
          const payload = event.payload as Record<string, any> | null;

          const { data: relatedSales } = await supabase
            .from("sales")
            .select(`*, sale_items (*)`)
            .or(`adversus_external_id.eq.${externalId},id.eq.${eventId}`)
            .limit(5);

          const agentExternalId = payload?.userId || payload?.agentId || payload?.agent_id;
          let relatedAgent = null;
          if (agentExternalId) {
            const { data } = await supabase
              .from("agents")
              .select("*")
              .or(`external_adversus_id.eq.${agentExternalId},external_dialer_id.eq.${agentExternalId}`)
              .limit(1)
              .maybeSingle();
            relatedAgent = data;
          }

          let employeeMapping = null;
          if (agentExternalId) {
            const { data } = await supabase
              .from("employee_identity")
              .select(`
                *,
                employee_master_data:master_employee_id (id, first_name, last_name, work_email)
              `)
              .eq("source_employee_id", String(agentExternalId))
              .limit(1)
              .maybeSingle();
            employeeMapping = data;
          }

          const { data: relatedCalls } = await supabase
            .from("dialer_calls")
            .select("*")
            .eq("external_id", externalId)
            .limit(5);

          linkedData[eventId] = {
            sales: relatedSales || [],
            agent: relatedAgent,
            employeeMapping,
            calls: relatedCalls || [],
          };
        })
      );

      return linkedData;
    },
    enabled: expandedEvents.size > 0 && !!eventsData,
  });

  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
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

  const handleFilterChange = useCallback((columnId: string, value: string) => {
    setFilters(prev => ({ ...prev, [columnId]: value || undefined }));
    setPage(0);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    Object.values(filters).forEach(v => { if (v) count++; });
    return count;
  }, [search, dateFrom, dateTo, filters]);

  // Client-side filter for campaign_status (since it's in JSON payload)
  const filteredEvents = useMemo(() => {
    if (!eventsData?.events) return [];
    
    let events = eventsData.events;
    
    // Filter by campaign_status (client-side since it's in JSON payload)
    if (filters.campaign_status) {
      events = events.filter(event => {
        const status = getCampaignStatus(event.payload as Record<string, any> | null);
        return status === filters.campaign_status;
      });
    }
    
    return events;
  }, [eventsData?.events, filters.campaign_status]);

  const filteredTotal = filters.campaign_status ? filteredEvents.length : (eventsData?.total || 0);
  const totalPages = Math.ceil(filteredTotal / pageSize);

  // Filter panel content (shared between desktop sidebar and mobile sheet)
  const FilterPanelContent = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ID, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <Separator />

      {/* Event Type Filter */}
      {provider.toLowerCase() === "adversus" && eventTypes && eventTypes.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Type</label>
          <Select 
            value={filters.event_type || "all"} 
            onValueChange={(v) => handleFilterChange("event_type", v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {eventTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Processing Status</label>
        <Select 
          value={filters.status || "all"} 
          onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Outcome Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Campaign Outcome</label>
        <Select 
          value={filters.campaign_status || "all"} 
          onValueChange={(v) => handleFilterChange("campaign_status", v === "all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Outcomes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Date Range */}
      <div className="space-y-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          Date Range
        </label>
        
        {/* Quick presets */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs justify-start"
            onClick={() => {
              const today = new Date();
              setDateFrom(format(today, "yyyy-MM-dd"));
              setDateTo(format(today, "yyyy-MM-dd"));
              setPage(0);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs justify-start"
            onClick={() => {
              const yesterday = subDays(new Date(), 1);
              setDateFrom(format(yesterday, "yyyy-MM-dd"));
              setDateTo(format(yesterday, "yyyy-MM-dd"));
              setPage(0);
            }}
          >
            Yesterday
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs justify-start"
            onClick={() => {
              const today = new Date();
              setDateFrom(format(subDays(today, 6), "yyyy-MM-dd"));
              setDateTo(format(today, "yyyy-MM-dd"));
              setPage(0);
            }}
          >
            Last 7 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs justify-start"
            onClick={() => {
              const today = new Date();
              setDateFrom(format(subDays(today, 29), "yyyy-MM-dd"));
              setDateTo(format(today, "yyyy-MM-dd"));
              setPage(0);
            }}
          >
            Last 30 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs justify-start col-span-2"
            onClick={() => {
              const today = new Date();
              setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
              setDateTo(format(today, "yyyy-MM-dd"));
              setPage(0);
            }}
          >
            This month
          </Button>
        </div>

        {/* Custom date pickers */}
        <div className="space-y-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(new Date(dateFrom), "PPP") : <span className="text-muted-foreground">From date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom ? new Date(dateFrom) : undefined}
                onSelect={(date) => { setDateFrom(date ? format(date, "yyyy-MM-dd") : ""); setPage(0); }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(new Date(dateTo), "PPP") : <span className="text-muted-foreground">To date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo ? new Date(dateTo) : undefined}
                onSelect={(date) => { setDateTo(date ? format(date, "yyyy-MM-dd") : ""); setPage(0); }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}>
            <X className="h-3 w-3 mr-1" /> Clear dates
          </Button>
        )}
      </div>

      <Separator />

      {/* Column Visibility */}
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
                onCheckedChange={(checked) => 
                  setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))
                }
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={clearAllFilters}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear All Filters ({activeFilterCount})
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with stats and mobile filter toggle */}
      <Card className={cn("bg-gradient-to-br border", providerColor)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className={cn("capitalize flex items-center gap-2 text-lg", iconColor)}>
              <FileJson className="h-5 w-5" />
              Events from {provider}
              {eventsData && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {eventsData.total.toLocaleString()}
                </Badge>
              )}
            </CardTitle>

            {/* Desktop: Quick search + filter toggle */}
            <div className="flex items-center gap-2">
              {/* Desktop quick search */}
              <div className="relative hidden md:block w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Quick search..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 h-9"
                />
              </div>

              {/* Desktop filter panel toggle */}
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

              {/* Mobile filter sheet trigger */}
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

          {/* Active filters badges */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
                </Badge>
              )}
              {filters.event_type && (
                <Badge variant="secondary" className="gap-1">
                  Type: {filters.event_type}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange("event_type", "")} />
                </Badge>
              )}
              {filters.status && (
                <Badge variant="secondary" className="gap-1">
                  Processing: {filters.status}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange("status", "")} />
                </Badge>
              )}
              {filters.campaign_status && (
                <Badge variant="secondary" className="gap-1">
                  Outcome: {getCampaignStatusInfo(filters.campaign_status).label}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange("campaign_status", "")} />
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

      {/* Main content area */}
      <div className="flex gap-4">
        {/* Desktop filter sidebar */}
        {filterPanelOpen && (
          <Card className="hidden md:block w-72 shrink-0 h-fit sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setFilterPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <FilterPanelContent />
            </CardContent>
          </Card>
        )}

        {/* Table area */}
        <Card className="flex-1 min-w-0">
          <CardContent className="p-0">
            {eventsLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !eventsData?.events.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No events found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {activeFilterCount > 0
                    ? "Try adjusting your filters to see more results" 
                    : `No events from ${provider} yet`}
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
                            className={cn(
                              col.sortable && "cursor-pointer select-none hover:bg-muted/50"
                            )}
                            onClick={() => col.sortable && handleSort(col.id)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {col.sortable && (
                                <>
                                  {sortConfig.column === col.id ? (
                                    sortConfig.direction === "desc" ? 
                                      <ArrowDown className="h-3 w-3" /> : 
                                      <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                                  )}
                                </>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event: any) => (
                        <EventTableRow
                          key={event.id}
                          event={event}
                          columns={visibleColumns}
                          isExpanded={expandedEvents.has(event.id)}
                          onToggle={() => toggleExpand(event.id)}
                          linkedData={linkedDataMap?.[event.id]}
                          provider={provider}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                  {filteredEvents.map((event: any) => (
                    <MobileEventCard
                      key={event.id}
                      event={event}
                      isExpanded={expandedEvents.has(event.id)}
                      onToggle={() => toggleExpand(event.id)}
                      linkedData={linkedDataMap?.[event.id]}
                      provider={provider}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                      {filteredTotal.toLocaleString()} events
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                          if (pageNum >= totalPages) return null;
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? "default" : "ghost"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum + 1}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                      >
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

// Desktop table row component
interface EventTableRowProps {
  event: any;
  columns: ColumnConfig[];
  isExpanded: boolean;
  onToggle: () => void;
  linkedData: any;
  provider: string;
}

function EventTableRow({ event, columns, isExpanded, onToggle, linkedData, provider }: EventTableRowProps) {
  return (
    <>
      <TableRow 
        className={cn(
          "cursor-pointer transition-colors",
          isExpanded && "bg-muted/30"
        )}
        onClick={onToggle}
      >
        <TableCell className="w-10">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        {columns.map(col => (
          <TableCell key={col.id}>
            {col.render ? col.render(col.accessor(event), event) : col.accessor(event)}
          </TableCell>
        ))}
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={columns.length + 1} className="bg-muted/10 p-0">
            <ExpandedEventDetails event={event} linkedData={linkedData} provider={provider} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Mobile card component
interface MobileEventCardProps {
  event: any;
  isExpanded: boolean;
  onToggle: () => void;
  linkedData: any;
  provider: string;
}

function MobileEventCard({ event, isExpanded, onToggle, linkedData, provider }: MobileEventCardProps) {
  const payload = event.payload as Record<string, any> | null;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {/* Top row: ID + Type */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">
                  {event.external_id || event.id?.slice(0, 8)}
                </span>
                <Badge className={getEventTypeColor(event.event_type)} variant="outline">
                  {event.event_type}
                </Badge>
              </div>

              {/* Middle row: Status + Date */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  {event.processed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <span className="text-xs">{event.processed ? "Processed" : "Pending"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {event.received_at ? format(new Date(event.received_at), "dd/MM/yy HH:mm") : "-"}
                </span>
              </div>

              {/* Bottom row: Agent + Customer */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {(event._agent?.name || payload?.agentName) && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3" />
                    {event._agent?.name || payload?.agentName || "-"}
                  </span>
                )}
                {(event._customer?.phone || payload?.customerPhone) && (
                  <span className="flex items-center gap-1 truncate font-mono">
                    <Phone className="h-3 w-3" />
                    {event._customer?.phone || payload?.customerPhone || "-"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          <ExpandedEventDetails event={event} linkedData={linkedData} provider={provider} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Shared expanded details component
interface ExpandedEventDetailsProps {
  event: any;
  linkedData: any;
  provider: string;
}

function ExpandedEventDetails({ event, linkedData, provider }: ExpandedEventDetailsProps) {
  const payload = event.payload as Record<string, any> | null;
  const campaignStatus = getCampaignStatus(payload);
  const rawResultText = getRawResultText(payload);
  const statusInfo = getCampaignStatusInfo(campaignStatus);

  return (
    <div className="p-4 space-y-4 border-l-2 border-primary/30 ml-2 md:ml-6">
      {/* Campaign Outcome Section - Shows both canonical enum and raw result */}
      <div className="border border-border/50 rounded-lg p-3 bg-gradient-to-br from-primary/5 to-transparent">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Campaign Outcome
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Canonical Status (Source of Truth) */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Canonical Status</p>
            <div className="flex items-center gap-2">
              <Badge className={cn(statusInfo.color, !statusInfo.isKnown && campaignStatus && "border-dashed")} variant="outline">
                {statusInfo.label}
                {!statusInfo.isKnown && campaignStatus && (
                  <span className="ml-1 text-[10px] opacity-60">(?)</span>
                )}
              </Badge>
              {campaignStatus ? (
                <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  {campaignStatus}
                </code>
              ) : (
                <span className="text-xs text-muted-foreground">No campaign_status provided</span>
              )}
            </div>
            {!statusInfo.isKnown && campaignStatus && (
              <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Unknown status value (displayed as-is)
              </p>
            )}
          </div>

          {/* Raw Result Text (Human-Readable) */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Raw Result Text</p>
            <p className="text-sm font-medium">
              {rawResultText !== null && rawResultText !== undefined && rawResultText !== "" ? rawResultText : "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              (Stored for transparency; not used for filtering/logic)
            </p>
          </div>
        </div>
      </div>

      {/* Raw Payload */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <FileJson className="h-4 w-4 text-blue-400" />
          Raw Payload
        </h4>
        <ScrollArea className="h-[180px] rounded-md border border-border/50 bg-muted/30">
          <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
            {payload ? JSON.stringify(payload, null, 2) : "No payload data"}
          </pre>
        </ScrollArea>
      </div>

      {/* Linked Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Related Agent */}
        <div className="border border-border/50 rounded-lg p-3 bg-card/20">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <User className="h-4 w-4 text-purple-400" />
            Linked Agent
          </h4>
          {linkedData?.agent ? (
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {linkedData.agent.name}</p>
              <p><span className="text-muted-foreground">Email:</span> {linkedData.agent.email}</p>
              <p className="font-mono text-xs break-all">
                <span className="text-muted-foreground">External ID:</span>{" "}
                {linkedData.agent.external_adversus_id || linkedData.agent.external_dialer_id}
              </p>
              <Badge variant={linkedData.agent.is_active ? "default" : "secondary"} className="mt-1">
                {linkedData.agent.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          ) : event._agent?.name ? (
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {event._agent.name}</p>
              <p><span className="text-muted-foreground">Email:</span> {event._agent.email || "-"}</p>
              <p className="font-mono text-xs break-all">
                <span className="text-muted-foreground">External ID:</span> {event._agent.external_id || "-"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No linked agent found
            </p>
          )}
        </div>

        {/* Employee Mapping */}
        <div className="border border-border/50 rounded-lg p-3 bg-card/20">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-cyan-400" />
            Employee Mapping
          </h4>
          {linkedData?.employeeMapping ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Employee:</span>{" "}
                {linkedData.employeeMapping.employee_master_data?.first_name}{" "}
                {linkedData.employeeMapping.employee_master_data?.last_name}
              </p>
              <p><span className="text-muted-foreground">Email:</span> {linkedData.employeeMapping.employee_master_data?.work_email}</p>
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">Source:</span> {linkedData.employeeMapping.source}
              </p>
              <p className="font-mono text-xs break-all">
                <span className="text-muted-foreground">Source ID:</span> {linkedData.employeeMapping.source_employee_id}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No employee mapping found
            </p>
          )}
        </div>
      </div>

      {/* Related Sales */}
      {(linkedData?.sales?.length > 0 || event._sale) && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            Related Sales Records
          </h4>
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>External ID</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(linkedData?.sales || [event._sale].filter(Boolean)).map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.adversus_external_id || sale.id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{sale.agent_name || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{sale.customer_company || "-"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{sale.customer_phone || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.validation_status === "validated" ? "default" : "secondary"}>
                          {sale.validation_status || sale.status || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {linkedData?.sales?.[0]?.sale_items?.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-medium text-muted-foreground mb-2">Sale Items</h5>
              <div className="flex flex-wrap gap-2">
                {linkedData.sales[0].sale_items.map((item: any) => (
                  <Badge key={item.id} variant="outline" className="text-xs">
                    {item.adversus_product_title || item.product_id} × {item.quantity}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Related Calls */}
      {linkedData?.calls?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-amber-400" />
            Related Call Records ({linkedData.calls.length})
          </h4>
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>External ID</TableHead>
                    <TableHead>Agent ID</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedData.calls.map((call: any) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-xs">{call.external_id || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{call.agent_external_id || "-"}</TableCell>
                      <TableCell>
                        {call.duration_seconds 
                          ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{call.status || "unknown"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {call.start_time ? format(new Date(call.start_time), "dd/MM/yyyy HH:mm") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Extracted Fields Summary */}
      {payload && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileJson className="h-4 w-4 text-pink-400" />
            Extracted Fields
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(extractKeyFields(payload)).map(([key, value]) => (
              <div key={key} className="border border-border/50 rounded p-2 bg-card/20">
                <p className="text-xs text-muted-foreground truncate">{key}</p>
                <p className="text-sm font-mono truncate" title={String(value)}>
                  {String(value) || "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getEventTypeColor(type: string) {
  const colors: Record<string, string> = {
    sale: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    leadClosedSuccess: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    result: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    unparsed_webhook: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return colors[type] || "bg-muted text-muted-foreground";
}

function extractKeyFields(payload: Record<string, any>): Record<string, any> {
  const keyFields: Record<string, any> = {};
  const importantKeys = [
    // Campaign status fields (canonical source of truth)
    "campaignStatus", "campaign_status", 
    // Raw result fields (human-readable)
    "result", "resultText", "result_text", "Resultat Af Samtalen",
    // Other important fields
    "userId", "agentId", "agent_id", "campaignId", "campaign_id",
    "phone", "customerPhone", "customer_phone", "email",
    "orderId", "order_id", "leadId", "lead_id",
    "status", "outcome",
    "productName", "product_name", "amount", "price",
  ];

  for (const key of importantKeys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      keyFields[key] = payload[key];
    }
  }

  if (payload.data && typeof payload.data === "object") {
    for (const key of importantKeys) {
      if (payload.data[key] !== undefined && payload.data[key] !== null && !keyFields[key]) {
        keyFields[key] = payload.data[key];
      }
    }
  }

  return keyFields;
}
