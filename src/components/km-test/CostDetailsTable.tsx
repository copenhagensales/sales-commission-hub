import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { costCategories, salaryDetails } from "@/data/financialData";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function CostDetailsTable() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getChangeIndicator = (actual: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((actual - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 5) return <Minus className="h-4 w-4 text-muted-foreground" />;
    // For costs, increase is bad (red), decrease is good (green)
    return change > 0 ? (
      <TrendingUp className="h-4 w-4 text-red-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-600" />
    );
  };

  const formatChange = (actual: number, previous: number) => {
    if (previous === 0) return "N/A";
    const change = ((actual - previous) / Math.abs(previous)) * 100;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(0)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Omkostningsdetaljer</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {/* Lønninger */}
          <AccordionItem value="salaries">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between w-full pr-4">
                <span className="font-medium">Lønninger</span>
                <span className="text-muted-foreground">{formatCurrency(salaryDetails.reduce((s, i) => s + i.actual, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">2025</TableHead>
                    <TableHead className="text-right">2024</TableHead>
                    <TableHead className="text-right">Ændring</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryDetails.map((item) => (
                    <TableRow key={item.account}>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(item.previousYear)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getChangeIndicator(item.actual, item.previousYear)}
                          <span className={cn(
                            "text-sm",
                            item.actual > item.previousYear ? "text-red-500" : "text-green-600"
                          )}>
                            {formatChange(item.actual, item.previousYear)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          {/* Andre kategorier */}
          {costCategories.map((category) => (
            <AccordionItem key={category.category} value={category.category}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex justify-between w-full pr-4">
                  <span className="font-medium">{category.category}</span>
                  <span className="text-muted-foreground">{formatCurrency(category.total)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead className="text-right">2025</TableHead>
                      <TableHead className="text-right">2024</TableHead>
                      <TableHead className="text-right">Ændring</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.items.map((item) => (
                      <TableRow key={item.account}>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(item.previousYear)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIndicator(item.actual, item.previousYear)}
                            <span className={cn(
                              "text-sm",
                              item.actual > item.previousYear ? "text-red-500" : "text-green-600"
                            )}>
                              {formatChange(item.actual, item.previousYear)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
