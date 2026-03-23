import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Check, X, Loader2, Clock, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export function ApprovalQueueTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-approval", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const { data: queueItems = [], isLoading } = useQuery({
    queryKey: ["cancellation-queue", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("cancellation_queue")
        .select(`
          id,
          sale_id,
          upload_type,
          status,
          reviewed_at,
          created_at,
          import_id
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Fetch related sales and imports data
      const saleIds = [...new Set(data.map(d => d.sale_id))];
      const importIds = [...new Set(data.map(d => d.import_id))];

      const [salesResult, importsResult] = await Promise.all([
        saleIds.length > 0
          ? supabase
              .from("sales")
              .select("id, sale_datetime, customer_phone, customer_company, agent_name, validation_status, raw_payload")
              .in("id", saleIds)
          : { data: [] as any[], error: null },
        importIds.length > 0
          ? supabase
              .from("cancellation_imports")
              .select("id, file_name, uploaded_by")
              .in("id", importIds)
          : { data: [] as any[], error: null },
      ]);

      const salesMap = new Map((salesResult.data || []).map(s => [s.id, s]));
      const importsMap = new Map((importsResult.data || []).map(i => [i.id, i]));

      // Extract OPP from raw_payload
      const extractOpp = (rawPayload: unknown): string => {
        if (!rawPayload || typeof rawPayload !== 'object') return "";
        const rp = rawPayload as Record<string, unknown>;
        if (rp['legacy_opp_number']) return String(rp['legacy_opp_number']);
        const fields = rp['leadResultFields'] as Record<string, unknown> | undefined;
        if (fields?.['OPP nr']) return String(fields['OPP nr']);
        if (fields?.['OPP-nr']) return String(fields['OPP-nr']);
        const dataArr = rp['leadResultData'] as Array<{label?: string; value?: string}> | undefined;
        if (Array.isArray(dataArr)) {
          const found = dataArr.find(d => d.label === 'OPP nr' || d.label === 'OPP-nr');
          if (found?.value) return String(found.value);
        }
        return "";
      };

      return data.map(item => {
        const sale = salesMap.get(item.sale_id);
        const imp = importsMap.get(item.import_id);
        return {
          ...item,
          saleDate: sale?.sale_datetime || "",
          agentName: sale?.agent_name || "Ukendt",
          phone: sale?.customer_phone || "",
          company: sale?.customer_company || "",
          oppNumber: extractOpp(sale?.raw_payload),
          currentValidationStatus: sale?.validation_status || "",
          fileName: imp?.file_name || "",
        };
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");

      // Get the items to approve
      const items = queueItems.filter(i => itemIds.includes(i.id));

      for (const item of items) {
        // Update the sale based on upload_type
        const newStatus = item.upload_type === "cancellation" ? "cancelled" : "basket_changed";
        const { error: saleError } = await supabase
          .from("sales")
          .update({ validation_status: newStatus })
          .eq("id", item.sale_id);
        if (saleError) throw saleError;

        // Update queue item
        const { error: queueError } = await supabase
          .from("cancellation_queue")
          .update({
            status: "approved",
            reviewed_by: currentEmployee.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (queueError) throw queueError;
      }

      return { count: items.length };
    },
    onSuccess: ({ count }) => {
      toast({ title: "Godkendt", description: `${count} salg er godkendt.` });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");

      for (const id of itemIds) {
        const { error } = await supabase
          .from("cancellation_queue")
          .update({
            status: "rejected",
            reviewed_by: currentEmployee.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
      }

      return { count: itemIds.length };
    },
    onSuccess: ({ count }) => {
      toast({ title: "Afvist", description: `${count} salg er afvist.` });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const pendingItems = queueItems.filter(i => i.status === "pending");
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Godkendelseskø
              </CardTitle>
              <CardDescription>
                Gennemse og godkend/afvis uploadede annulleringer og kurv-rettelser.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ventende</SelectItem>
                  <SelectItem value="approved">Godkendte</SelectItem>
                  <SelectItem value="rejected">Afviste</SelectItem>
                  <SelectItem value="all">Alle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusFilter === "pending" && pendingItems.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(pendingItems.map(i => i.id))}
                disabled={isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Godkend alle ({pendingItems.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate(pendingItems.map(i => i.id))}
                disabled={isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Afvis alle ({pendingItems.length})
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : queueItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Ingen {statusFilter === "pending" ? "ventende" : ""} items i køen.
            </div>
          ) : (
            <div className="rounded-md border max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salgsdato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Virksomhed</TableHead>
                    <TableHead>OPP</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fil</TableHead>
                    <TableHead>Status</TableHead>
                    {statusFilter === "pending" && <TableHead>Handlinger</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.saleDate ? format(new Date(item.saleDate), "dd/MM/yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell>{item.agentName}</TableCell>
                      <TableCell>{item.phone || "-"}</TableCell>
                      <TableCell>{item.company || "-"}</TableCell>
                      <TableCell>{item.oppNumber || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.upload_type === "cancellation" ? "destructive" : "secondary"}>
                          {item.upload_type === "cancellation" ? "Annullering" : "Kurv diff."}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={item.fileName}>
                        {item.fileName || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "approved" ? "default" :
                            item.status === "rejected" ? "destructive" : "secondary"
                          }
                        >
                          {item.status === "pending" ? "Ventende" :
                           item.status === "approved" ? "Godkendt" : "Afvist"}
                        </Badge>
                      </TableCell>
                      {statusFilter === "pending" && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveMutation.mutate([item.id])}
                              disabled={isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectMutation.mutate([item.id])}
                              disabled={isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
