import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { costCategories, monthlyFixedCosts, summaryData, totalFixedCosts } from "@/data/financialData";
import { cn } from "@/lib/utils";

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
  const maxCategory = sortedCategories[0]?.total || 1;

  const colors = [
    "bg-blue-500",
    "bg-emerald-500", 
    "bg-amber-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-pink-500",
  ];

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Faste omkostninger</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Pr. måned • Ekskl. løn</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(monthlyFixedCosts)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalFixedCosts)} YTD
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedCategories.map((cat, index) => {
          const monthlyAmount = cat.total / summaryData.months;
          const percentage = (cat.total / totalFixedCosts) * 100;
          
          return (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[180px]">
                  {cat.category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}%
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(monthlyAmount)}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", colors[index % colors.length])}
                  style={{ width: `${(cat.total / maxCategory) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
