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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowUpDown, Calendar, ChevronLeft, ChevronRight, DollarSign, Download, Filter, Loader2, Package, Phone, RefreshCw, Search, User } from "lucide-react";
import { toast } from "sonner";
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
  campaign_name: string | null;
  customer_phone: string | null;
  outcome: string | null;
  agent: { id: string; name: string } | null;
  product: { id: string; name: string; commission_value: number | null; clawback_window_days: number | null; revenue_amount: number | null } | null;
}

const PAGE_SIZE = 50;

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
  
  const lastDash = productName.lastIndexOf(' - ');
  if (lastDash !== -1) {
    return productName.substring(lastDash + 3);
  }
  
  return 'Ukendt';
}

export default function Sales() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortByProduct, setSortByProduct] = useState<'asc' | 'desc' | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: { syncDays: 7 }
      });
      
      if (error) throw error;
      
      toast.success(`Sync fuldført: ${data.salesCreated || 0} nye salg`);
      // Refetch sales data
      window.location.reload();
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Sync fejlede. Prøv igen.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch unique campaigns
  const { data: campaigns } = useQuery({
    queryKey: ['unique-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('campaign_name')
        .not('campaign_name', 'is', null);
      if (error) throw error;
      const unique = [...new Set(data.map(s => s.campaign_name).filter(Boolean))];
      return unique.sort() as string[];
    }
  });

  // Fetch unique customers from products
  const { data: customers } = useQuery({
    queryKey: ['unique-customers-from-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('name');
      if (error) throw error;
      const customerSet = new Set<string>();
      data.forEach(p => customerSet.add(extractCustomer(p.name)));
      return [...customerSet].sort();
    }
  });

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['sales-count', statusFilter, campaignFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('id', { count: 'exact', head: true });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as SaleStatus);
      }
      if (campaignFilter !== 'all') {
        query = query.eq('campaign_name', campaignFilter);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales-with-details', currentPage, statusFilter, campaignFilter, customerFilter, sortByProduct],
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
          campaign_name,
          customer_phone,
          outcome,
          agent:agents!sales_agent_id_fkey(id, name),
          product:products!sales_product_id_fkey(id, name, commission_value, clawback_window_days, revenue_amount)
        `)
        .range(from, to);
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as SaleStatus);
      }
      if (campaignFilter !== 'all') {
        query = query.eq('campaign_name', campaignFilter);
      }
      
      // Apply sorting - default to sale_date desc if no product sort
      if (sortByProduct) {
        query = query.order('product_id', { ascending: sortByProduct === 'asc' });
      } else {
        query = query.order('sale_date', { ascending: false });
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SaleWithDetails[];
    }
  });

  // Client-side search and customer filtering
  const filteredSales = (sales || []).filter(sale => {
    // Customer filter (client-side since it's based on product name)
    if (customerFilter !== 'all') {
      const productCustomer = sale.product?.name ? extractCustomer(sale.product.name) : 'Ukendt';
      if (productCustomer !== customerFilter) return false;
    }
    
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const agentName = sale.agent?.name || '';
    const productName = sale.product?.name || '';
    const campaignName = sale.campaign_name || '';
    const customerPhone = sale.customer_phone || '';
    const outcome = sale.outcome || '';
    return agentName.toLowerCase().includes(searchLower) ||
      productName.toLowerCase().includes(searchLower) ||
      campaignName.toLowerCase().includes(searchLower) ||
      customerPhone.includes(search) ||
      outcome.toLowerCase().includes(searchLower);
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
          <div className="flex gap-2">
            <Button 
              onClick={handleSync} 
              disabled={isSyncing}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synkroniserer...' : 'Sync Adversus'}
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Eksportér
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søg efter agent, produkt, kampagne eller telefon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statusser</SelectItem>
              <SelectItem value="pending">Afventer</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="cancelled">Annulleret</SelectItem>
              <SelectItem value="clawbacked">Modregnet</SelectItem>
            </SelectContent>
          </Select>
          <Select 
            value={campaignFilter} 
            onValueChange={(value) => {
              setCampaignFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Kampagne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kampagner</SelectItem>
              {campaigns?.map(campaign => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={customerFilter} 
            onValueChange={(value) => {
              setCustomerFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kunde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kunder</SelectItem>
              {customers?.map(customer => (
                <SelectItem key={customer} value={customer}>
                  {customer}
                </SelectItem>
              ))}
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
                  <TableHead className="text-muted-foreground">Kunde</TableHead>
                  <TableHead className="text-muted-foreground">Kampagne</TableHead>
                  <TableHead className="text-muted-foreground">Afslutningskode</TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => {
                      setSortByProduct(prev => prev === null ? 'asc' : prev === 'asc' ? 'desc' : null);
                      setCurrentPage(1);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Produkt
                      <ArrowUpDown className={`h-4 w-4 ${sortByProduct ? 'text-primary' : ''}`} />
                    </div>
                  </TableHead>
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
                      onClick={() => setSelectedSale(sale)}
                    >
                      <TableCell className="text-foreground">
                        {sale.sale_date ? (
                          <div className="flex flex-col">
                            <span>{new Date(sale.sale_date).toLocaleDateString("da-DK")}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(sale.sale_date).toLocaleTimeString("da-DK", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {sale.agent?.name || 'Ukendt'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.customer_phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">{sale.customer_phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.campaign_name ? (
                          <span className="text-sm">{sale.campaign_name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.outcome ? (
                          <span className="text-sm font-medium text-primary">{sale.outcome}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.product?.name || 'Ukendt produkt'}
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

        {/* Sale Details Dialog */}
        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Salgsdetaljer
              </DialogTitle>
            </DialogHeader>
            
            {selectedSale && (
              <div className="space-y-6">
                {/* Status & Date */}
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedSale.status || 'pending'} />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{selectedSale.sale_date ? new Date(selectedSale.sale_date).toLocaleDateString("da-DK", { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '-'}</span>
                  </div>
                </div>

                {/* Agent & Customer */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <User className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-wide">Agent</span>
                    </div>
                    <p className="font-semibold text-foreground">{selectedSale.agent?.name || 'Ukendt'}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Phone className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-wide">Kunde</span>
                    </div>
                    <p className="font-semibold text-foreground font-mono">
                      {selectedSale.customer_phone || '-'}
                    </p>
                  </div>
                </div>

                {/* Product & Campaign */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Produkt</span>
                    <span className="font-medium text-foreground">{selectedSale.product?.name || 'Ukendt'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Kampagne</span>
                    <span className="font-medium text-foreground">{selectedSale.campaign_name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Afslutningskode</span>
                    <span className="font-medium text-primary">{selectedSale.outcome || '-'}</span>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">Økonomi</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Omsætning</span>
                    <span className="font-semibold text-success">
                      +{(selectedSale.product?.revenue_amount || 0).toLocaleString('da-DK')} kr
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provision</span>
                    <span className={`font-semibold ${getCommissionDisplay(selectedSale) >= 0 ? 'text-foreground' : 'text-danger'}`}>
                      {getCommissionDisplay(selectedSale) >= 0 ? '+' : ''}{getCommissionDisplay(selectedSale).toLocaleString('da-DK')} kr
                    </span>
                  </div>
                  {selectedSale.product?.clawback_window_days && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Clawback vindue</span>
                      <span className="text-foreground">{selectedSale.product.clawback_window_days} dage</span>
                    </div>
                  )}
                  {calculateDaysInClawback(selectedSale) !== null && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-warning flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Dage tilbage i clawback
                      </span>
                      <span className="font-semibold text-warning">{calculateDaysInClawback(selectedSale)} dage</span>
                    </div>
                  )}
                </div>

                {/* Sale ID */}
                <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                  ID: {selectedSale.id}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
