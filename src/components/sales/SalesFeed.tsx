import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Clock
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

export default function SalesFeed() {
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [newSaleIds, setNewSaleIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Fetch paginated sales data
  const { data, isLoading } = useQuery({
    queryKey: ["sales-feed", currentPage, agentFilter, searchQuery],
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
      if (agentFilter !== "all") {
        query = query.eq("agent_name", agentFilter);
      }
      if (searchQuery) {
        query = query.or(`customer_phone.ilike.%${searchQuery}%,customer_company.ilike.%${searchQuery}%,agent_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      return { sales: (data || []) as Sale[], totalCount: count || 0 };
    },
  });

  const sales = data?.sales || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch unique agents for filter
  const { data: agents } = useQuery({
    queryKey: ["sales-feed-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("agent_name")
        .not("agent_name", "is", null)
        .order("agent_name");
      
      const uniqueAgents = [...new Set(data?.map(s => s.agent_name).filter(Boolean))];
      return uniqueAgents as string[];
    },
  });

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
  }, [searchQuery, agentFilter]);

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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter telefon, kunde eller agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Alle agenter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle agenter</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent} value={agent}>
                  {agent}
                </SelectItem>
              ))}
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
                    <TableHead className="w-[200px]">Agent</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Produkter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Tidspunkt</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                  {getInitials(sale.agent_name)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              {sale.agent_email && <p className="text-xs">{sale.agent_email}</p>}
                            </TooltipContent>
                          </Tooltip>
                          <span className="font-medium truncate max-w-[120px]">
                            {sale.agent_name || "Ukendt"}
                          </span>
                        </div>
                      </TableCell>
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
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px]">
                            {sale.client_campaigns?.clients?.name || sale.client_campaigns?.name || "-"}
                          </span>
                          {sale.customer_company && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {sale.customer_company}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getProductsDisplay(sale.sale_items)}</TableCell>
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
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground whitespace-nowrap cursor-default">
                              {formatDistanceToNow(parseISO(sale.sale_datetime), { 
                                addSuffix: true, 
                                locale: da 
                              })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(parseISO(sale.sale_datetime), "EEEE d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                          </TooltipContent>
                        </Tooltip>
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