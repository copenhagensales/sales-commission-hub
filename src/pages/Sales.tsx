import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ValidationStatus = 'pending' | 'approved' | 'cancelled' | 'rejected' | null;

const getValidationBadge = (status: ValidationStatus) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Godkendt</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Annulleret</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Afvist</Badge>;
    case 'pending':
    default:
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-500/30">Afventer</Badge>;
  }
};

export default function Sales() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const syncLast24Hours = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('adversus-sync-v2', {
        body: { action: 'sync-sales', days: 1 }
      });
      
      if (error) throw error;
      
      toast.success(data.message || "Sincronización de 24h completada");
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      
      supabase.functions.invoke("backfill-opp");
      
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales-list', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`*, client_campaigns(name, clients(name)), sale_items(id, adversus_product_title, quantity, mapped_commission, mapped_revenue, needs_mapping, products(name))`)
        .order('sale_datetime', { ascending: false })
        .limit(100);
      
      // Apply status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          query = query.or('validation_status.is.null,validation_status.eq.pending');
        } else {
          query = query.eq('validation_status', statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sales Overview</h1>
          <p className="text-muted-foreground">View all recorded sales</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle>Recent Sales</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle status</SelectItem>
                  <SelectItem value="pending">Afventer</SelectItem>
                  <SelectItem value="approved">Godkendt</SelectItem>
                  <SelectItem value="cancelled">Annulleret</SelectItem>
                  <SelectItem value="rejected">Afvist</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={syncLast24Hours} disabled={isSyncing} size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Synkroniserer...' : 'Sync sidste 24 timer'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : sales?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No sales yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Validation</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.map((sale) => {
                    const totalCommission = sale.sale_items?.reduce((sum: number, item: any) => {
                      const qty = Number(item.quantity ?? 1) || 1;
                      const commissionPerUnit = Number(item.mapped_commission) || 0;
                      return sum + qty * commissionPerUnit;
                    }, 0) || 0;
                    
                    const isCancelled = sale.validation_status === 'cancelled' || sale.validation_status === 'rejected';
                    
                    return (
                      <TableRow key={sale.id} className={isCancelled ? "opacity-60" : ""}>
                        <TableCell>{format(new Date(sale.sale_datetime), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>{sale.customer_company || '—'}</TableCell>
                        <TableCell>{sale.agent_name || '—'}</TableCell>
                        <TableCell>
                          {sale.sale_items?.map((item: any) => (
                            <Badge key={item.id} variant={item.needs_mapping ? "destructive" : "secondary"} className="mr-1 text-xs">
                              {item.products?.name || item.adversus_product_title}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          {getValidationBadge(sale.validation_status as ValidationStatus)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                          {totalCommission.toLocaleString('da-DK')} DKK
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
