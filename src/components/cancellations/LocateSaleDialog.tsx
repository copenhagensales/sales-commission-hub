import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
}

interface SaleRow {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  agent_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  sale_items: { display_name: string | null; quantity: number | null; mapped_revenue: number | null }[];
}

export function LocateSaleDialog({
  open,
  onOpenChange,
  row,
  clientId,
  campaignIds,
  assignedEmployeeId,
  assignedEmployeeName,
}: LocateSaleDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterByEmployee, setFilterByEmployee] = useState(!!assignedEmployeeId);
  const queryClient = useQueryClient();

  // Fetch employee email for filtering
  const { data: employeeData } = useQuery({
    queryKey: ["employee-email", assignedEmployeeId],
    queryFn: async () => {
      if (!assignedEmployeeId) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("id", assignedEmployeeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!assignedEmployeeId,
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["locate-sales", clientId, campaignIds, filterByEmployee, assignedEmployeeId],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];

      let query = supabase
        .from("sales")
        .select("id, sale_datetime, agent_name, agent_email, customer_phone, customer_company, sale_items(display_name, quantity, mapped_revenue)")
        .in("client_campaign_id", campaignIds)
        .order("sale_datetime", { ascending: false })
        .limit(200);

      if (filterByEmployee && employeeData) {
        const empName = `${employeeData.first_name} ${employeeData.last_name}`.trim();
        if (employeeData.work_email) {
          query = query.or(`agent_email.ilike.${employeeData.work_email},agent_name.ilike.%${empName}%`);
        } else {
          query = query.ilike("agent_name", `%${empName}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SaleRow[];
    },
    enabled: open && campaignIds.length > 0,
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter(s => {
      const searchable = [
        s.agent_name,
        s.agent_email,
        s.customer_phone,
        s.customer_company,
        s.sale_items?.map(i => i.display_name).join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [sales, searchQuery]);

  const linkSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      // 1. Insert into cancellation_queue
      const { error: queueError } = await supabase
        .from("cancellation_queue")
        .insert([{
          import_id: row.importId,
          sale_id: saleId,
          upload_type: row.uploadType,
          status: "pending",
          uploaded_data: row.rowData as unknown as Json,
          client_id: clientId,
        }]);
      if (queueError) throw queueError;

      // 2. Remove row from unmatched_rows
      const { data: importData } = await supabase
        .from("cancellation_imports")
        .select("unmatched_rows")
        .eq("id", row.importId)
        .single();

      if (importData?.unmatched_rows && Array.isArray(importData.unmatched_rows)) {
        const rowJson = JSON.stringify(row.rowData);
        const updated = (importData.unmatched_rows as Record<string, unknown>[]).filter(
          ur => JSON.stringify(ur) !== rowJson
        );
        await supabase
          .from("cancellation_imports")
          .update({ unmatched_rows: (updated.length > 0 ? updated : null) as Json })
          .eq("id", row.importId);
      }
    },
    onSuccess: () => {
      toast({ title: "Salg koblet til annullering og sendt til godkendelseskøen" });
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Fejl ved kobling af salg", variant: "destructive" });
    },
  });

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
              {Object.entries(row.rowData).filter(([k]) => k !== "_product_rows").slice(0, 6).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs font-normal">
                  {key}: {val != null ? String(val) : "-"}
                </Badge>
              ))}
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg telefon, firma, sælger..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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

          {isLoading ? (
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
                          disabled={linkSaleMutation.isPending}
                          onClick={() => linkSaleMutation.mutate(sale.id)}
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
