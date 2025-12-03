import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { costCategories, monthlyFixedCosts, summaryData } from "@/data/financialData";

export function MonthlyFixedCostsCard() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sorter kategorier efter størrelse
  const sortedCategories = [...costCategories].sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Faste omkostninger pr. måned</CardTitle>
        <p className="text-sm text-muted-foreground">Ekskl. løn • Baseret på {summaryData.months} måneder</p>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary mb-4">
          {formatCurrency(monthlyFixedCosts)}
        </div>
        <Table>
          <TableBody>
            {sortedCategories.map((cat) => (
              <TableRow key={cat.category}>
                <TableCell className="py-2 text-sm">{cat.category}</TableCell>
                <TableCell className="py-2 text-right font-medium">
                  {formatCurrency(cat.total / summaryData.months)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
