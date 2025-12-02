import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Filter, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

type SaleStatus = "pending" | "active" | "cancelled" | "clawbacked";

interface SaleWithDetails {
  id: string;
  sale_date: string | null;
  sale_amount: number | null;
  status: SaleStatus | null;
  agent: { id: string; name: string } | null;
  product: { id: string; name: string; commission_value: number | null; clawback_window_days: number | null } | null;
}

const PAGE_SIZE = 50;

export default function Sales() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['sales-count', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('id', { count: 'exact', head: true });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as SaleStatus);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales-with-details', currentPage, statusFilter],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          sale_amount,
          status,
          agent:agents!sales_agent_id_fkey(id, name),
          product:products!sales_product_id_fkey(id, name, commission_value, clawback_window_days)
        `)
        .order('sale_date', { ascending: false })
        .range(from, to);
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as SaleStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SaleWithDetails[];
    }
  });

  // Client-side search filtering
  const filteredSales = (sales || []).filter(sale => {
    if (!search) return true;
    const agentName = sale.agent?.name || '';
    const productName = sale.product?.name || '';
    return agentName.toLowerCase().includes(search.toLowerCase()) ||
      productName.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  const calculateDaysInClawback = (sale: SaleWithDetails) => {
    if (!sale.sale_date || !sale.product?.clawback_window_days) return null;
    if (sale.status !== 'pending' && sale.status !== 'active') return null;
    
    const saleDate = new Date(sale.sale_date);
    const daysSinceSale = differenceInDays(new Date(), saleDate);
    const daysRemaining = sale.product.clawback_window_days - daysSinceSale;
    
    return daysRemaining > 0 ? daysRemaining : null;
  };

  const getCommissionDisplay = (sale: SaleWithDetails) => {
    const commissionValue = sale.product?.commission_value || 0;
    if (sale.status === 'clawbacked') return -commissionValue;
    if (sale.status === 'cancelled') return 0;
    return commissionValue;
  };

  // Reset to page 1 when filter changes
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Salg</h1>
            <p className="mt-1 text-muted-foreground">
              Oversigt over alle salg og deres status
              {totalCount !== undefined && totalCount > 0 && (
                <span className="ml-2">({totalCount.toLocaleString('da-DK')} total)</span>
              )}
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Eksportér
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søg efter agent eller produkt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="pending">Afventer</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="cancelled">Annulleret</SelectItem>
              <SelectItem value="clawbacked">Modregnet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>Ingen salg fundet</p>
              <p className="text-sm">Kør en sync fra Settings for at hente salgsdata</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Dato</TableHead>
                  <TableHead className="text-muted-foreground">Agent</TableHead>
                  <TableHead className="text-muted-foreground">Produkt</TableHead>
                  <TableHead className="text-muted-foreground">Beløb</TableHead>
                  <TableHead className="text-muted-foreground">Provision</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Risiko</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const commission = getCommissionDisplay(sale);
                  const daysInClawback = calculateDaysInClawback(sale);
                  
                  return (
                    <TableRow 
                      key={sale.id} 
                      className="border-border cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="text-foreground">
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString("da-DK") : '-'}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {sale.agent?.name || 'Ukendt'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.product?.name || 'Ukendt produkt'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {(sale.sale_amount || 0).toLocaleString("da-DK")} kr
                      </TableCell>
                      <TableCell className={commission >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>
                        {commission >= 0 ? "+" : ""}{commission.toLocaleString("da-DK")} kr
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sale.status || 'pending'} />
                      </TableCell>
                      <TableCell>
                        {daysInClawback !== null && (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-warning">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm">{daysInClawback}d</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{daysInClawback} dage tilbage i clawback-vinduet</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Viser {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount || 0)} af {totalCount?.toLocaleString('da-DK')} salg
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
                {/* Show page numbers */}
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
                      variant={currentPage === pageNum ? "default" : "outline"}
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
    </MainLayout>
  );
}
