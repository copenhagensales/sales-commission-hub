import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downloadExcelAoa } from "@/utils/excel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { FileText, Check, Percent, MapPin, AlertTriangle, TrendingUp, Download, Send } from "lucide-react";
import { SendToSupplierDialog } from "./SendToSupplierDialog";
import { format, startOfMonth, endOfMonth, differenceInDays, getISOWeek, startOfWeek, max as maxDate, min as minDate } from "date-fns";
import { da } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { toast } from "sonner";
import { downloadSupplierReportPdf } from "@/utils/supplierReportPdfGenerator";

interface DiscountRule {
  id: string;
  location_type: string;
  min_placements: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
  discount_type: string;
  min_revenue: number | null;
  min_days_per_location: number;
}

interface LocationException {
  id: string;
  location_type: string;
  location_name: string;
  exception_type: string;
  max_discount_percent: number | null;
  is_active: boolean;
}

export function SupplierReportTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [selectedLocationType, setSelectedLocationType] = useState<string>("");
  const [periodType, setPeriodType] = useState<"month" | "payroll">("month");
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const monthDate = new Date(selectedMonth + "-01");
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthStart);

  // Calculate period dates based on periodType
  const periodStart = periodType === "payroll"
    ? new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 15)
    : monthStart;
  const periodEnd = periodType === "payroll"
    ? new Date(monthDate.getFullYear(), monthDate.getMonth(), 14, 23, 59, 59, 999)
    : monthEnd;
  const yearStart = periodType === "payroll"
    ? new Date(monthDate.getFullYear(), 0, 15)
    : new Date(monthDate.getFullYear(), 0, 1);

  // Period label for display and PDF
  const periodLabel = periodType === "payroll"
    ? `Lønperiode ${format(monthDate, "MMMM yyyy", { locale: da })}`
    : format(monthDate, "MMMM yyyy", { locale: da });

  // Generate month options
  const monthOptions = [];
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: da }),
    });
  }

  // Fetch distinct location types
  const { data: locationTypes } = useQuery({
    queryKey: ["location-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("type")
        .not("type", "is", null);
      if (error) throw error;
      const types = [...new Set(data.map((l: any) => l.type).filter(Boolean))];
      return types as string[];
    },
  });

  // Fetch bookings for selected type and month
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["supplier-report-bookings", selectedMonth, selectedLocationType, periodType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type, external_id),
          clients(id, name)
        `)
        .eq("status", "confirmed")
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .gte("end_date", format(periodStart, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return data.filter((b: any) => b.location?.type === selectedLocationType);
    },
    enabled: !!selectedLocationType,
  });

  // Fetch YTD bookings for annual_revenue calculation
  const { data: ytdBookings } = useQuery({
    queryKey: ["supplier-ytd-bookings", selectedMonth, selectedLocationType, periodType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type, external_id)
        `)
        .eq("status", "confirmed")
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .gte("end_date", format(yearStart, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return data.filter((b: any) => b.location?.type === selectedLocationType);
    },
    enabled: !!selectedLocationType,
  });

  // Fetch discount rules for selected type
  const { data: discountRules } = useQuery({
    queryKey: ["supplier-discount-rules", selectedLocationType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("supplier_discount_rules")
        .select("*")
        .eq("location_type", selectedLocationType)
        .eq("is_active", true)
        .order("min_placements", { ascending: false });
      if (error) throw error;
      return data as DiscountRule[];
    },
    enabled: !!selectedLocationType,
  });

  // Fetch location exceptions
  const { data: locationExceptions } = useQuery({
    queryKey: ["supplier-location-exceptions", selectedLocationType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("supplier_location_exceptions")
        .select("*")
        .eq("location_type", selectedLocationType)
        .eq("is_active", true);
      if (error) throw error;
      return data as LocationException[];
    },
    enabled: !!selectedLocationType,
  });

  // Fetch existing report for this period + type
  const { data: existingReport } = useQuery({
    queryKey: ["supplier-report", selectedMonth, selectedLocationType, periodType],
    queryFn: async () => {
      if (!selectedLocationType) return null;
      const { data, error } = await supabase
        .from("supplier_invoice_reports")
        .select("*")
        .eq("location_type", selectedLocationType)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLocationType,
  });

  // Determine discount type
  const discountType = discountRules?.[0]?.discount_type || "placements";

  // Count actual booked days using booked_days array, clipped to a period
  const countBookedDays = (booking: any, clipStart?: Date, clipEnd?: Date): number => {
    const bookedDays = booking.booked_days as number[] | null;
    const bookStart = new Date(booking.start_date);
    const bookEnd = new Date(booking.end_date);
    const start = clipStart ? maxDate([bookStart, clipStart]) : bookStart;
    const end = clipEnd ? minDate([bookEnd, clipEnd]) : bookEnd;
    if (start > end) return 0;
    if (!bookedDays || bookedDays.length === 0) {
      return differenceInDays(end, start) + 1;
    }
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
      if (bookedDays.includes(isoDay)) count++;
    }
    return count || 0;
  };

  // Count total (unclipped) booked days for proration
  const countTotalBookedDays = (booking: any): number => {
    return countBookedDays(booking);
  };

  // Helper to calculate booking total, clipped to the reporting period
  const calcBookingTotal = (booking: any, clipStart?: Date, clipEnd?: Date) => {
    const clippedDays = countBookedDays(booking, clipStart, clipEnd);
    if (booking.total_price != null) {
      const totalDays = countTotalBookedDays(booking);
      const ratio = totalDays > 0 ? clippedDays / totalDays : 1;
      const proratedTotal = booking.total_price * ratio;
      return { total: proratedTotal, days: clippedDays, dailyRate: clippedDays > 0 ? proratedTotal / clippedDays : booking.total_price, usesTotalPrice: true };
    }
    const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
    return { total: dailyRate * clippedDays, days: clippedDays, dailyRate, usesTotalPrice: false };
  };

  // Get booked weekdays grouped by ISO week, clipped to period
  const getBookedWeekdays = (booking: any, clipStart?: Date, clipEnd?: Date): Map<number, Set<number>> => {
    const weeks = new Map<number, Set<number>>();
    const bookedDays = booking.booked_days as number[] | null;
    const bookStart = new Date(booking.start_date);
    const bookEnd = new Date(booking.end_date);
    const start = clipStart ? maxDate([bookStart, clipStart]) : bookStart;
    const end = clipEnd ? minDate([bookEnd, clipEnd]) : bookEnd;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
      if (!bookedDays || bookedDays.length === 0 || bookedDays.includes(isoDay)) {
        const week = getISOWeek(d);
        if (!weeks.has(week)) weeks.set(week, new Set());
        weeks.get(week)!.add(isoDay);
      }
    }
    return weeks;
  };

  // Count consecutive-day placements clipped to period
  const countConsecutivePlacements = (bookings: any[], minDays: number, clipStart?: Date, clipEnd?: Date): number => {
    const dateSet = new Set<string>();
    for (const booking of bookings) {
      const bookedDays = booking.booked_days as number[] | null;
      const bookStart = new Date(booking.start_date);
      const bookEnd = new Date(booking.end_date);
      const start = clipStart ? maxDate([bookStart, clipStart]) : bookStart;
      const end = clipEnd ? minDate([bookEnd, clipEnd]) : bookEnd;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
        if (!bookedDays || bookedDays.length === 0 || bookedDays.includes(isoDay)) {
          dateSet.add(d.toISOString().slice(0, 10));
        }
      }
    }
    const sorted = [...dateSet].sort();
    if (sorted.length === 0) return 0;
    let placements = 0;
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      if (curr.getTime() - prev.getTime() === 86400000) {
        streak++;
      } else {
        if (streak >= minDays) placements++;
        streak = 1;
      }
    }
    if (streak >= minDays) placements++;
    return placements;
  };

  // Count discount placements using week-start attribution:
  // A full booked week counts as a placement in the month where the week STARTS (Monday).
  // This prevents double-counting weeks that span month boundaries.
  const countDiscountPlacementsWeekBased = (
    allBookingsByLoc: Record<string, any[]>,
    minDays: number,
    targetPeriodStart: Date,
    targetPeriodEnd: Date
  ): number => {
    const targetMonth = targetPeriodStart.getMonth();
    const targetYear = targetPeriodStart.getFullYear();
    let totalPlacements = 0;

    for (const locBookings of Object.values(allBookingsByLoc)) {
      // Collect ALL booked dates for this location (unclipped) to find full weeks
      const dateSet = new Set<string>();
      for (const booking of locBookings) {
        const bookedDays = booking.booked_days as number[] | null;
        const s = new Date(booking.start_date);
        const e = new Date(booking.end_date);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
          if (!bookedDays || bookedDays.length === 0 || bookedDays.includes(isoDay)) {
            dateSet.add(d.toISOString().slice(0, 10));
          }
        }
      }

      // Group dates by ISO week and check consecutive streaks within each week
      const sorted = [...dateSet].sort();
      if (sorted.length === 0) continue;

      // Find consecutive sequences of ≥ minDays
      let streakDates: string[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        if (curr.getTime() - prev.getTime() === 86400000) {
          streakDates.push(sorted[i]);
        } else {
          if (streakDates.length >= minDays) {
            // Attribute this placement to the month where the streak's Monday falls
            const streakStart = new Date(streakDates[0]);
            const weekMonday = startOfWeek(streakStart, { weekStartsOn: 1 });
            if (weekMonday.getMonth() === targetMonth && weekMonday.getFullYear() === targetYear) {
              totalPlacements++;
            }
          }
          streakDates = [sorted[i]];
        }
      }
      if (streakDates.length >= minDays) {
        const streakStart = new Date(streakDates[0]);
        const weekMonday = startOfWeek(streakStart, { weekStartsOn: 1 });
        if (weekMonday.getMonth() === targetMonth && weekMonday.getFullYear() === targetYear) {
          totalPlacements++;
        }
      }
    }

    return totalPlacements;
  };

  // Build exception lookup
  const exceptionMap = new Map<string, LocationException>();
  locationExceptions?.forEach((exc) => {
    exceptionMap.set(exc.location_name.toLowerCase(), exc);
  });

  const WEEKDAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  // Group bookings by location, clipped to current period
  const bookingsByLocation = bookings?.reduce((acc: any, booking: any) => {
    const locationId = booking.location_id;
    const { total, days, dailyRate, usesTotalPrice } = calcBookingTotal(booking, periodStart, periodEnd);

    if (days === 0) return acc; // Skip bookings with no days in period

    if (!acc[locationId]) {
      acc[locationId] = {
        location: booking.location,
        client: booking.clients,
        bookings: [],
        totalDays: 0,
        totalAmount: 0,
        dailyRate,
        usesTotalPrice,
        minDate: booking.start_date,
        maxDate: booking.end_date,
        weekdaysByWeek: new Map<number, Set<number>>(),
      };
    }

    acc[locationId].bookings.push(booking);
    acc[locationId].totalDays += days;
    acc[locationId].totalAmount += total;

    // Merge weekdays (clipped to period)
    const bWeeks = getBookedWeekdays(booking, periodStart, periodEnd);
    bWeeks.forEach((days_set, week) => {
      if (!acc[locationId].weekdaysByWeek.has(week)) {
        acc[locationId].weekdaysByWeek.set(week, new Set<number>());
      }
      days_set.forEach((d: number) => acc[locationId].weekdaysByWeek.get(week)!.add(d));
    });

    if (booking.start_date < acc[locationId].minDate) acc[locationId].minDate = booking.start_date;
    if (booking.end_date > acc[locationId].maxDate) acc[locationId].maxDate = booking.end_date;

    return acc;
  }, {} as Record<string, any>) || {};

  const locationEntries = Object.values(bookingsByLocation) as any[];
  const minDaysPerLocation = discountRules?.[0]?.min_days_per_location ?? 1;

  // Discount placements: use week-start-based attribution
  // Group all bookings by location_id for discount calculation
  const allBookingsByLocForDiscount: Record<string, any[]> = {};
  bookings?.forEach((b: any) => {
    const lid = b.location_id;
    if (!allBookingsByLocForDiscount[lid]) allBookingsByLocForDiscount[lid] = [];
    allBookingsByLocForDiscount[lid].push(b);
  });
  const totalPlacements = countDiscountPlacementsWeekBased(
    allBookingsByLocForDiscount,
    minDaysPerLocation,
    periodStart,
    periodEnd
  );

  // Calculate YTD revenue (for annual_revenue type), clipped per booking to YTD period
  const ytdRevenue = ytdBookings?.reduce((sum, booking: any) => {
    const { total } = calcBookingTotal(booking, yearStart, periodEnd);
    const locName = booking.location?.name?.toLowerCase() || "";
    const exc = exceptionMap.get(locName);
    if (exc?.exception_type === "excluded") return sum;
    return sum + total;
  }, 0) || 0;

  // Calculate total for current month (non-excluded)
  const totalAmountNonExcluded = locationEntries.reduce((sum, loc) => {
    const locName = loc.location?.name?.toLowerCase() || "";
    const exc = exceptionMap.get(locName);
    if (exc?.exception_type === "excluded") return sum;
    return sum + loc.totalAmount;
  }, 0);

  const totalAmountAll = locationEntries.reduce((sum, loc) => sum + loc.totalAmount, 0);

  // Calculate discount based on type
  let appliedDiscount = 0;
  let appliedRule: DiscountRule | null = null;

  if (discountRules && discountRules.length > 0) {
    if (discountType === "monthly_revenue") {
      // Monthly revenue: use current period's total non-excluded amount
      const sortedRules = [...discountRules].sort((a, b) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
      for (const rule of sortedRules) {
        if (totalAmountNonExcluded >= (rule.min_revenue ?? 0)) {
          appliedDiscount = Number(rule.discount_percent);
          appliedRule = rule;
          break;
        }
      }
    } else if (discountType === "annual_revenue") {
      // Sort by min_revenue desc for staircase lookup
      const sortedRules = [...discountRules].sort((a, b) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
      for (const rule of sortedRules) {
        if (ytdRevenue >= (rule.min_revenue ?? 0)) {
          appliedDiscount = Number(rule.discount_percent);
          appliedRule = rule;
          break;
        }
      }
    } else {
      // Placement-based (existing logic)
      for (const rule of discountRules) {
        if (totalPlacements >= rule.min_placements) {
          appliedDiscount = Number(rule.discount_percent);
          appliedRule = rule;
          break;
        }
      }
    }
  }

  // Calculate per-location discounts respecting exceptions
  let totalDiscountAmount = 0;
  const locationDiscounts = locationEntries.map((loc: any) => {
    const locName = loc.location?.name?.toLowerCase() || "";
    const exc = exceptionMap.get(locName);

    if (exc?.exception_type === "excluded") {
      return { ...loc, discount: 0, discountAmount: 0, finalAmount: loc.totalAmount, isExcluded: true, maxDiscount: null };
    }

    let effectiveDiscount = appliedDiscount;
    if (exc?.exception_type === "max_discount" && exc.max_discount_percent != null) {
      effectiveDiscount = Math.min(appliedDiscount, Number(exc.max_discount_percent));
    }

    const discountAmount = loc.totalAmount * (effectiveDiscount / 100);
    totalDiscountAmount += discountAmount;

    return {
      ...loc,
      discount: effectiveDiscount,
      discountAmount,
      finalAmount: loc.totalAmount - discountAmount,
      isExcluded: false,
      maxDiscount: exc?.max_discount_percent ?? null,
    };
  });

  const finalAmount = totalAmountAll - totalDiscountAmount;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const reportData = locationDiscounts.map((loc) => ({
        locationName: loc.location?.name,
        externalId: loc.location?.external_id || "",
        city: loc.location?.address_city,
        client: loc.client?.name,
        days: loc.totalDays,
        dailyRate: loc.dailyRate,
        amount: loc.totalAmount,
        discount: loc.discount,
        discountAmount: loc.discountAmount,
        finalAmount: loc.finalAmount,
        isExcluded: loc.isExcluded,
        minDate: loc.minDate,
        maxDate: loc.maxDate,
      }));

      const { data: userData } = await supabase.auth.getUser();

      const payload = {
        location_type: selectedLocationType,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        total_amount: totalAmountAll,
        discount_percent: appliedDiscount,
        discount_amount: totalDiscountAmount,
        final_amount: finalAmount,
        unique_locations: totalPlacements,
        status: "approved",
        approved_by: userData.user?.id,
        approved_at: new Date().toISOString(),
        report_data: reportData,
      };

      if (existingReport) {
        const { error } = await supabase
          .from("supplier_invoice_reports")
          .update(payload)
          .eq("id", existingReport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_invoice_reports")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rapport godkendt!");
      queryClient.invalidateQueries({ queryKey: ["supplier-report"] });
    },
    onError: (err: any) => {
      toast.error("Fejl ved godkendelse: " + err.message);
    },
  });

  const isApproved = existingReport?.status === "approved";

  const formatDateRange = (minDate: string, maxDate: string) => {
    return `${format(new Date(minDate), "dd/MM")} - ${format(new Date(maxDate), "dd/MM")}`;
  };

  // Build staircase visualization for revenue-based types
  const staircaseSteps = (discountType === "annual_revenue" || discountType === "monthly_revenue") && discountRules
    ? [...discountRules].sort((a, b) => (a.min_revenue ?? 0) - (b.min_revenue ?? 0))
    : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={selectedLocationType} onValueChange={setSelectedLocationType}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Vælg leverandør/type" />
          </SelectTrigger>
          <SelectContent>
            {locationTypes?.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as "month" | "payroll")}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="payroll">Lønperiode (15.–14.)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isApproved && (
          <Badge variant="default" className="ml-auto bg-green-600">
            <Check className="h-3 w-3 mr-1" /> Godkendt
          </Badge>
        )}
      </div>

      {!selectedLocationType ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Vælg en leverandør/lokationstype for at generere rapport</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground text-center py-8">Indlæser...</p>
      ) : locationEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ingen bookinger fundet for {selectedLocationType} i den valgte periode
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Report table */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  Leverandørrapport: {selectedLocationType}
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lokation</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Uger & Dage</TableHead>
                     <TableHead className="text-right">Bookinger</TableHead>
                     <TableHead className="text-right">Dage</TableHead>
                     <TableHead className="text-right">Dagspris</TableHead>
                    <TableHead className="text-right">Beløb</TableHead>
                    {discountRules && discountRules.length > 0 && (
                      <>
                        <TableHead className="text-right">Rabat</TableHead>
                        <TableHead className="text-right">Efter rabat</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationDiscounts.map((loc: any) => (
                    <TableRow key={loc.location?.id} className={loc.isExcluded ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {loc.location?.name}
                          {loc.isExcluded && (
                            <Badge variant="destructive" className="text-xs">Udelukket</Badge>
                          )}
                          {loc.maxDiscount != null && !loc.isExcluded && (
                            <Badge variant="outline" className="text-xs">Max {loc.maxDiscount}%</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{loc.location?.external_id || "-"}</TableCell>
                      <TableCell>{loc.location?.address_city || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{loc.client?.name || "Ukendt"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {[...(loc.weekdaysByWeek as Map<number, Set<number>>).entries()]
                            .sort(([a], [b]) => a - b)
                            .map(([week, daysSet]) => {
                              const sorted = [...daysSet].sort((a, b) => a - b);
                              const isFullWeek = [0, 1, 2, 3, 4].every(d => daysSet.has(d));
                              return (
                                <div key={week} className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Uge {week}</span>
                                  {isFullWeek ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Man–Fre</Badge>
                                  ) : (
                                    sorted.map(d => (
                                      <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">{WEEKDAY_NAMES[d]}</Badge>
                                    ))
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </TableCell>
                       <TableCell className="text-right">{loc.bookings.length}</TableCell>
                       <TableCell className="text-right">{loc.totalDays}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {loc.usesTotalPrice ? (
                          <span className="italic">samlet</span>
                        ) : (
                          `${loc.dailyRate.toLocaleString("da-DK")} kr`
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {loc.totalAmount.toLocaleString("da-DK")} kr
                      </TableCell>
                      {discountRules && discountRules.length > 0 && (
                        <>
                          <TableCell className="text-right">
                            {loc.isExcluded ? (
                              <span className="text-xs text-muted-foreground italic">Separat</span>
                            ) : (
                              <span className="text-green-600">-{loc.discount}%</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {loc.isExcluded ? "-" : `${loc.finalAmount.toLocaleString("da-DK")} kr`}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8} className="font-semibold">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {totalAmountAll.toLocaleString("da-DK")} kr
                    </TableCell>
                    {discountRules && discountRules.length > 0 && (
                      <>
                        <TableCell className="text-right font-bold text-green-600">
                          -{totalDiscountAmount.toLocaleString("da-DK")} kr
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {finalAmount.toLocaleString("da-DK")} kr
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Discount section - only show when discount rules exist */}
          {discountRules && discountRules.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Rabatberegning</h2>
              </div>

              {discountType === "monthly_revenue" ? (
                <div className="space-y-4">
                  {/* Monthly revenue overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Månedsomsætning (denne periode)</p>
                      <p className="text-2xl font-bold">{totalAmountNonExcluded.toLocaleString("da-DK")} kr</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rabattrin</p>
                      <p className="text-2xl font-bold">
                        {appliedDiscount > 0 ? `${appliedDiscount}%` : "Ingen"}
                      </p>
                      {appliedRule && (
                        <p className="text-xs text-muted-foreground">{appliedRule.description}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rabatbeløb</p>
                      <p className="text-2xl font-bold text-green-600">
                        -{totalDiscountAmount.toLocaleString("da-DK")} kr
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total efter rabat</p>
                      <p className="text-2xl font-bold">{finalAmount.toLocaleString("da-DK")} kr</p>
                    </div>
                  </div>

                  {/* Staircase visualization */}
                  {discountRules && discountRules.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-2">Rabattrappe</h3>
                      <div className="space-y-2">
                        {[...discountRules]
                          .sort((a, b) => (a.min_revenue ?? 0) - (b.min_revenue ?? 0))
                          .map((rule) => (
                            <div
                              key={rule.id}
                              className={`flex items-center justify-between p-2 rounded ${
                                appliedRule?.id === rule.id
                                  ? "bg-primary/10 border border-primary"
                                  : "bg-muted/50"
                              }`}
                            >
                              <span className="text-sm">
                                {rule.description || `Fra ${(rule.min_revenue ?? 0).toLocaleString("da-DK")} kr`}
                              </span>
                              <span className="font-semibold">{rule.discount_percent}%</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : discountType === "annual_revenue" ? (
                <div className="space-y-4">
                  {/* Annual revenue overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Kumulativ årsomsætning</p>
                      <p className="text-2xl font-bold">{ytdRevenue.toLocaleString("da-DK")} kr</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rabattrin</p>
                      <p className="text-2xl font-bold">
                        {appliedDiscount > 0 ? `${appliedDiscount}%` : "Ingen"}
                      </p>
                      {appliedRule && (
                        <p className="text-xs text-muted-foreground">{appliedRule.description}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rabatbeløb</p>
                      <p className="text-2xl font-bold text-green-600">
                        -{totalDiscountAmount.toLocaleString("da-DK")} kr
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total efter rabat</p>
                      <p className="text-2xl font-bold">{finalAmount.toLocaleString("da-DK")} kr</p>
                    </div>
                  </div>

                  {/* Staircase visualization */}
                  {discountRules && discountRules.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-2">Rabattrappe</h3>
                      <div className="space-y-2">
                        {[...discountRules]
                          .sort((a, b) => (a.min_revenue ?? 0) - (b.min_revenue ?? 0))
                          .map((rule) => (
                            <div
                              key={rule.id}
                              className={`flex items-center justify-between p-2 rounded ${
                                appliedRule?.id === rule.id
                                  ? "bg-primary/10 border border-primary"
                                  : "bg-muted/50"
                              }`}
                            >
                              <span className="text-sm">
                                {rule.description || `Fra ${(rule.min_revenue ?? 0).toLocaleString("da-DK")} kr`}
                              </span>
                              <span className="font-semibold">{rule.discount_percent}%</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bookinger (min. {minDaysPerLocation} dage)</p>
                    <p className="text-2xl font-bold">{totalPlacements}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locationEntries.reduce((sum: number, loc: any) => sum + loc.bookings.length, 0)} samlede bookinger
                    </p>
                    <p className="text-xs text-muted-foreground">1 placering = min. {minDaysPerLocation} sammenhængende dage på samme lokation</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rabattrin</p>
                    <p className="text-2xl font-bold">
                      {appliedDiscount > 0 ? `${appliedDiscount}%` : "Ingen"}
                    </p>
                    {appliedRule && (
                      <p className="text-xs text-muted-foreground">{appliedRule.description}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rabatbeløb</p>
                    <p className="text-2xl font-bold text-green-600">
                      -{totalDiscountAmount.toLocaleString("da-DK")} kr
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total efter rabat</p>
                    <p className="text-2xl font-bold">{finalAmount.toLocaleString("da-DK")} kr</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const monthLabel = periodLabel;
                const staircaseSteps = (discountType === "annual_revenue" || discountType === "monthly_revenue") && discountRules
                  ? [...discountRules].sort((a, b) => (a.min_revenue ?? 0) - (b.min_revenue ?? 0)).map(r => ({ minRevenue: r.min_revenue ?? 0, discountPercent: r.discount_percent }))
                  : [];

                downloadSupplierReportPdf({
                  locationType: selectedLocationType,
                  month: monthLabel,
                  locations: locationDiscounts.map((loc: any) => ({
                    locationName: loc.location?.name || "",
                    externalId: loc.location?.external_id || "",
                    city: loc.location?.address_city || "",
                    client: loc.client?.name || "",
                    weekdays: [...(loc.weekdaysByWeek as Map<number, Set<number>>).entries()]
                      .map(([week, daysSet]) => ({ week, days: [...daysSet].sort((a: number, b: number) => a - b) })),
                    bookings: loc.bookings.length,
                    days: loc.totalDays,
                    dailyRate: loc.usesTotalPrice ? "samlet" : loc.dailyRate,
                    amount: loc.totalAmount,
                    discount: loc.discount,
                    discountAmount: loc.discountAmount,
                    finalAmount: loc.finalAmount,
                    isExcluded: loc.isExcluded,
                    maxDiscount: loc.maxDiscount,
                  })),
                  discountType,
                  hasDiscountRules: !!(discountRules && discountRules.length > 0),
                  minDaysPerLocation,
                  totals: { subtotal: totalAmountAll, discountAmount: totalDiscountAmount, finalAmount },
                  discountInfo: {
                    uniquePlacements: totalPlacements,
                    discountPercent: appliedDiscount,
                    discountDescription: appliedRule?.description ?? null,
                    ytdRevenue,
                    staircaseSteps,
                  },
                  exceptions: (locationExceptions || []).map(exc => ({
                    name: exc.location_name,
                    type: exc.exception_type,
                    maxDiscount: exc.max_discount_percent,
                  })),
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const WEEKDAY_NAMES_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
                const hasDiscount = discountRules && discountRules.length > 0;
                const headers = [
                  "Lokation", "ID", "By", "Uger & Dage", "Dage", "Beløb",
                  ...(hasDiscount ? ["Rabat %", "Rabat", "Efter rabat"] : []),
                ];
                const rows = locationDiscounts.map((loc: any) => {
                  const weekText = [...(loc.weekdaysByWeek as Map<number, Set<number>>).entries()]
                    .sort(([a]: [number, any], [b]: [number, any]) => a - b)
                    .map(([week, daysSet]: [number, Set<number>]) => {
                      const sorted = [...daysSet].sort((a, b) => a - b);
                      const isFullWeek = [0,1,2,3,4].every(d => daysSet.has(d));
                      return `Uge ${week}: ${isFullWeek ? "Man–Fre" : sorted.map(d => WEEKDAY_NAMES_SHORT[d]).join(", ")}`;
                    })
                    .join(" | ");
                  return [
                    loc.location?.name || "",
                    loc.location?.external_id || "",
                    loc.location?.address_city || "",
                    weekText,
                    loc.totalDays,
                    loc.totalAmount,
                    ...(hasDiscount ? [loc.discount, loc.discountAmount, loc.finalAmount] : []),
                  ];
                });

                // Period label
                const filePeriod = periodType === "payroll"
                  ? `${format(periodStart, "dd-MM")}_${format(periodEnd, "dd-MM-yyyy")}`
                  : format(monthDate, "yyyy-MM");
                const periodLabel = periodType === "payroll"
                  ? `${format(periodStart, "dd/MM/yyyy")} – ${format(periodEnd, "dd/MM/yyyy")}`
                  : format(monthDate, "MMMM yyyy", { locale: da });

                // Header rows + separator
                const metaRows: any[][] = [
                  [`Leverandørrapport: ${selectedLocationType}`],
                  [`Periode: ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}`],
                  [],
                ];

                // Total row
                const sumDays = locationDiscounts.reduce((s: number, l: any) => s + (l.totalDays || 0), 0);
                const sumAmount = locationDiscounts.reduce((s: number, l: any) => s + (l.totalAmount || 0), 0);
                const totalRow: any[] = ["Total", "", "", "", sumDays, sumAmount];
                if (hasDiscount) {
                  const sumDisc = locationDiscounts.reduce((s: number, l: any) => s + (l.discountAmount || 0), 0);
                  const sumFinal = locationDiscounts.reduce((s: number, l: any) => s + (l.finalAmount || 0), 0);
                  totalRow.push("", sumDisc, sumFinal);
                }

                const allData = [...metaRows, headers, ...rows, totalRow];
                const colWidths = [25, 10, 15, 40, 8, 12, ...(hasDiscount ? [10, 12, 12] : [])];
                const boldRowIdxs = [0, 1, 3, allData.length - 1];
                await downloadExcelAoa(
                  `Leverandorrapport_${selectedLocationType}_${filePeriod}.xlsx`,
                  "Leverandørrapport",
                  allData,
                  colWidths,
                  boldRowIdxs
                );
              }}
              disabled={locationDiscounts.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
            {isApproved && (
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Send til leverandør
              </Button>
            )}
            {isApproved ? (
              <div className="text-sm text-muted-foreground flex items-center">
                Godkendt {existingReport?.approved_at
                  ? format(new Date(existingReport.approved_at), "dd/MM/yyyy HH:mm", { locale: da })
                  : ""}
              </div>
            ) : (
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                {approveMutation.isPending ? "Godkender..." : "Godkend rapport"}
              </Button>
            )}
          </div>

          {isApproved && existingReport && (
            <SendToSupplierDialog
              open={sendDialogOpen}
              onOpenChange={setSendDialogOpen}
              locationType={selectedLocationType}
              month={periodLabel}
              reportId={existingReport.id}
              hasDiscountRules={!!(discountRules && discountRules.length > 0)}
              reportData={locationDiscounts.map((loc: any) => ({
                locationName: loc.location?.name,
                externalId: loc.location?.external_id || "",
                city: loc.location?.address_city,
                weekdays: [...(loc.weekdaysByWeek as Map<number, Set<number>>).entries()]
                  .map(([week, daysSet]) => ({ week, days: [...daysSet].sort((a: number, b: number) => a - b) })),
                days: loc.totalDays,
                amount: loc.totalAmount,
                discount: loc.discount,
                discountAmount: loc.discountAmount,
                finalAmount: loc.finalAmount,
                isExcluded: loc.isExcluded,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
