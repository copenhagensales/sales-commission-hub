import { useState, useMemo } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hotel, CircleAlert, CircleCheck, Clock, Loader2, Check } from "lucide-react";
import { useJyllandFynBookings, useBookingHotels, useUpdateBookingHotel } from "@/hooks/useBookingHotels";
import { AssignHotelDialog } from "@/components/vagt-flow/AssignHotelDialog";
import { HotelRegistry } from "@/components/vagt-flow/HotelRegistry";

export default function HotelsContent() {
  const { data: bookings = [], isLoading: bookingsLoading } = useJyllandFynBookings();
  const bookingIds = useMemo(() => bookings.map((b: any) => b.id), [bookings]);
  const { data: bookingHotels = [], isLoading: hotelsLoading } = useBookingHotels(
    bookingIds.length > 0 ? bookingIds : undefined
  );
  const updateBookingHotel = useUpdateBookingHotel();

  const [assignBooking, setAssignBooking] = useState<any>(null);
  const [editingBookingHotel, setEditingBookingHotel] = useState<any>(null);

  const isLoading = bookingsLoading || hotelsLoading;

  const hotelMap = useMemo(() => {
    const map: Record<string, any> = {};
    bookingHotels.forEach((bh) => { map[bh.booking_id] = bh; });
    return map;
  }, [bookingHotels]);

  const getStatus = (bookingId: string) => {
    const bh = hotelMap[bookingId];
    if (!bh) return "missing";
    if (bh.status === "confirmed") return "confirmed";
    return "pending";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CircleCheck className="h-3 w-3 mr-1" />Bekræftet
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />Ubekræftet
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <CircleAlert className="h-3 w-3 mr-1" />Mangler hotel
          </Badge>
        );
    }
  };

  const handleQuickConfirm = (bookingId: string) => {
    const bh = hotelMap[bookingId];
    if (!bh) return;
    updateBookingHotel.mutate({ id: bh.id, status: "confirmed" });
  };

  const handleEdit = (booking: any) => {
    const bh = hotelMap[booking.id];
    setEditingBookingHotel(bh || null);
    setAssignBooking(booking);
  };

  const missingCount = bookings.filter((b: any) => getStatus(b.id) === "missing").length;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings" className="flex items-center gap-2">
            <Hotel className="h-4 w-4" />Bookinger
            {missingCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{missingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="registry">Hotelregister</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Ingen kommende bookinger i Jylland/Fyn.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking: any) => {
                const status = getStatus(booking.id);
                const bh = hotelMap[booking.id];
                const uniqueStaff = new Set(
                  (booking.booking_assignment || []).map((a: any) => a.employee_id)
                );
                const staffCount = uniqueStaff.size || booking.expected_staff_count || 0;

                return (
                  <Card key={booking.id} className={
                    status === "missing" ? "border-destructive/50" :
                    status === "pending" ? "border-yellow-400/50" : "border-green-400/50"
                  }>
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{booking.location?.name}</span>
                          <span className="text-muted-foreground text-sm">– {booking.location?.address_city}</span>
                          <Badge variant="outline" className="text-xs">{booking.location?.region}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex gap-3">
                          <span>
                            {format(new Date(booking.start_date), "d. MMM", { locale: da })} – {format(new Date(booking.end_date), "d. MMM yyyy", { locale: da })}
                          </span>
                          <span>Uge {booking.week_number}</span>
                          {staffCount > 0 && <span>{staffCount} medarbejdere</span>}
                        </div>
                        {bh && bh.hotel && (
                          <div className="text-sm">
                            <span className="font-medium">{bh.hotel.name}</span>
                            {bh.confirmation_number && (
                              <span className="text-muted-foreground ml-2">Bek.nr: {bh.confirmation_number}</span>
                            )}
                            {bh.rooms && <span className="text-muted-foreground ml-2">{bh.rooms} værelse(r)</span>}
                            {bh.booked_days && bh.booked_days.length > 0 && <span className="text-muted-foreground ml-2">{bh.booked_days.length} dage</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(status)}
                        {status === "missing" ? (
                          <Button size="sm" onClick={() => { setEditingBookingHotel(null); setAssignBooking(booking); }}>
                            Tildel hotel
                          </Button>
                        ) : (
                          <>
                            {status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => handleQuickConfirm(booking.id)}
                                disabled={updateBookingHotel.isPending}>
                                <Check className="h-4 w-4 mr-1" />Bekræft
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleEdit(booking)}>
                              Ændr
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="registry" className="mt-4">
          <HotelRegistry />
        </TabsContent>
      </Tabs>

      {assignBooking && (
        <AssignHotelDialog
          open={!!assignBooking}
          onOpenChange={(open) => { if (!open) { setAssignBooking(null); setEditingBookingHotel(null); } }}
          booking={assignBooking}
          existingBookingHotel={editingBookingHotel}
        />
      )}
    </div>
  );
}
