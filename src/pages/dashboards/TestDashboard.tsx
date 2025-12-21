import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TvPreviewOverlay } from "@/components/tv-preview/TvPreviewOverlay";

interface EmployeeSalesData {
  agent_name: string;
  sales_count: number;
  commission: number;
  revenue: number;
}

const TestDashboard = () => {
  const { data: employeeStats, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["test-dashboard-employees"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Get sales per agent with commission and revenue
      const { data, error } = await supabase
        .from("sales")
        .select(`
          agent_name,
          sale_datetime,
          sale_items (
            mapped_commission,
            mapped_revenue
          )
        `)
        .gte("sale_datetime", startOfMonth);

      if (error) throw error;

      // Aggregate by agent
      const agentMap = new Map<string, {
        sales_count: number;
        sales_today: number;
        commission: number;
        revenue: number;
      }>();

      (data || []).forEach((sale: any) => {
        const agentName = sale.agent_name || "Ukendt";
        const existing = agentMap.get(agentName) || { sales_count: 0, sales_today: 0, commission: 0, revenue: 0 };
        
        existing.sales_count++;
        
        // Check if sale is today
        if (sale.sale_datetime >= startOfDay) {
          existing.sales_today++;
        }
        
        // Sum commission and revenue from sale_items
        (sale.sale_items || []).forEach((item: any) => {
          existing.commission += Number(item.mapped_commission) || 0;
          existing.revenue += Number(item.mapped_revenue) || 0;
        });
        
        agentMap.set(agentName, existing);
      });

      // Convert to array and sort by sales count
      const result = Array.from(agentMap.entries())
        .map(([agent_name, stats]) => ({
          agent_name,
          ...stats
        }))
        .sort((a, b) => b.sales_count - a.sales_count);

      return result;
    },
    refetchInterval: 30000,
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("da-DK") : "";
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalSales = employeeStats?.reduce((sum, e) => sum + e.sales_count, 0) || 0;
  const totalToday = employeeStats?.reduce((sum, e) => sum + e.sales_today, 0) || 0;
  const totalCommission = employeeStats?.reduce((sum, e) => sum + e.commission, 0) || 0;
  const totalRevenue = employeeStats?.reduce((sum, e) => sum + e.revenue, 0) || 0;

  const statsContent = (
    <div className="flex items-center gap-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => refetch()}
        disabled={isFetching}
        className="h-8 px-2"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
      {lastUpdated && (
        <span className="text-xs text-muted-foreground">Opdateret: {lastUpdated}</span>
      )}
      <div className="text-right">
        <p className="text-xs text-muted-foreground">I dag</p>
        <p className="text-xl font-bold text-primary">{totalToday}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Måned</p>
        <p className="text-xl font-bold">{totalSales}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Provision</p>
        <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalCommission)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Omsætning</p>
        <p className="text-lg font-bold text-blue-500">{formatCurrency(totalRevenue)}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Test Dashboard"
        subtitle="Medarbejder provision og omsætning"
        rightContent={statsContent}
      />
      
      <TvPreviewOverlay>
        <main className="p-6">
          {isLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {[...Array(12)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-6 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {employeeStats?.map((employee, index) => {
                const medals = ["🥇", "🥈", "🥉"];
                
                return (
                  <Card 
                    key={employee.agent_name} 
                    className="relative overflow-hidden bg-gradient-to-br from-background to-muted/20 border"
                  >
                    {/* Rank indicator for top 3 */}
                    {index < 3 && (
                      <div className="absolute top-2 right-2 text-lg">
                        {medals[index]}
                      </div>
                    )}
                    
                    <CardContent className="p-4 space-y-3">
                      {/* Employee name */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate pr-6">{employee.agent_name}</p>
                          <p className="text-xs text-muted-foreground">#{index + 1}</p>
                        </div>
                      </div>
                      
                      {/* Sales stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background/50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">I dag</p>
                          <p className="text-lg font-bold">{employee.sales_today}</p>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Måned</p>
                          <p className="text-lg font-bold">{employee.sales_count}</p>
                        </div>
                      </div>
                      
                      {/* Commission and Revenue */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Provision</span>
                          <span className="font-semibold text-emerald-500">{formatCurrency(employee.commission)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Omsætning</span>
                          <span className="font-semibold text-blue-500">{formatCurrency(employee.revenue)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && (!employeeStats || employeeStats.length === 0) && (
            <div className="text-center py-12">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium">Ingen salgsdata fundet</h3>
              <p className="text-muted-foreground">Der er ingen salg denne måned endnu.</p>
            </div>
          )}
        </main>
      </TvPreviewOverlay>
    </div>
  );
};

export default TestDashboard;
