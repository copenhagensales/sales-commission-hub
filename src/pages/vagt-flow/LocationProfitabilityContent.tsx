import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWeekStartDate, getWeekNumber, getWeekYear } from "@/lib/calculations";
import { VACATION_PAY_RATES } from "@/lib/calculations/vacation-pay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, MapPin,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface Placement {
  id: string;
  name: string;
  daily_rate: number;
  location_id: string;
}

interface BookingInfo {
  id: string;
  placementId: string | null;
  dailyRateOverride: number | null;
}

interface LocationSalesData {
  locationId: string;
  locationName: string;
  clientName: string;
  dailyRate: number;
  bookedDays: number[];
  dailyBreakdown: Record<string, { sales: number; commission: number; revenue: number }>;
  placements: Placement[];
  selectedPlacementId: string | null;
  bookings: BookingInfo[];
}

function formatKr(amount: number) {
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 0 }).format(amount) + " kr";
}

function formatPct(value: number) {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 1 }).format(value) + "%";
}

function TeamBadge({ clientName }: { clientName: string }) {
  const lower = clientName.toLowerCase();
  if (lower.includes("eesy")) {
    return <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-[10px] px-1.5 py-0">Eesy</Badge>;
  }
  if (lower.includes("yousee")) {
    return <Badge className="bg-blue-700 text-white hover:bg-blue-800 text-[10px] px-1.5 py-0">YouSee</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{clientName}</Badge>;
}

interface KpiSectionProps {
  label: string;
  totals: {
    totalRevenue: number;
    totalSellerCost: number;
    totalLocationCost: number;
    totalHotelCost: number;
    totalDietCost: number;
    totalDB: number;
    dbPerDay: number;
  };
}

function KpiCards({ label, totals }: KpiSectionProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-muted-foreground mb-2">{label}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">Omsætning</p>
          <p className="text-lg font-bold">{formatKr(totals.totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">Sælgerløn</p>
          <p className="text-lg font-bold">{formatKr(totals.totalSellerCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">Lokation</p>
          <p className="text-lg font-bold">{formatKr(totals.totalLocationCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">Hotel</p>
          <p className="text-lg font-bold">{formatKr(totals.totalHotelCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">Diæt</p>
          <p className="text-lg font-bold">{formatKr(totals.totalDietCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">DB</p>
          <p className={`text-lg font-bold ${totals.totalDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatKr(totals.totalDB)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">DB/dag</p>
          <div className="flex items-center gap-1">
            <p className={`text-lg font-bold ${totals.dbPerDay >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatKr(totals.dbPerDay)}
            </p>
            {totals.dbPerDay >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

function computeTotals(locations: Array<{ totalRevenue: number; sellerCost: number; locationCost: number; hotelCost: number; dietCost: number; db: number; bookedDays: number[] }>) {
  const totalRevenue = locations.reduce((s, l) => s + l.totalRevenue, 0);
  const totalSellerCost = locations.reduce((s, l) => s + l.sellerCost, 0);
  const totalLocationCost = locations.reduce((s, l) => s + l.locationCost, 0);
  const totalHotelCost = locations.reduce((s, l) => s + l.hotelCost, 0);
  const totalDietCost = locations.reduce((s, l) => s + l.dietCost, 0);
  const totalDB = totalRevenue - totalSellerCost - totalLocationCost - totalHotelCost - totalDietCost;
  const totalDays = locations.reduce((s, l) => s + l.bookedDays.length, 0);
  const dbPerDay = totalDays > 0 ? totalDB / totalDays : 0;
  return { totalRevenue, totalSellerCost, totalLocationCost, totalHotelCost, totalDietCost, totalDB, dbPerDay };
}

export default function LocationProfitabilityContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
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
    setSearchParams({ tab: "okonomi", week: String(newWeek), year: String(newYear) });
  };

  // Fetch bookings with location + client data
  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["location-profitability-bookings", week, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, location_id, booked_days, daily_rate_override, placement_id, start_date, end_date, client_id, client:clients!client_id(name), location!inner(id, name, daily_rate)")
        .eq("week_number", week)
        .eq("year", year);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all placements for locations in the bookings
  const locationIds = useMemo(() => {
    if (!bookings) return [];
    return [...new Set(bookings.map(b => b.location_id))];
  }, [bookings]);

  const bookingIds = useMemo(() => {
    if (!bookings) return [];
    return bookings.map(b => b.id);
  }, [bookings]);

  const { data: placements } = useQuery({
    queryKey: ["location-profitability-placements", locationIds],
    queryFn: async () => {
      if (locationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("location_placements")
        .select("*")
        .in("location_id", locationIds);
      if (error) throw error;
      return (data || []) as Placement[];
    },
    enabled: locationIds.length > 0,
  });

  // Fetch diet data for bookings in this week
  const { data: dietData } = useQuery({
    queryKey: ["location-profitability-diet", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("booking_diet")
        .select("booking_id, date, amount")
        .in("booking_id", bookingIds);
      if (error) throw error;
      return data || [];
    },
    enabled: bookingIds.length > 0,
  });

  // Fetch hotel data for bookings in this week
  const { data: hotelData } = useQuery({
    queryKey: ["location-profitability-hotel", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("booking_hotel")
        .select("booking_id, check_in, check_out, price_per_night, rooms, booked_days")
        .in("booking_id", bookingIds);
      if (error) throw error;
      return data || [];
    },
    enabled: bookingIds.length > 0,
  });

  // Fetch FM sales for the week
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

  // Mutation: update booking placement
  const updatePlacement = useMutation({
    mutationFn: async ({ bookingIds: ids, placementId, dailyRate }: { bookingIds: string[]; placementId: string; dailyRate: number }) => {
      for (const id of ids) {
        const { error } = await supabase
          .from("booking")
          .update({ placement_id: placementId, daily_rate_override: dailyRate })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-profitability-bookings"] });
      toast.success("Placering opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere placering"),
  });

  // Pre-compute hotel cost per booking and per-day distribution
  const hotelCostByBooking = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hotelData || []) {
      const cost = h.price_per_night || 0;
      map.set(h.booking_id, (map.get(h.booking_id) || 0) + cost);
    }
    return map;
  }, [hotelData]);

  const hotelBookedDaysByBooking = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const h of hotelData || []) {
      map.set(h.booking_id, h.booked_days || []);
    }
    return map;
  }, [hotelData]);

  const dietCostByBooking = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dietData || []) {
      map.set(d.booking_id, (map.get(d.booking_id) || 0) + (d.amount || 0));
    }
    return map;
  }, [dietData]);

  const bookingToLocation = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings || []) {
      map.set(b.id, b.location_id);
    }
    return map;
  }, [bookings]);

  const hotelCostByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const [bid, cost] of hotelCostByBooking) {
      const locId = bookingToLocation.get(bid);
      if (locId) map.set(locId, (map.get(locId) || 0) + cost);
    }
    return map;
  }, [hotelCostByBooking, bookingToLocation]);

  const hotelBookedDaysByLocation = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const [bid, days] of hotelBookedDaysByBooking) {
      const locId = bookingToLocation.get(bid);
      if (locId) {
        const existing = map.get(locId) || [];
        const merged = Array.from(new Set([...existing, ...days])).sort();
        map.set(locId, merged);
      }
    }
    return map;
  }, [hotelBookedDaysByBooking, bookingToLocation]);

  const dietCostByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const [bid, cost] of dietCostByBooking) {
      const locId = bookingToLocation.get(bid);
      if (locId) map.set(locId, (map.get(locId) || 0) + cost);
    }
    return map;
  }, [dietCostByBooking, bookingToLocation]);

  // Build location profitability data
  const locationData = useMemo(() => {
    if (!bookings || !salesData) return [];

    const placementsByLocation = new Map<string, Placement[]>();
    for (const p of placements || []) {
      if (!placementsByLocation.has(p.location_id)) placementsByLocation.set(p.location_id, []);
      placementsByLocation.get(p.location_id)!.push(p);
    }

    const locationMap = new Map<string, LocationSalesData>();

    for (const booking of bookings) {
      const loc = booking.location as any;
      const client = (booking as any).client as any;
      const clientName = client?.name || "Ukendt";
      const locId = booking.location_id;
      const locPlacements = placementsByLocation.get(locId) || [];
      const selectedPlacement = locPlacements.find(p => p.id === booking.placement_id);
      const effectiveRate = booking.daily_rate_override ?? selectedPlacement?.daily_rate ?? loc?.daily_rate ?? 0;

      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: locId,
          locationName: loc?.name || "Ukendt",
          clientName,
          dailyRate: effectiveRate,
          bookedDays: booking.booked_days || [],
          dailyBreakdown: {},
          placements: locPlacements,
          selectedPlacementId: booking.placement_id,
          bookings: [{ id: booking.id, placementId: booking.placement_id, dailyRateOverride: booking.daily_rate_override }],
        });
      } else {
        const existing = locationMap.get(locId)!;
        const mergedDays = new Set([...existing.bookedDays, ...(booking.booked_days || [])]);
        existing.bookedDays = Array.from(mergedDays);
        existing.bookings.push({ id: booking.id, placementId: booking.placement_id, dailyRateOverride: booking.daily_rate_override });
        if (booking.daily_rate_override) existing.dailyRate = booking.daily_rate_override;
        if (booking.placement_id) existing.selectedPlacementId = booking.placement_id;
        // Keep the client name from the first booking
      }
    }

    // Map sales to locations
    for (const sale of salesData) {
      const payload = sale.raw_payload as any;
      const locId = payload?.fm_location_id;
      if (!locId) continue;

      const saleDate = format(new Date(sale.sale_datetime), "yyyy-MM-dd");
      const items = (sale as any).sale_items || [];
      let commission = 0, revenue = 0, salesCount = 0;

      for (const item of items) {
        const countsAsSale = item.products?.counts_as_sale !== false;
        commission += item.mapped_commission || 0;
        revenue += item.mapped_revenue || 0;
        if (countsAsSale) salesCount += item.quantity || 1;
      }

      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: locId, locationName: "Ukendt lokation", clientName: "Ukendt", dailyRate: 0,
          bookedDays: [], dailyBreakdown: {}, placements: [], selectedPlacementId: null, bookings: [],
        });
      }

      const l = locationMap.get(locId)!;
      if (!l.dailyBreakdown[saleDate]) l.dailyBreakdown[saleDate] = { sales: 0, commission: 0, revenue: 0 };
      l.dailyBreakdown[saleDate].sales += salesCount;
      l.dailyBreakdown[saleDate].commission += commission;
      l.dailyBreakdown[saleDate].revenue += revenue;
    }

    return Array.from(locationMap.values())
      .map((loc) => {
        const totalRevenue = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.revenue, 0);
        const totalCommission = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.commission, 0);
        const totalSales = Object.values(loc.dailyBreakdown).reduce((s, d) => s + d.sales, 0);
        const sellerCost = totalCommission * (1 + VACATION_PAY_RATES.SELLER);
        const locationCost = loc.dailyRate * loc.bookedDays.length;
        const hotelCost = hotelCostByLocation.get(loc.locationId) || 0;
        const dietCost = dietCostByLocation.get(loc.locationId) || 0;
        const db = totalRevenue - sellerCost - locationCost - hotelCost - dietCost;
        const dbPerDay = loc.bookedDays.length > 0 ? db / loc.bookedDays.length : 0;
        return { ...loc, totalRevenue, totalCommission, totalSales, sellerCost, locationCost, hotelCost, dietCost, db, dbPerDay };
      })
      .sort((a, b) => b.db - a.db);
  }, [bookings, salesData, placements, hotelCostByLocation, dietCostByLocation]);

  // Split by client group
  const { eesyLocations, youseeLocations, otherLocations } = useMemo(() => {
    const eesy: typeof locationData = [];
    const yousee: typeof locationData = [];
    const other: typeof locationData = [];
    for (const loc of locationData) {
      const lower = loc.clientName.toLowerCase();
      if (lower.includes("eesy")) eesy.push(loc);
      else if (lower.includes("yousee")) yousee.push(loc);
      else other.push(loc);
    }
    return { eesyLocations: eesy, youseeLocations: yousee, otherLocations: other };
  }, [locationData]);

  const totalAll = useMemo(() => computeTotals(locationData), [locationData]);
  const totalEesy = useMemo(() => computeTotals(eesyLocations), [eesyLocations]);
  const totalYousee = useMemo(() => computeTotals(youseeLocations), [youseeLocations]);

  const toggleExpand = (locId: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId); else next.add(locId);
      return next;
    });
  };

  const handlePlacementChange = (loc: LocationSalesData & { totalRevenue: number }, placementId: string) => {
    const placement = loc.placements.find(p => p.id === placementId);
    if (!placement || loc.bookings.length === 0) return;
    updatePlacement.mutate({
      bookingIds: loc.bookings.map(b => b.id),
      placementId: placement.id,
      dailyRate: placement.daily_rate,
    });
  };

  const isLoading = loadingBookings || loadingSales;

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const dietByLocationDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dietData || []) {
      const locId = bookingToLocation.get(d.booking_id);
      if (locId) {
        const key = `${locId}|${d.date}`;
        map.set(key, (map.get(key) || 0) + (d.amount || 0));
      }
    }
    return map;
  }, [dietData, bookingToLocation]);

  // Render location rows (reusable for grouped sections)
  const renderLocationRows = (locations: typeof locationData) =>
    locations.map((loc) => {
      const isExpanded = expandedLocations.has(loc.locationId);
      const hasPlacements = loc.placements.length > 0;
      const selectedPlacement = loc.placements.find(p => p.id === loc.selectedPlacementId);

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
                <TeamBadge clientName={loc.clientName} />
              </div>
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              {hasPlacements ? (
                <Select
                  value={loc.selectedPlacementId || ""}
                  onValueChange={(val) => handlePlacementChange(loc, val)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Vælg placering" />
                  </SelectTrigger>
                  <SelectContent>
                    {loc.placements.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({formatKr(p.daily_rate)}/dag)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">–</span>
              )}
            </TableCell>
            <TableCell className="text-right">{loc.bookedDays.length}</TableCell>
            <TableCell className="text-right">{loc.totalSales}</TableCell>
            <TableCell className="text-right">{formatKr(loc.totalRevenue)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.sellerCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.locationCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.hotelCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.dietCost)}</TableCell>
            <TableCell className={`text-right font-semibold ${loc.db >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatKr(loc.db)}
            </TableCell>
            <TableCell className={`text-right pr-6 ${loc.dbPerDay >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatKr(loc.dbPerDay)}
            </TableCell>
          </TableRow>
          {isExpanded && weekDates.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const jsDay = date.getDay();
            const dayNum = jsDay === 0 ? 6 : jsDay - 1;
            const isBooked = loc.bookedDays.includes(dayNum);
            const day = loc.dailyBreakdown[dateStr];
            const dayRevenue = day?.revenue || 0;
            const dayCommission = day?.commission || 0;
            const daySellerCost = dayCommission * (1 + VACATION_PAY_RATES.SELLER);
            const dayLocCost = isBooked ? loc.dailyRate : 0;
            const dayDietCost = dietByLocationDate.get(`${loc.locationId}|${dateStr}`) || 0;
            const hotelDays = hotelBookedDaysByLocation.get(loc.locationId) || [];
            const isHotelDay = hotelDays.includes(dayNum);
            const dayHotelCost = isHotelDay && hotelDays.length > 0 ? (loc.hotelCost / hotelDays.length) : 0;
            const dayDB = dayRevenue - daySellerCost - dayLocCost - dayHotelCost - dayDietCost;

            return (
              <TableRow key={`${loc.locationId}-${dateStr}`} className="bg-muted/30">
                <TableCell className="pl-12 text-muted-foreground text-sm">
                  {format(date, "EEEE d/M", { locale: da })}
                  {!isBooked && <span className="ml-2 text-xs opacity-50">(ikke booket)</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {selectedPlacement?.name || "–"}
                </TableCell>
                <TableCell className="text-right text-sm">{isBooked ? "1" : "–"}</TableCell>
                <TableCell className="text-right text-sm">{day?.sales || 0}</TableCell>
                <TableCell className="text-right text-sm">{formatKr(dayRevenue)}</TableCell>
                <TableCell className="text-right text-sm">{formatKr(daySellerCost)}</TableCell>
                <TableCell className="text-right text-sm">{formatKr(dayLocCost)}</TableCell>
                <TableCell className="text-right text-sm">{formatKr(dayHotelCost)}</TableCell>
                <TableCell className="text-right text-sm">{formatKr(dayDietCost)}</TableCell>
                <TableCell className={`text-right text-sm font-medium ${dayDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {formatKr(dayDB)}
                </TableCell>
                <TableCell className="text-right pr-6 text-sm">
                  {formatKr(dayDB)}
                </TableCell>
              </TableRow>
            );
          })}
        </>
      );
    });

  const renderGroupSubtotal = (label: string, locations: typeof locationData) => {
    const t = computeTotals(locations);
    return (
      <TableRow className="bg-muted/60 font-semibold border-t">
        <TableCell className="pl-6" colSpan={2}>{label} — subtotal</TableCell>
        <TableCell className="text-right">{locations.reduce((s, l) => s + l.bookedDays.length, 0)}</TableCell>
        <TableCell className="text-right">{locations.reduce((s, l) => s + l.totalSales, 0)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalRevenue)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalSellerCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalLocationCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalHotelCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalDietCost)}</TableCell>
        <TableCell className={`text-right ${t.totalDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatKr(t.totalDB)}</TableCell>
        <TableCell className={`text-right pr-6 ${t.dbPerDay >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatKr(t.dbPerDay)}</TableCell>
      </TableRow>
    );
  };

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

      {/* KPI Cards split by client */}
      <div className="space-y-4">
        {eesyLocations.length > 0 && <KpiCards label="Eesy FM" totals={totalEesy} />}
        {youseeLocations.length > 0 && <KpiCards label="YouSee" totals={totalYousee} />}
        <KpiCards label="Samlet" totals={totalAll} />
      </div>

      {/* Location table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Lokationer i uge {week}
            <Badge variant="secondary" className="ml-2">{locationData.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Indlæser...</div>
          ) : locationData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Ingen bookinger i denne uge</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Lokation</TableHead>
                  <TableHead>Placering</TableHead>
                  <TableHead className="text-right">Dage</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Sælgerløn</TableHead>
                  <TableHead className="text-right">Lokation</TableHead>
                  <TableHead className="text-right">Hotel</TableHead>
                  <TableHead className="text-right">Diæt</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="text-right pr-6">DB/dag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Eesy FM group */}
                {eesyLocations.length > 0 && (
                  <>
                    <TableRow className="bg-orange-50 dark:bg-orange-950/20">
                      <TableCell colSpan={11} className="pl-6 py-2 font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-500 text-white hover:bg-orange-600">Eesy FM</Badge>
                          <span className="text-muted-foreground">({eesyLocations.length} lokationer)</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {renderLocationRows(eesyLocations)}
                    {renderGroupSubtotal("Eesy FM", eesyLocations)}
                  </>
                )}

                {/* YouSee group */}
                {youseeLocations.length > 0 && (
                  <>
                    <TableRow className="bg-blue-50 dark:bg-blue-950/20">
                      <TableCell colSpan={11} className="pl-6 py-2 font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-700 text-white hover:bg-blue-800">YouSee</Badge>
                          <span className="text-muted-foreground">({youseeLocations.length} lokationer)</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {renderLocationRows(youseeLocations)}
                    {renderGroupSubtotal("YouSee", youseeLocations)}
                  </>
                )}

                {/* Other group */}
                {otherLocations.length > 0 && (
                  <>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={11} className="pl-6 py-2 font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Øvrige</Badge>
                          <span className="text-muted-foreground">({otherLocations.length} lokationer)</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {renderLocationRows(otherLocations)}
                    {renderGroupSubtotal("Øvrige", otherLocations)}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
