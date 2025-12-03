import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit2, Plus, Trash2, Package, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { EditProductDialog } from "./EditProductDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  code: string;
  name: string;
  commission_type: string;
  commission_value: number;
  clawback_window_days: number;
  is_active: boolean;
  revenue_amount?: number;
}

interface Props {
  products: Product[];
}

const ITEMS_PER_PAGE = 10;

// Extract customer name from product name suffix
function extractCustomer(productName: string): string {
  const suffixes = [
    ' - Finansforbundet',
    ' - TDC Erhverv',
    ' - Tryg',
    ' - TRYG',
    ' - Codan',
    ' - Business Danmark',
    ' - SIXT',
    ' - AKA',
    ' - ASE',
    ' - Eesy',
    ' - Relatel',
    ' - YouSee',
    ' - Min A-Kasse'
  ];
  
  for (const suffix of suffixes) {
    if (productName.toLowerCase().includes(suffix.toLowerCase())) {
      return suffix.replace(' - ', '');
    }
  }
  
  // Fallback: extract after last " - "
  const lastDash = productName.lastIndexOf(' - ');
  if (lastDash !== -1) {
    return productName.substring(lastDash + 3);
  }
  
  return 'Ukendt';
}

export function ProductsSection({ products }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Status opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere status");
    },
  });

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  // Get unique customers from products
  const customers = useMemo(() => {
    const customerSet = new Set<string>();
    products.forEach(p => customerSet.add(extractCustomer(p.name)));
    return Array.from(customerSet).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (showOnlyActive) {
      filtered = filtered.filter(p => p.is_active);
    }
    
    if (selectedCampaign !== "all") {
      filtered = filtered.filter(p => extractCustomer(p.name) === selectedCampaign);
    }
    
    return filtered;
  }, [products, showOnlyActive, selectedCampaign]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Stats per customer
  const customerStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number }> = {};
    products.forEach(p => {
      const customer = extractCustomer(p.name);
      if (!stats[customer]) stats[customer] = { total: 0, active: 0 };
      stats[customer].total++;
      if (p.is_active) stats[customer].active++;
    });
    return stats;
  }, [products]);

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    inactive: products.filter(p => !p.is_active).length,
    filtered: filteredProducts.length
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1.5">
            <Package className="h-3 w-3" />
            <span className="font-normal text-muted-foreground">Total:</span> {stats.total}
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/5">
            <span className="font-normal text-muted-foreground">Aktive:</span> {stats.active}
          </Badge>
          {stats.inactive > 0 && (
            <Badge variant="outline" className="gap-1.5 border-muted-foreground/30">
              <span className="font-normal text-muted-foreground">Inaktive:</span> {stats.inactive}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Campaign filter */}
          <Select
            value={selectedCampaign}
            onValueChange={(value) => {
              setSelectedCampaign(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Vælg kunde..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Alle kunder ({stats.total})
              </SelectItem>
              {customers.map(customer => {
                const custStats = customerStats[customer];
                return (
                  <SelectItem key={customer} value={customer}>
                    {customer} ({custStats?.active || 0}/{custStats?.total || 0})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <Button
            variant={showOnlyActive ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setShowOnlyActive(!showOnlyActive);
              setCurrentPage(1);
            }}
          >
            {showOnlyActive ? "Vis alle" : "Kun aktive"}
          </Button>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Tilføj produkt
          </Button>
        </div>
      </div>

      {/* Selected customer indicator */}
      {selectedCampaign !== "all" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtreret:</span>
          <Badge variant="secondary">
            {selectedCampaign}
          </Badge>
          <span className="text-muted-foreground">
            ({filteredProducts.length} produkter)
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2"
            onClick={() => setSelectedCampaign("all")}
          >
            Ryd filter
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/30">
              <TableHead className="text-muted-foreground">Produkt</TableHead>
              <TableHead className="text-muted-foreground w-24">Kode</TableHead>
              <TableHead className="text-muted-foreground w-28">Kunde</TableHead>
              <TableHead className="text-muted-foreground w-28">Omsætning</TableHead>
              <TableHead className="text-muted-foreground w-32">Provision</TableHead>
              <TableHead className="text-muted-foreground w-28">Clawback</TableHead>
              <TableHead className="text-muted-foreground w-20">Status</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => {
              const customerName = extractCustomer(product.name);
              
              return (
                <TableRow key={product.id} className="border-border">
                  <TableCell className="font-medium text-foreground">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {product.code}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setSelectedCampaign(customerName);
                        setCurrentPage(1);
                      }}
                    >
                      {customerName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.revenue_amount ? `${product.revenue_amount.toLocaleString('da-DK')} kr` : '-'}
                  </TableCell>
                  <TableCell className="text-foreground">
                    <Badge variant="secondary">
                      {product.commission_type === "fixed" 
                        ? `${product.commission_value} kr` 
                        : `${product.commission_value}%`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.clawback_window_days} dage
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={product.is_active} 
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: product.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditClick(product)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Viser {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} af {filteredProducts.length} produkter
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Forrige
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Næste
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <EditProductDialog
        product={editingProduct}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
