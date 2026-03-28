import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { Hotel, Calendar, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Afventer", variant: "secondary" },
  confirmed: { label: "Bekræftet", variant: "default" },
  cancelled: { label: "Annulleret", variant: "destructive" },
};

export function HotelExpensesTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [periodType, setPeriodType] = useState<"month" | "payroll">("month");

  const monthDate = new Date(selectedMonth + "-01");
  const periodStart = periodType === "payroll"
    ? format(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 15), "yyyy-MM-dd")
    : format(startOfMonth(monthDate), "yyyy-MM-dd");
  const periodEnd = periodType === "payroll"
    ? format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 14), "yyyy-MM-dd")
    : format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: hotelBookings, isLoading } = useQuery({
    queryKey: ["hotel-expenses", selectedMonth, periodType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_hotel")
        .select(`
          *,
          hotel:hotel_id(*),
          booking:booking_id(
            start_date, end_date, week_number,
            location:location_id(name, address_city)
          )
        `)
        .gte("check_in", periodStart)
        .lte("check_in", periodEnd)
        .order("check_in", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const monthOptions = [];
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: da }),
    });
  }

  const totalExpense = hotelBookings?.reduce((sum, bh) => {
    if (!bh.price_per_night) return sum;
    const checkIn = new Date(bh.check_in);
    const checkOut = new Date(bh.check_out);
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + nights * bh.price_per_night * (bh.rooms || 1);
  }, 0) || 0;

  const totalNights = hotelBookings?.reduce((sum, bh) => {
    const checkIn = new Date(bh.check_in);
    const checkOut = new Date(bh.check_out);
    return sum + Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  }, 0) || 0;

  const totalBookings = hotelBookings?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as "month" | "payroll")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="payroll">Lønperiode (15.–14.)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Samlet udgift</p>
                <p className="text-3xl font-bold mt-1">{totalExpense.toLocaleString("da-DK")} kr</p>
                <p className="text-xs text-muted-foreground mt-1">Overnatninger i perioden</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overnatninger</p>
                <p className="text-3xl font-bold mt-1">{totalNights}</p>
                <p className="text-xs text-muted-foreground mt-1">Antal nætter</p>
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
                <p className="text-sm font-medium text-muted-foreground">Bookinger</p>
                <p className="text-3xl font-bold mt-1">{totalBookings}</p>
                <p className="text-xs text-muted-foreground mt-1">Hotel-tildelinger</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Hotel className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking (lokation)</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Nætter</TableHead>
                <TableHead className="text-right">Værelser</TableHead>
                <TableHead className="text-right">Pris/nat</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : !hotelBookings?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Ingen hotelovernatninger i denne periode
                  </TableCell>
                </TableRow>
              ) : (
                hotelBookings.map((bh) => {
                  const checkIn = new Date(bh.check_in);
                  const checkOut = new Date(bh.check_out);
                  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
                  const rooms = bh.rooms || 1;
                  const lineTotal = (bh.price_per_night || 0) * nights * rooms;
                  const statusInfo = STATUS_LABELS[bh.status] || { label: bh.status, variant: "outline" as const };

                  return (
                    <TableRow key={bh.id}>
                      <TableCell>
                        <div className="font-medium">{bh.booking?.location?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{bh.booking?.location?.address_city || ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{bh.hotel?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{bh.hotel?.city || ""}</div>
                      </TableCell>
                      <TableCell>{format(checkIn, "dd/MM/yyyy")}</TableCell>
                      <TableCell>{format(checkOut, "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right">{nights}</TableCell>
                      <TableCell className="text-right">{rooms}</TableCell>
                      <TableCell className="text-right">
                        {bh.price_per_night ? `${bh.price_per_night.toLocaleString("da-DK")} kr` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {lineTotal > 0 ? `${lineTotal.toLocaleString("da-DK")} kr` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {hotelBookings && hotelBookings.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{totalNights}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-bold">{totalExpense.toLocaleString("da-DK")} kr</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
