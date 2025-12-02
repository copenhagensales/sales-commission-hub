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

// Extract campaign prefix from product code
function getCampaignPrefix(code: string): string {
  const parts = code.split('-');
  return parts[0] || code;
}

// Map prefix to readable campaign name
const PREFIX_TO_CAMPAIGN: Record<string, string> = {
  'AKA': 'AKA',
  'ASE': 'ASE',
  'BD': 'Business Danmark',
  'CODAN': 'Codan',
  'EESY': 'Eesy',
  'FF': 'Finansforbundet',
  'MAK': 'Min A-Kasse',
  'REL': 'Relatel',
  'TDCE': 'TDC Erhverv',
  'TDC': 'TDC',
  'TRYG': 'Tryg',
  'YS': 'YouSee',
  'STD': 'Standard',
};

export function ProductsSection({ products }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  // Get unique campaigns from products
  const campaigns = useMemo(() => {
    const prefixes = new Set<string>();
    products.forEach(p => prefixes.add(getCampaignPrefix(p.code)));
    return Array.from(prefixes).sort((a, b) => {
      const nameA = PREFIX_TO_CAMPAIGN[a] || a;
      const nameB = PREFIX_TO_CAMPAIGN[b] || b;
      return nameA.localeCompare(nameB);
    });
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (showOnlyActive) {
      filtered = filtered.filter(p => p.is_active);
    }
    
    if (selectedCampaign !== "all") {
      filtered = filtered.filter(p => getCampaignPrefix(p.code) === selectedCampaign);
    }
    
    return filtered;
  }, [products, showOnlyActive, selectedCampaign]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Stats per campaign
  const campaignStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number }> = {};
    products.forEach(p => {
      const prefix = getCampaignPrefix(p.code);
      if (!stats[prefix]) stats[prefix] = { total: 0, active: 0 };
      stats[prefix].total++;
      if (p.is_active) stats[prefix].active++;
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
              <SelectValue placeholder="Vælg kampagne..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Alle kampagner ({stats.total})
              </SelectItem>
              {campaigns.map(prefix => {
                const campaignName = PREFIX_TO_CAMPAIGN[prefix] || prefix;
                const prefixStats = campaignStats[prefix];
                return (
                  <SelectItem key={prefix} value={prefix}>
                    {campaignName} ({prefixStats?.active || 0}/{prefixStats?.total || 0})
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

      {/* Selected campaign indicator */}
      {selectedCampaign !== "all" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtreret:</span>
          <Badge variant="secondary">
            {PREFIX_TO_CAMPAIGN[selectedCampaign] || selectedCampaign}
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
              <TableHead className="text-muted-foreground w-28">Kampagne</TableHead>
              <TableHead className="text-muted-foreground w-32">Provision</TableHead>
              <TableHead className="text-muted-foreground w-28">Clawback</TableHead>
              <TableHead className="text-muted-foreground w-20">Status</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => {
              const prefix = getCampaignPrefix(product.code);
              const campaignName = PREFIX_TO_CAMPAIGN[prefix] || prefix;
              
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
                        setSelectedCampaign(prefix);
                        setCurrentPage(1);
                      }}
                    >
                      {campaignName}
                    </Badge>
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
    </div>
  );
}
