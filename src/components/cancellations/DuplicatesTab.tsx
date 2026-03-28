import { useState, useMemo } from "react";
import { useAgentNameResolver } from "@/hooks/useAgentNameResolver";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, ShoppingCart, Copy, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EditCartDialog } from "./EditCartDialog";
import { CLIENT_IDS } from "@/utils/clientIds";
import { extractOpp } from "./utils/extractOpp";

const DUMMY_PHONES = new Set(["0000000", "00000000", "99999999", "", null]);

// Wrapper returning null instead of "" for backward compat
function extractOppNullable(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const result = extractOpp(raw);
  return result || null;
}

interface SaleRow {
  id: string;
  sale_datetime: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  validation_status: string | null;
  agent_name: string | null;
  source: string | null;
  raw_payload: Record<string, unknown> | null;
  sale_items?: { display_name: string | null; adversus_product_title: string | null }[];
}

interface DuplicateGroup {
  key: string;
  phone: string | null;
  company: string | null;
  customerName: string | null;
  sales: SaleRow[];
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "approved":
      return <Badge variant="default">Godkendt</Badge>;
    case "rejected":
      return <Badge variant="destructive">Afvist</Badge>;
    case "pending":
      return <Badge variant="secondary">Afventer</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Annulleret</Badge>;
    default:
      return <Badge variant="secondary">{status || "Ukendt"}</Badge>;
  }
}

function isValidPhone(phone: string | null | undefined): phone is string {
  return !!phone && !DUMMY_PHONES.has(phone.trim());
}

interface DuplicatesTabProps {
  clientId: string;
}

export function DuplicatesTab({ clientId: selectedClientId }: DuplicatesTabProps) {
  const { resolve } = useAgentNameResolver();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-for-duplicates", selectedClientId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedClientId) return [];

      let query = supabase
        .from("sales")
        .select("id, sale_datetime, customer_phone, customer_company, validation_status, agent_name, source, raw_payload, sale_items(display_name, adversus_product_title)")
        .neq("validation_status", "cancelled")
        .order("sale_datetime", { ascending: false });

      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", selectedClientId);

      const campaignIds = campaigns?.map((c) => c.id) || [];
      if (campaignIds.length === 0) return [];
      query = query.in("client_campaign_id", campaignIds);

      if (dateFrom) query = query.gte("sale_datetime", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) query = query.lte("sale_datetime", format(dateTo, "yyyy-MM-dd") + "T23:59:59");

      // Fetch all rows with pagination to avoid 1000-row limit
      const allRows: SaleRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...(data as unknown as SaleRow[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allRows;
    },
    enabled: !!selectedClientId,
  });

  const isTdc = selectedClientId === CLIENT_IDS["TDC Erhverv"];

  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, SaleRow[]>();

    for (const sale of sales) {
      let key: string | null = null;
      if (isTdc) {
        key = extractOppNullable(sale.raw_payload);
      } else {
        const phone = sale.customer_phone?.trim();
        if (isValidPhone(phone)) key = phone;
      }
      if (key) {
        const existing = groupMap.get(key) || [];
        existing.push(sale);
        groupMap.set(key, existing);
      }
    }

    const minCount = 2;
    const groups: DuplicateGroup[] = [];

    for (const [key, keySales] of groupMap) {
      if (keySales.length >= minCount) {
        const firstSale = keySales[0];
        const customerName = firstSale.raw_payload
          ? (firstSale.raw_payload as Record<string, unknown>)["CustomerName"] as string | null
          : null;

        groups.push({
          key,
          phone: isTdc ? null : key,
          company: firstSale.customer_company,
          customerName,
          sales: keySales,
        });
      }
    }

    groups.sort((a, b) => b.sales.length - a.sales.length);
    return groups;
  }, [sales, isTdc]);

  // Agents that appear in duplicate groups
  const agentsWithDuplicates = useMemo(() => {
    const names = new Set<string>();
    for (const group of duplicateGroups) {
      for (const sale of group.sales) {
        if (sale.agent_name) names.add(sale.agent_name);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "da"));
  }, [duplicateGroups]);

  // Filter groups by selected agent
  const filteredGroups = useMemo(() => {
    if (!selectedAgent) return duplicateGroups;
    return duplicateGroups.filter((g) =>
      g.sales.some((s) => s.agent_name === selectedAgent)
    );
  }, [duplicateGroups, selectedAgent]);

  const totalSalesInvolved = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.sales.length, 0),
    [filteredGroups]
  );

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="space-y-2">
          <Label>Fra dato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: da }) : "Vælg dato..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setSelectedAgent(""); }} initialFocus className="pointer-events-auto" locale={da} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Til dato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: da }) : "Vælg dato..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setSelectedAgent(""); }} initialFocus className="pointer-events-auto" locale={da} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Vælg medarbejder</Label>
          <Select value={selectedAgent || "all"} onValueChange={(v) => setSelectedAgent(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Alle medarbejdere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle medarbejdere</SelectItem>
              {agentsWithDuplicates.map((name) => (
                <SelectItem key={name} value={name}>
                  {resolve(name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary + Results */}
      {!selectedClientId ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p>Vælg en kunde for at finde dubletter</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>Ingen dubletter fundet med de valgte filtre</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-4">
            <div className="rounded-lg border bg-card p-4 flex-1">
              <p className="text-sm text-muted-foreground">Dublet-grupper</p>
              <p className="text-2xl font-bold">{filteredGroups.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 flex-1">
              <p className="text-sm text-muted-foreground">Salg involveret</p>
              <p className="text-2xl font-bold">{totalSalesInvolved}</p>
            </div>
          </div>

          {/* Grouped results */}
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const isOpen = openGroups.has(group.key);
              return (
                <Collapsible key={group.key} open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Copy className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">
                            {isTdc ? `OPP: ${group.key}` : group.phone}
                          </span>
                          {group.company && (
                            <span className="text-muted-foreground ml-2">– {group.company}</span>
                          )}
                          {group.customerName && (
                            <span className="text-muted-foreground ml-2">({group.customerName})</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary">{group.sales.length} salg</Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-md border mt-1 ml-7">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Salgsdato</TableHead>
                            <TableHead>Sælger</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>Produkt</TableHead>
                            <TableHead>Virksomhed</TableHead>
                            <TableHead>Kilde</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Handling</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.sales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell>
                                {sale.sale_datetime
                                  ? format(new Date(sale.sale_datetime), "dd/MM/yyyy", { locale: da })
                                  : "-"}
                              </TableCell>
                              <TableCell>{resolve(sale.agent_name) || "-"}</TableCell>
                              <TableCell>{sale.customer_phone || "-"}</TableCell>
                              <TableCell>
                                {sale.sale_items && sale.sale_items.length > 0
                                  ? sale.sale_items.map((item, i) => (
                                      <Badge key={i} variant="outline" className="mr-1 mb-0.5">
                                        {item.display_name ?? item.adversus_product_title ?? "-"}
                                      </Badge>
                                    ))
                                  : "-"}
                              </TableCell>
                              <TableCell>{sale.customer_company || "-"}</TableCell>
                              <TableCell>{sale.source || "-"}</TableCell>
                              <TableCell>{getStatusBadge(sale.validation_status)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedSaleId(sale.id)}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-1" />
                                  Rediger kurv
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </>
      )}

      <EditCartDialog
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
      />
    </div>
  );
}
