import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { costCategories, summaryData } from "@/data/financialData";

export function YearComparisonChart() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sorter og vis kun omkostningskategorier
  const sortedCategories = [...costCategories].sort((a, b) => b.total - a.total);

  const chartData = sortedCategories.map(cat => ({
    category: cat.category.length > 15 ? cat.category.substring(0, 15) + '...' : cat.category,
    "2025": cat.total,
    "2024": cat.previousYearTotal,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">År-over-år sammenligning (Jan-Nov)</CardTitle>
        <p className="text-sm text-muted-foreground">Faste omkostninger ekskl. løn</p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="2024" fill="#94a3b8" name="2024" />
              <Bar dataKey="2025" fill="#3b82f6" name="2025" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
