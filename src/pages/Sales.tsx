import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Sales() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncLast24Hours = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-adversus', {
        body: { action: 'sync-sales-to-db', days: 1 }
      });
      if (error) throw error;
      toast.success(`Synkronisering færdig: ${data?.salesCreated || 0} nye salg`);
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
    } catch (error: any) {
      toast.error(`Fejl ved synkronisering: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`*, client_campaigns(name, clients(name)), sale_items(id, adversus_product_title, quantity, mapped_commission, mapped_revenue, needs_mapping, products(name))`)
        .order('sale_datetime', { ascending: false })
        .limit(100);
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <Button onClick={syncLast24Hours} disabled={isSyncing} size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synkroniserer...' : 'Sync sidste 24 timer'}
            </Button>
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
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.map((sale) => {
                    const totalCommission = sale.sale_items?.reduce((sum: number, item: any) => sum + (Number(item.mapped_commission) || 0), 0) || 0;
                    return (
                      <TableRow key={sale.id}>
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
                        <TableCell className="text-right font-medium">{totalCommission.toLocaleString('da-DK')} DKK</TableCell>
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
