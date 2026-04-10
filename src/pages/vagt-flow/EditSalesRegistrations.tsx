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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Trash2, Search, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { fetchAllRows } from "@/utils/supabasePagination";
import { da } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// buildFmPricingMap removed – pricing is handled by database triggers

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

interface GroupEditFormData {
  seller_id: string;
  location_id: string;
  client_id: string;
}

interface GroupSaleItem {
  id: string | null; // null for new items
  product_name: string;
  phone_number: string;
  comment: string;
  toDelete?: boolean;
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

  // Group edit dialog state
  const [groupEditDialog, setGroupEditDialog] = useState<{ open: boolean; group: GroupedSales | null }>({
    open: false,
    group: null,
  });
  const [groupEditForm, setGroupEditForm] = useState<GroupEditFormData>({
    seller_id: "",
    location_id: "",
    client_id: "",
  });
  const [groupSaleItems, setGroupSaleItems] = useState<GroupSaleItem[]>([]);
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{ open: boolean; group: GroupedSales | null }>({
    open: false,
    group: null,
  });

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

  // Fetch all sales from centralized sales table with source = 'fieldmarketing'
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["fm-sales-edit", dateRange.from, dateRange.to],
    queryFn: async () => {
      const data = await fetchAllRows<{ id: string; sale_datetime: string; customer_phone: string | null; raw_payload: any; created_at: string }>(
        "sales",
        "id, sale_datetime, customer_phone, raw_payload, created_at",
        (query) => query
          .eq("source", "fieldmarketing")
          .gte("sale_datetime", `${dateRange.from}T00:00:00`)
          .lte("sale_datetime", `${dateRange.to}T23:59:59`),
        { orderBy: "sale_datetime", ascending: false }
      );
      
      // Extract unique IDs from raw_payload
      const sellerIds = [...new Set(data?.map(s => (s.raw_payload as any)?.fm_seller_id).filter(Boolean))] as string[];
      const locationIds = [...new Set(data?.map(s => (s.raw_payload as any)?.fm_location_id).filter(Boolean))] as string[];
      const clientIds = [...new Set(data?.map(s => (s.raw_payload as any)?.fm_client_id).filter(Boolean))] as string[];
      
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
      
      // Fetch sale_items for all sales to get actual mapped prices
      const saleIds = (data || []).map(s => s.id);
      let saleItemsMap = new Map<string, { commission: number; revenue: number }>();
      if (saleIds.length > 0) {
        // Fetch in chunks of 200 to avoid URL length limits
        const chunks = [];
        for (let i = 0; i < saleIds.length; i += 200) {
          chunks.push(saleIds.slice(i, i + 200));
        }
        const itemResults = await Promise.all(
          chunks.map(chunk =>
            supabase
              .from("sale_items")
              .select("sale_id, mapped_commission, mapped_revenue")
              .in("sale_id", chunk)
          )
        );
        for (const result of itemResults) {
          for (const item of result.data || []) {
            const existing = saleItemsMap.get(item.sale_id);
            saleItemsMap.set(item.sale_id, {
              commission: (existing?.commission || 0) + (item.mapped_commission || 0),
              revenue: (existing?.revenue || 0) + (item.mapped_revenue || 0),
            });
          }
        }
      }
      
      // Transform sales table data to SaleRecord interface
      return (data || []).map(sale => {
        const payload = sale.raw_payload as any || {};
        const sellerId = payload.fm_seller_id || "";
        const locationId = payload.fm_location_id || "";
        const clientId = payload.fm_client_id || "";
        return {
          id: sale.id,
          seller_id: sellerId,
          location_id: locationId,
          client_id: clientId,
          product_name: payload.fm_product_name || null,
          phone_number: sale.customer_phone || null,
          comment: payload.fm_comment || null,
          registered_at: sale.sale_datetime,
          created_at: sale.created_at,
          seller: sellerId ? sellersMap.get(sellerId) || null : null,
          location: locationId ? locationsMap.get(locationId) || null : null,
          client: clientId ? clientsMap.get(clientId) || null : null,
          commission_dkk: saleItemsMap.get(sale.id)?.commission || 0,
          revenue_dkk: saleItemsMap.get(sale.id)?.revenue || 0,
        };
      }) as SaleRecord[];
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

  // Fetch locations for edit dialog (include all to allow editing existing sales with inactive locations)
  const { data: locations } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["fm-locations-edit"],
    queryFn: async () => {
      // Use raw query to avoid type issues with 'location' table name
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/location?select=id,name&order=name`,
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

  // Update sale mutation - now uses centralized sales table with raw_payload
  const updateSale = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EditFormData }) => {
      // Get existing raw_payload first
      const { data: existing } = await supabase
        .from("sales")
        .select("raw_payload")
        .eq("id", id)
        .maybeSingle();
      
      const existingPayload = (existing?.raw_payload as any) || {};
      
      const updateData = {
        sale_datetime: updates.registered_at,
        customer_phone: updates.phone_number || null,
        raw_payload: {
          ...existingPayload,
          fm_product_name: updates.product_name,
          fm_comment: updates.comment || null,
          fm_location_id: updates.location_id || null,
          fm_client_id: updates.client_id || null,
        },
      };
      const { error } = await supabase
        .from("sales")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // Delete existing sale_items so the trigger can recreate with correct campaign-aware pricing
      await supabase.from("sale_items").delete().eq("sale_id", id);
      // Re-trigger sale_items creation by touching the sale (trigger fires on insert only)
      // So we need to invoke rematch for this specific sale
      await supabase.functions.invoke("rematch-pricing-rules", {
        body: { sale_ids: [id] },
      });
    },
    onSuccess: () => {
      toast.success("Salgsregistrering opdateret");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
      setEditDialog({ open: false, sale: null });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opdatere: ${error.message}`);
    },
  });

  // Delete sale mutation - now uses centralized sales table
  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salgsregistrering slettet");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });

  // Update group mutation - updates all sales in a group (now uses centralized sales table)
  const updateGroup = useMutation({
    mutationFn: async ({ 
      updates, 
      items, 
      originalGroup 
    }: { 
      updates: GroupEditFormData; 
      items: GroupSaleItem[];
      originalGroup: GroupedSales;
    }) => {
      const firstSale = originalGroup.sales[0];
      const baseDate = firstSale?.registered_at ? parseISO(firstSale.registered_at) : new Date();
      
      // Items to delete
      const toDelete = items.filter(item => item.toDelete && item.id);
      // Items to update (existing items not marked for deletion)
      const toUpdate = items.filter(item => item.id && !item.toDelete);
      // Items to create (new items)
      const toCreate = items.filter(item => !item.id && !item.toDelete);
      
      // Delete marked items from centralized sales table
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("sales")
          .delete()
          .in("id", toDelete.map(i => i.id!));
        if (error) throw error;
      }
      
      // Update existing items (product, phone, comment) + group fields via raw_payload
      const saleIdsNeedingRematch: string[] = [];
      
      for (const item of toUpdate) {
        // Find the original sale to compare core fields
        const originalSale = originalGroup.sales.find(s => s.id === item.id);
        
        // Get existing raw_payload
        const { data: existing } = await supabase
          .from("sales")
          .select("raw_payload")
          .eq("id", item.id!)
          .maybeSingle();
        
        const existingPayload = (existing?.raw_payload as any) || {};
        
        // Determine if core data (product, client, location) has changed
        const productChanged = item.product_name !== (existingPayload.fm_product_name || originalSale?.product_name);
        const clientChanged = updates.client_id && updates.client_id !== (existingPayload.fm_client_id || originalSale?.client_id);
        const locationChanged = updates.location_id && updates.location_id !== (existingPayload.fm_location_id || originalSale?.location_id);
        const coreDataChanged = productChanged || clientChanged || locationChanged;
        
        const { error } = await supabase
          .from("sales")
          .update({
            customer_phone: item.phone_number || null,
            raw_payload: {
              ...existingPayload,
              fm_product_name: item.product_name,
              fm_comment: item.comment || null,
              fm_seller_id: updates.seller_id || existingPayload.fm_seller_id,
              fm_location_id: updates.location_id || existingPayload.fm_location_id,
              fm_client_id: updates.client_id || existingPayload.fm_client_id,
            },
          })
          .eq("id", item.id!);
        if (error) throw error;

        // Only delete and rematch sale_items when core pricing data changed
        if (coreDataChanged) {
          await supabase.from("sale_items").delete().eq("sale_id", item.id!);
          saleIdsNeedingRematch.push(item.id!);
        }
      }
      
      // Batch rematch all sales that had core data changes
      if (saleIdsNeedingRematch.length > 0) {
        await supabase.functions.invoke("rematch-pricing-rules", {
          body: { sale_ids: saleIdsNeedingRematch },
        });
      }
      
      // Create new items via centralized sales table
      if (toCreate.length > 0) {
        // Get employee name for agent_name
        const sellerId = updates.seller_id || firstSale?.seller_id;
        let agentName: string | null = null;
        if (sellerId) {
          const { data: employee } = await supabase
            .from("employee_master_data")
            .select("first_name, last_name")
            .eq("id", sellerId)
            .maybeSingle();
          if (employee) {
            agentName = `${employee.first_name} ${employee.last_name}`;
          }
        }
        
        const newSales = toCreate.map(item => ({
          source: 'fieldmarketing' as const,
          integration_type: 'manual' as const,
          sale_datetime: baseDate.toISOString(),
          customer_phone: item.phone_number || null,
          agent_name: agentName,
          validation_status: 'pending',
          raw_payload: {
            fm_seller_id: updates.seller_id || firstSale?.seller_id,
            fm_location_id: updates.location_id || firstSale?.location_id,
            fm_client_id: updates.client_id || firstSale?.client_id,
            fm_product_name: item.product_name,
            fm_comment: item.comment || null,
          },
        }));
        const { data: insertedNewSales, error } = await supabase
          .from("sales")
          .insert(newSales)
          .select("id");
        if (error) throw error;

        // sale_items are created automatically by the create_fm_sale_items trigger
        // with correct campaign-aware pricing – no manual creation needed
      }
    },
    onSuccess: () => {
      toast.success("Salgsgruppe opdateret");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
      setGroupEditDialog({ open: false, group: null });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opdatere gruppe: ${error.message}`);
    },
  });

  // Delete group mutation - deletes all sales in a group (now uses centralized sales table)
  const deleteGroup = useMutation({
    mutationFn: async (group: GroupedSales) => {
      const saleIds = group.sales.map(s => s.id);
      const { error } = await supabase
        .from("sales")
        .delete()
        .in("id", saleIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salgsgruppe slettet");
      queryClient.invalidateQueries({ queryKey: ["fm-sales-edit"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
      setDeleteGroupDialog({ open: false, group: null });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette gruppe: ${error.message}`);
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

  const openGroupEditDialog = (group: GroupedSales) => {
    const firstSale = group.sales[0];
    setGroupEditForm({
      seller_id: firstSale?.seller_id || "",
      location_id: firstSale?.location_id || "",
      client_id: firstSale?.client_id || "",
    });
    // Initialize sale items from group
    setGroupSaleItems(
      group.sales.map(sale => ({
        id: sale.id,
        product_name: sale.product_name || "",
        phone_number: sale.phone_number || "",
        comment: sale.comment || "",
      }))
    );
    setGroupEditDialog({ open: true, group });
  };

  const handleSave = () => {
    if (!editDialog.sale) return;
    updateSale.mutate({
      id: editDialog.sale.id,
      updates: editForm,
    });
  };

  const handleGroupSave = () => {
    if (!groupEditDialog.group) return;
    updateGroup.mutate({
      updates: groupEditForm,
      items: groupSaleItems,
      originalGroup: groupEditDialog.group,
    });
  };

  const addGroupSaleItem = () => {
    setGroupSaleItems(prev => [
      ...prev,
      { id: null, product_name: "", phone_number: "", comment: "" }
    ]);
  };

  const updateGroupSaleItem = (index: number, field: keyof GroupSaleItem, value: string | boolean) => {
    setGroupSaleItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const toggleDeleteGroupSaleItem = (index: number) => {
    setGroupSaleItems(prev => prev.map((item, i) => 
      i === index ? { ...item, toDelete: !item.toDelete } : item
    ));
  };

  const removeNewGroupSaleItem = (index: number) => {
    setGroupSaleItems(prev => prev.filter((_, i) => i !== index));
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

  // Sales already have commission/revenue from sale_items (fetched in query)
  const enrichedSales = filteredSales;

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

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg produkt, telefon, sælger..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fra</Label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                    className="h-10 w-[140px]"
                  />
                </div>
                <span className="text-muted-foreground mt-5">–</span>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Til</Label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                    className="h-10 w-[140px]"
                  />
                </div>
              </div>

              {/* Seller filter */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Sælger</Label>
                <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                  <SelectTrigger className="h-10">
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
              <div className="flex flex-col gap-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Kunde</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-10">
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
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openGroupEditDialog(group);
                                }}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="h-4 w-4 mr-1.5" />
                                Rediger
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteGroupDialog({ open: true, group });
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Slet
                              </Button>
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

      {/* Group Edit Dialog */}
      <Dialog open={groupEditDialog.open} onOpenChange={(open) => setGroupEditDialog({ open, group: open ? groupEditDialog.group : null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rediger hele salgsgruppen</DialogTitle>
          </DialogHeader>

          {groupEditDialog.group && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="text-muted-foreground">Dato:</span> {format(parseISO(groupEditDialog.group.date), "dd/MM/yyyy", { locale: da })}
                </div>
              </div>

              {/* Group fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Sælger</Label>
                  <Select
                    value={groupEditForm.seller_id}
                    onValueChange={(value) => setGroupEditForm((prev) => ({ ...prev, seller_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg sælger" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers?.map((seller) => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.first_name} {seller.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Lokation</Label>
                  <Select
                    value={groupEditForm.location_id}
                    onValueChange={(value) => setGroupEditForm((prev) => ({ ...prev, location_id: value }))}
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
                  <Label>Kunde</Label>
                  <Select
                    value={groupEditForm.client_id}
                    onValueChange={(value) => setGroupEditForm((prev) => ({ ...prev, client_id: value }))}
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
              </div>

              {/* Sale items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Salg ({groupSaleItems.filter(i => !i.toDelete).length})</Label>
                  <Button variant="outline" size="sm" onClick={addGroupSaleItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    Tilføj salg
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {groupSaleItems.map((item, index) => (
                    <div 
                      key={item.id || `new-${index}`} 
                      className={`p-3 border rounded-lg space-y-2 ${item.toDelete ? 'opacity-50 bg-destructive/10' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {item.id ? `Salg #${index + 1}` : 'Nyt salg'}
                        </span>
                        {item.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDeleteGroupSaleItem(index)}
                            className={item.toDelete ? "text-green-600" : "text-destructive"}
                          >
                            {item.toDelete ? "Fortryd slet" : <><Trash2 className="h-3 w-3 mr-1" /> Slet</>}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeNewGroupSaleItem(index)}
                            className="text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      {!item.toDelete && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Produkt</Label>
                            <Select
                              value={item.product_name}
                              onValueChange={(value) => updateGroupSaleItem(index, 'product_name', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Vælg produkt" />
                              </SelectTrigger>
                              <SelectContent>
                                {products?.map((product) => (
                                  <SelectItem key={product.id} value={product.name || ""}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Telefon</Label>
                            <Input
                              className="h-8"
                              value={item.phone_number}
                              onChange={(e) => updateGroupSaleItem(index, 'phone_number', e.target.value)}
                              placeholder="Telefonnummer"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Kommentar</Label>
                            <Input
                              className="h-8"
                              value={item.comment}
                              onChange={(e) => updateGroupSaleItem(index, 'comment', e.target.value)}
                              placeholder="Kommentar"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupEditDialog({ open: false, group: null })}>
              Annuller
            </Button>
            <Button onClick={handleGroupSave} disabled={updateGroup.isPending}>
              {updateGroup.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gem ændringer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog 
        open={deleteGroupDialog.open} 
        onOpenChange={(open) => setDeleteGroupDialog({ open, group: open ? deleteGroupDialog.group : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet hele salgsgruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du er ved at slette {deleteGroupDialog.group?.salesCount} salgsregistrering(er) for{" "}
              <strong>{deleteGroupDialog.group?.sellerName}</strong> den{" "}
              {deleteGroupDialog.group?.date && format(parseISO(deleteGroupDialog.group.date), "d. MMMM yyyy", { locale: da })}.
              <br /><br />
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupDialog.group && deleteGroup.mutate(deleteGroupDialog.group)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroup.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Ja, slet gruppen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VagtFlowLayout>
  );
}
