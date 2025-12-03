import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string;
  adversus_outcome: string | null;
  product_id: string | null;
  liquidity_customer_id: string | null;
  created_at: string;
  products?: {
    name: string;
    commission_value: number | null;
    commission_type: string | null;
    revenue_amount: number | null;
  } | null;
  liquidity_customers?: {
    name: string;
  } | null;
}

interface Product {
  id: string;
  name: string;
  commission_value: number | null;
  commission_type: string | null;
  revenue_amount: number | null;
}

interface Customer {
  id: string;
  name: string;
}

export default function CommissionCPO() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CampaignMapping | null>(null);
  const [newMapping, setNewMapping] = useState({
    adversus_campaign_id: "",
    adversus_campaign_name: "",
    adversus_outcome: "",
    product_id: "",
    liquidity_customer_id: "",
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaign-mappings-with-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_mappings")
        .select(`
          *,
          products (
            name,
            commission_value,
            commission_type,
            revenue_amount
          ),
          liquidity_customers (
            name
          )
        `)
        .order("adversus_campaign_name");

      if (error) throw error;
      return data as CampaignMapping[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_value, commission_type, revenue_amount")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["liquidity-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidity_customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Customer[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaign_product_mappings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-mappings-with-products"] });
      toast({ title: "Mapping slettet" });
    },
    onError: (error) => {
      toast({ title: "Fejl ved sletning", description: error.message, variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaign_product_mappings")
        .insert({
          adversus_campaign_id: newMapping.adversus_campaign_id,
          adversus_campaign_name: newMapping.adversus_campaign_name,
          adversus_outcome: newMapping.adversus_outcome || null,
          product_id: newMapping.product_id || null,
          liquidity_customer_id: newMapping.liquidity_customer_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-mappings-with-products"] });
      toast({ title: "Mapping tilføjet" });
      setIsAddDialogOpen(false);
      setNewMapping({
        adversus_campaign_id: "",
        adversus_campaign_name: "",
        adversus_outcome: "",
        product_id: "",
        liquidity_customer_id: "",
      });
    },
    onError: (error) => {
      toast({ title: "Fejl ved tilføjelse", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (mapping: CampaignMapping) => {
      const { error } = await supabase
        .from("campaign_product_mappings")
        .update({
          adversus_campaign_id: mapping.adversus_campaign_id,
          adversus_campaign_name: mapping.adversus_campaign_name,
          adversus_outcome: mapping.adversus_outcome || null,
          product_id: mapping.product_id || null,
          liquidity_customer_id: mapping.liquidity_customer_id || null,
        })
        .eq("id", mapping.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-mappings-with-products"] });
      toast({ title: "Mapping opdateret" });
      setIsEditDialogOpen(false);
      setEditingMapping(null);
    },
    onError: (error) => {
      toast({ title: "Fejl ved opdatering", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, product_id }: { id: string; product_id: string | null }) => {
      const { error } = await supabase
        .from("campaign_product_mappings")
        .update({ product_id })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-mappings-with-products"] });
      toast({ title: "Produkt opdateret" });
    },
    onError: (error) => {
      toast({ title: "Fejl ved opdatering", description: error.message, variant: "destructive" });
    },
  });

  const handleEditClick = (mapping: CampaignMapping) => {
    setEditingMapping({ ...mapping });
    setIsEditDialogOpen(true);
  };

  // Group campaigns by campaign name
  const groupedCampaigns = campaigns?.reduce((acc, campaign) => {
    const key = campaign.adversus_campaign_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(campaign);
    return acc;
  }, {} as Record<string, CampaignMapping[]>);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Provision og CPO</h1>
            <p className="text-muted-foreground">
              Oversigt over alle kampagner og deres provisions- og CPO-indstillinger
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tilføj mapping
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tilføj ny kampagne-mapping</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign_id">Kampagne ID</Label>
                  <Input
                    id="campaign_id"
                    value={newMapping.adversus_campaign_id}
                    onChange={(e) => setNewMapping({ ...newMapping, adversus_campaign_id: e.target.value })}
                    placeholder="F.eks. 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign_name">Kampagne navn</Label>
                  <Input
                    id="campaign_name"
                    value={newMapping.adversus_campaign_name}
                    onChange={(e) => setNewMapping({ ...newMapping, adversus_campaign_name: e.target.value })}
                    placeholder="F.eks. TDC Erhverv"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outcome">Outcome (valgfrit)</Label>
                  <Input
                    id="outcome"
                    value={newMapping.adversus_outcome}
                    onChange={(e) => setNewMapping({ ...newMapping, adversus_outcome: e.target.value })}
                    placeholder="F.eks. Sale"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Produkt</Label>
                  <Select
                    value={newMapping.product_id}
                    onValueChange={(value) => setNewMapping({ ...newMapping, product_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg produkt" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer">Kunde (valgfrit)</Label>
                  <Select
                    value={newMapping.liquidity_customer_id}
                    onValueChange={(value) => setNewMapping({ ...newMapping, liquidity_customer_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg kunde" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => addMutation.mutate()} 
                  disabled={!newMapping.adversus_campaign_id || !newMapping.adversus_campaign_name || addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending ? "Tilføjer..." : "Tilføj"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedCampaigns && Object.entries(groupedCampaigns).map(([campaignName, mappings]) => (
              <Card key={campaignName}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {campaignName}
                    <Badge variant="secondary" className="ml-2">
                      {mappings.length} {mappings.length === 1 ? "mapping" : "mappings"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Adversus Kampagne ID</TableHead>
                        <TableHead>Adversus Outcome</TableHead>
                        <TableHead className="min-w-[200px]">Produkt Mapping</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Provision</TableHead>
                        <TableHead>CPO</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping) => (
                        <TableRow key={mapping.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {mapping.adversus_campaign_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {mapping.adversus_outcome || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={mapping.product_id || "none"}
                              onValueChange={(value) => 
                                updateProductMutation.mutate({ 
                                  id: mapping.id, 
                                  product_id: value === "none" ? null : value 
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Vælg produkt" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="none">Ingen produkt</SelectItem>
                                {products?.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {mapping.liquidity_customers?.name || "-"}
                          </TableCell>
                          <TableCell>
                            {mapping.products?.commission_type === "percentage" 
                              ? `${mapping.products.commission_value}%`
                              : formatCurrency(mapping.products?.commission_value)
                            }
                          </TableCell>
                          <TableCell>
                            {formatCurrency(mapping.products?.revenue_amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(mapping)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(mapping.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

            {(!groupedCampaigns || Object.keys(groupedCampaigns).length === 0) && (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Ingen kampagner fundet. Kør en synkronisering fra Indstillinger for at hente kampagner.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rediger kampagne-mapping</DialogTitle>
            </DialogHeader>
            {editingMapping && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Kampagne ID</Label>
                  <Input
                    value={editingMapping.adversus_campaign_id}
                    onChange={(e) => setEditingMapping({ ...editingMapping, adversus_campaign_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kampagne navn</Label>
                  <Input
                    value={editingMapping.adversus_campaign_name}
                    onChange={(e) => setEditingMapping({ ...editingMapping, adversus_campaign_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outcome (valgfrit)</Label>
                  <Input
                    value={editingMapping.adversus_outcome || ""}
                    onChange={(e) => setEditingMapping({ ...editingMapping, adversus_outcome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Produkt</Label>
                  <Select
                    value={editingMapping.product_id || ""}
                    onValueChange={(value) => setEditingMapping({ ...editingMapping, product_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg produkt" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kunde (valgfrit)</Label>
                  <Select
                    value={editingMapping.liquidity_customer_id || ""}
                    onValueChange={(value) => setEditingMapping({ ...editingMapping, liquidity_customer_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg kunde" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => editMutation.mutate(editingMapping)} 
                  disabled={editMutation.isPending}
                  className="w-full"
                >
                  {editMutation.isPending ? "Gemmer..." : "Gem ændringer"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
