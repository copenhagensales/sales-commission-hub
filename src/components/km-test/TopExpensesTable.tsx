import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import type { TopExpense } from "@/hooks/useFinanceSummary";

interface TopExpensesTableProps {
  data: TopExpense[];
}

export function TopExpensesTable({ data }: TopExpensesTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top 10 udgifter</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dato</TableHead>
              <TableHead>Beskrivelse</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Beløb</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Ingen udgifter
                </TableCell>
              </TableRow>
            ) : (
              data.map((expense, index) => (
                <TableRow key={index}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(expense.date), "d. MMM", { locale: da })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {expense.text || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                      {expense.category || 'Ukendt'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
