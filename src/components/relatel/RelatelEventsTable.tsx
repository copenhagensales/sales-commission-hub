import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  ChevronRightIcon,
  RefreshCw,
  Database,
  User,
  Package,
  Calendar,
  Phone,
  Mail,
  Building2,
  Hash,
  FileJson,
  ClipboardList
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface RelatelSale {
  id: string;
  adversus_external_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  sale_datetime: string | null;
  validation_status: string | null;
  dialer_campaign_id: string | null;
  raw_payload: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  sale_items?: Array<{
    id: string;
    adversus_product_title: string | null;
    adversus_external_id: string | null;
    quantity: number | null;
    mapped_commission: number | null;
  }>;
}

export default function RelatelEventsTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch Relatel sales data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["relatel-events", search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          id,
          adversus_external_id,
          agent_name,
          agent_email,
          customer_phone,
          customer_company,
          sale_datetime,
          validation_status,
          dialer_campaign_id,
          raw_payload,
          created_at,
          updated_at,
          sale_items (
            id,
            adversus_product_title,
            adversus_external_id,
            quantity,
            mapped_commission
          )
        `, { count: "exact" })
        .eq("source", "Relatel_CPHSALES")
        .order("sale_datetime", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.or(`agent_name.ilike.%${search}%,agent_email.ilike.%${search}%,adversus_external_id.ilike.%${search}%,customer_phone.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        sales: (data as RelatelSale[]) || [],
        total: count || 0,
      };
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  // Extract key info from raw_payload
  const extractPayloadInfo = (payload: Record<string, any> | null) => {
    if (!payload) return null;
    return {
      opportunityId: payload.id,
      leadId: payload.leadId,
      campaignId: payload.campaignId,
      currency: payload.currency,
      state: payload.state,
      createdTime: payload.createdTime,
      closedTime: payload.closedTime,
      createdBy: payload.createdBy,
      closedBy: payload.closedBy,
      ownedBy: payload.ownedBy,
      lastModifiedBy: payload.lastModifiedBy,
      lastModifiedTime: payload.lastModifiedTime,
      lines: payload.lines || [],
      // New: Lead result fields from Adversus
      leadResultFields: payload.leadResultFields || {},
      leadResultData: payload.leadResultData || [],
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Relatel Events
            </CardTitle>
            <CardDescription>
              {data?.total || 0} events i alt fra Relatel_CPHSALES
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and page size */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg på agent, email, telefon, ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={String(size)}>{size} pr. side</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ScrollArea className="w-full">
          <div className="min-w-[1000px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Kampagne</TableHead>
                  <TableHead>Salgstidspunkt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modtaget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Ingen events fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.sales.map((sale) => {
                    const isExpanded = expandedRows.has(sale.id);
                    const payloadInfo = extractPayloadInfo(sale.raw_payload);
                    const firstProduct = sale.sale_items?.[0];

                    return (
                      <Collapsible key={sale.id} open={isExpanded} onOpenChange={() => toggleExpand(sale.id)} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs">{sale.adversus_external_id || sale.id.slice(0, 8)}</span>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium truncate max-w-[150px]">{sale.agent_name || "-"}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{sale.agent_email || ""}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm truncate max-w-[200px] block">
                                  {firstProduct?.adversus_product_title || "-"}
                                </span>
                                {sale.sale_items && sale.sale_items.length > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{sale.sale_items.length - 1} mere
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs">{sale.dialer_campaign_id || "-"}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm whitespace-nowrap">
                                  {sale.sale_datetime 
                                    ? format(new Date(sale.sale_datetime), "d. MMM HH:mm", { locale: da })
                                    : "-"
                                  }
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline"
                                  className={
                                    sale.validation_status === "validated" 
                                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                                      : sale.validation_status === "cancelled"
                                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  }
                                >
                                  {sale.validation_status || "pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(sale.created_at), "d. MMM HH:mm:ss", { locale: da })}
                                </span>
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-4 space-y-4">
                                  {/* Key Fields Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> Opportunity ID
                                      </p>
                                      <p className="font-mono text-sm">{payloadInfo?.opportunityId || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> Lead ID
                                      </p>
                                      <p className="font-mono text-sm">{payloadInfo?.leadId || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <User className="h-3 w-3" /> Created By
                                      </p>
                                      <p className="font-mono text-sm">{payloadInfo?.createdBy || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <User className="h-3 w-3" /> Closed By
                                      </p>
                                      <p className="font-mono text-sm">{payloadInfo?.closedBy || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Created Time
                                      </p>
                                      <p className="text-sm">
                                        {payloadInfo?.createdTime 
                                          ? format(new Date(payloadInfo.createdTime), "d. MMM yyyy HH:mm", { locale: da })
                                          : "-"
                                        }
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Closed Time
                                      </p>
                                      <p className="text-sm">
                                        {payloadInfo?.closedTime 
                                          ? format(new Date(payloadInfo.closedTime), "d. MMM yyyy HH:mm", { locale: da })
                                          : "-"
                                        }
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground">State</p>
                                      <Badge variant="outline" className="bg-primary/10">
                                        {payloadInfo?.state || "-"}
                                      </Badge>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground">Currency</p>
                                      <p className="text-sm">{payloadInfo?.currency || "-"}</p>
                                    </div>
                                  </div>

                                  {/* Product Lines */}
                                  {payloadInfo?.lines && payloadInfo.lines.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium flex items-center gap-1">
                                        <Package className="h-4 w-4" /> Produktlinjer ({payloadInfo.lines.length})
                                      </h4>
                                      <div className="border rounded-md overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/50">
                                              <TableHead className="text-xs">Line ID</TableHead>
                                              <TableHead className="text-xs">Produkt</TableHead>
                                              <TableHead className="text-xs">Product ID</TableHead>
                                              <TableHead className="text-xs">Antal</TableHead>
                                              <TableHead className="text-xs">Pris</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {payloadInfo.lines.map((line: any, idx: number) => (
                                              <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">{line.lineId}</TableCell>
                                                <TableCell className="text-sm">{line.title || "-"}</TableCell>
                                                <TableCell className="font-mono text-xs">{line.productId}</TableCell>
                                                <TableCell className="text-sm">{line.quantity}</TableCell>
                                                <TableCell className="text-sm">{line.unitPrice} {payloadInfo.currency}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Lead Result Fields */}
                                  {payloadInfo?.leadResultFields && Object.keys(payloadInfo.leadResultFields).length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium flex items-center gap-1">
                                        <ClipboardList className="h-4 w-4" /> Resultatfelter ({Object.keys(payloadInfo.leadResultFields).length})
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 bg-background border rounded-md">
                                        {Object.entries(payloadInfo.leadResultFields).map(([fieldName, fieldValue]) => (
                                          <div key={fieldName} className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground truncate" title={fieldName}>
                                              {fieldName}
                                            </p>
                                            <p className="text-sm font-medium truncate" title={String(fieldValue ?? "-")}>
                                              {fieldValue !== null && fieldValue !== undefined && fieldValue !== "" 
                                                ? String(fieldValue) 
                                                : "-"
                                              }
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Raw Payload */}
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-1">
                                      <FileJson className="h-4 w-4" /> Raw Payload
                                    </h4>
                                    <pre className="bg-background border rounded-md p-3 text-xs overflow-x-auto max-h-[300px]">
                                      {JSON.stringify(sale.raw_payload, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Viser {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data?.total || 0)} af {data?.total || 0}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Side {page + 1} af {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
