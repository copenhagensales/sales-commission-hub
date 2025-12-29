import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Calendar, 
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
  Database
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventsViewProps {
  provider: string;
  providerColor: string;
  iconColor: string;
}

const PAGE_SIZE = 50;

export default function EventsView({ provider, providerColor, iconColor }: EventsViewProps) {
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Fetch event types for filter dropdown
  const { data: eventTypes } = useQuery({
    queryKey: ["event-types", provider],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_events")
        .select("event_type")
        .order("event_type");
      
      if (error) throw error;
      const unique = [...new Set(data?.map(e => e.event_type) || [])];
      return unique.filter(Boolean).sort();
    },
    enabled: provider.toLowerCase() === "adversus",
  });

  // Fetch events with pagination
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["events", provider, eventTypeFilter, dateFrom, dateTo, search, page],
    queryFn: async () => {
      if (provider.toLowerCase() !== "adversus") {
        // For non-adversus providers, we'll show sales with raw_payload as "events"
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
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

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
            // Related data
            _agent: { name: sale.agent_name, email: sale.agent_email, external_id: sale.agent_external_id },
            _customer: { phone: sale.customer_phone, company: sale.customer_company },
            _sale: sale,
          })),
          total: count || 0,
        };
      }

      // For adversus provider, fetch from adversus_events
      let query = supabase
        .from("adversus_events")
        .select("*", { count: "exact" })
        .order("received_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
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
    queryKey: ["event-linked-data", Array.from(expandedEvents)],
    queryFn: async () => {
      if (expandedEvents.size === 0) return {};

      const eventIds = Array.from(expandedEvents);
      const linkedData: Record<string, any> = {};

      // For each expanded event, fetch related sales, agents, etc.
      await Promise.all(
        eventIds.map(async (eventId) => {
          const event = eventsData?.events.find(e => e.id === eventId);
          if (!event) return;

          const externalId = event.external_id;
          const payload = event.payload as Record<string, any> | null;

          // Try to find related sale by external_id
          const { data: relatedSales } = await supabase
            .from("sales")
            .select(`
              *,
              sale_items (*)
            `)
            .or(`adversus_external_id.eq.${externalId},id.eq.${eventId}`)
            .limit(5);

          // Try to find related agent
          const agentExternalId = payload?.userId || payload?.agentId || payload?.agent_id;
          let relatedAgent = null;
          if (agentExternalId) {
            const { data } = await supabase
              .from("agents")
              .select("*")
              .or(`external_adversus_id.eq.${agentExternalId},external_dialer_id.eq.${agentExternalId}`)
              .limit(1)
              .single();
            relatedAgent = data;
          }

          // Try to find employee mapping
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
              .single();
            employeeMapping = data;
          }

          // Try to find related calls
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

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const totalPages = Math.ceil((eventsData?.total || 0) / PAGE_SIZE);

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      sale: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      leadClosedSuccess: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      result: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      unparsed_webhook: "bg-red-500/20 text-red-300 border-red-500/30",
    };
    return colors[type] || "bg-muted text-muted-foreground";
  };

  return (
    <Card className={`bg-gradient-to-br ${providerColor}`}>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className={`capitalize flex items-center gap-2 ${iconColor}`}>
            <FileJson className="h-5 w-5" />
            Events from {provider}
            {eventsData && (
              <Badge variant="outline" className="ml-2">
                {eventsData.total.toLocaleString()} total
              </Badge>
            )}
          </CardTitle>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>

          {provider.toLowerCase() === "adversus" && eventTypes && eventTypes.length > 0 && (
            <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {eventTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="w-[140px]"
              placeholder="From"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="w-[140px]"
              placeholder="To"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {eventsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !eventsData?.events.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No events found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || eventTypeFilter !== "all" || dateFrom || dateTo 
                ? "Try adjusting your filters" 
                : `No events from ${provider} yet`}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {eventsData.events.map((event: any) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isExpanded={expandedEvents.has(event.id)}
                  onToggle={() => toggleExpand(event.id)}
                  linkedData={linkedDataMap?.[event.id]}
                  getEventTypeColor={getEventTypeColor}
                  provider={provider}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} ({eventsData.total.toLocaleString()} events)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface EventRowProps {
  event: any;
  isExpanded: boolean;
  onToggle: () => void;
  linkedData: any;
  getEventTypeColor: (type: string) => string;
  provider: string;
}

function EventRow({ event, isExpanded, onToggle, linkedData, getEventTypeColor, provider }: EventRowProps) {
  const payload = event.payload as Record<string, any> | null;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border/50 rounded-lg bg-card/30 hover:bg-card/50 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center gap-4 text-left">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}

            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4">
              <div className="font-mono text-xs truncate" title={event.external_id}>
                {event.external_id || event.id?.slice(0, 8)}
              </div>
              
              <Badge className={`w-fit ${getEventTypeColor(event.event_type)}`}>
                {event.event_type}
              </Badge>

              <div className="text-sm text-muted-foreground">
                {event.received_at 
                  ? format(new Date(event.received_at), "dd/MM/yyyy HH:mm:ss")
                  : "-"}
              </div>

              <div className="flex items-center gap-1">
                {event.processed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-400" />
                )}
                <span className="text-xs text-muted-foreground">
                  {event.processed ? "Processed" : "Pending"}
                </span>
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {payload?.customerPhone || payload?.phone || event._customer?.phone || "-"}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-4 space-y-4">
            {/* Raw Payload */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileJson className="h-4 w-4 text-blue-400" />
                Raw Payload
              </h4>
              <ScrollArea className="h-[200px] rounded-md border border-border/50 bg-muted/30 p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {payload ? JSON.stringify(payload, null, 2) : "No payload data"}
                </pre>
              </ScrollArea>
            </div>

            {/* Linked Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <p className="font-mono text-xs">
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
                    <p className="font-mono text-xs">
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
                    <p className="font-mono text-xs">
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
                <div className="overflow-x-auto">
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
                          <TableCell>{sale.agent_name || "-"}</TableCell>
                          <TableCell>
                            <div>
                              <div>{sale.customer_company || "-"}</div>
                              <div className="text-xs text-muted-foreground">{sale.customer_phone || "-"}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sale.validation_status === "validated" ? "default" : "secondary"}>
                              {sale.validation_status || sale.status || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Sale Items */}
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
                  <Database className="h-4 w-4 text-amber-400" />
                  Related Call Records ({linkedData.calls.length})
                </h4>
                <div className="overflow-x-auto">
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
                          <TableCell className="text-sm text-muted-foreground">
                            {call.start_time ? format(new Date(call.start_time), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Extracted Fields Summary */}
            {payload && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-pink-400" />
                  Extracted Fields
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(extractKeyFields(payload)).map(([key, value]) => (
                    <div key={key} className="border border-border/50 rounded p-2 bg-card/20">
                      <p className="text-xs text-muted-foreground">{key}</p>
                      <p className="text-sm font-mono truncate" title={String(value)}>
                        {String(value) || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Extract commonly useful fields from payload
function extractKeyFields(payload: Record<string, any>): Record<string, any> {
  const keyFields: Record<string, any> = {};
  const importantKeys = [
    "userId", "agentId", "agent_id", "campaignId", "campaign_id",
    "phone", "customerPhone", "customer_phone", "email",
    "orderId", "order_id", "leadId", "lead_id",
    "status", "result", "outcome",
    "productName", "product_name", "amount", "price",
  ];

  for (const key of importantKeys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      keyFields[key] = payload[key];
    }
  }

  // Also check nested objects
  if (payload.data && typeof payload.data === "object") {
    for (const key of importantKeys) {
      if (payload.data[key] !== undefined && payload.data[key] !== null && !keyFields[key]) {
        keyFields[key] = payload.data[key];
      }
    }
  }

  return keyFields;
}
