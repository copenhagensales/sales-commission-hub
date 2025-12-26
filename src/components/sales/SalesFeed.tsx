import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, parseISO, startOfDay, endOfDay, subDays, subWeeks, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  Copy, 
  Check, 
  Pause, 
  Play, 
  Search, 
  Loader2, 
  Radio,
  Clock,
  CalendarIcon,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Sale {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  agent_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  validation_status: string | null;
  client_campaigns: {
    id: string;
    name: string;
    clients: { id: string; name: string } | null;
  } | null;
  sale_items: Array<{
    id: string;
    quantity: number | null;
    adversus_product_title: string | null;
    products: { id: string; name: string } | null;
  }>;
}

const ITEMS_PER_PAGE = 20;

type DatePreset = "all" | "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "Alle datoer" },
  { value: "today", label: "I dag" },
  { value: "yesterday", label: "I går" },
  { value: "last7days", label: "Sidste 7 dage" },
  { value: "last30days", label: "Sidste 30 dage" },
  { value: "thisMonth", label: "Denne måned" },
  { value: "custom", label: "Vælg periode..." },
];

function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } | null {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "last7days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30days":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "thisMonth":
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(firstOfMonth), end: endOfDay(now) };
    default:
      return null;
  }
}

export default function SalesFeed() {
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [newSaleIds, setNewSaleIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Get effective date range based on preset or custom range
  const getEffectiveDateRange = useCallback(() => {
    if (datePreset === "custom" && customDateRange.from) {
      return { 
        start: startOfDay(customDateRange.from), 
        end: endOfDay(customDateRange.to || customDateRange.from) 
      };
    }
    return getDateRangeFromPreset(datePreset);
  }, [datePreset, customDateRange]);

  // Fetch paginated sales data
  const dateRange = getEffectiveDateRange();
  const { data, isLoading } = useQuery({
    queryKey: ["sales-feed", currentPage, searchQuery, datePreset, statusFilter, customDateRange.from?.toISOString(), customDateRange.to?.toISOString()],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          agent_name,
          agent_email,
          customer_phone,
          customer_company,
          validation_status,
          client_campaigns (
            id,
            name,
            clients (id, name)
          ),
          sale_items (
            id,
            quantity,
            adversus_product_title,
            products (id, name)
          )
        `, { count: "exact" })
        .order("sale_datetime", { ascending: false });

      // Apply filters
      if (searchQuery) {
        query = query.or(`customer_phone.ilike.%${searchQuery}%,customer_company.ilike.%${searchQuery}%,agent_name.ilike.%${searchQuery}%`);
      }
      if (dateRange) {
        query = query.gte("sale_datetime", dateRange.start.toISOString()).lte("sale_datetime", dateRange.end.toISOString());
      }
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          query = query.or('validation_status.is.null,validation_status.eq.pending');
        } else {
          query = query.eq('validation_status', statusFilter);
        }
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      return { sales: (data || []) as Sale[], totalCount: count || 0 };
    },
  });

  const sales = data?.sales || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Real-time subscription
  useEffect(() => {
    if (isPaused) return;

    const channel = supabase
      .channel("sales-feed-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
        },
        async (payload) => {
          // Fetch the full sale with relations
          const { data: newSale } = await supabase
            .from("sales")
            .select(`
              id,
              sale_datetime,
              agent_name,
              agent_email,
              customer_phone,
              customer_company,
              validation_status,
              client_campaigns (
                id,
                name,
                clients (id, name)
              ),
              sale_items (
                id,
                quantity,
                adversus_product_title,
                products (id, name)
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (newSale) {
            // Mark as new for animation
            setNewSaleIds(prev => new Set([...prev, newSale.id]));
            
            // Remove animation after 5 seconds
            setTimeout(() => {
              setNewSaleIds(prev => {
                const next = new Set(prev);
                next.delete(newSale.id);
                return next;
              });
            }, 5000);

            // Invalidate query to refetch with new data
            queryClient.invalidateQueries({ queryKey: ["sales-feed"] });

            // Reset to first page when new sale arrives
            setCurrentPage(1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPaused, queryClient]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, datePreset, statusFilter, customDateRange]);

  // Copy phone number
  const copyPhone = useCallback((phone: string, saleId: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(saleId);
    toast.success("Telefonnummer kopieret");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Get initials from agent name
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Format phone number for display
  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 8) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
    }
    return phone;
  };

  // Get products display
  const getProductsDisplay = (items: Sale["sale_items"]) => {
    if (!items || items.length === 0) return <span className="text-muted-foreground">-</span>;
    
    return (
      <div className="flex gap-1 flex-wrap">
        {items.map((item, idx) => {
          const name = item.products?.name || item.adversus_product_title || "Unknown";
          const qty = item.quantity || 1;
          return (
            <Badge key={idx} variant="secondary" className="text-xs">
              {qty > 1 ? `${qty}x ` : ""}{name}
            </Badge>
          );
        })}
      </div>
    );
  };

  // Generate pagination range
  const getPaginationRange = () => {
    const range: (number | "ellipsis")[] = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (showEllipsisStart) range.push("ellipsis");
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) range.push(i);
      
      if (showEllipsisEnd) range.push("ellipsis");
      range.push(totalPages);
    }
    return range;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter telefon, kunde eller agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Date Filter with Presets */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[220px] justify-start text-left font-normal",
                  datePreset === "all" && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {datePreset === "custom" && customDateRange.from 
                  ? customDateRange.to 
                    ? `${format(customDateRange.from, "d/M", { locale: da })} - ${format(customDateRange.to, "d/M", { locale: da })}`
                    : format(customDateRange.from, "d. MMM yyyy", { locale: da })
                  : DATE_PRESETS.find(p => p.value === datePreset)?.label || "Vælg periode"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col">
                {/* Preset Options */}
                <div className="p-2 space-y-1">
                  {DATE_PRESETS.filter(p => p.value !== "custom").map((preset) => (
                    <Button
                      key={preset.value}
                      variant={datePreset === preset.value ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-9"
                      onClick={() => {
                        setDatePreset(preset.value);
                        setCustomDateRange({ from: undefined, to: undefined });
                        setIsCalendarOpen(false);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  {/* Custom Period Button */}
                  <Button
                    variant={datePreset === "custom" ? "secondary" : "ghost"}
                    className="w-full justify-start text-left h-9"
                    onClick={() => {
                      setIsCalendarOpen(false);
                      setIsRangePickerOpen(true);
                    }}
                  >
                    Vælg periode...
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Picker Dialog */}
          <Popover open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
            <PopoverTrigger asChild>
              <span className="hidden" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Vælg periode</p>
                <Calendar
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => {
                    setCustomDateRange({ from: range?.from, to: range?.to });
                  }}
                  locale={da}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsRangePickerOpen(false);
                    }}
                  >
                    Annuller
                  </Button>
                  <Button
                    size="sm"
                    disabled={!customDateRange.from}
                    onClick={() => {
                      if (customDateRange.from) {
                        setDatePreset("custom");
                        setIsRangePickerOpen(false);
                      }
                    }}
                  >
                    Anvend
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {datePreset !== "all" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDatePreset("all");
                setCustomDateRange({ from: undefined, to: undefined });
              }}
              className="h-10 w-10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Alle status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle status</SelectItem>
              <SelectItem value="pending">Afventer</SelectItem>
              <SelectItem value="approved">Godkendt</SelectItem>
              <SelectItem value="cancelled">Annulleret</SelectItem>
              <SelectItem value="rejected">Afvist</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={isPaused ? "default" : "outline"}
            onClick={() => setIsPaused(!isPaused)}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Genoptag
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className={cn(
              "h-4 w-4",
              isPaused ? "text-muted-foreground" : "text-green-500 animate-pulse"
            )} />
            {isPaused ? "Live opdateringer sat på pause" : "Live - nye salg vises automatisk"}
          </div>
          <span className="text-sm text-muted-foreground">
            Viser {sales.length} af {totalCount} salg
          </span>
        </div>

        {/* Sales Table */}
        {sales.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Venter på nye salg</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Nye salg vil automatisk dukke op her i realtid
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead className="w-[180px]">Agent</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Produkter</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow 
                      key={sale.id}
                      className={cn(
                        "transition-all duration-500",
                        newSaleIds.has(sale.id) && "bg-primary/10 animate-in slide-in-from-top-2"
                      )}
                    >
                      {/* Date Column */}
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm whitespace-nowrap cursor-default">
                              {format(parseISO(sale.sale_datetime), "d. MMM HH:mm", { locale: da })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(parseISO(sale.sale_datetime), "EEEE d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {/* Customer Column */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px]">
                            {sale.customer_company || "-"}
                          </span>
                          {sale.client_campaigns?.clients?.name && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {sale.client_campaigns.clients.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {/* Agent Column */}
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium truncate max-w-[150px] cursor-default">
                              {sale.agent_name || "Ukendt"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {sale.agent_email && <p className="text-xs">{sale.agent_email}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {/* Phone Column */}
                      <TableCell>
                        {sale.customer_phone ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm">{formatPhone(sale.customer_phone)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyPhone(sale.customer_phone!, sale.id)}
                            >
                              {copiedId === sale.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {/* Products Column */}
                      <TableCell>{getProductsDisplay(sale.sale_items)}</TableCell>
                      {/* Status Column */}
                      <TableCell>
                        <Badge
                          variant={
                            sale.validation_status === "cancelled" || sale.validation_status === "rejected"
                              ? "destructive"
                              : sale.validation_status === "pending"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {sale.validation_status || "ny"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  
                  {getPaginationRange().map((page, idx) => (
                    <PaginationItem key={idx}>
                      {page === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}