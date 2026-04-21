import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

interface DailyRevenueChartProps {
  daysBack?: number;
}

export function DailyRevenueChart({ daysBack = 30 }: DailyRevenueChartProps) {
  const today = new Date();
  const startDate = subDays(today, daysBack - 1);
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  // Fetch sales data with revenue
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["daily-revenue-chart", startDateStr, todayStr],
    queryFn: async () => {
      // Get sales for the period with pagination
      let salesData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: salesPage, error } = await supabase
          .from("sales")
          .select(`
            id, 
            sale_datetime, 
            client_campaign_id,
            client_campaigns(client_id, clients(name)),
            dialer_campaign_id
          `)
           .gte("sale_datetime", `${startDateStr}T00:00:00`)
          .lte("sale_datetime", `${todayStr}T23:59:59`)
          .or("validation_status.neq.rejected,validation_status.is.null")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!salesPage || salesPage.length === 0) break;
        salesData = [...salesData, ...salesPage];
        if (salesPage.length < pageSize) break;
        page++;
      }

      // Get sale_items with revenue - batch in chunks
      const saleIds = salesData.map((s) => s.id);
      let saleItems: any[] = [];
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < saleIds.length; i += BATCH_SIZE) {
        const batchIds = saleIds.slice(i, i + BATCH_SIZE);
        const { data: batchItems } = await supabase
          .from("sale_items")
          .select("sale_id, mapped_revenue, product_id")
          .in("sale_id", batchIds);
        if (batchItems) {
          saleItems = [...saleItems, ...batchItems];
        }
      }

      // Get campaign mappings for overrides
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("adversus_campaign_id, id");
      
      const campaignIdToMappingId = new Map<string, string>();
      campaignMappings?.forEach((m) => {
        campaignIdToMappingId.set(m.adversus_campaign_id, m.id);
      });

      // Get product pricing rules (replaces deprecated product_campaign_overrides)
      const { data: productPricingRules } = await supabase
        .from("product_pricing_rules")
        .select("product_id, campaign_mapping_ids, campaign_match_mode, revenue_dkk, priority")
        .eq("is_active", true);
      
      // Sort by priority desc so highest priority wins
      const sortedRules = [...(productPricingRules || [])].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      );

      // Group rules by product_id, preserving priority order, so we can pick
      // the first matching rule per (product, campaign) pair below.
      const rulesByProductId = new Map<
        string,
        Array<{
          campaign_mapping_ids: string[] | null;
          campaign_match_mode: "include" | "exclude";
          revenue: number;
        }>
      >();
      sortedRules.forEach((rule) => {
        if (!rule.product_id) return;
        const list = rulesByProductId.get(rule.product_id) || [];
        list.push({
          campaign_mapping_ids: rule.campaign_mapping_ids,
          campaign_match_mode:
            rule.campaign_match_mode === "exclude" ? "exclude" : "include",
          revenue: rule.revenue_dkk ?? 0,
        });
        rulesByProductId.set(rule.product_id, list);
      });

      const findRevenueOverride = (
        productId: string,
        campaignMappingId: string | null,
      ): number | undefined => {
        const list = rulesByProductId.get(productId);
        if (!list) return undefined;
        for (const rule of list) {
          const ids = rule.campaign_mapping_ids;
          if (!ids || ids.length === 0) return rule.revenue;
          if (rule.campaign_match_mode === "exclude") {
            if (!campaignMappingId || !ids.includes(campaignMappingId)) return rule.revenue;
          } else {
            if (campaignMappingId && ids.includes(campaignMappingId)) return rule.revenue;
          }
        }
        return undefined;
      };

      // Map sale_items to sales
      const saleItemsBySaleId: Record<string, any[]> = {};
      saleItems.forEach((si) => {
        if (!saleItemsBySaleId[si.sale_id]) saleItemsBySaleId[si.sale_id] = [];
        saleItemsBySaleId[si.sale_id].push(si);
      });

      // Calculate revenue per day
      const revenueByDay: Record<string, number> = {};
      
      salesData.forEach((sale) => {
        const saleDate = format(parseISO(sale.sale_datetime), "yyyy-MM-dd");
        const items = saleItemsBySaleId[sale.id] || [];
        const campaignMappingId = sale.dialer_campaign_id 
          ? campaignIdToMappingId.get(sale.dialer_campaign_id) ?? null
          : null;
        
        let saleRevenue = 0;
        items.forEach((item) => {
          const override = findRevenueOverride(item.product_id, campaignMappingId);
          if (override !== undefined) {
            saleRevenue += override;
          } else {
            saleRevenue += Number(item.mapped_revenue) || 0;
          }
        });
        
        revenueByDay[saleDate] = (revenueByDay[saleDate] || 0) + saleRevenue;
      });

      // FM sales revenue is now included in the main query above via sale_items
      // (DB trigger creates sale_items with mapped_revenue for FM sales)

      return revenueByDay;
    },
    refetchInterval: 60000,
  });

  // Build chart data for all days
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: today });
    
    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const revenue = revenueData?.[dateStr] || 0;
      
      return {
        date: dateStr,
        label: format(day, "dd/MM", { locale: da }),
        revenue,
      };
    });
  }, [revenueData, startDate, today]);

  // Calculate total revenue for the period
  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.revenue, 0);
  }, [chartData]);

  // Format number for display
  const formatRevenue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }
    return value.toString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Daglig omsætning (sidste {daysBack} dage)
          </CardTitle>
          <div className="text-right">
            <span className="text-2xl font-bold text-emerald-500">
              {formatRevenue(totalRevenue)} kr
            </span>
            <p className="text-xs text-muted-foreground">Total periode</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatRevenue}
                width={50}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString('da-DK')} kr`, 'Omsætning']}
                labelFormatter={(label) => `Dato: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar 
                dataKey="revenue" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.revenue > 0 ? 'hsl(142 71% 45%)' : 'hsl(var(--muted))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
