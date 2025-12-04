import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileText, Calendar, MapPin, TrendingUp } from "lucide-react";
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
} from "@/components/ui/table";

export default function VagtBilling() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
  const monthEnd = endOfMonth(monthStart);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-billing-bookings", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(id, name, address_city, daily_rate, type),
          brand(id, name, color_hex)
        `)
        .gte("start_date", format(monthStart, "yyyy-MM-dd"))
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["vagt-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Filter by brand
  const filteredBookings = bookings?.filter((b: any) => 
    brandFilter === "all" || b.brand_id === brandFilter
  );

  // Group bookings by location
  const bookingsByLocation = filteredBookings?.reduce((acc: any, booking: any) => {
    const locationId = booking.location_id;
    const dailyRate = booking.location?.daily_rate || 1000;
    
    if (!acc[locationId]) {
      acc[locationId] = {
        location: booking.location,
        brand: booking.brand,
        bookings: [],
        totalDays: 0,
        totalAmount: 0,
        dailyRate: dailyRate,
        minDate: booking.start_date,
        maxDate: booking.end_date,
      };
    }
    
    acc[locationId].bookings.push(booking);
    
    // Calculate days for this booking
    const days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
    acc[locationId].totalDays += days;
    acc[locationId].totalAmount += days * dailyRate;
    
    // Track date range
    if (booking.start_date < acc[locationId].minDate) {
      acc[locationId].minDate = booking.start_date;
    }
    if (booking.end_date > acc[locationId].maxDate) {
      acc[locationId].maxDate = booking.end_date;
    }
    
    return acc;
  }, {});

  // Calculate totals
  const totalBookings = filteredBookings?.length || 0;
  const totalDays: number = (Object.values(bookingsByLocation || {}) as any[]).reduce(
    (sum: number, loc: any) => sum + (loc.totalDays || 0), 0
  );
  const totalAmount: number = (Object.values(bookingsByLocation || {}) as any[]).reduce(
    (sum: number, loc: any) => sum + (loc.totalAmount || 0), 0
  );
  const uniqueLocations = Object.keys(bookingsByLocation || {}).length;

  // Generate month options
  const monthOptions = [];
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: da }),
    });
  }

  const formatDateRange = (minDate: string, maxDate: string) => {
    const start = new Date(minDate);
    const end = new Date(maxDate);
    return `${format(start, "dd/MM")} - ${format(end, "dd/MM")}`;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Faktureringsrapport</h1>
            <p className="text-muted-foreground">Oversigt over bookinger til fakturering</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Alle brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle brands</SelectItem>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
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
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="text-sm font-medium text-muted-foreground">Total Beløb</p>
                  <p className="text-3xl font-bold mt-1">{totalAmount.toLocaleString("da-DK")}</p>
                  <p className="text-xs text-muted-foreground mt-1">kr ex moms</p>
                </div>
                <div className="p-2 bg-muted rounded-lg">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
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
                    <TableHead>Brand</TableHead>
                    <TableHead>Dato Periode</TableHead>
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
                            <p className="text-sm text-muted-foreground">
                              {loc.location.address_city}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: loc.brand?.color_hex,
                            color: "white",
                          }}
                        >
                          {loc.brand?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateRange(loc.minDate, loc.maxDate)}</TableCell>
                      <TableCell className="text-right">{loc.bookings.length}</TableCell>
                      <TableCell className="text-right">{loc.totalDays}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{loc.dailyRate.toLocaleString("da-DK")} kr</TableCell>
                      <TableCell className="text-right font-semibold">{loc.totalAmount.toLocaleString("da-DK")} kr</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Faktureringstips:</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Dato Periode:</span> Viser hvornår lokationen var booket (format: dd/mm - dd/mm)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Dage:</span> Antal dage lokationen var booket (bruges til dagspriser)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Bookinger:</span> Antal separate bookinger på samme lokation
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Tip:</span> Sammenlign med jeres aftaler om dagspriser og bemanding
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
