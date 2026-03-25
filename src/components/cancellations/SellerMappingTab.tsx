import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Trash2, Users, Loader2, Package, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
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

function ProductMappingSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkedNames, setCheckedNames] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState("");

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["cancellation-product-mappings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_product_mappings")
        .select("id, excel_product_name, product_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch all unique column headers from uploaded Excel data
  const { data: excelColumns = [] } = useQuery({
    queryKey: ["excel-column-headers", clientId],
    queryFn: async () => {
      const [queueResult, importsResult] = await Promise.all([
        supabase
          .from("cancellation_queue")
          .select("uploaded_data")
          .eq("client_id", clientId)
          .limit(50),
        supabase
          .from("cancellation_imports")
          .select("unmatched_rows")
          .eq("client_id", clientId)
          .not("unmatched_rows", "is", null)
          .limit(10),
      ]);

      if (queueResult.error) throw queueResult.error;
      if (importsResult.error) throw importsResult.error;

      const columns = new Set<string>();

      for (const row of queueResult.data || []) {
        if (row.uploaded_data && typeof row.uploaded_data === "object") {
          Object.keys(row.uploaded_data as Record<string, unknown>).forEach(k => columns.add(k));
        }
      }

      for (const imp of importsResult.data || []) {
        if (!Array.isArray(imp.unmatched_rows)) continue;
        for (const row of imp.unmatched_rows) {
          if (row && typeof row === "object") {
            Object.keys(row as Record<string, unknown>).forEach(k => columns.add(k));
          }
        }
      }

      return [...columns].sort((a, b) => a.localeCompare(b, "da"));
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

  const mappedNames = new Set(mappings.map(m => m.excel_product_name));
  const availableExcelNames = excelColumns.filter((n: string) => !mappedNames.has(n));
  const unmappedUploadNames = availableExcelNames;

  const productMap = new Map(products.map(p => [p.id, p.name]));

  // Group existing mappings by product
  const mappingsByProduct = new Map<string, typeof mappings>();
  for (const m of mappings) {
    const list = mappingsByProduct.get(m.product_id) || [];
    list.push(m);
    mappingsByProduct.set(m.product_id, list);
  }

  const openDialogForProduct = (productId: string) => {
    setSelectedProductId(productId);
    // Pre-check already mapped names for this product
    const existing = (mappingsByProduct.get(productId) || []).map(m => m.excel_product_name);
    setCheckedNames(new Set(existing));
    setCustomName("");
    setDialogOpen(true);
  };

  const toggleName = (name: string) => {
    setCheckedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const addCustomName = () => {
    const trimmed = customName.trim();
    if (trimmed) {
      setCheckedNames(prev => new Set(prev).add(trimmed));
      setCustomName("");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) return;

      const existingForProduct = (mappingsByProduct.get(selectedProductId) || []);
      const existingNames = new Set(existingForProduct.map(m => m.excel_product_name));

      // Names to add
      const toAdd = [...checkedNames].filter(n => !existingNames.has(n));
      // Names to remove
      const toRemove = existingForProduct.filter(m => !checkedNames.has(m.excel_product_name));

      // Delete removed
      for (const m of toRemove) {
        const { error } = await supabase.from("cancellation_product_mappings").delete().eq("id", m.id);
        if (error) throw error;
      }

      // Insert new
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("cancellation_product_mappings")
          .upsert(
            toAdd.map(name => ({ client_id: clientId, excel_product_name: name, product_id: selectedProductId })),
            { onConflict: "client_id,excel_product_name" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Gemt", description: "Produkt-mappings opdateret." });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cancellation-product-mappings", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cancellation_product_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Slettet", description: "Produkt-mapping er fjernet." });
      queryClient.invalidateQueries({ queryKey: ["cancellation-product-mappings", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Produkt-mappings</CardTitle>
          <CardDescription>Koblinger mellem produktnavne fra upload-filer og interne produkter. Bruges til kurvrettelser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Select product to map */}
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
                        {products.map(p => (
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
            <ProductAutoMatch clientId={clientId} availableExcelNames={unmappedUploadNames} products={products} />
          </div>

          {/* Show unmapped Excel columns */}
          {unmappedUploadNames.length > 0 && (
            <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {unmappedUploadNames.length} umappede kolonner fundet fra uploads:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unmappedUploadNames.map((name: string) => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Existing mappings grouped by product */}
          {mappings.length === 0 && unmappedUploadNames.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Ingen produkt-mappings endnu</p>
              <p className="text-sm mt-1">Vælg et internt produkt ovenfor for at tilknytte Excel-navne.</p>
            </div>
          ) : mappings.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internt produkt</TableHead>
                    <TableHead>Excel-kolonner</TableHead>
                    <TableHead>Oprettet</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...mappingsByProduct.entries()].map(([productId, productMappings]) => (
                    <TableRow key={productId} className="cursor-pointer hover:bg-muted/50" onClick={() => openDialogForProduct(productId)}>
                      <TableCell className="font-medium">{productMap.get(productId) || productId}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {productMappings.map(m => (
                            <Badge key={m.id} variant="outline" className="text-xs">{m.excel_product_name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(productMappings[0].created_at).toLocaleDateString("da-DK")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            productMappings.forEach(m => deleteMutation.mutate(m.id));
                          }}
                          disabled={deleteMutation.isPending}
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

      {/* Dialog for selecting Excel names */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Tilknyt Excel-kolonner til "{selectedProduct?.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vælg hvilke kolonner fra Excel-filen der skal mappes til dette produkt. Et produkt kan have flere kolonner.
            </p>

            {/* All Excel columns */}
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {excelColumns.map((name: string) => (
                <label key={name} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={checkedNames.has(name)}
                    onCheckedChange={() => toggleName(name)}
                  />
                  <span className="text-sm">{name}</span>
                  {mappedNames.has(name) && !checkedNames.has(name) && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">Allerede mappet</Badge>
                  )}
                </label>
              ))}
              {/* Show custom-added names not in available list */}
              {[...checkedNames].filter(n => !excelColumns.includes(n)).map((name: string) => (
                <label key={name} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-primary/30">
                  <Checkbox checked onCheckedChange={() => toggleName(name)} />
                  <span className="text-sm">{name}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Manuelt tilføjet</Badge>
                </label>
              ))}
            </div>

            {/* Add custom name */}
            <div className="flex gap-2">
              <Input
                placeholder="Tilføj nyt navn manuelt..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomName(); } }}
                className="h-9 text-sm"
              />
              <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={addCustomName} disabled={!customName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={checkedNames.size === 0 || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Gem ({checkedNames.size} valgt)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
