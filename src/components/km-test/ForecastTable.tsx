import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summaryData, monthlyAverage, forecastFullYear, totalFixedCosts } from "@/data/financialData";
import { cn } from "@/lib/utils";

export function ForecastTable() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const rows = [
    {
      label: "Omsætning",
      ytd: summaryData.revenue,
      monthly: monthlyAverage.revenue,
      forecast: forecastFullYear.revenue,
      type: "revenue" as const,
    },
    {
      label: "Direkte omkostninger",
      ytd: summaryData.directCosts,
      monthly: monthlyAverage.directCosts,
      forecast: forecastFullYear.directCosts,
      type: "cost" as const,
    },
    {
      label: "Dækningsbidrag",
      ytd: summaryData.contributionMargin,
      monthly: summaryData.contributionMargin / summaryData.months,
      forecast: (summaryData.contributionMargin / summaryData.months) * 12,
      type: "subtotal" as const,
    },
    {
      label: "Faste omkostninger (ekskl. løn)",
      ytd: totalFixedCosts,
      monthly: monthlyAverage.fixedCosts,
      forecast: forecastFullYear.fixedCosts,
      type: "cost" as const,
    },
    {
      label: "Resultat før skat",
      ytd: summaryData.resultBeforeTax,
      monthly: monthlyAverage.result,
      forecast: forecastFullYear.result,
      type: "total" as const,
    },
  ];

  const marginYtd = (summaryData.resultBeforeTax / summaryData.revenue) * 100;
  const marginForecast = (forecastFullYear.result / forecastFullYear.revenue) * 100;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Forecast 2025</CardTitle>
            <p className="text-sm text-muted-foreground">Baseret på {summaryData.months} måneder • Ekskl. løn</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Forventet helårsresultat</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(forecastFullYear.result)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Post</TableHead>
                <TableHead className="text-right">YTD</TableHead>
                <TableHead className="text-right">Pr. måned</TableHead>
                <TableHead className="text-right">Forecast helår</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow 
                  key={row.label} 
                  className={cn(
                    row.type === "total" && "bg-primary/5 font-bold border-t-2",
                    row.type === "subtotal" && "bg-muted/30 font-medium",
                  )}
                >
                  <TableCell className={cn(
                    row.type === "cost" && "text-muted-foreground"
                  )}>
                    {row.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.ytd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.monthly)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.forecast)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t">
                <TableCell className="font-medium text-muted-foreground">Overskudsgrad</TableCell>
                <TableCell className="text-right tabular-nums">{marginYtd.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{marginForecast.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
