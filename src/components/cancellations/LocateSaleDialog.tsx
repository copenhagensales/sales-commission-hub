import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Check, AlertTriangle, CalendarIcon, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CLIENT_IDS } from "@/utils/clientIds";

interface FlatUnmatchedRow {
  importId: string;
  uploadType: string;
  rowData: Record<string, unknown>;
}

interface LocateSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: FlatUnmatchedRow;
  clientId: string;
  campaignIds: string[];
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  onMatch?: (saleId: string, row: FlatUnmatchedRow, saleItemTitle?: string) => void;
}

interface SaleRow {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  agent_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  sale_items: { id: string; display_name: string | null; adversus_product_title: string | null; quantity: number | null; mapped_revenue: number | null }[];
}

export function LocateSaleDialog({
  open,
  onOpenChange,
  row,
  clientId,
  campaignIds,
  assignedEmployeeId,
  assignedEmployeeName,
  onMatch,
}: LocateSaleDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [filterByEmployee, setFilterByEmployee] = useState(!!assignedEmployeeId);

  // Fetch sale_ids already in the queue (exclude rejected)
  const { data: usedSaleIds } = useQuery({
    queryKey: ["used-sale-ids", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cancellation_queue")
        .select("sale_id")
        .eq("client_id", clientId)
        .neq("status", "rejected");
      return new Set((data || []).map(d => d.sale_id));
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch all agent identities for this employee via agent mappings
  const { data: agentIdentities, isLoading: agentLoading } = useQuery({
    queryKey: ["employee-agent-identities", assignedEmployeeId],
    queryFn: async () => {
      if (!assignedEmployeeId) return null;

      // Get agent_ids mapped to this employee
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id")
        .eq("employee_id", assignedEmployeeId);

      const agentIds = (mappings || []).map(m => m.agent_id);

      const emails = new Set<string>();
      const names = new Set<string>();

      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from("agents")
          .select("email, name")
          .in("id", agentIds);

        for (const a of agents || []) {
          if (a.email) emails.add(a.email.toLowerCase());
          if (a.name) names.add(a.name.toLowerCase());
        }
      }

      // Fallback: get work_email from employee_master_data
      const { data: emp } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name, work_email")
        .eq("id", assignedEmployeeId)
        .single();

      if (emp?.work_email) emails.add(emp.work_email.toLowerCase());

      const isMappingBased = agentIds.length > 0;

      return {
        emails: [...emails],
        names: [...names],
        isMappingBased,
        fallbackName: emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : null,
      };
    },
    enabled: !!assignedEmployeeId && open,
  });

  // Only run sales query when agent identities are ready (if filter is on)
  const filterReady = !filterByEmployee || (!!agentIdentities && (agentIdentities.emails.length > 0 || agentIdentities.names.length > 0));

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["locate-sales", clientId, campaignIds, filterByEmployee, agentIdentities],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];

      if (filterByEmployee && agentIdentities) {
        // Build precise OR filter from agent identities
        const orClauses: string[] = [];
        for (const email of agentIdentities.emails) {
          orClauses.push(`agent_email.eq.${email}`);
        }
        for (const name of agentIdentities.names) {
          orClauses.push(`agent_name.eq.${name}`);
        }

        if (orClauses.length === 0) return [];

        const { data, error } = await supabase
          .from("sales")
          .select("id, sale_datetime, agent_name, agent_email, customer_phone, customer_company, sale_items(id, display_name, adversus_product_title, quantity, mapped_revenue)")
          .in("client_campaign_id", campaignIds)
          .or(orClauses.join(","))
          .order("sale_datetime", { ascending: false })
          .limit(200);

        if (error) throw error;
        return (data || []) as SaleRow[];
      }

      // No filter – show all sales for campaigns
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, agent_name, agent_email, customer_phone, customer_company, sale_items(id, display_name, adversus_product_title, quantity, mapped_revenue)")
        .in("client_campaign_id", campaignIds)
        .order("sale_datetime", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as SaleRow[];
    },
    enabled: open && campaignIds.length > 0 && filterReady,
  });

  const filtered = useMemo(() => {
    let result = sales;
    // Exclude sales already in queue
    if (usedSaleIds?.size) {
      result = result.filter(s => !usedSaleIds.has(s.id));
    }
    // Date filter
    if (dateFilter) {
      const target = format(dateFilter, "yyyy-MM-dd");
      result = result.filter(s =>
        s.sale_datetime && format(new Date(s.sale_datetime), "yyyy-MM-dd") === target
      );
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => {
        const searchable = [
          s.agent_name,
          s.agent_email,
          s.customer_phone,
          s.customer_company,
          s.sale_items?.map(i => i.display_name).join(" "),
        ].filter(Boolean).join(" ").toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [sales, searchQuery, usedSaleIds, dateFilter]);

  const handleSelectSale = (saleId: string) => {
    if (onMatch) {
      onMatch(saleId, row);
      toast({ title: "Salg valgt – afventer bekræftelse" });
      onOpenChange(false);
    }
  };

  const showFallbackWarning = filterByEmployee && agentIdentities && !agentIdentities.isMappingBased;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Lokaliser salg</DialogTitle>
          <DialogDescription>
            Find og vælg det korrekte salg at koble til denne annulleringsrække.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Row data summary */}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Annulleringsdata:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(row.rowData).filter(([k]) => k !== "_product_rows").map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs font-normal">
                  {key}: {val != null ? String(val) : "-"}
                </Badge>
              ))}
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg telefon, firma, sælger..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 gap-1.5 text-xs",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFilter ? format(dateFilter, "dd-MM-yyyy") : "Dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setDateFilter(undefined)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {assignedEmployeeId && (
              <div className="flex items-center gap-2">
                <Switch
                  id="filter-employee"
                  checked={filterByEmployee}
                  onCheckedChange={setFilterByEmployee}
                />
                <Label htmlFor="filter-employee" className="text-xs whitespace-nowrap">
                  Kun {assignedEmployeeName || "tildelt sælger"}
                </Label>
              </div>
            )}
          </div>

          {/* Fallback warning */}
          {showFallbackWarning && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Ingen agent-mapping fundet – filteret bruger kun work-email som fallback og kan være bredere end forventet.</span>
            </div>
          )}

          {(isLoading || (filterByEmployee && agentLoading)) ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Ingen salg fundet. Prøv at fjerne filtre eller søg bredere.
            </div>
          ) : (
            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Produkter</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd-MM-yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{sale.agent_name || sale.agent_email || "-"}</TableCell>
                      <TableCell className="text-xs">{sale.customer_phone || "-"}</TableCell>
                      <TableCell className="text-xs">{sale.customer_company || "-"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {sale.sale_items?.map(i => i.display_name).filter(Boolean).join(", ") || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {(() => {
                          const total = sale.sale_items?.reduce((sum, i) => sum + (i.mapped_revenue || 0), 0) || 0;
                          return total > 0 ? `${total.toLocaleString("da-DK")} kr` : "-";
                        })()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleSelectSale(sale.id)}
                        >
                          <Check className="h-3 w-3 mr-1" /> Vælg
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Viser op til 200 salg. Brug søgefeltet til at indsnævre resultater.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
