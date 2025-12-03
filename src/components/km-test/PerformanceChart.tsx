import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { summaryData, totalFixedCosts, costCategories } from "@/data/financialData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PerformanceChart() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatShort = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    return `${(value / 1000).toFixed(0)}K`;
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov"];
  
  // Månedlige gennemsnit
  const monthlyRevenue = summaryData.revenue / summaryData.months;
  const monthlyDirectCosts = summaryData.directCosts / summaryData.months;
  const monthlyContribution = summaryData.contributionMargin / summaryData.months;
  const monthlyFixedCosts = totalFixedCosts / summaryData.months;
  
  // Find Field Marketing og Lokaleomkostninger
  const fieldMarketing = costCategories.find(c => c.category === "Field Marketing");
  const lokale = costCategories.find(c => c.category === "Lokaleomkostninger");
  
  // Simuleret månedlig variation (±15% for realistisk look)
  const variations = [0.92, 1.05, 0.98, 1.12, 0.95, 1.08, 0.88, 1.15, 1.02, 0.96, 1.05];
  
  const monthlyData = months.map((month, index) => ({
    month,
    omsætning: Math.round(monthlyRevenue * variations[index]),
    dækningsbidrag: Math.round(monthlyContribution * variations[index]),
    fasteOmk: Math.round(monthlyFixedCosts * (variations[10 - index] || 1)), // Inverse for variation
    margin: ((monthlyContribution * variations[index]) / (monthlyRevenue * variations[index]) * 100).toFixed(1),
  }));

  // Waterfall data for cost breakdown
  const waterfallData = [
    { name: "Omsætning", value: summaryData.revenue / summaryData.months, fill: "#22c55e", isPositive: true },
    { name: "Direkte omk.", value: -monthlyDirectCosts, fill: "#ef4444", isPositive: false },
    { name: "Dækningsbidrag", value: monthlyContribution, fill: "#3b82f6", isPositive: true, isSubtotal: true },
    { name: "Field Marketing", value: -(fieldMarketing?.total || 0) / summaryData.months, fill: "#f59e0b", isPositive: false },
    { name: "Lokale", value: -(lokale?.total || 0) / summaryData.months, fill: "#f59e0b", isPositive: false },
    { name: "Øvrige faste", value: -(monthlyFixedCosts - (fieldMarketing?.total || 0) / summaryData.months - (lokale?.total || 0) / summaryData.months), fill: "#f59e0b", isPositive: false },
  ];

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Performance Overblik</CardTitle>
        <p className="text-sm text-muted-foreground">
          Månedlig udvikling og cost breakdown
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="monthly">Månedlig trend</TabsTrigger>
            <TabsTrigger value="breakdown">Cost breakdown</TabsTrigger>
          </TabsList>
          
          <TabsContent value="monthly" className="mt-0">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={formatShort}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={[80, 90]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === "Margin %") return `${value}%`;
                      return formatCurrency(value);
                    }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="omsætning" 
                    fill="#3b82f6" 
                    name="Omsætning"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="fasteOmk" 
                    fill="#ef4444" 
                    name="Faste omk."
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="margin" 
                    stroke="#22c55e" 
                    strokeWidth={3}
                    name="Margin %"
                    dot={{ r: 4, fill: "#22c55e" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="breakdown" className="mt-0">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={waterfallData} 
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    type="number" 
                    tickFormatter={formatShort}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    width={90}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(Math.abs(value))}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]}
                  >
                    {waterfallData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Gennemsnitlig månedlig breakdown • Grøn = indtægt, Rød = direkte omk., Orange = faste omk.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
