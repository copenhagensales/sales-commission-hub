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

  const chartData = [
    {
      category: "Omsætning",
      "2025": summaryData.revenue,
      "2024": summaryData.revenuePreviousYear,
    },
    {
      category: "Dækningsbidrag",
      "2025": summaryData.contributionMargin,
      "2024": summaryData.contributionMarginPreviousYear,
    },
    {
      category: "Lønninger",
      "2025": summaryData.totalSalaries,
      "2024": summaryData.totalSalariesPreviousYear,
    },
    ...costCategories.map(cat => ({
      category: cat.category.split(" ")[0], // Kort navn
      "2025": cat.total,
      "2024": cat.previousYearTotal,
    })),
    {
      category: "Resultat",
      "2025": summaryData.resultBeforeTax,
      "2024": summaryData.resultBeforeTaxPreviousYear,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">År-over-år sammenligning (Jan-Nov)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis type="category" dataKey="category" width={100} />
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
