import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summaryData, monthlyAverage, forecastFullYear, totalFixedCosts } from "@/data/financialData";

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
    },
    {
      label: "Direkte omkostninger",
      ytd: summaryData.directCosts,
      monthly: monthlyAverage.directCosts,
      forecast: forecastFullYear.directCosts,
    },
    {
      label: "Dækningsbidrag",
      ytd: summaryData.contributionMargin,
      monthly: summaryData.contributionMargin / summaryData.months,
      forecast: (summaryData.contributionMargin / summaryData.months) * 12,
    },
    {
      label: "Lønninger",
      ytd: summaryData.totalSalaries,
      monthly: monthlyAverage.salaries,
      forecast: forecastFullYear.salaries,
    },
    {
      label: "Øvrige faste omkostninger",
      ytd: totalFixedCosts - summaryData.totalSalaries,
      monthly: (totalFixedCosts - summaryData.totalSalaries) / summaryData.months,
      forecast: ((totalFixedCosts - summaryData.totalSalaries) / summaryData.months) * 12,
    },
    {
      label: "Resultat før skat",
      ytd: summaryData.resultBeforeTax,
      monthly: monthlyAverage.result,
      forecast: forecastFullYear.result,
      highlight: true,
    },
  ];

  // Beregn margin
  const marginYtd = (summaryData.resultBeforeTax / summaryData.revenue) * 100;
  const marginForecast = (forecastFullYear.result / forecastFullYear.revenue) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Forecast 2025 (baseret på {summaryData.months} måneder)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead className="text-right">YTD ({summaryData.period})</TableHead>
              <TableHead className="text-right">Gns. pr. måned</TableHead>
              <TableHead className="text-right">Forecast helår</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} className={row.highlight ? "bg-muted/50 font-bold" : ""}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.ytd)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.monthly)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.forecast)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-medium">Overskudsgrad</TableCell>
              <TableCell className="text-right">{marginYtd.toFixed(1)}%</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{marginForecast.toFixed(1)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
