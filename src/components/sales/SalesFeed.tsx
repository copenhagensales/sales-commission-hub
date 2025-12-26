import { useState, useEffect, useCallback, useRef } from "react";
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
import { 
  Copy, 
  Check, 
  Pause, 
  Play, 
  Search, 
  Loader2, 
  Radio,
  Phone,
  Package,
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

export default function SalesFeed() {
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [newSaleIds, setNewSaleIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch initial sales data (last 100)
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .order("sale_datetime", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as Sale[];
    },
  });

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

            // Update the query cache
            queryClient.setQueryData<Sale[]>(["sales-feed"], (old) => {
              if (!old) return [newSale as Sale];
              // Add to top and keep max 100
              return [newSale as Sale, ...old].slice(0, 100);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPaused, queryClient]);

  // Filter sales
  const filteredSales = sales?.filter((sale) => {
    if (agentFilter !== "all" && sale.agent_name !== agentFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const phoneMatch = sale.customer_phone?.toLowerCase().includes(query);
      const companyMatch = sale.customer_company?.toLowerCase().includes(query);
      const agentMatch = sale.agent_name?.toLowerCase().includes(query);
      if (!phoneMatch && !companyMatch && !agentMatch) return false;
    }
    return true;
  });

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
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    // Format as XX XX XX XX for 8 digits (Danish)
    if (digits.length === 8) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
    }
    return phone;
  };

  // Get products display
  const getProductsDisplay = (items: Sale["sale_items"]) => {
    if (!items || items.length === 0) return null;
    
    return items.map((item, idx) => {
      const name = item.products?.name || item.adversus_product_title || "Unknown";
      const qty = item.quantity || 1;
      return (
        <Badge key={idx} variant="secondary" className="text-xs">
          {qty > 1 ? `${qty}x ` : ""}{name}
        </Badge>
      );
    });
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Radio className={cn(
            "h-4 w-4",
            isPaused ? "text-muted-foreground" : "text-green-500 animate-pulse"
          )} />
          {isPaused ? "Live opdateringer sat på pause" : "Live - nye salg vises automatisk"}
        </div>

        {/* Sales Feed */}
        <div ref={containerRef} className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
          {filteredSales?.length === 0 ? (
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
            filteredSales?.map((sale) => (
              <Card 
                key={sale.id} 
                className={cn(
                  "transition-all duration-500",
                  newSaleIds.has(sale.id) && "ring-2 ring-primary bg-primary/5 animate-in slide-in-from-top-2"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Agent Avatar */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(sale.agent_name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{sale.agent_name || "Ukendt agent"}</p>
                        {sale.agent_email && <p className="text-xs text-muted-foreground">{sale.agent_email}</p>}
                      </TooltipContent>
                    </Tooltip>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{sale.agent_name || "Ukendt agent"}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {sale.client_campaigns?.clients?.name || sale.client_campaigns?.name || "Ukendt kunde"}
                        </span>
                      </div>

                      {/* Phone number */}
                      {sale.customer_phone && (
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
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
                      )}

                      {/* Company name if available */}
                      {sale.customer_company && (
                        <p className="text-sm text-muted-foreground mt-1">{sale.customer_company}</p>
                      )}

                      {/* Products */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex gap-1 flex-wrap">
                          {getProductsDisplay(sale.sale_items) || (
                            <span className="text-sm text-muted-foreground">Ingen produkter</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side - Time and Status */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
