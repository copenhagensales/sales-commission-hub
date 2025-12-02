import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Edit2, Plus, Trash2, Package, ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  id: string;
  code: string;
  name: string;
  commission_type: string;
  commission_value: number;
  clawback_window_days: number;
  is_active: boolean;
}

interface Props {
  products: Product[];
}

const ITEMS_PER_PAGE = 10;

export function ProductsSection({ products }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const filteredProducts = showOnlyActive 
    ? products.filter(p => p.is_active) 
    : products;

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    inactive: products.filter(p => !p.is_active).length
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
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

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/30">
              <TableHead className="text-muted-foreground">Produkt</TableHead>
              <TableHead className="text-muted-foreground w-20">Kode</TableHead>
              <TableHead className="text-muted-foreground w-32">Provision</TableHead>
              <TableHead className="text-muted-foreground w-28">Clawback</TableHead>
              <TableHead className="text-muted-foreground w-20">Status</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => (
              <TableRow key={product.id} className="border-border">
                <TableCell className="font-medium text-foreground">
                  {product.name}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {product.code}
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
                  <Switch checked={product.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
}
