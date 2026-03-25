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
import { toast } from "@/hooks/use-toast";
import { Trash2, Users, Loader2, Package, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const [newExcelName, setNewExcelName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [excelPopoverOpen, setExcelPopoverOpen] = useState(false);

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

  // Get unique Excel product names from previous uploads (all types: cancellations + basket corrections)
  const { data: excelProductNames = [] } = useQuery({
    queryKey: ["excel-product-names", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_queue")
        .select("target_product_name")
        .eq("client_id", clientId)
        .not("target_product_name", "is", null);
      if (error) throw error;
      const unique = [...new Set((data || []).map(d => d.target_product_name).filter(Boolean))] as string[];
      return unique;
    },
    enabled: !!clientId,
  });

  // Get campaign IDs for client, then products for those campaigns
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

  // Fetch unique product titles from sale_items as fallback
  const { data: saleItemNames = [] } = useQuery({
    queryKey: ["sale-item-product-names", campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [] as string[];
      const { data: sales, error: salesErr } = await supabase
        .from("sales")
        .select("id")
        .in("client_campaign_id", campaignIds);
      if (salesErr) throw salesErr;
      const saleIds = (sales || []).map(s => s.id);
      if (saleIds.length === 0) return [] as string[];
      const { data, error } = await supabase
        .from("sale_items")
        .select("adversus_product_title")
        .in("sale_id", saleIds)
        .not("adversus_product_title", "is", null);
      if (error) throw error;
      return [...new Set((data || []).map(d => d.adversus_product_title).filter(Boolean))] as string[];
    },
    enabled: campaignIds.length > 0,
  });

  // Combine all sources and filter out already-mapped names
  const mappedNames = new Set(mappings.map(m => m.excel_product_name));
  const allExcelNames = [...new Set([...excelProductNames, ...saleItemNames])]
    .sort((a, b) => a.localeCompare(b, "da"));
  const availableExcelNames = allExcelNames.filter(n => !mappedNames.has(n));

  const productMap = new Map(products.map(p => [p.id, p.name]));

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cancellation_product_mappings")
        .upsert(
          { client_id: clientId, excel_product_name: newExcelName.trim(), product_id: selectedProductId },
          { onConflict: "client_id,excel_product_name" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Produkt-mapping oprettet" });
      setNewExcelName("");
      setSelectedProductId("");
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Produkt-mappings</CardTitle>
        <CardDescription>Koblinger mellem produktnavne fra upload-filer og interne produkter. Bruges til kurvrettelser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new mapping */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Produktnavn fra Excel</label>
            <Popover open={excelPopoverOpen} onOpenChange={setExcelPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-9 w-full justify-between text-xs font-normal">
                  <span className="truncate">{newExcelName || "Vælg produktnavn..."}</span>
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command onKeyDown={(e) => {
                  if (e.key === "Enter" && newExcelName.trim() && availableExcelNames.every(n => n.toLowerCase() !== newExcelName.trim().toLowerCase())) {
                    setExcelPopoverOpen(false);
                  }
                }}>
                  <CommandInput placeholder="Søg eller skriv nyt navn..." className="h-9 text-xs" onValueChange={v => setNewExcelName(v)} />
                  <CommandList>
                    <CommandEmpty>
                      {newExcelName.trim() ? (
                        <button
                          className="w-full px-3 py-2 text-xs text-left hover:bg-accent rounded-sm cursor-pointer flex items-center gap-2 font-medium"
                          onClick={() => { setExcelPopoverOpen(false); }}
                        >
                          <Plus className="h-3 w-3" /> Opret ny: "{newExcelName.trim()}"
                        </button>
                      ) : "Ingen produktnavne fundet."}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableExcelNames.map(name => (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => { setNewExcelName(name); setExcelPopoverOpen(false); }}
                          className="text-xs"
                        >
                          <Check className={cn("mr-2 h-3 w-3", newExcelName === name ? "opacity-100" : "opacity-0")} />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Internt produkt</label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-9 w-full justify-between text-xs font-normal">
                  <span className="truncate">{selectedProduct ? selectedProduct.name : "Vælg produkt..."}</span>
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
                          onSelect={() => { setSelectedProductId(p.id); setPopoverOpen(false); }}
                          className="text-xs"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            size="sm"
            className="h-9"
            disabled={!newExcelName.trim() || !selectedProductId || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            <Plus className="h-4 w-4 mr-1" /> Tilføj
          </Button>
        </div>

        {/* Existing mappings */}
        {mappings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">Ingen produkt-mappings endnu</p>
            <p className="text-sm mt-1">Tilføj mappings ovenfor for at koble upload-produktnavne til interne produkter.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Excel-produktnavn</TableHead>
                  <TableHead>Internt produkt</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant="outline">{m.excel_product_name}</Badge></TableCell>
                    <TableCell className="font-medium">{productMap.get(m.product_id) || m.product_id}</TableCell>
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
