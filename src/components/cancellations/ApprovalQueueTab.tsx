import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Check, X, Loader2, Clock, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface DiffField {
  label: string;
  systemValue: string;
  uploadedValue: string;
  isDifferent: boolean;
}

function extractOpp(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object") return "";
  const rp = rawPayload as Record<string, unknown>;
  if (rp["legacy_opp_number"]) return String(rp["legacy_opp_number"]);
  const fields = rp["leadResultFields"] as Record<string, unknown> | undefined;
  if (fields?.["OPP nr"]) return String(fields["OPP nr"]);
  if (fields?.["OPP-nr"]) return String(fields["OPP-nr"]);
  const dataArr = rp["leadResultData"] as Array<{ label?: string; value?: string }> | undefined;
  if (Array.isArray(dataArr)) {
    const found = dataArr.find((d) => d.label === "OPP nr" || d.label === "OPP-nr");
    if (found?.value) return String(found.value);
  }
  return "";
}

function computeDiff(
  uploadedData: Record<string, unknown> | null,
  saleItems: Array<{ product_name: string; quantity: number; mapped_commission: number; mapped_revenue: number }>,
): DiffField[] {
  if (!uploadedData || Object.keys(uploadedData).length === 0) return [];

  const diffs: DiffField[] = [];

  // System totals
  const systemRevenue = saleItems.reduce((sum, si) => sum + (si.mapped_revenue || 0), 0);
  const systemCommission = saleItems.reduce((sum, si) => sum + (si.mapped_commission || 0), 0);
  const systemProducts = saleItems.map((si) => si.product_name).filter(Boolean);

  // Try to find product/revenue/commission fields in uploaded data
  const keys = Object.keys(uploadedData);

  // Detect numeric columns that might be revenue/commission
  for (const key of keys) {
    const val = uploadedData[key];
    const lowerKey = key.toLowerCase();

    // Skip empty values
    if (val === null || val === undefined || val === "") continue;

    // Product-like columns
    if (
      lowerKey.includes("produkt") ||
      lowerKey.includes("product") ||
      lowerKey.includes("vare")
    ) {
      const uploadedProduct = String(val).trim();
      // Normalize: strip trailing % numbers (e.g. "TT trin 100" → compare base)
      const normalizeProduct = (p: string) =>
        p.replace(/\s+(0|50|100)%?\s*$/i, "").toLowerCase().trim();
      const normalizedUploaded = normalizeProduct(uploadedProduct);
      const matchesAny = systemProducts.some(
        (sp) => normalizeProduct(sp) === normalizedUploaded
      );
      if (!matchesAny && systemProducts.length > 0) {
        diffs.push({
          label: key,
          systemValue: systemProducts.join(", ") || "-",
          uploadedValue: uploadedProduct,
          isDifferent: true,
        });
      }
      continue;
    }

    // Revenue-like columns
    if (
      lowerKey.includes("omsætning") ||
      lowerKey.includes("omsaetning") ||
      lowerKey.includes("revenue") ||
      lowerKey.includes("oms")
    ) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal) && Math.abs(uploadedVal - systemRevenue) > 0.01) {
        diffs.push({
          label: key,
          systemValue: `${systemRevenue.toFixed(2)} kr`,
          uploadedValue: `${uploadedVal.toFixed(2)} kr`,
          isDifferent: true,
        });
      }
      continue;
    }

    // Commission-like columns
    if (
      lowerKey.includes("provision") ||
      lowerKey.includes("commission") ||
      lowerKey.includes("provi")
    ) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal) && Math.abs(uploadedVal - systemCommission) > 0.01) {
        diffs.push({
          label: key,
          systemValue: `${systemCommission.toFixed(2)} kr`,
          uploadedValue: `${uploadedVal.toFixed(2)} kr`,
          isDifferent: true,
        });
      }
      continue;
    }
  }

  // If uploaded data has product columns with TDC-style names (containing 0%, 50%, 100%)
  // Also compare individual product entries
  const uploadedProductEntries = keys.filter((k) => {
    const v = uploadedData[k];
    if (v === null || v === undefined || v === "" || v === 0) return false;
    // Check if key looks like a product name (has % or is a known product pattern)
    return (
      k.match(/\d+%\s*$/) ||
      k.match(/^(TT|Mobil|Fiber|Bredbånd|Internet)/i)
    );
  });

  if (uploadedProductEntries.length > 0) {
    // These are product columns where key = product name, value = quantity/amount
    for (const productKey of uploadedProductEntries) {
      const uploadedQty = Number(uploadedData[productKey]) || 0;
      if (uploadedQty === 0) continue;

      // Find matching system product
      const normalizeForMatch = (p: string) =>
        p.replace(/\s+/g, " ").toLowerCase().trim();
      const matchedItem = saleItems.find(
        (si) => normalizeForMatch(si.product_name) === normalizeForMatch(productKey)
      );

      const systemQty = matchedItem?.quantity || 0;
      if (Math.abs(uploadedQty - systemQty) > 0.01) {
        diffs.push({
          label: productKey,
          systemValue: `${systemQty}`,
          uploadedValue: `${uploadedQty}`,
          isDifferent: true,
        });
      }
    }
  }

  return diffs;
}

export function ApprovalQueueTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [onlyDifferences, setOnlyDifferences] = useState(false);

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
        .select(`id, sale_id, upload_type, status, reviewed_at, created_at, import_id`)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Fetch uploaded_data separately (since types might not include it yet)
      const queueIds = data.map((d) => d.id);
      let uploadedDataMap = new Map<string, Record<string, unknown>>();
      if (queueIds.length > 0) {
        const { data: rawData } = await supabase
          .from("cancellation_queue")
          .select("id, uploaded_data")
          .in("id", queueIds) as any;
        if (rawData) {
          uploadedDataMap = new Map(rawData.map((r: any) => [r.id, r.uploaded_data]));
        }
      }

      const saleIds = [...new Set(data.map((d) => d.sale_id))];
      const importIds = [...new Set(data.map((d) => d.import_id))];

      const [salesResult, importsResult, saleItemsResult] = await Promise.all([
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
        saleIds.length > 0
          ? supabase
              .from("sale_items")
              .select("sale_id, quantity, mapped_commission, mapped_revenue, adversus_product_title, product_id")
              .in("sale_id", saleIds)
          : { data: [] as any[], error: null },
      ]);

      // Fetch product names for sale items
      const productIds = [...new Set((saleItemsResult.data || []).map((si) => si.product_id).filter(Boolean))];
      let productsMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        if (products) {
          productsMap = new Map(products.map((p) => [p.id, p.name]));
        }
      }

      const salesMap = new Map((salesResult.data || []).map((s) => [s.id, s]));
      const importsMap = new Map((importsResult.data || []).map((i) => [i.id, i]));

      // Group sale items by sale_id
      const saleItemsBySale = new Map<string, Array<{ product_name: string; quantity: number; mapped_commission: number; mapped_revenue: number }>>();
      for (const si of saleItemsResult.data || []) {
        const items = saleItemsBySale.get(si.sale_id) || [];
        items.push({
          product_name: productsMap.get(si.product_id) || si.adversus_product_title || "Ukendt",
          quantity: si.quantity || 1,
          mapped_commission: si.mapped_commission || 0,
          mapped_revenue: si.mapped_revenue || 0,
        });
        saleItemsBySale.set(si.sale_id, items);
      }

      return data.map((item) => {
        const sale = salesMap.get(item.sale_id);
        const imp = importsMap.get(item.import_id);
        const saleItems = saleItemsBySale.get(item.sale_id) || [];
        const uploaded = uploadedDataMap.get(item.id) as Record<string, unknown> | null;
        const diffs = computeDiff(uploaded, saleItems);

        return {
          ...item,
          saleDate: sale?.sale_datetime || "",
          agentName: sale?.agent_name || "Ukendt",
          phone: sale?.customer_phone || "",
          company: sale?.customer_company || "",
          oppNumber: extractOpp(sale?.raw_payload),
          currentValidationStatus: sale?.validation_status || "",
          fileName: imp?.file_name || "",
          saleItems,
          uploadedData: uploaded,
          diffs,
          hasDifferences: diffs.length > 0,
        };
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");
      const items = queueItems.filter((i) => itemIds.includes(i.id));

      for (const item of items) {
        const newStatus = item.upload_type === "cancellation" ? "cancelled" : "basket_changed";
        const { error: saleError } = await supabase
          .from("sales")
          .update({ validation_status: newStatus })
          .eq("id", item.sale_id);
        if (saleError) throw saleError;

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

  const filteredItems = onlyDifferences
    ? queueItems.filter((i) => i.hasDifferences)
    : queueItems;

  const pendingItems = filteredItems.filter((i) => i.status === "pending");
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-diff"
                  checked={onlyDifferences}
                  onCheckedChange={(checked) => setOnlyDifferences(!!checked)}
                />
                <label htmlFor="only-diff" className="text-sm cursor-pointer">
                  Kun forskelle
                </label>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusFilter === "pending" && pendingItems.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(pendingItems.map((i) => i.id))}
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
                onClick={() => rejectMutation.mutate(pendingItems.map((i) => i.id))}
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
          ) : filteredItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {onlyDifferences
                ? "Ingen salg med forskelle fundet."
                : `Ingen ${statusFilter === "pending" ? "ventende" : ""} items i køen.`}
            </div>
          ) : (
            <div className="rounded-md border max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salgsdato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>OPP</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>System data</TableHead>
                    <TableHead>Uploadet data</TableHead>
                    <TableHead>Forskelle</TableHead>
                    <TableHead>Status</TableHead>
                    {statusFilter === "pending" && <TableHead>Handlinger</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.saleDate
                          ? format(new Date(item.saleDate), "dd/MM/yyyy HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>{item.agentName}</TableCell>
                      <TableCell>{item.oppNumber || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.upload_type === "cancellation"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {item.upload_type === "cancellation"
                            ? "Annullering"
                            : "Kurv diff."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {item.saleItems.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.saleItems.map((si, idx) => (
                              <div key={idx} className="truncate" title={si.product_name}>
                                {si.product_name} (×{si.quantity})
                              </div>
                            ))}
                            <div className="text-muted-foreground mt-1">
                              Oms: {item.saleItems.reduce((s, si) => s + si.mapped_revenue, 0).toFixed(0)} kr
                              {" | "}
                              Provi: {item.saleItems.reduce((s, si) => s + si.mapped_commission, 0).toFixed(0)} kr
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Ingen produkter</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {item.uploadedData && Object.keys(item.uploadedData).length > 0 ? (
                          <div className="space-y-0.5 max-h-24 overflow-auto">
                            {Object.entries(item.uploadedData)
                              .filter(([, v]) => v !== null && v !== undefined && v !== "")
                              .slice(0, 8)
                              .map(([k, v]) => (
                                <div key={k} className="truncate" title={`${k}: ${v}`}>
                                  <span className="text-muted-foreground">{k}:</span> {String(v)}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {item.diffs.length > 0 ? (
                          <div className="space-y-1">
                            {item.diffs.map((d, idx) => (
                              <div
                                key={idx}
                                className="p-1 rounded bg-destructive/10 border border-destructive/20"
                              >
                                <div className="font-medium text-destructive">{d.label}</div>
                                <div>
                                  System: <span className="font-mono">{d.systemValue}</span>
                                </div>
                                <div>
                                  Upload: <span className="font-mono">{d.uploadedValue}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Ingen forskelle</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "approved"
                              ? "default"
                              : item.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {item.status === "pending"
                            ? "Ventende"
                            : item.status === "approved"
                            ? "Godkendt"
                            : "Afvist"}
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
