import { useState } from "react";
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
import { Loader2, Pencil, Trash2, Search, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { da } from "date-fns/locale";

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
            <Badge variant="outline">{filteredSales?.length ?? 0} registreringer</Badge>
          </CardHeader>
          <CardContent>
            {loadingSales ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredSales || filteredSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ingen salgsregistreringer fundet i den valgte periode
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dato</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Lokation</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Kommentar</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="whitespace-nowrap">
                          {sale.registered_at
                            ? format(parseISO(sale.registered_at), "dd/MM/yyyy HH:mm", { locale: da })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {sale.seller
                            ? `${sale.seller.first_name} ${sale.seller.last_name}`
                            : "-"}
                        </TableCell>
                        <TableCell>{sale.client?.name || "-"}</TableCell>
                        <TableCell>{sale.location?.name || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{sale.product_name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{sale.phone_number || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground">
                          {sale.comment || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(sale)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(sale.id, sale.product_name || "salg")}
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
