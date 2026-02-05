import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { X, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import { cn } from "@/lib/utils";
import { VACATION_PAY_RATES } from "@/lib/calculations";

interface ClientDBDailyBreakdownProps {
  clientId: string;
  clientName: string;
  periodStart: Date;
  periodEnd: Date;
  onClose: () => void;
}

interface DailyData {
  date: Date;
  dateStr: string;
  sales: number;
  revenue: number;
  commission: number;
  sellerSalaryCost: number; // commission + 12.5% vacation
  locationCosts: number;
  db: number;
}

/**
 * Convert JavaScript getDay (0=Sunday) to booked_days format (0=Monday, 6=Sunday)
 */
function getBookedDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function ClientDBDailyBreakdown({
  clientId,
  clientName,
  periodStart,
  periodEnd,
  onClose,
}: ClientDBDailyBreakdownProps) {
  // Fetch sales data grouped by date
  const { data: salesData, isLoading: salesLoading } = useSalesAggregatesExtended({
    periodStart,
    periodEnd,
    clientId,
    groupBy: ["date"],
    enabled: true,
  });

  // Fetch bookings for location costs
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings-for-client-daily", clientId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, start_date, end_date, booked_days, daily_rate_override, location:location_id(daily_rate)")
        .eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
  });

  // Calculate daily location costs from bookings
  const locationCostsByDate = useMemo(() => {
    const costMap = new Map<string, number>();
    
    if (!bookings) return costMap;

    // Get all days in the period
    const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

    for (const day of daysInPeriod) {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayIndex = getBookedDayIndex(day);
      let dailyCost = 0;

      for (const booking of bookings) {
        const bookingStart = parseISO(booking.start_date);
        const bookingEnd = parseISO(booking.end_date);
        const bookedDays = (booking.booked_days as number[]) || [];

        // Check if this day falls within booking range AND matches booked_days
        if (day >= bookingStart && day <= bookingEnd && bookedDays.includes(dayIndex)) {
          const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
          dailyCost += dailyRate;
        }
      }

      if (dailyCost > 0) {
        costMap.set(dateStr, dailyCost);
      }
    }

    return costMap;
  }, [bookings, periodStart, periodEnd]);

  // Build daily data
  const dailyData = useMemo((): DailyData[] => {
    if (!salesData) return [];

    const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });
    const result: DailyData[] = [];

    for (const day of daysInPeriod) {
      const dateStr = format(day, "yyyy-MM-dd");
      const salesForDay = salesData.byDate[dateStr];
      const locationCosts = locationCostsByDate.get(dateStr) || 0;

      // Only include days with sales OR location costs
      if (salesForDay || locationCosts > 0) {
        const sales = salesForDay?.sales || 0;
       const revenue = salesForDay?.revenue || 0;
        const commission = salesForDay?.commission || 0;
        const sellerVacationPay = commission * VACATION_PAY_RATES.SELLER;
        const sellerSalaryCost = commission + sellerVacationPay;
        const db = revenue - sellerSalaryCost - locationCosts;

        result.push({
          date: day,
          dateStr,
          sales,
          revenue,
          commission,
          sellerSalaryCost,
          locationCosts,
          db,
        });
      }
    }

    return result.sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
  }, [salesData, locationCostsByDate, periodStart, periodEnd]);

  // Calculate totals
  const totals = useMemo(() => {
    return dailyData.reduce(
      (acc, day) => ({
        sales: acc.sales + day.sales,
        revenue: acc.revenue + day.revenue,
        sellerSalaryCost: acc.sellerSalaryCost + day.sellerSalaryCost,
        locationCosts: acc.locationCosts + day.locationCosts,
        db: acc.db + day.db,
      }),
      { sales: 0, revenue: 0, sellerSalaryCost: 0, locationCosts: 0, db: 0 }
    );
  }, [dailyData]);

  const isLoading = salesLoading || bookingsLoading;

  // formatCurrency imported from @/lib/calculations

  const formatDate = (date: Date) => {
    const dayName = format(date, "EEEE", { locale: da });
    const dayStr = format(date, "d. MMM", { locale: da });
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dayStr}`;
  };

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">
            Daglig DB: {clientName}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            ({format(periodStart, "d. MMM", { locale: da })} - {format(periodEnd, "d. MMM yyyy", { locale: da })})
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead className="text-right">Salg</TableHead>
                <TableHead className="text-right">Omsætning</TableHead>
                <TableHead className="text-right">Sælgerløn</TableHead>
                <TableHead className="text-right">Centre/Boder</TableHead>
                <TableHead className="text-right">DB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : dailyData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ingen data for denne periode
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {dailyData.map((day) => (
                    <TableRow key={day.dateStr}>
                      <TableCell className="font-medium">
                        {formatDate(day.date)}
                      </TableCell>
                      <TableCell className="text-right">{day.sales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(day.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {day.sellerSalaryCost > 0 ? `-${formatCurrency(day.sellerSalaryCost)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {day.locationCosts > 0 ? `-${formatCurrency(day.locationCosts)}` : "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          day.db >= 0 ? "text-primary" : "text-destructive"
                        )}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {day.db >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatCurrency(day.db)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-medium border-t-2">
                    <TableCell>Samlet</TableCell>
                    <TableCell className="text-right">{totals.sales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatCurrency(totals.sellerSalaryCost)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {totals.locationCosts > 0 ? `-${formatCurrency(totals.locationCosts)}` : "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-bold",
                        totals.db >= 0 ? "text-primary" : "text-destructive"
                      )}
                    >
                      {formatCurrency(totals.db)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Sælgerløn = provision + 12,5% feriepenge. Centre/Boder beregnes fra aktive bookings på den specifikke dato.
        </p>
      </CardContent>
    </Card>
  );
}
