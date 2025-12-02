import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

interface MonthlyData {
  month: string;
  revenue: number;
  commission: number;
  netMargin: number;
}

export function RevenueChart() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get last 6 months of data
        const months: MonthlyData[] = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);
          
          const monthName = monthStart.toLocaleDateString('da-DK', { month: 'short' });

          // Fetch sales for this month
          const { data: salesData } = await supabase
            .from('sales')
            .select(`
              id,
              status,
              products (revenue_amount)
            `)
            .gte('sale_date', monthStart.toISOString())
            .lte('sale_date', monthEnd.toISOString());

          // Calculate revenue
          let revenue = 0;
          const activeSales = salesData?.filter(s => s.status === 'active' || s.status === 'pending') || [];
          activeSales.forEach(sale => {
            const product = sale.products as any;
            if (product?.revenue_amount) {
              revenue += product.revenue_amount;
            }
          });

          // Fetch commissions for this month
          const { data: commissionData } = await supabase
            .from('commission_transactions')
            .select('type, amount')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString());

          let commission = 0;
          commissionData?.forEach(ct => {
            if (ct.type === 'earn') {
              commission += ct.amount || 0;
            } else if (ct.type === 'clawback') {
              commission -= Math.abs(ct.amount || 0);
            }
          });

          const vacationPay = commission * 0.125;
          const netMargin = revenue - commission - vacationPay;

          months.push({
            month: monthName,
            revenue,
            commission,
            netMargin
          });
        }

        setData(months);
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Omsætning & Margin</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Seneste 6 måneder</p>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="month" 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))'
              }}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString('da-DK')} kr`,
                name === 'revenue' ? 'Omsætning' : name === 'netMargin' ? 'Netto margin' : 'Provision'
              ]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--success))"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="netMargin"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorMargin)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">Omsætning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Netto margin</span>
        </div>
      </div>
    </div>
  );
}
