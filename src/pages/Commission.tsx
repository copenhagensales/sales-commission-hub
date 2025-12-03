import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, RefreshCw, AlertTriangle, CheckCircle, Package, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EditingCell = {
  productId: string;
  field: 'name' | 'commission_dkk' | 'revenue_dkk';
} | null;

export default function Commission() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch products
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          client_campaigns (
            name,
            clients (name)
          )
        `)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, field, value }: { productId: string; field: string; value: string | number }) => {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Produkt opdateret');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingCell(null);
    },
    onError: (error) => {
      toast.error(`Fejl: ${error.message}`);
    }
  });

  const startEditing = (productId: string, field: 'name' | 'commission_dkk' | 'revenue_dkk', currentValue: string | number) => {
    setEditingCell({ productId, field });
    setEditValue(String(currentValue));
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const value = editingCell.field === 'name' ? editValue : parseFloat(editValue) || 0;
    updateProductMutation.mutate({ productId: editingCell.productId, field: editingCell.field, value });
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  // Fetch unmapped sale items
  const { data: unmappedItems, isLoading: loadingUnmapped } = useQuery({
    queryKey: ['unmapped-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          sales (
            agent_name,
            customer_company,
            sale_datetime
          )
        `)
        .eq('needs_mapping', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch sales summary
  const { data: salesSummary } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select('mapped_commission, mapped_revenue, needs_mapping');
      if (error) throw error;
      
      const totalCommission = data?.reduce((sum, item) => sum + (Number(item.mapped_commission) || 0), 0) || 0;
      const totalRevenue = data?.reduce((sum, item) => sum + (Number(item.mapped_revenue) || 0), 0) || 0;
      const unmappedCount = data?.filter(item => item.needs_mapping).length || 0;
      
      return { totalCommission, totalRevenue, unmappedCount, totalItems: data?.length || 0 };
    }
  });

  // Import CSV mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('client_name', 'TDC Erhverv');
      formData.append('campaign_name', 'Standard');

      const { data, error } = await supabase.functions.invoke('import-products', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.inserted} new, updated ${data.updated} products`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    }
  });

  // Map product mutation
  const mapProductMutation = useMutation({
    mutationFn: async ({ itemId, productId }: { itemId: string; productId: string }) => {
      // Get product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('commission_dkk, revenue_dkk')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Get sale item to get quantity
      const { data: saleItem, error: itemError } = await supabase
        .from('sale_items')
        .select('quantity, adversus_external_id')
        .eq('id', itemId)
        .single();

      if (itemError) throw itemError;

      // Update sale item
      const { error: updateError } = await supabase
        .from('sale_items')
        .update({
          product_id: productId,
          mapped_commission: (product.commission_dkk || 0) * (saleItem.quantity || 1),
          mapped_revenue: (product.revenue_dkk || 0) * (saleItem.quantity || 1),
          needs_mapping: false,
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Create/update product mapping if externalId exists
      if (saleItem.adversus_external_id) {
        await supabase
          .from('adversus_product_mappings')
          .upsert({
            adversus_external_id: saleItem.adversus_external_id,
            product_id: productId,
          }, { onConflict: 'adversus_external_id' });
      }
    },
    onSuccess: () => {
      toast.success('Product mapped successfully');
      queryClient.invalidateQueries({ queryKey: ['unmapped-items'] });
      queryClient.invalidateQueries({ queryKey: ['sales-summary'] });
    },
    onError: (error) => {
      toast.error(`Mapping failed: ${error.message}`);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Commission Management</h1>
          <p className="text-muted-foreground">Manage products, mappings, and view commission data</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesSummary?.totalCommission || 0).toLocaleString('da-DK')} DKK</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesSummary?.totalRevenue || 0).toLocaleString('da-DK')} DKK</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sale Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesSummary?.totalItems || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{salesSummary?.unmappedCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="mappings" className="gap-2">
              <Link2 className="h-4 w-4" />
              Mappings
              {(salesSummary?.unmappedCount || 0) > 0 && (
                <Badge variant="destructive" className="ml-1">{salesSummary?.unmappedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Import CSV
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Master Product List</CardTitle>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filter by client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="all">Alle kunder</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {loadingProducts ? (
                  <div className="text-center py-8 text-muted-foreground">Loading products...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Client / Campaign</TableHead>
                        <TableHead className="text-right">Commission (DKK)</TableHead>
                        <TableHead className="text-right">Revenue (DKK)</TableHead>
                        <TableHead>External Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filteredProducts = selectedClientId === "all" 
                          ? products 
                          : products?.filter(p => {
                              const clientId = clients?.find(c => c.name === p.client_campaigns?.clients?.name)?.id;
                              return clientId === selectedClientId;
                            });
                        
                        // Sort alphabetically by client name
                        const sortedProducts = [...(filteredProducts || [])].sort((a, b) => {
                          const clientA = a.client_campaigns?.clients?.name || '';
                          const clientB = b.client_campaigns?.clients?.name || '';
                          return clientA.localeCompare(clientB, 'da');
                        });
                        
                        if (!sortedProducts?.length) {
                          return (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                {selectedClientId === "all" 
                                  ? "No products imported yet. Use the Import CSV tab to add products."
                                  : "No products found for this client."}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        return sortedProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">
                              {editingCell?.productId === product.id && editingCell?.field === 'name' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveEdit}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                  className="h-7 w-full"
                                />
                              ) : (
                                <span
                                  onClick={() => startEditing(product.id, 'name', product.name)}
                                  className="cursor-pointer hover:bg-muted px-2 py-1 rounded -mx-2"
                                >
                                  {product.name}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {product.client_campaigns?.clients?.name} / {product.client_campaigns?.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingCell?.productId === product.id && editingCell?.field === 'commission_dkk' ? (
                                <Input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveEdit}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                  className="h-7 w-24 text-right ml-auto"
                                />
                              ) : (
                                <span
                                  onClick={() => startEditing(product.id, 'commission_dkk', product.commission_dkk ?? 0)}
                                  className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                                >
                                  {Number(product.commission_dkk).toLocaleString('da-DK')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingCell?.productId === product.id && editingCell?.field === 'revenue_dkk' ? (
                                <Input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveEdit}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                  className="h-7 w-24 text-right ml-auto"
                                />
                              ) : (
                                <span
                                  onClick={() => startEditing(product.id, 'revenue_dkk', product.revenue_dkk ?? 0)}
                                  className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                                >
                                  {Number(product.revenue_dkk).toLocaleString('da-DK')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {product.external_product_code || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mappings Tab */}
          <TabsContent value="mappings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Items Needing Mapping
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUnmapped ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : unmappedItems?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p>All sale items are mapped!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Adversus Product</TableHead>
                        <TableHead>External ID</TableHead>
                        <TableHead>Sale Info</TableHead>
                        <TableHead>Map to Product</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.adversus_product_title || 'Unknown'}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {item.adversus_external_id || '—'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{item.sales?.customer_company}</div>
                              <div className="text-muted-foreground">{item.sales?.agent_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select onValueChange={(value) => mapProductMutation.mutate({ itemId: item.id, productId: value })}>
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select product..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products?.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Products from CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Upload a CSV file with columns: Salg, Provsion, Omsætning
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-sm">Selected: {selectedFile.name}</p>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || importMutation.isPending}
                    className="gap-2"
                  >
                    {importMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import Products
                  </Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Semicolon (;) separated values</li>
                    <li>First row should be headers</li>
                    <li>Column 1: Salg (Product Name)</li>
                    <li>Column 2: Provsion (Commission in DKK)</li>
                    <li>Column 3: Omsætning (Revenue in DKK)</li>
                    <li>Rows with "opstartsbonus" will be ignored</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
