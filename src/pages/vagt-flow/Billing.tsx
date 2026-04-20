import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileText, Calendar, MapPin, TrendingUp, Percent } from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays, getISOWeek } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierReportTab } from "@/components/billing/SupplierReportTab";
import { DiscountRulesTab } from "@/components/billing/DiscountRulesTab";
import { SupplierContactsTab } from "@/components/billing/SupplierContactsTab";
import { HotelExpensesTab } from "@/components/billing/HotelExpensesTab";
import { ExpenseReportTab } from "@/components/billing/ExpenseReportTab";

function BillingOverviewTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [locationTypeFilter, setLocationTypeFilter] = useState<string>("all");
  const [periodType, setPeriodType] = useState<"month" | "payroll">("month");

  const monthDate = new Date(selectedMonth + "-01");
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthStart);

  const periodStart = periodType === "payroll"
    ? new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 15)
    : monthStart;
  const periodEnd = periodType === "payroll"
    ? new Date(monthDate.getFullYear(), monthDate.getMonth(), 14)
    : monthEnd;

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-billing-bookings", selectedMonth, periodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type),
          clients(id, name)
        `)
        .eq("status", "confirmed")
        .gte("start_date", format(periodStart, "yyyy-MM-dd"))
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all active discount rules for netto calculation
  const { data: allDiscountRules } = useQuery({
    queryKey: ["billing-all-discount-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_discount_rules")
        .select("*")
        .eq("is_active", true)
        .order("min_placements", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all location exceptions
  const { data: allLocationExceptions } = useQuery({
    queryKey: ["billing-all-location-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_location_exceptions")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: fieldmarketingClients } = useQuery({
    queryKey: ["fieldmarketing-team-clients-billing"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .maybeSingle();
      if (!team) return [];
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);
      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
    },
  });

  const staticLocationTypes = ["Coop butik", "Meny butik", "Danske Shoppingcentre", "Ocean Outdoor", "Markeder", "Messer", "Anden lokation"];
  const dynamicTypes = bookings?.map((b: any) => b.location?.type).filter(Boolean) || [];
  const locationTypes = [...new Set([...staticLocationTypes, ...dynamicTypes])];

  const filteredBookings = bookings?.filter((b: any) => {
    const matchesClient = clientFilter === "all" || b.client_id === clientFilter;
    const matchesLocationType = locationTypeFilter === "all" || b.location?.type === locationTypeFilter;
    return matchesClient && matchesLocationType;
  });

  const WEEKDAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  const countBookedDays = (booking: any): number => {
    const bookedDays = booking.booked_days as number[] | null;
    if (!bookedDays || bookedDays.length === 0) {
      return differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
    }
    let count = 0;
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
      if (bookedDays.includes(isoDay)) count++;
    }
    return count || 1;
  };

  const getBookedWeekdays = (booking: any): Map<number, Set<number>> => {
    const weeks = new Map<number, Set<number>>();
    const bookedDays = booking.booked_days as number[] | null;
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
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

  const bookingsByLocation = filteredBookings?.reduce((acc: any, booking: any) => {
    const locationId = booking.location_id;
    const clientId = booking.client_id || "no-client";
    const groupKey = `${locationId}__${clientId}`;
    let bookingTotal: number;
    let dailyRate: number;
    const days = countBookedDays(booking);

    if (booking.total_price != null) {
      bookingTotal = booking.total_price;
      dailyRate = days > 0 ? bookingTotal / days : bookingTotal;
    } else {
      dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
      bookingTotal = dailyRate * days;
    }

    if (!acc[groupKey]) {
      acc[groupKey] = {
        location: booking.location,
        client: booking.clients,
        bookings: [],
        totalDays: 0,
        totalAmount: 0,
        dailyRate,
        usesTotalPrice: booking.total_price != null,
        minDate: booking.start_date,
        maxDate: booking.end_date,
        weekdaysByWeek: new Map<number, Set<number>>(),
      };
    }

    acc[groupKey].bookings.push(booking);
    acc[groupKey].totalDays += days;
    acc[groupKey].totalAmount += bookingTotal;

    // Merge weekdays
    const bWeeks = getBookedWeekdays(booking);
    bWeeks.forEach((days_set, week) => {
      if (!acc[groupKey].weekdaysByWeek.has(week)) {
        acc[groupKey].weekdaysByWeek.set(week, new Set<number>());
      }
      days_set.forEach((d: number) => acc[groupKey].weekdaysByWeek.get(week)!.add(d));
    });

    if (booking.start_date < acc[groupKey].minDate) acc[groupKey].minDate = booking.start_date;
    if (booking.end_date > acc[groupKey].maxDate) acc[groupKey].maxDate = booking.end_date;

    return acc;
  }, {});

  const totalBookings = filteredBookings?.length || 0;
  const totalDays: number = (Object.values(bookingsByLocation || {}) as any[]).reduce(
    (sum: number, loc: any) => sum + (loc.totalDays || 0), 0
  );
  const totalAmount: number = (Object.values(bookingsByLocation || {}) as any[]).reduce(
    (sum: number, loc: any) => sum + (loc.totalAmount || 0), 0
  );
  const uniqueLocations = Object.keys(bookingsByLocation || {}).length;

  // Calculate netto amount using discount rules per location type
  const nettoAmount = (() => {
    if (!allDiscountRules || !bookingsByLocation) return totalAmount;

    const locationEntries = Object.values(bookingsByLocation) as any[];

    // Group locations by type
    const byType: Record<string, any[]> = {};
    locationEntries.forEach((loc: any) => {
      const type = loc.location?.type || "unknown";
      if (!byType[type]) byType[type] = [];
      byType[type].push(loc);
    });

    // Build exception lookup
    const exceptionMap = new Map<string, any>();
    allLocationExceptions?.forEach((exc: any) => {
      exceptionMap.set(exc.location_name.toLowerCase(), exc);
    });

    let totalNetto = 0;

    Object.entries(byType).forEach(([type, locs]) => {
      const rulesForType = allDiscountRules.filter((r: any) => r.location_type === type);

      if (rulesForType.length === 0) {
        // No discount rules for this type – use brutto
        totalNetto += locs.reduce((s: number, l: any) => s + l.totalAmount, 0);
        return;
      }

      const discountType = rulesForType[0]?.discount_type || "placement";
      const minDaysPerLoc = rulesForType[0]?.min_days_per_location ?? 1;

      // Calculate placements for this type
      const placements = locs.reduce((s: number, l: any) => s + Math.floor(l.totalDays / minDaysPerLoc), 0);

      // Calculate type-group total for monthly_revenue lookup
      const typeGroupTotal = locs.reduce((s: number, l: any) => {
        const locName = l.location?.name?.toLowerCase() || "";
        const exc = exceptionMap.get(locName);
        if (exc?.exception_type === "excluded") return s;
        return s + l.totalAmount;
      }, 0);

      // Find applicable discount
      let appliedDiscount = 0;
      if (discountType === "monthly_revenue") {
        // Monthly revenue: use type group's total booking amount
        const sorted = [...rulesForType].sort((a: any, b: any) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
        for (const rule of sorted) {
          if (typeGroupTotal >= (rule.min_revenue ?? 0)) {
            appliedDiscount = Number(rule.discount_percent);
            break;
          }
        }
      } else if (discountType === "annual_revenue") {
        // For annual_revenue, we'd need YTD data – simplify by using the lowest tier
        const sorted = [...rulesForType].sort((a: any, b: any) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
        // Use lowest tier (0 revenue) as approximation since we don't have YTD in this tab
        appliedDiscount = sorted[sorted.length - 1]?.discount_percent ?? 0;
      } else {
        const sorted = [...rulesForType].sort((a: any, b: any) => b.min_placements - a.min_placements);
        for (const rule of sorted) {
          if (placements >= rule.min_placements) {
            appliedDiscount = Number(rule.discount_percent);
            break;
          }
        }
      }

      // Apply per-location with exceptions
      locs.forEach((loc: any) => {
        const locName = loc.location?.name?.toLowerCase() || "";
        const exc = exceptionMap.get(locName);

        if (exc?.exception_type === "excluded") {
          totalNetto += loc.totalAmount;
          return;
        }

        let effectiveDiscount = appliedDiscount;
        if (exc?.exception_type === "max_discount" && exc.max_discount_percent != null) {
          effectiveDiscount = Math.min(appliedDiscount, Number(exc.max_discount_percent));
        }

        totalNetto += loc.totalAmount * (1 - effectiveDiscount / 100);
      });
    });

    return totalNetto;
  })();

  const totalDiscount = totalAmount - nettoAmount;

  const monthOptions = [];
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: da }),
    });
  }

  const formatDateRange = (minDate: string, maxDate: string) => {
    return `${format(new Date(minDate), "dd/MM")} - ${format(new Date(maxDate), "dd/MM")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as "month" | "payroll")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="payroll">Lønperiode (15.–14.)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alle kunder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kunder</SelectItem>
            {fieldmarketingClients?.map((client: any) => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locationTypeFilter} onValueChange={setLocationTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alle typer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {locationTypes.map((type: string) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bookinger</p>
                <p className="text-3xl font-bold mt-1">{totalBookings}</p>
                <p className="text-xs text-muted-foreground mt-1">Unikke bookinger</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bookede Dage</p>
                <p className="text-3xl font-bold mt-1">{totalDays}</p>
                <p className="text-xs text-muted-foreground mt-1">Lokations-dage</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lokationer</p>
                <p className="text-3xl font-bold mt-1">{uniqueLocations}</p>
                <p className="text-xs text-muted-foreground mt-1">Unikke lokationer</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Brutto Beløb</p>
                <p className="text-3xl font-bold mt-1">{Math.round(totalAmount).toLocaleString("da-DK")}</p>
                <p className="text-xs text-muted-foreground mt-1">kr ex moms (før rabat)</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Netto Beløb</p>
                      <p className="text-3xl font-bold mt-1">{nettoAmount.toLocaleString("da-DK", { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        kr ex moms (−{totalDiscount.toLocaleString("da-DK", { maximumFractionDigits: 0 })} rabat)
                      </p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <Percent className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Beregnet med rabatregler per leverandørtype</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Detaljeret Oversigt per Lokation</h2>
              <p className="text-sm text-muted-foreground">
                Brug denne oversigt til at kontrollere faktureringen mod aftaler
              </p>
            </div>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Indlæser...</p>
          ) : uniqueLocations === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Ingen bookinger fundet for den valgte periode
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokation</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Uger & Dage</TableHead>
                  <TableHead className="text-right">Bookinger</TableHead>
                  <TableHead className="text-right">Dage</TableHead>
                  <TableHead className="text-right">Dagspris</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(bookingsByLocation || {}).map((loc: any) => (
                  <TableRow key={loc.location?.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{loc.location?.name}</p>
                        {loc.location?.address_city && (
                          <p className="text-sm text-muted-foreground">{loc.location.address_city}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{loc.client?.name || "Ukendt kunde"}</Badge>
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
                        `${Math.round(loc.dailyRate).toLocaleString("da-DK")} kr`
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {Math.round(loc.totalAmount).toLocaleString("da-DK")} kr
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-2">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h3 className="font-semibold mb-2">Faktureringstips:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><span className="font-medium text-foreground">Dato Periode:</span> Viser hvornår lokationen var booket (format: dd/mm - dd/mm)</li>
                <li><span className="font-medium text-foreground">Dage:</span> Antal dage lokationen var booket (bruges til dagspriser)</li>
                <li><span className="font-medium text-foreground">Bookinger:</span> Antal separate bookinger på samme lokation</li>
                <li><span className="font-medium text-foreground">Tip:</span> Sammenlign med jeres aftaler om dagspriser og bemanding</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VagtBilling() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faktureringsrapport</h1>
          <p className="text-muted-foreground">Oversigt over bookinger til fakturering</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Oversigt</TabsTrigger>
            <TabsTrigger value="supplier">Leverandørrapport</TabsTrigger>
            <TabsTrigger value="hotels">Hoteller</TabsTrigger>
            <TabsTrigger value="expenses">Udgiftsrapport</TabsTrigger>
            <TabsTrigger value="discounts">Rabataftaler</TabsTrigger>
            <TabsTrigger value="contacts">Kontaktpersoner</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <BillingOverviewTab />
          </TabsContent>

          <TabsContent value="supplier">
            <SupplierReportTab />
          </TabsContent>

          <TabsContent value="hotels">
            <HotelExpensesTab />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpenseReportTab />
          </TabsContent>

          <TabsContent value="discounts">
            <DiscountRulesTab />
          </TabsContent>

          <TabsContent value="contacts">
            <SupplierContactsTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
