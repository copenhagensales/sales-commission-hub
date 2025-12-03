import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { summaryData, monthlyAverage } from "@/data/financialData";

export function MonthlyTrendChart() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Simuleret månedlig data baseret på YTD gennemsnit
  // I virkeligheden ville vi have faktiske månedstal
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  
  // Kumulativ udvikling over året
  const chartData = months.map((month, index) => {
    const monthNum = index + 1;
    const isActual = monthNum <= summaryData.months;
    
    // Kumulativ omsætning og resultat
    const cumulativeRevenue = isActual 
      ? (summaryData.revenue / summaryData.months) * monthNum
      : null;
    const cumulativeResult = isActual
      ? (summaryData.resultBeforeTax / summaryData.months) * monthNum
      : null;
    const cumulativeCosts = isActual
      ? ((summaryData.revenue - summaryData.resultBeforeTax) / summaryData.months) * monthNum
      : null;
    
    // Forecast for resterende måneder
    const forecastRevenue = !isActual 
      ? (summaryData.revenue / summaryData.months) * monthNum
      : null;
    const forecastResult = !isActual
      ? (summaryData.resultBeforeTax / summaryData.months) * monthNum
      : null;
    
    return {
      month,
      omsætning: cumulativeRevenue,
      resultat: cumulativeResult,
      omkostninger: cumulativeCosts,
      forecastOmsætning: forecastRevenue,
      forecastResultat: forecastResult,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kumulativ udvikling 2025</CardTitle>
        <p className="text-sm text-muted-foreground">
          Faktisk (Jan-Nov) og forecast (Dec) baseret på gennemsnit
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
              />
              <Tooltip 
                formatter={(value: number | null) => value ? formatCurrency(value) : '-'}
              />
              <Legend />
              <ReferenceLine x="Nov" stroke="#888" strokeDasharray="3 3" label="Nu" />
              
              {/* Faktiske linjer */}
              <Line 
                type="monotone" 
                dataKey="omsætning" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Omsætning"
                dot={{ r: 4 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="resultat" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="Resultat"
                dot={{ r: 4 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="omkostninger" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Omkostninger"
                dot={{ r: 4 }}
                connectNulls={false}
              />
              
              {/* Forecast linjer (stiplet) */}
              <Line 
                type="monotone" 
                dataKey="forecastOmsætning" 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Forecast omsætning"
                dot={{ r: 4 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="forecastResultat" 
                stroke="#22c55e" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Forecast resultat"
                dot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
