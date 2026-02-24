import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { FileText, Check, Percent, MapPin } from "lucide-react";
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

export function SupplierReportTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [selectedLocationType, setSelectedLocationType] = useState<string>("");
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
  const monthEnd = endOfMonth(monthStart);

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
      // Filter by location type client-side
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
      return data;
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

  // Group bookings by location
  const bookingsByLocation = bookings?.reduce((acc: any, booking: any) => {
    const locationId = booking.location_id;
    let bookingTotal: number;
    let dailyRate: number;
    let days: number;

    if (booking.total_price != null) {
      bookingTotal = booking.total_price;
      days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
      dailyRate = days > 0 ? bookingTotal / days : bookingTotal;
    } else {
      dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
      days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
      bookingTotal = dailyRate * days;
    }

    if (!acc[locationId]) {
      acc[locationId] = {
        location: booking.location,
        client: booking.clients,
        bookings: [],
        totalDays: 0,
        totalAmount: 0,
        dailyRate,
        usesTotalPrice: booking.total_price != null,
        minDate: booking.start_date,
        maxDate: booking.end_date,
      };
    }

    acc[locationId].bookings.push(booking);
    acc[locationId].totalDays += days;
    acc[locationId].totalAmount += bookingTotal;

    if (booking.start_date < acc[locationId].minDate) acc[locationId].minDate = booking.start_date;
    if (booking.end_date > acc[locationId].maxDate) acc[locationId].maxDate = booking.end_date;

    return acc;
  }, {} as Record<string, any>) || {};

  const locationEntries = Object.values(bookingsByLocation) as any[];
  const uniqueLocations = locationEntries.length;
  const totalAmount = locationEntries.reduce((sum, loc) => sum + loc.totalAmount, 0);

  // Calculate discount
  let appliedDiscount = 0;
  let appliedRule: any = null;
  if (discountRules && discountRules.length > 0) {
    // Rules are sorted desc by min_placements, find highest applicable
    for (const rule of discountRules) {
      if (uniqueLocations >= rule.min_placements) {
        appliedDiscount = Number(rule.discount_percent);
        appliedRule = rule;
        break;
      }
    }
  }
  const discountAmount = totalAmount * (appliedDiscount / 100);
  const finalAmount = totalAmount - discountAmount;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const reportData = locationEntries.map((loc) => ({
        locationName: loc.location?.name,
        city: loc.location?.address_city,
        client: loc.client?.name,
        days: loc.totalDays,
        dailyRate: loc.dailyRate,
        amount: loc.totalAmount,
        minDate: loc.minDate,
        maxDate: loc.maxDate,
      }));

      const { data: userData } = await supabase.auth.getUser();

      if (existingReport) {
        const { error } = await supabase
          .from("supplier_invoice_reports")
          .update({
            total_amount: totalAmount,
            discount_percent: appliedDiscount,
            discount_amount: discountAmount,
            final_amount: finalAmount,
            unique_locations: uniqueLocations,
            status: "approved",
            approved_by: userData.user?.id,
            approved_at: new Date().toISOString(),
            report_data: reportData,
          })
          .eq("id", existingReport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_invoice_reports")
          .insert({
            location_type: selectedLocationType,
            period_start: format(monthStart, "yyyy-MM-dd"),
            period_end: format(monthEnd, "yyyy-MM-dd"),
            total_amount: totalAmount,
            discount_percent: appliedDiscount,
            discount_amount: discountAmount,
            final_amount: finalAmount,
            unique_locations: uniqueLocations,
            status: "approved",
            approved_by: userData.user?.id,
            approved_at: new Date().toISOString(),
            report_data: reportData,
          });
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
      ) : uniqueLocations === 0 ? (
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
                    <TableHead className="text-right">Dage</TableHead>
                    <TableHead className="text-right">Dagspris</TableHead>
                    <TableHead className="text-right">Beløb</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationEntries.map((loc: any) => (
                    <TableRow key={loc.location?.id}>
                      <TableCell className="font-medium">{loc.location?.name}</TableCell>
                      <TableCell>{loc.location?.address_city || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{loc.client?.name || "Ukendt"}</Badge>
                      </TableCell>
                      <TableCell>{formatDateRange(loc.minDate, loc.maxDate)}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="font-semibold">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {totalAmount.toLocaleString("da-DK")} kr
                    </TableCell>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Unikke placeringer</p>
                  <p className="text-2xl font-bold">{uniqueLocations}</p>
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
                    -{discountAmount.toLocaleString("da-DK")} kr
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total efter rabat</p>
                  <p className="text-2xl font-bold">{finalAmount.toLocaleString("da-DK")} kr</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approve button */}
          <div className="flex justify-end">
            {isApproved ? (
              <div className="text-sm text-muted-foreground">
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
        </>
      )}
    </div>
  );
}
