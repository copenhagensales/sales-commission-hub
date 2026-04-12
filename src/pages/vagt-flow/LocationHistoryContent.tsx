import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, MapPin, CalendarIcon,
} from "lucide-react";
import { format, startOfMonth, startOfYear, subMonths, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Helpers (same as LocationProfitabilityContent) ──

function formatKr(amount: number) {
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 0 }).format(amount) + " kr";
}

function formatPct(value: number) {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 1 }).format(value) + "%";
}

function TeamBadge({ clientName }: { clientName: string }) {
  const lower = clientName.toLowerCase();
  if (lower.includes("eesy"))
    return <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-[10px] px-1.5 py-0">Eesy</Badge>;
  if (lower.includes("yousee"))
    return <Badge className="bg-blue-700 text-white hover:bg-blue-800 text-[10px] px-1.5 py-0">YouSee</Badge>;
  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{clientName}</Badge>;
}

interface KpiTotals {
  totalRevenue: number;
  totalSellerCost: number;
  totalLocationCost: number;
  totalHotelCost: number;
  totalDietCost: number;
  totalDB: number;
  dbPct: number;
}

function KpiCards({ label, totals }: { label: string; totals: KpiTotals }) {
  return (
    <div>
      <p className="text-sm font-semibold text-muted-foreground mb-2">{label}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { l: "Omsætning", v: totals.totalRevenue },
          { l: "Sælgerløn", v: totals.totalSellerCost },
          { l: "Lokation", v: totals.totalLocationCost },
          { l: "Hotel", v: totals.totalHotelCost },
          { l: "Diæt", v: totals.totalDietCost },
        ].map((c) => (
          <Card key={c.l}><CardContent className="pt-3 pb-2 px-3">
            <p className="text-xs text-muted-foreground">{c.l}</p>
            <p className="text-lg font-bold">{formatKr(c.v)}</p>
          </CardContent></Card>
        ))}
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">DB</p>
          <p className={`text-lg font-bold ${totals.totalDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatKr(totals.totalDB)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3">
          <p className="text-xs text-muted-foreground">DB%</p>
          <div className="flex items-center gap-1">
            <p className={`text-lg font-bold ${totals.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatPct(totals.dbPct)}
            </p>
            {totals.dbPct >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

function computeTotals(locations: Array<{ totalRevenue: number; sellerCost: number; locationCost: number; hotelCost: number; dietCost: number }>) {
  const totalRevenue = locations.reduce((s, l) => s + l.totalRevenue, 0);
  const totalSellerCost = locations.reduce((s, l) => s + l.sellerCost, 0);
  const totalLocationCost = locations.reduce((s, l) => s + l.locationCost, 0);
  const totalHotelCost = locations.reduce((s, l) => s + l.hotelCost, 0);
  const totalDietCost = locations.reduce((s, l) => s + l.dietCost, 0);
  const totalDB = totalRevenue - totalSellerCost - totalLocationCost - totalHotelCost - totalDietCost;
  const dbPct = totalRevenue > 0 ? (totalDB / totalRevenue) * 100 : 0;
  return { totalRevenue, totalSellerCost, totalLocationCost, totalHotelCost, totalDietCost, totalDB, dbPct };
}

// ── Preset periods ──
type PresetKey = "3m" | "ytd" | "last_year" | "all" | "custom";

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "3m": return { from: subMonths(startOfMonth(now), 2), to: now };
    case "ytd": return { from: startOfYear(now), to: now };
    case "last_year": {
      const ly = new Date(now.getFullYear() - 1, 0, 1);
      return { from: ly, to: new Date(now.getFullYear() - 1, 11, 31) };
    }
    case "all": return { from: new Date(2020, 0, 1), to: now };
    default: return { from: subMonths(startOfMonth(now), 2), to: now };
  }
}

// ── Aggregated row type ──
interface AggregatedLocation {
  locationId: string;
  locationName: string;
  clientName: string;
  bookedWeeks: number;
  bookedDaysCount: number;
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  sellerCost: number;
  locationCost: number;
  hotelCost: number;
  dietCost: number;
  db: number;
  dbPct: number;
  weeklyBreakdown: Array<{
    week: number;
    year: number;
    revenue: number;
    sellerCost: number;
    locationCost: number;
    hotelCost: number;
    dietCost: number;
    db: number;
    dbPct: number;
    sales: number;
    days: number;
  }>;
}

export default function LocationHistoryContent() {
  const [preset, setPreset] = useState<PresetKey>("3m");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const { from: rangeFrom, to: rangeTo } = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const startStr = format(rangeFrom, "yyyy-MM-dd");
  const endStr = format(rangeTo, "yyyy-MM-dd");

  // ── Fetch bookings in date range ──
  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["loc-history-bookings", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, location_id, booked_days, daily_rate_override, placement_id, week_number, year, start_date, end_date, client_id, client:clients!client_id(name), location!inner(id, name, daily_rate)")
        .gte("start_date", startStr)
        .lte("end_date", endStr);
      if (error) throw error;
      return data || [];
    },
  });

  const bookingIds = useMemo(() => (bookings || []).map(b => b.id), [bookings]);
  const locationIds = useMemo(() => [...new Set((bookings || []).map(b => b.location_id))], [bookings]);

  // ── Fetch placements ──
  const { data: placements } = useQuery({
    queryKey: ["loc-history-placements", locationIds],
    queryFn: async () => {
      if (!locationIds.length) return [];
      const { data, error } = await supabase.from("location_placements").select("*").in("location_id", locationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: locationIds.length > 0,
  });

  // ── Fetch hotel ──
  const { data: hotelData } = useQuery({
    queryKey: ["loc-history-hotel", bookingIds],
    queryFn: async () => {
      if (!bookingIds.length) return [];
      // Batch in chunks of 200
      const results: any[] = [];
      for (let i = 0; i < bookingIds.length; i += 200) {
        const chunk = bookingIds.slice(i, i + 200);
        const { data, error } = await (supabase as any)
          .from("booking_hotel")
          .select("booking_id, price_per_night, booked_days")
          .in("booking_id", chunk);
        if (error) throw error;
        results.push(...(data || []));
      }
      return results;
    },
    enabled: bookingIds.length > 0,
  });

  // ── Fetch diet ──
  const { data: dietData } = useQuery({
    queryKey: ["loc-history-diet", bookingIds],
    queryFn: async () => {
      if (!bookingIds.length) return [];
      const results: any[] = [];
      for (let i = 0; i < bookingIds.length; i += 200) {
        const chunk = bookingIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("booking_diet")
          .select("booking_id, amount")
          .in("booking_id", chunk);
        if (error) throw error;
        results.push(...(data || []));
      }
      return results;
    },
    enabled: bookingIds.length > 0,
  });

  // ── Fetch FM sales ──
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["loc-history-sales", startStr, endStr],
    queryFn: async () => {
      // Paginate to avoid 1000-row limit
      const all: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("sales")
          .select("id, sale_datetime, raw_payload, sale_items(mapped_commission, mapped_revenue, quantity, product_id, products(counts_as_sale))")
          .gte("sale_datetime", startStr + "T00:00:00")
          .lte("sale_datetime", endStr + "T23:59:59")
          .eq("source", "fieldmarketing")
          .or("validation_status.neq.rejected,validation_status.is.null")
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }
      return all;
    },
  });

  // ── Pre-compute maps ──
  const bookingToLocation = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings || []) map.set(b.id, b.location_id);
    return map;
  }, [bookings]);

  const hotelCostByBooking = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hotelData || []) {
      map.set(h.booking_id, (map.get(h.booking_id) || 0) + (h.price_per_night || 0));
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

  // ── Aggregate by location ──
  const locationData = useMemo((): AggregatedLocation[] => {
    if (!bookings || !salesData) return [];

    const placementMap = new Map<string, any>();
    for (const p of placements || []) placementMap.set(p.id, p);

    // Per location, per week key
    interface WeekBucket {
      week: number; year: number;
      revenue: number; commission: number; sales: number; days: number;
      locationCost: number; hotelCost: number; dietCost: number;
    }

    const locAgg = new Map<string, {
      locationName: string; clientName: string;
      weeks: Map<string, WeekBucket>;
    }>();

    const ensureLoc = (locId: string, name: string, client: string) => {
      if (!locAgg.has(locId)) {
        locAgg.set(locId, { locationName: name, clientName: client, weeks: new Map() });
      }
      return locAgg.get(locId)!;
    };

    const ensureWeek = (weeks: Map<string, WeekBucket>, w: number, y: number) => {
      const key = `${y}-${w}`;
      if (!weeks.has(key)) weeks.set(key, { week: w, year: y, revenue: 0, commission: 0, sales: 0, days: 0, locationCost: 0, hotelCost: 0, dietCost: 0 });
      return weeks.get(key)!;
    };

    // Process bookings
    for (const b of bookings) {
      const loc = b.location as any;
      const client = (b as any).client as any;
      const locEntry = ensureLoc(b.location_id, loc?.name || "Ukendt", client?.name || "Ukendt");
      const wb = ensureWeek(locEntry.weeks, b.week_number, b.year);

      const selectedPlacement = b.placement_id ? placementMap.get(b.placement_id) : null;
      const effectiveRate = b.daily_rate_override ?? selectedPlacement?.daily_rate ?? loc?.daily_rate ?? 0;
      const days = (b.booked_days || []).length;
      wb.days += days;
      wb.locationCost += effectiveRate * days;
      wb.hotelCost += hotelCostByBooking.get(b.id) || 0;
      wb.dietCost += dietCostByBooking.get(b.id) || 0;
    }

    // Process sales
    for (const sale of salesData) {
      const payload = sale.raw_payload as any;
      const locId = payload?.fm_location_id;
      if (!locId) continue;

      const dt = new Date(sale.sale_datetime);
      // Determine ISO week/year — simplistic approach using the booking data
      // Find the booking for this location that contains this date
      const matchingBooking = (bookings || []).find(b => b.location_id === locId && sale.sale_datetime >= b.start_date + "T00:00:00" && sale.sale_datetime <= b.end_date + "T23:59:59");
      const w = matchingBooking?.week_number || getISOWeek(dt);
      const y = matchingBooking?.year || dt.getFullYear();

      const locEntry = ensureLoc(locId, locAgg.get(locId)?.locationName || "Ukendt lokation", locAgg.get(locId)?.clientName || "Ukendt");
      const wb = ensureWeek(locEntry.weeks, w, y);

      const items = (sale as any).sale_items || [];
      for (const item of items) {
        const countsAsSale = item.products?.counts_as_sale !== false;
        wb.commission += item.mapped_commission || 0;
        wb.revenue += item.mapped_revenue || 0;
        if (countsAsSale) wb.sales += item.quantity || 1;
      }
    }

    // Build aggregated rows
    return Array.from(locAgg.entries()).map(([locId, entry]) => {
      let totalRevenue = 0, totalCommission = 0, totalSales = 0, totalDays = 0;
      let totalLocCost = 0, totalHotelCost = 0, totalDietCost = 0;

      const weeklyBreakdown = Array.from(entry.weeks.values())
        .sort((a, b) => a.year - b.year || a.week - b.week)
        .map(wb => {
          const sellerCost = wb.commission * (1 + VACATION_PAY_RATES.SELLER);
          const db = wb.revenue - sellerCost - wb.locationCost - wb.hotelCost - wb.dietCost;
          const dbPct = wb.revenue > 0 ? (db / wb.revenue) * 100 : 0;
          totalRevenue += wb.revenue;
          totalCommission += wb.commission;
          totalSales += wb.sales;
          totalDays += wb.days;
          totalLocCost += wb.locationCost;
          totalHotelCost += wb.hotelCost;
          totalDietCost += wb.dietCost;
          return { ...wb, sellerCost, db, dbPct, days: wb.days };
        });

      const sellerCost = totalCommission * (1 + VACATION_PAY_RATES.SELLER);
      const db = totalRevenue - sellerCost - totalLocCost - totalHotelCost - totalDietCost;
      const dbPct = totalRevenue > 0 ? (db / totalRevenue) * 100 : 0;

      return {
        locationId: locId,
        locationName: entry.locationName,
        clientName: entry.clientName,
        bookedWeeks: entry.weeks.size,
        bookedDaysCount: totalDays,
        totalSales,
        totalRevenue,
        totalCommission,
        sellerCost,
        locationCost: totalLocCost,
        hotelCost: totalHotelCost,
        dietCost: totalDietCost,
        db,
        dbPct,
        weeklyBreakdown,
      };
    }).sort((a, b) => b.db - a.db);
  }, [bookings, salesData, placements, hotelCostByBooking, dietCostByBooking]);

  // ── Split by client ──
  const { eesyLocations, youseeLocations, otherLocations } = useMemo(() => {
    const eesy: AggregatedLocation[] = [], yousee: AggregatedLocation[] = [], other: AggregatedLocation[] = [];
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
    setExpandedLocations(prev => {
      const next = new Set(prev);
      next.has(locId) ? next.delete(locId) : next.add(locId);
      return next;
    });
  };

  const isLoading = loadingBookings || loadingSales;

  // ── Render helpers ──
  const renderLocationRows = (locations: AggregatedLocation[]) =>
    locations.map(loc => {
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
                <TeamBadge clientName={loc.clientName} />
              </div>
            </TableCell>
            <TableCell className="text-right">{loc.bookedWeeks}</TableCell>
            <TableCell className="text-right">{loc.bookedDaysCount}</TableCell>
            <TableCell className="text-right">{loc.totalSales}</TableCell>
            <TableCell className="text-right">{formatKr(loc.totalRevenue)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.sellerCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.locationCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.hotelCost)}</TableCell>
            <TableCell className="text-right">{formatKr(loc.dietCost)}</TableCell>
            <TableCell className={`text-right font-semibold ${loc.db >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatKr(loc.db)}
            </TableCell>
            <TableCell className={`text-right pr-6 ${loc.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatPct(loc.dbPct)}
            </TableCell>
          </TableRow>
          {isExpanded && loc.weeklyBreakdown.map(wb => (
            <TableRow key={`${loc.locationId}-${wb.year}-${wb.week}`} className="bg-muted/30">
              <TableCell className="pl-12 text-muted-foreground text-sm">
                Uge {wb.week}, {wb.year}
              </TableCell>
              <TableCell className="text-right text-sm">1</TableCell>
              <TableCell className="text-right text-sm">{wb.days}</TableCell>
              <TableCell className="text-right text-sm">{wb.sales}</TableCell>
              <TableCell className="text-right text-sm">{formatKr(wb.revenue)}</TableCell>
              <TableCell className="text-right text-sm">{formatKr(wb.sellerCost)}</TableCell>
              <TableCell className="text-right text-sm">{formatKr(wb.locationCost)}</TableCell>
              <TableCell className="text-right text-sm">{formatKr(wb.hotelCost)}</TableCell>
              <TableCell className="text-right text-sm">{formatKr(wb.dietCost)}</TableCell>
              <TableCell className={`text-right text-sm font-medium ${wb.db >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatKr(wb.db)}
              </TableCell>
              <TableCell className={`text-right pr-6 text-sm ${wb.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatPct(wb.dbPct)}
              </TableCell>
            </TableRow>
          ))}
        </>
      );
    });

  const renderGroupSubtotal = (label: string, locations: AggregatedLocation[]) => {
    const t = computeTotals(locations);
    return (
      <TableRow className="bg-muted/60 font-semibold border-t">
        <TableCell className="pl-6" colSpan={2}>{label} — subtotal</TableCell>
        <TableCell className="text-right">{locations.reduce((s, l) => s + l.bookedDaysCount, 0)}</TableCell>
        <TableCell className="text-right">{locations.reduce((s, l) => s + l.totalSales, 0)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalRevenue)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalSellerCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalLocationCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalHotelCost)}</TableCell>
        <TableCell className="text-right">{formatKr(t.totalDietCost)}</TableCell>
        <TableCell className={`text-right ${t.totalDB >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatKr(t.totalDB)}</TableCell>
        <TableCell className={`text-right pr-6 ${t.dbPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatPct(t.dbPct)}</TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vælg periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Seneste 3 mdr</SelectItem>
            <SelectItem value="ytd">År til dato</SelectItem>
            <SelectItem value="last_year">Sidste år</SelectItem>
            <SelectItem value="all">Alt</SelectItem>
            <SelectItem value="custom">Brugerdefineret</SelectItem>
          </SelectContent>
        </Select>

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customFrom ? format(customFrom, "dd/MM/yy") : "Fra"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customTo ? format(customTo, "dd/MM/yy") : "Til"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <span className="text-sm text-muted-foreground">
          {format(rangeFrom, "d. MMM yyyy", { locale: da })} – {format(rangeTo, "d. MMM yyyy", { locale: da })}
        </span>
      </div>

      {/* KPI Cards */}
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
            Historisk lokationsoversigt
            <Badge variant="secondary" className="ml-2">{locationData.length} lokationer</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Indlæser...</div>
          ) : locationData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Ingen bookinger i perioden</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Lokation</TableHead>
                  <TableHead className="text-right">Uger</TableHead>
                  <TableHead className="text-right">Dage</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Sælgerløn</TableHead>
                  <TableHead className="text-right">Lokation</TableHead>
                  <TableHead className="text-right">Hotel</TableHead>
                  <TableHead className="text-right">Diæt</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="text-right pr-6">DB%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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

// Simple ISO week helper
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
