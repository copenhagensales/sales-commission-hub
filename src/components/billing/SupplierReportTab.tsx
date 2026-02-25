import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { FileText, Check, Percent, MapPin, AlertTriangle, TrendingUp, Download, Send } from "lucide-react";
import { SendToSupplierDialog } from "./SendToSupplierDialog";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
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
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const yearStart = new Date(monthStart.getFullYear(), 0, 1);

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
    queryKey: ["supplier-report-bookings", selectedMonth, selectedLocationType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type),
          clients(id, name)
        `)
        .gte("start_date", format(monthStart, "yyyy-MM-dd"))
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return data.filter((b: any) => b.location?.type === selectedLocationType);
    },
    enabled: !!selectedLocationType,
  });

  // Fetch YTD bookings for annual_revenue calculation
  const { data: ytdBookings } = useQuery({
    queryKey: ["supplier-ytd-bookings", selectedMonth, selectedLocationType],
    queryFn: async () => {
      if (!selectedLocationType) return [];
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type)
        `)
        .gte("start_date", format(yearStart, "yyyy-MM-dd"))
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
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
    queryKey: ["supplier-report", selectedMonth, selectedLocationType],
    queryFn: async () => {
      if (!selectedLocationType) return null;
      const { data, error } = await supabase
        .from("supplier_invoice_reports")
        .select("*")
        .eq("location_type", selectedLocationType)
        .eq("period_start", format(monthStart, "yyyy-MM-dd"))
        .eq("period_end", format(monthEnd, "yyyy-MM-dd"))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLocationType,
  });

  // Determine discount type
  const discountType = discountRules?.[0]?.discount_type || "placements";

  // Helper to calculate booking total
  const calcBookingTotal = (booking: any) => {
    if (booking.total_price != null) {
      const days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
      return { total: booking.total_price, days, dailyRate: days > 0 ? booking.total_price / days : booking.total_price, usesTotalPrice: true };
    }
    const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
    const days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
    return { total: dailyRate * days, days, dailyRate, usesTotalPrice: false };
  };

  // Build exception lookup
  const exceptionMap = new Map<string, LocationException>();
  locationExceptions?.forEach((exc) => {
    exceptionMap.set(exc.location_name.toLowerCase(), exc);
  });

  // Group bookings by location (current month)
  const bookingsByLocation = bookings?.reduce((acc: any, booking: any) => {
    const locationId = booking.location_id;
    const { total, days, dailyRate, usesTotalPrice } = calcBookingTotal(booking);

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
      };
    }

    acc[locationId].bookings.push(booking);
    acc[locationId].totalDays += days;
    acc[locationId].totalAmount += total;

    if (booking.start_date < acc[locationId].minDate) acc[locationId].minDate = booking.start_date;
    if (booking.end_date > acc[locationId].maxDate) acc[locationId].maxDate = booking.end_date;

    return acc;
  }, {} as Record<string, any>) || {};

  const locationEntries = Object.values(bookingsByLocation) as any[];
  const totalPlacements = locationEntries.reduce((sum: number, loc: any) => sum + loc.bookings.length, 0);

  // Calculate YTD revenue (for annual_revenue type)
  const ytdRevenue = ytdBookings?.reduce((sum, booking: any) => {
    const { total } = calcBookingTotal(booking);
    // Exclude excluded locations from YTD
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
    if (discountType === "annual_revenue") {
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
        period_start: format(monthStart, "yyyy-MM-dd"),
        period_end: format(monthEnd, "yyyy-MM-dd"),
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

  // Build staircase visualization for annual_revenue
  const staircaseSteps = discountType === "annual_revenue" && discountRules
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
      ) : totalPlacements === 0 ? (
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
                    <TableHead>By</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Periode</TableHead>
                     <TableHead className="text-right">Bookinger</TableHead>
                     <TableHead className="text-right">Dage</TableHead>
                     <TableHead className="text-right">Dagspris</TableHead>
                    <TableHead className="text-right">Beløb</TableHead>
                    {discountType === "annual_revenue" && (
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
                      <TableCell>{loc.location?.address_city || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{loc.client?.name || "Ukendt"}</Badge>
                      </TableCell>
                      <TableCell>{formatDateRange(loc.minDate, loc.maxDate)}</TableCell>
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
                      {discountType === "annual_revenue" && (
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
                    <TableCell colSpan={7} className="font-semibold">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {totalAmountAll.toLocaleString("da-DK")} kr
                    </TableCell>
                    {discountType === "annual_revenue" && (
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

          {/* Discount section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Rabatberegning</h2>
              </div>

              {discountType === "annual_revenue" ? (
                <div className="space-y-4">
                  {/* Annual revenue overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Kumulativ årsomsætning</p>
                      <p className="text-2xl font-bold">{ytdRevenue.toLocaleString("da-DK")} kr</p>
                      <p className="text-xs text-muted-foreground">Jan - {format(monthEnd, "MMM yyyy", { locale: da })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nuværende rabattrin</p>
                      <p className="text-2xl font-bold">
                        {appliedDiscount > 0 ? `${appliedDiscount}%` : "Ingen"}
                      </p>
                      {appliedRule && (
                        <p className="text-xs text-muted-foreground">{appliedRule.description}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Samlet rabat (denne md)</p>
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
                  {staircaseSteps.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Rabattrappe {monthStart.getFullYear()}</p>
                      </div>
                      <div className="flex gap-1">
                        {staircaseSteps.map((step, i) => {
                          const isActive = ytdRevenue >= (step.min_revenue ?? 0);
                          const isCurrent = step.id === appliedRule?.id;
                          return (
                            <div
                              key={step.id}
                              className={`flex-1 rounded-md p-2 text-center text-xs border transition-colors ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : isActive
                                  ? "bg-primary/20 border-primary/30"
                                  : "bg-muted border-border"
                              }`}
                            >
                              <div className="font-bold">{step.discount_percent}%</div>
                              <div className="truncate">
                                {(step.min_revenue ?? 0).toLocaleString("da-DK")} kr
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Exceptions info */}
                  {locationExceptions && locationExceptions.length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Undtagelser</p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {locationExceptions.map((exc) => (
                          <li key={exc.id}>
                            <span className="font-medium">{exc.location_name}</span>:{" "}
                            {exc.exception_type === "excluded"
                              ? "Pris aftales separat"
                              : `Max ${exc.max_discount_percent}% rabat`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* Placement-based discount (original) */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bookinger</p>
                    <p className="text-2xl font-bold">{totalPlacements}</p>
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

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const monthLabel = format(monthStart, "MMMM yyyy", { locale: da });
                const staircaseSteps = discountType === "annual_revenue" && discountRules
                  ? [...discountRules].sort((a, b) => (a.min_revenue ?? 0) - (b.min_revenue ?? 0)).map(r => ({ minRevenue: r.min_revenue ?? 0, discountPercent: r.discount_percent }))
                  : [];

                downloadSupplierReportPdf({
                  locationType: selectedLocationType,
                  month: monthLabel,
                  locations: locationDiscounts.map((loc: any) => ({
                    locationName: loc.location?.name || "",
                    city: loc.location?.address_city || "",
                    client: loc.client?.name || "",
                    period: formatDateRange(loc.minDate, loc.maxDate),
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
              month={format(monthStart, "MMMM yyyy", { locale: da })}
              reportId={existingReport.id}
              reportData={locationDiscounts.map((loc: any) => ({
                locationName: loc.location?.name,
                city: loc.location?.address_city,
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
