import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertCircle, FileSpreadsheet, Database } from "lucide-react";
import { format } from "date-fns";

function extractOpp(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object") return "";
  const rp = rawPayload as Record<string, unknown>;
  if (rp["legacy_opp_number"]) return String(rp["legacy_opp_number"]);
  const fields = rp["leadResultFields"] as Record<string, unknown> | undefined;
  if (fields?.["OPP nr"]) return String(fields["OPP nr"]);
  if (fields?.["OPP-nr"]) return String(fields["OPP-nr"]);
  const dataArr = rp["leadResultData"] as Array<{ label?: string; value?: string }> | undefined;
  if (Array.isArray(dataArr)) {
    const found = dataArr.find(d => d.label === "OPP nr" || d.label === "OPP-nr");
    if (found?.value) return String(found.value);
  }
  return "";
}

interface UnmatchedTabProps {
  clientId: string;
}

export function UnmatchedTab({ clientId }: UnmatchedTabProps) {
  const [selectedImportId, setSelectedImportId] = useState<string>("");

  // Fetch imports
  const { data: imports = [] } = useQuery({
    queryKey: ["cancellation-imports-for-unmatched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_imports")
        .select("id, file_name, created_at, rows_processed, rows_matched, upload_type, config_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const selectedImport = imports.find(i => i.id === selectedImportId);

  // Fetch unmatched_rows from selected import
  const { data: unmatchedUploadRows = [], isLoading: loadingUnmatched } = useQuery({
    queryKey: ["unmatched-upload-rows", selectedImportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_imports")
        .select("unmatched_rows")
        .eq("id", selectedImportId)
        .single();
      if (error) throw error;
      return (data?.unmatched_rows as Record<string, unknown>[] | null) || [];
    },
    enabled: !!selectedImportId,
  });

  // Fetch matched sale_ids from queue for this import
  const { data: queueSaleIds = [] } = useQuery({
    queryKey: ["queue-sale-ids-for-import", selectedImportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_queue")
        .select("sale_id, client_id")
        .eq("import_id", selectedImportId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedImportId,
  });

  // Get client_id from queue items
  const clientId = queueSaleIds[0]?.client_id || null;
  const matchedSaleIdSet = new Set(queueSaleIds.map(q => q.sale_id));

  // Fetch system sales for the client that are NOT in the queue
  const { data: missingFromUpload = [], isLoading: loadingSystemSales } = useQuery({
    queryKey: ["system-sales-missing-from-upload", selectedImportId, clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // Get campaigns for this client
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      // Fetch recent sales for this client
      const { data: allSales, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, customer_phone, customer_company, agent_name, validation_status, raw_payload")
        .in("client_campaign_id", campaignIds)
        .neq("validation_status", "cancelled")
        .order("sale_datetime", { ascending: false })
        .limit(2000);
      
      if (error) throw error;
      
      // Filter out sales already in queue
      const unmatched = (allSales || []).filter(s => !matchedSaleIdSet.has(s.id));
      
      // Fetch sale_items with product names for these sales
      if (unmatched.length > 0) {
        const saleIds = unmatched.map(s => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, mapped_commission, mapped_revenue, product:products(name)")
          .in("sale_id", saleIds.slice(0, 500));
        
        const itemsBySale: Record<string, typeof items> = {};
        (items || []).forEach(item => {
          if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
          itemsBySale[item.sale_id].push(item);
        });
        
        return unmatched.map(s => ({ ...s, saleItems: itemsBySale[s.id] || [] }));
      }
      
      return unmatched.map(s => ({ ...s, saleItems: [] as any[] }));
    },
    enabled: !!selectedImportId && !!clientId && matchedSaleIdSet.size > 0,
  });

  // Get column names from unmatched rows
  const uploadColumnNames = unmatchedUploadRows.length > 0
    ? Object.keys(unmatchedUploadRows[0])
    : [];

  return (
    <div className="space-y-6">
      {/* Import selector */}
      <Card>
        <CardHeader>
          <CardTitle>Vælg import</CardTitle>
          <CardDescription>Vælg en tidligere upload for at se umatchede rækker</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label>Import</Label>
            <Select value={selectedImportId} onValueChange={setSelectedImportId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg en import..." />
              </SelectTrigger>
              <SelectContent>
                {imports.map(imp => (
                  <SelectItem key={imp.id} value={imp.id}>
                    {imp.file_name} — {format(new Date(imp.created_at), "dd/MM/yyyy HH:mm")} ({imp.rows_matched}/{imp.rows_processed} matchet)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedImportId && (
        <>
          {/* Section 1: Upload rows without match */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                I upload men ikke i system
                <Badge variant="secondary">{unmatchedUploadRows.length}</Badge>
              </CardTitle>
              <CardDescription>Rækker fra Excel-filen der ikke matchede noget salg i systemet</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUnmatched ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : unmatchedUploadRows.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>Alle upload-rækker blev matchet — ingen umatchede rækker.</span>
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {uploadColumnNames.map(col => (
                          <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedUploadRows.map((row, idx) => (
                        <TableRow key={idx}>
                          {uploadColumnNames.map(col => (
                            <TableCell key={col} className="whitespace-nowrap">
                              {row[col] != null ? String(row[col]) : ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: System sales without match */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                I system men ikke i upload
                <Badge variant="secondary">{missingFromUpload.length}</Badge>
              </CardTitle>
              <CardDescription>Salg i systemet for denne kunde der ikke blev matchet af uploaden</CardDescription>
            </CardHeader>
            <CardContent>
              {!clientId ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>Ingen kundedata tilgængelig for denne import.</span>
                </div>
              ) : loadingSystemSales ? (
                <p className="text-muted-foreground">Indlæser systemsalg...</p>
              ) : missingFromUpload.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>Alle systemsalg er dækket af uploaden.</span>
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Sælger</TableHead>
                        <TableHead>OPP</TableHead>
                        <TableHead>Produkter</TableHead>
                        <TableHead>Omsætning</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Virksomhed</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingFromUpload.map(sale => {
                        const products = (sale.saleItems || [])
                          .map((si: any) => si.product?.name || si.adversus_product_title || "Ukendt")
                          .filter(Boolean);
                        const revenue = (sale.saleItems || [])
                          .reduce((sum: number, si: any) => sum + (si.mapped_revenue || 0), 0);
                        return (
                          <TableRow key={sale.id}>
                            <TableCell className="whitespace-nowrap">
                              {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell>{sale.agent_name || "-"}</TableCell>
                            <TableCell>{extractOpp(sale.raw_payload) || "-"}</TableCell>
                            <TableCell>
                              {products.length > 0 
                                ? products.map((p: string, i: number) => (
                                    <Badge key={i} variant="outline" className="mr-1 mb-1">{p}</Badge>
                                  ))
                                : <span className="text-muted-foreground">-</span>
                              }
                            </TableCell>
                            <TableCell className="font-mono">
                              {revenue > 0 ? `${Math.round(revenue).toLocaleString("da-DK")} kr` : "-"}
                            </TableCell>
                            <TableCell>{sale.customer_phone || "-"}</TableCell>
                            <TableCell>{sale.customer_company || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{sale.validation_status || "pending"}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
