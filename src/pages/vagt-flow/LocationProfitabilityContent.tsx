import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWeekStartDate, getWeekNumber, getWeekYear } from "@/lib/calculations";
import { VACATION_PAY_RATES } from "@/lib/calculations/vacation-pay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, MapPin, DollarSign, BarChart3,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { da } from "date-fns/locale";

interface LocationSalesData {
  locationId: string;
  locationName: string;
  dailyRate: number;
  bookedDays: number[];
  dailyBreakdown: Record<string, { sales: number; commission: number; revenue: number }>;
}

function formatKr(amount: number) {
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 0 }).format(amount) + " kr";
}

function formatPct(value: number) {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 1 }).format(value) + "%";
}

export default function LocationProfitabilityContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = getWeekYear(now);
  const week = parseInt(searchParams.get("week") || String(currentWeek));
  const year = parseInt(searchParams.get("year") || String(currentYear));
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const weekStart = useMemo(() => getWeekStartDate(year, week), [year, week]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const navigateWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    const newWeek = getWeekNumber(d);
    const newYear = getWeekYear(d);
    const params: Record<string, string> = { tab: "okonomi", week: String(newWeek), year: String(newYear) };
    setSearchParams(params);
  };

  // Fetch bookings for the week with location data
  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["location-profitability-bookings", week, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, location_id, booked_days, daily_rate_override, start_date, end_date, location!inner(id, name, daily_rate)")
        .eq("week_number", week)
        .eq("year", year);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch FM sales for the week grouped by location
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["location-profitability-sales", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, raw_payload, sale_items(mapped_commission, mapped_revenue, quantity, product_id, products(counts_as_sale))")
        .gte("sale_datetime", startStr + "T00:00:00")
        .lte("sale_datetime", endStr + "T23:59:59")
        .eq("source", "fieldmarketing")
        .or("validation_status.neq.rejected,validation_status.is.null");
      if (error) throw error;
      return data || [];
    },
  });

  // Build location profitability data
  const locationData = useMemo(() => {
    if (!bookings || !salesData) return [];

    // Group bookings by location
    const locationMap = new Map<string, LocationSalesData>();

    for (const booking of bookings) {
      const loc = booking.location as any;
      const locId = booking.location_id;
      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: locId,
          locationName: loc?.name || "Ukendt",
          dailyRate: booking.daily_rate_override ?? loc?.daily_rate ?? 0,
          bookedDays: booking.booked_days || [],
          dailyBreakdown: {},
        });
      } else {
        // Merge booked days from multiple bookings on same location
        const existing = locationMap.get(locId)!;
        const mergedDays = new Set([...existing.bookedDays, ...(booking.booked_days || [])]);
        existing.bookedDays = Array.from(mergedDays);
        // Use override if present
        if (booking.daily_rate_override) {
          existing.dailyRate = booking.daily_rate_override;
        }
      }
    }

    // Map sales to locations by fm_location_id
    for (const sale of salesData) {
      const payload = sale.raw_payload as any;
      const locId = payload?.fm_location_id;
      if (!locId) continue;

      const saleDate = format(new Date(sale.sale_datetime), "yyyy-MM-dd");
      const items = (sale as any).sale_items || [];

      let commission = 0;
      let revenue = 0;
      let salesCount = 0;

      for (const item of items) {
        const countsAsSale = item.products?.counts_as_sale !== false;
        commission += item.mapped_commission || 0;
        revenue += item.mapped_revenue || 0;
        if (countsAsSale) salesCount += item.quantity || 1;
      }

      // Add to existing location or create entry for orphan sales
      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: locId,
          locationName: "Ukendt lokation",
          dailyRate: 0,
          bookedDays: [],
          dailyBreakdown: {},
        });
      }

      const loc = locationMap.get(locId)!;
      if (!loc.dailyBreakdown[saleDate]) {
        loc.dailyBreakdown[saleDate] = { sales: 0, commission: 0, revenue: 0 };
      }
      loc.dailyBreakdown[saleDate].sales += salesCount;
      loc.dailyBreakdown[saleDate].commission += commission;
      loc.dailyBreakdown[saleDate].revenue += revenue;
    }

    // Calculate totals and sort
    return Array.from(locationMap.values())
      .map((loc) => {
        const totalRevenue = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.revenue, 0);
        const totalCommission = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.commission, 0);
        const totalSales = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.sales, 0);
        const sellerCost = totalCommission * (1 + VACATION_PAY_RATES.SELLER); // +12.5% feriepenge
        const locationCost = loc.dailyRate * loc.bookedDays.length;
        const db = totalRevenue - sellerCost - locationCost;
        const dbPct = totalRevenue > 0 ? (db / totalRevenue) * 100 : 0;

        return { ...loc, totalRevenue, totalCommission, totalSales, sellerCost, locationCost, db, dbPct };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [bookings, salesData]);

  // Totals
  const totals = useMemo(() => {
    const totalRevenue = locationData.reduce((s, l) => s + l.totalRevenue, 0);
    const totalSellerCost = locationData.reduce((s, l) => s + l.sellerCost, 0);
    const totalLocationCost = locationData.reduce((s, l) => s + l.locationCost, 0);
    const totalDB = totalRevenue - totalSellerCost - totalLocationCost;
    const dbPct = totalRevenue > 0 ? (totalDB / totalRevenue) * 100 : 0;
    return { totalRevenue, totalSellerCost, totalLocationCost, totalDB, dbPct, locationCount: locationData.length };
  }, [locationData]);

  const toggleExpand = (locId: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  };

  const isLoading = loadingBookings || loadingSales;

  // Generate array of dates for the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Uge {week}, {year}</h2>
            <p className="text-sm text-muted-foreground">
              {format(weekStart, "d. MMM", { locale: da })} – {format(weekEnd, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Omsætning</p>
            <p className="text-xl font-bold">{formatKr(totals.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Sælgerløn</p>
            <p className="text-xl font-bold">{formatKr(totals.totalSellerCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Lokationsomkostning</p>
            <p className="text-xl font-bold">{formatKr(totals.totalLocationCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Dækningsbidrag</p>
            <p className={`text-xl font-bold ${totals.totalDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatKr(totals.totalDB)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">DB%</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-bold ${totals.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatPct(totals.dbPct)}
              </p>
              {totals.dbPct >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Lokationer i uge {week}
            <Badge variant="secondary" className="ml-2">{totals.locationCount}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Indlæser...</div>
          ) : locationData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Ingen bookinger i denne uge
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Lokation</TableHead>
                  <TableHead className="text-right">Dage</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Sælgerløn</TableHead>
                  <TableHead className="text-right">Lokation</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="text-right pr-6">DB%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationData.map((loc) => {
                  const isExpanded = expandedLocations.has(loc.locationId);
                  return (
                    <>
                      <TableRow
                        key={loc.locationId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(loc.locationId)}
                      >
                        <TableCell className="pl-6 font-medium">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {loc.locationName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{loc.bookedDays.length}</TableCell>
                        <TableCell className="text-right">{loc.totalSales}</TableCell>
                        <TableCell className="text-right">{formatKr(loc.totalRevenue)}</TableCell>
                        <TableCell className="text-right">{formatKr(loc.sellerCost)}</TableCell>
                        <TableCell className="text-right">{formatKr(loc.locationCost)}</TableCell>
                        <TableCell className={`text-right font-semibold ${loc.db >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {formatKr(loc.db)}
                        </TableCell>
                        <TableCell className={`text-right pr-6 ${loc.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {formatPct(loc.dbPct)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && weekDates.map((date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        const dayNum = date.getDay() === 0 ? 7 : date.getDay(); // 1=Mon...7=Sun
                        const isBooked = loc.bookedDays.includes(dayNum);
                        const day = loc.dailyBreakdown[dateStr];
                        const dayRevenue = day?.revenue || 0;
                        const dayCommission = day?.commission || 0;
                        const daySellerCost = dayCommission * (1 + VACATION_PAY_RATES.SELLER);
                        const dayLocCost = isBooked ? loc.dailyRate : 0;
                        const dayDB = dayRevenue - daySellerCost - dayLocCost;

                        return (
                          <TableRow key={`${loc.locationId}-${dateStr}`} className="bg-muted/30">
                            <TableCell className="pl-12 text-muted-foreground text-sm">
                              {format(date, "EEEE d/M", { locale: da })}
                              {!isBooked && <span className="ml-2 text-xs opacity-50">(ikke booket)</span>}
                            </TableCell>
                            <TableCell className="text-right text-sm">{isBooked ? "1" : "–"}</TableCell>
                            <TableCell className="text-right text-sm">{day?.sales || 0}</TableCell>
                            <TableCell className="text-right text-sm">{formatKr(dayRevenue)}</TableCell>
                            <TableCell className="text-right text-sm">{formatKr(daySellerCost)}</TableCell>
                            <TableCell className="text-right text-sm">{formatKr(dayLocCost)}</TableCell>
                            <TableCell className={`text-right text-sm font-medium ${dayDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {formatKr(dayDB)}
                            </TableCell>
                            <TableCell className="text-right pr-6 text-sm">
                              {dayRevenue > 0 ? formatPct((dayDB / dayRevenue) * 100) : "–"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
