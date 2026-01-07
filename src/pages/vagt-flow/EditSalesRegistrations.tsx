import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SaleRecord {
  id: string;
  seller_id: string;
  location_id: string | null;
  client_id: string | null;
  product_name: string | null;
  phone_number: string | null;
  comment: string | null;
  registered_at: string;
  created_at: string;
  seller: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  location: {
    name: string;
  } | null;
  client: {
    name: string;
  } | null;
  commission_dkk?: number;
  revenue_dkk?: number;
}

interface GroupedSales {
  key: string;
  sellerName: string;
  clientName: string;
  locationName: string;
  date: string;
  salesCount: number;
  totalCommission: number;
  totalRevenue: number;
  sales: SaleRecord[];
}

interface EditFormData {
  product_name: string;
  phone_number: string;
  comment: string;
  registered_at: string;
  location_id: string;
  client_id: string;
}

export default function EditSalesRegistrations() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  
  const [editDialog, setEditDialog] = useState<{ open: boolean; sale: SaleRecord | null }>({
    open: false,
    sale: null,
  });
  const [editForm, setEditForm] = useState<EditFormData>({
    product_name: "",
    phone_number: "",
    comment: "",
    registered_at: "",
    location_id: "",
    client_id: "",
  });

  // Fetch products for commission/revenue lookup
  const { data: products } = useQuery({
    queryKey: ["fm-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all sales
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["fm-sales-edit", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fieldmarketing_sales")
        .select(`
          id,
          seller_id,
          location_id,
          client_id,
          product_name,
          phone_number,
          comment,
          registered_at,
          created_at
        `)
        .gte("registered_at", `${dateRange.from}T00:00:00`)
        .lte("registered_at", `${dateRange.to}T23:59:59`)
        .order("registered_at", { ascending: false });

      if (error) throw error;
      
      // Fetch related data separately
      const sellerIds = [...new Set(data?.map(s => s.seller_id).filter(Boolean))] as string[];
      const locationIds = [...new Set(data?.map(s => s.location_id).filter(Boolean))] as string[];
      const clientIds = [...new Set(data?.map(s => s.client_id).filter(Boolean))] as string[];
      
      const [sellersRes, locationsRes, clientsRes] = await Promise.all([
        sellerIds.length > 0 
          ? supabase.from("employee_master_data").select("id, first_name, last_name").in("id", sellerIds)
          : { data: [] },
        locationIds.length > 0
          ? supabase.from("location").select("id, name").in("id", locationIds)
          : { data: [] },
        clientIds.length > 0
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : { data: [] },
      ]);
      
      const sellersMap = new Map((sellersRes.data || []).map(s => [s.id, s]));
      const locationsMap = new Map((locationsRes.data || []).map(l => [l.id, l]));
      const clientsMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
      
      return (data || []).map(sale => ({
        ...sale,
        seller: sale.seller_id ? sellersMap.get(sale.seller_id) || null : null,
        location: sale.location_id ? locationsMap.get(sale.location_id) || null : null,
        client: sale.client_id ? clientsMap.get(sale.client_id) || null : null,
      })) as SaleRecord[];
    },
  });

  // Fetch sellers for filter
  const { data: sellers } = useQuery({
    queryKey: ["fm-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ["fm-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations for edit dialog
  const { data: locations } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["fm-locations-edit"],
    queryFn: async () => {
      // Use raw query to avoid type issues with 'location' table name
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/location?is_active=eq.true&select=id,name&order=name`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    },
  });

  // Update sale mutation
  const updateSale = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EditFormData }) => {
      const updateData: Record<string, unknown> = {
        product_name: updates.product_name,
        phone_number: updates.phone_number,
        comment: updates.comment || null,
        registered_at: updates.registered_at,
        location_id: updates.location_id || null,
        client_id: updates.client_id || null,
      };
      const { error } = await supabase
        .from("fieldmarketing_sales")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salgsregistrering opdateret");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
      setEditDialog({ open: false, sale: null });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
    },
  });

  // Delete sale mutation
  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fieldmarketing_sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salgsregistrering slettet");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });

  const openEditDialog = (sale: SaleRecord) => {
    setEditForm({
      product_name: sale.product_name || "",
      phone_number: sale.phone_number || "",
      comment: sale.comment || "",
      registered_at: sale.registered_at ? format(parseISO(sale.registered_at), "yyyy-MM-dd'T'HH:mm") : "",
      location_id: sale.location_id || "",
      client_id: sale.client_id || "",
    });
    setEditDialog({ open: true, sale });
  };

  const handleSave = () => {
    if (!editDialog.sale) return;
    updateSale.mutate({
      id: editDialog.sale.id,
      updates: editForm,
    });
  };

  const handleDelete = (id: string, productName: string) => {
    if (confirm(`Er du sikker på at du vil slette "${productName}"?`)) {
      deleteSale.mutate(id);
    }
  };

  // Filter sales
  const filteredSales = sales?.filter((sale) => {
    const matchesSearch =
      !searchTerm ||
      sale.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.phone_number?.includes(searchTerm) ||
      `${sale.seller?.first_name} ${sale.seller?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeller = selectedSellerId === "all" || sale.seller_id === selectedSellerId;
    const matchesClient = selectedClientId === "all" || sale.client_id === selectedClientId;

    return matchesSearch && matchesSeller && matchesClient;
  });

  // Create product name to commission/revenue map
  const productPriceMap = useMemo(() => {
    const map = new Map<string, { commission: number; revenue: number }>();
    products?.forEach(p => {
      if (p.name) {
        map.set(p.name.toLowerCase(), { 
          commission: p.commission_dkk || 0, 
          revenue: p.revenue_dkk || 0 
        });
      }
    });
    return map;
  }, [products]);

  // Enrich sales with commission/revenue
  const enrichedSales = useMemo(() => {
    return filteredSales?.map(sale => {
      const prices = sale.product_name 
        ? productPriceMap.get(sale.product_name.toLowerCase()) 
        : null;
      return {
        ...sale,
        commission_dkk: prices?.commission || 0,
        revenue_dkk: prices?.revenue || 0,
      };
    });
  }, [filteredSales, productPriceMap]);

  // Group sales by seller + date + location + client
  const groupedSales = useMemo(() => {
    if (!enrichedSales) return [];
    
    const groups = new Map<string, GroupedSales>();
    
    enrichedSales.forEach(sale => {
      const dateStr = sale.registered_at 
        ? format(parseISO(sale.registered_at), "yyyy-MM-dd")
        : "unknown";
      const sellerName = sale.seller 
        ? `${sale.seller.first_name} ${sale.seller.last_name}` 
        : "Ukendt";
      const locationName = sale.location?.name || "Ukendt";
      const clientName = sale.client?.name || "Ukendt";
      
      const key = `${sale.seller_id}-${dateStr}-${sale.location_id}-${sale.client_id}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          sellerName,
          clientName,
          locationName,
          date: dateStr,
          salesCount: 0,
          totalCommission: 0,
          totalRevenue: 0,
          sales: [],
        });
      }
      
      const group = groups.get(key)!;
      group.salesCount += 1;
      group.totalCommission += sale.commission_dkk;
      group.totalRevenue += sale.revenue_dkk;
      group.sales.push(sale);
    });
    
    // Sort groups by date descending, then by seller name
    return Array.from(groups.values()).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.sellerName.localeCompare(b.sellerName);
    });
  }, [enrichedSales]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Ret salgsregistrering (Leder)</h1>
          <p className="text-muted-foreground">Rediger eller slet fieldmarketing salgsregistreringer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg produkt, telefon, sælger..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Date From */}
              <div>
                <Label className="text-xs text-muted-foreground">Fra dato</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                />
              </div>

              {/* Date To */}
              <div>
                <Label className="text-xs text-muted-foreground">Til dato</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                />
              </div>

              {/* Seller filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Sælger</Label>
                <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle sælgere" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle sælgere</SelectItem>
                    {sellers?.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.first_name} {seller.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Kunde</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle kunder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle kunder</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Salgsregistreringer</CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{groupedSales.length} grupper</Badge>
              <Badge variant="outline">{enrichedSales?.length ?? 0} registreringer</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSales ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : groupedSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ingen salgsregistreringer fundet i den valgte periode
              </p>
            ) : (
              <div className="space-y-3">
                {groupedSales.map((group) => (
                  <Collapsible
                    key={group.key}
                    open={expandedGroups.has(group.key)}
                    onOpenChange={() => toggleGroup(group.key)}
                  >
                    <div className="rounded-lg border bg-card">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4">
                            {expandedGroups.has(group.key) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                              <span className="font-medium">{group.sellerName}</span>
                              <span className="text-sm text-muted-foreground">
                                {format(parseISO(group.date), "dd/MM/yyyy", { locale: da })}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {group.locationName}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Salg</div>
                                <Badge variant="default" className="mt-1">
                                  {group.salesCount}
                                </Badge>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Provi</div>
                                <div className="font-medium text-green-600">
                                  {group.totalCommission.toLocaleString("da-DK")} kr
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Oms</div>
                                <div className="font-medium text-blue-600">
                                  {group.totalRevenue.toLocaleString("da-DK")} kr
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="pl-12">Tidspunkt</TableHead>
                                <TableHead>Produkt</TableHead>
                                <TableHead>Telefon</TableHead>
                                <TableHead className="text-right">Provi</TableHead>
                                <TableHead className="text-right">Oms</TableHead>
                                <TableHead>Kommentar</TableHead>
                                <TableHead className="text-right">Handlinger</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.sales.map((sale) => (
                                <TableRow key={sale.id}>
                                  <TableCell className="pl-12 whitespace-nowrap">
                                    {sale.registered_at
                                      ? format(parseISO(sale.registered_at), "HH:mm", { locale: da })
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {sale.product_name || "-"}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {sale.phone_number || "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600">
                                    {sale.commission_dkk?.toLocaleString("da-DK")} kr
                                  </TableCell>
                                  <TableCell className="text-right text-blue-600">
                                    {sale.revenue_dkk?.toLocaleString("da-DK")} kr
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate text-muted-foreground">
                                    {sale.comment || "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditDialog(sale);
                                        }}
                                        className="h-8 w-8"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(sale.id, sale.product_name || "salg");
                                        }}
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, sale: open ? editDialog.sale : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediger salgsregistrering</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Produkt</Label>
              <Input
                value={editForm.product_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, product_name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Telefonnummer</Label>
              <Input
                value={editForm.phone_number}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>

            <div>
              <Label>Registreringstidspunkt</Label>
              <Input
                type="datetime-local"
                value={editForm.registered_at}
                onChange={(e) => setEditForm((prev) => ({ ...prev, registered_at: e.target.value }))}
              />
            </div>

            <div>
              <Label>Kunde</Label>
              <Select
                value={editForm.client_id}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Lokation</Label>
              <Select
                value={editForm.location_id}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, location_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg lokation" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kommentar</Label>
              <Textarea
                value={editForm.comment}
                onChange={(e) => setEditForm((prev) => ({ ...prev, comment: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, sale: null })}>
              Annuller
            </Button>
            <Button onClick={handleSave} disabled={updateSale.isPending}>
              {updateSale.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gem ændringer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VagtFlowLayout>
  );
}
