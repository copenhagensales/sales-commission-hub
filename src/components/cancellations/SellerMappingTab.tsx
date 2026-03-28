import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Trash2, Users, Loader2, Package, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProductAutoMatch } from "./ProductAutoMatch";

interface SellerMappingTabProps {
  clientId: string;
}

export function SellerMappingTab({ clientId }: SellerMappingTabProps) {
  return (
    <Tabs defaultValue="seller" className="space-y-4">
      <TabsList>
        <TabsTrigger value="seller" className="gap-1.5">
          <Users className="h-4 w-4" /> Sælger
        </TabsTrigger>
        <TabsTrigger value="product" className="gap-1.5">
          <Package className="h-4 w-4" /> Produkt
        </TabsTrigger>
      </TabsList>
      <TabsContent value="seller">
        <SellerMappingSection clientId={clientId} />
      </TabsContent>
      <TabsContent value="product">
        <ProductMappingSection clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}

/* ────────────────────────────────────────── Sælger ────────────────────────────────────────── */

function SellerMappingSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["cancellation-seller-mappings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_seller_mappings")
        .select("id, excel_seller_name, employee_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-mapping-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const employeeMap = new Map(employees.map(e => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()]));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cancellation_seller_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Slettet", description: "Mapping er fjernet." });
      queryClient.invalidateQueries({ queryKey: ["cancellation-seller-mappings", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Sælger-mappings</CardTitle>
        <CardDescription>Koblinger mellem Excel-sælgernavne og medarbejdere. Bruges til automatisk matching ved upload.</CardDescription>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">Ingen mappings endnu</p>
            <p className="text-sm mt-1">Mappings oprettes automatisk når du vælger en medarbejder under upload-preview.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Excel-sælgernavn</TableHead>
                  <TableHead>Mappet medarbejder</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant="outline">{m.excel_seller_name}</Badge></TableCell>
                    <TableCell className="font-medium">{employeeMap.get(m.employee_id) || m.employee_id}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(m.created_at).toLocaleDateString("da-DK")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────── Produkt ────────────────────────────────────────── */

const OPERATOR_LABELS: Record<string, string> = {
  any: "Ligegyldigt",
  in: "Er en af",
  not_in: "Er ikke en af",
};

const OPERATOR_SYMBOLS: Record<string, string> = {
  any: "∗",
  in: "∈",
  not_in: "∉",
};

interface ConditionDraft {
  operator: string;
  values: string[];
}

function ProductMappingSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, ConditionDraft>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const ALLOWED_COLUMNS = ["Operator", "Subscription Name", "Sales Department"] as const;

  // Fetch existing conditions
  const { data: conditions = [], isLoading } = useQuery({
    queryKey: ["cancellation-product-conditions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_product_conditions")
        .select("id, product_id, column_name, operator, values, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch column values from uploaded data
  const { data: columnValues = {} } = useQuery({
    queryKey: ["excel-column-values", clientId],
    queryFn: async () => {
      const [queueResult, importsResult] = await Promise.all([
        supabase
          .from("cancellation_queue")
          .select("uploaded_data")
          .eq("client_id", clientId)
          .limit(500),
        supabase
          .from("cancellation_imports")
          .select("unmatched_rows")
          .eq("client_id", clientId)
          .not("unmatched_rows", "is", null)
          .limit(50),
      ]);

      if (queueResult.error) throw queueResult.error;
      if (importsResult.error) throw importsResult.error;

      const values: Record<string, Set<string>> = {};
      for (const col of ALLOWED_COLUMNS) values[col] = new Set();

      const extractFromRow = (row: Record<string, unknown>) => {
        for (const col of ALLOWED_COLUMNS) {
          const val = row[col];
          if (val != null && String(val).trim()) {
            values[col].add(String(val).trim());
          }
        }
      };

      for (const row of queueResult.data || []) {
        if (row.uploaded_data && typeof row.uploaded_data === "object") {
          extractFromRow(row.uploaded_data as Record<string, unknown>);
        }
      }

      for (const imp of importsResult.data || []) {
        if (!Array.isArray(imp.unmatched_rows)) continue;
        for (const row of imp.unmatched_rows) {
          if (row && typeof row === "object") {
            extractFromRow(row as Record<string, unknown>);
          }
        }
      }

      const result: Record<string, string[]> = {};
      for (const col of ALLOWED_COLUMNS) {
        result[col] = [...values[col]].sort((a, b) => a.localeCompare(b, "da"));
      }
      return result;
    },
    enabled: !!clientId,
  });

  const { data: campaignIds = [] } = useQuery({
    queryKey: ["client-campaign-ids", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_campaigns").select("id").eq("client_id", clientId);
      if (error) throw error;
      return (data || []).map(c => c.id);
    },
    enabled: !!clientId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-mapping", campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, client_campaign_id")
        .in("client_campaign_id", campaignIds)
        .eq("is_active", true)
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: campaignIds.length > 0,
  });

  const productMap = new Map(products.map(p => [p.id, p.name]));

  // Group conditions by product
  const conditionsByProduct = new Map<string, typeof conditions>();
  for (const c of conditions) {
    const list = conditionsByProduct.get(c.product_id) || [];
    list.push(c);
    conditionsByProduct.set(c.product_id, list);
  }

  // Products that have conditions
  const productsWithConditions = [...conditionsByProduct.keys()];

  const openDialogForProduct = (productId: string) => {
    setSelectedProductId(productId);
    const existing = conditionsByProduct.get(productId) || [];
    const drafts: Record<string, ConditionDraft> = {};
    for (const col of ALLOWED_COLUMNS) {
      const cond = existing.find(c => c.column_name === col);
      drafts[col] = cond
        ? { operator: cond.operator, values: [...cond.values] }
        : { operator: "any", values: [] };
    }
    setConditionDrafts(drafts);
    setCustomInputs({});
    setDialogOpen(true);
  };

  const updateDraftOperator = (col: string, operator: string) => {
    setConditionDrafts(prev => ({
      ...prev,
      [col]: { ...prev[col], operator, values: operator === "any" ? [] : prev[col]?.values || [] },
    }));
  };

  const toggleDraftValue = (col: string, value: string) => {
    setConditionDrafts(prev => {
      const draft = prev[col] || { operator: "in", values: [] };
      const values = draft.values.includes(value)
        ? draft.values.filter(v => v !== value)
        : [...draft.values, value];
      return { ...prev, [col]: { ...draft, values } };
    });
  };

  const addCustomValue = (col: string) => {
    const val = (customInputs[col] || "").trim();
    if (!val) return;
    setConditionDrafts(prev => {
      const draft = prev[col] || { operator: "in", values: [] };
      if (draft.values.includes(val)) return prev;
      return { ...prev, [col]: { ...draft, values: [...draft.values, val] } };
    });
    setCustomInputs(prev => ({ ...prev, [col]: "" }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) return;

      // For each column, upsert or delete the condition
      for (const col of ALLOWED_COLUMNS) {
        const draft = conditionDrafts[col];
        if (!draft || draft.operator === "any") {
          // Delete any existing condition for this column
          await supabase
            .from("cancellation_product_conditions")
            .delete()
            .eq("client_id", clientId)
            .eq("product_id", selectedProductId)
            .eq("column_name", col);
        } else {
          // Upsert
          const { error } = await supabase
            .from("cancellation_product_conditions")
            .upsert(
              {
                client_id: clientId,
                product_id: selectedProductId,
                column_name: col,
                operator: draft.operator,
                values: draft.values,
              },
              { onConflict: "client_id,product_id,column_name" }
            );
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Gemt", description: "Produktbetingelser opdateret." });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cancellation-product-conditions", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  const deleteProductConditions = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("cancellation_product_conditions")
        .delete()
        .eq("client_id", clientId)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Slettet", description: "Alle betingelser for produktet er fjernet." });
      queryClient.invalidateQueries({ queryKey: ["cancellation-product-conditions", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Helper to render conditions summary
  const renderConditionsSummary = (productId: string) => {
    const conds = conditionsByProduct.get(productId) || [];
    if (conds.length === 0) return <span className="text-muted-foreground text-xs">Ingen betingelser</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {conds.filter(c => c.operator !== "any").map(c => (
          <Badge key={c.column_name} variant="outline" className="text-[11px] font-normal gap-1">
            <span className="font-medium">{c.column_name}</span>
            <span className="text-muted-foreground">{OPERATOR_SYMBOLS[c.operator] || c.operator}</span>
            <span className="max-w-[200px] truncate">{c.values.join(", ")}</span>
          </Badge>
        ))}
      </div>
    );
  };

  // Check if any non-any condition has values selected
  const hasAnyCondition = Object.values(conditionDrafts).some(d => d.operator !== "any" && d.values.length > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Produkt-betingelser</CardTitle>
          <CardDescription>Definer kolonne-betingelser pr. produkt. Bruges til at bestemme hvilket produkt en upload-række hører til.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Select product */}
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-sm space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vælg internt produkt</label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-9 w-full justify-between text-xs font-normal">
                    <span className="truncate">Vælg produkt...</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Søg produkt..." className="h-9 text-xs" />
                    <CommandList>
                      <CommandEmpty>Ingen produkter fundet.</CommandEmpty>
                      <CommandGroup>
                        {products.filter(p => !productsWithConditions.includes(p.id)).map(p => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              setPopoverOpen(false);
                              openDialogForProduct(p.id);
                            }}
                            className="text-xs"
                          >
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Existing conditions grouped by product */}
          {productsWithConditions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Ingen produkt-betingelser endnu</p>
              <p className="text-sm mt-1">Vælg et internt produkt ovenfor for at definere betingelser.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internt produkt</TableHead>
                    <TableHead>Betingelser</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsWithConditions.map(productId => (
                    <TableRow key={productId} className="cursor-pointer hover:bg-muted/50" onClick={() => openDialogForProduct(productId)}>
                      <TableCell className="font-medium">{productMap.get(productId) || productId}</TableCell>
                      <TableCell>{renderConditionsSummary(productId)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProductConditions.mutate(productId);
                          }}
                          disabled={deleteProductConditions.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Condition builder dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Betingelser for "{selectedProduct?.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {ALLOWED_COLUMNS.map(col => {
              const draft = conditionDrafts[col] || { operator: "any", values: [] };
              const knownValues = columnValues[col] || [];
              const showValues = draft.operator !== "any";

              return (
                <div key={col} className="space-y-2.5 border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">{col}</Label>
                    <Select value={draft.operator} onValueChange={(v) => updateDraftOperator(col, v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {showValues && (
                    <div className="space-y-2">
                      {/* Known values from uploads */}
                      {knownValues.length > 0 && (
                        <div className="max-h-[150px] overflow-auto space-y-1">
                          {knownValues.map((val: string) => (
                            <label key={val} className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors text-xs">
                              <Checkbox
                                checked={draft.values.includes(val)}
                                onCheckedChange={() => toggleDraftValue(col, val)}
                              />
                              <span>{val}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Custom-added values not in known list */}
                      {draft.values.filter(v => !knownValues.includes(v)).map(v => (
                        <label key={v} className="flex items-center gap-2.5 rounded-md border border-primary/30 px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors text-xs">
                          <Checkbox checked onCheckedChange={() => toggleDraftValue(col, v)} />
                          <span>{v}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">Manuelt</Badge>
                        </label>
                      ))}

                      {/* Add custom value */}
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Tilføj værdi..."
                          value={customInputs[col] || ""}
                          onChange={e => setCustomInputs(prev => ({ ...prev, [col]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomValue(col); } }}
                          className="h-8 text-xs"
                        />
                        <Button variant="outline" size="sm" className="h-8 shrink-0 px-2" onClick={() => addCustomValue(col)} disabled={!(customInputs[col] || "").trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {draft.values.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">Vælg mindst én værdi</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Gem betingelser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
