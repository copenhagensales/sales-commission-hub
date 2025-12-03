import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Sales() {
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
          <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
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
