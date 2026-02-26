import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, MapPin, Clock, Users, Car, Utensils, CalendarDays, MessageSquare, Hotel } from "lucide-react";
import { startOfWeek, addDays, addWeeks, format, isToday, isBefore, parseISO, getISOWeek } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export default function MyBookingSchedule() {
  const { user } = useAuth();
  const [referenceDate, setReferenceDate] = useState(new Date());

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);

  // Get employee_id from auth user
  const { data: employeeId } = useQuery({
    queryKey: ["my-employee-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${user.email},work_email.ilike.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user?.email,
  });

  // Fetch my assignments for this week
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-booking-assignments", employeeId, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employeeId) return [];
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      const { data } = await supabase
        .from("booking_assignment")
        .select(`
          id, date, start_time, end_time, booking_id,
          booking:booking_id (
            id, week_number, year,
            location:location_id ( id, name, address_city ),
            client:client_id ( name ),
            campaign:campaign_id ( name ),
            comment
          )
        `)
        .eq("employee_id", employeeId)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date")
        .order("start_time");

      return data ?? [];
    },
    enabled: !!employeeId,
  });

  // Fetch vehicles for my bookings this week
  const bookingIds = useMemo(() => {
    if (!assignments) return [];
    return [...new Set(assignments.map((a: any) => a.booking_id))];
  }, [assignments]);

  const { data: vehicles } = useQuery({
    queryKey: ["my-booking-vehicles", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data } = await supabase
        .from("booking_vehicle")
        .select("booking_id, date, vehicle:vehicle_id ( id, name, license_plate )")
        .in("booking_id", bookingIds);
      return data ?? [];
    },
    enabled: bookingIds.length > 0,
  });

  // Fetch hotel bookings for my bookings this week
  const { data: bookingHotels } = useQuery({
    queryKey: ["my-booking-hotels", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("booking_hotel")
        .select("booking_id, check_in, check_out, notes, status, hotel:hotel_id ( name, address, city, phone )")
        .in("booking_id", bookingIds);
      return data ?? [];
    },
    enabled: bookingIds.length > 0,
  });

  // Fetch diets for me this week
  const { data: diets } = useQuery({
    queryKey: ["my-booking-diets", employeeId, bookingIds],
    queryFn: async () => {
      if (!employeeId || bookingIds.length === 0) return [];
      const { data } = await supabase
        .from("booking_diet")
        .select("booking_id, date, amount")
        .eq("employee_id", employeeId)
        .in("booking_id", bookingIds);
      return data ?? [];
    },
    enabled: !!employeeId && bookingIds.length > 0,
  });

  // Fetch partners (other employees on same booking+date)
  const { data: partners } = useQuery({
    queryKey: ["my-booking-partners", employeeId, bookingIds],
    queryFn: async () => {
      if (!employeeId || bookingIds.length === 0) return [];
      const { data } = await supabase
        .from("booking_assignment")
        .select("booking_id, date, employee:employee_id ( id, first_name )")
        .in("booking_id", bookingIds)
        .neq("employee_id", employeeId);
      return data ?? [];
    },
    enabled: !!employeeId && bookingIds.length > 0,
  });

  // Group data by date
  const dayData = useMemo(() => {
    const days: Record<string, any> = {};
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateStr = format(date, "yyyy-MM-dd");
      days[dateStr] = {
        date,
        dateStr,
        dayName: DAY_NAMES[i],
        assignments: [] as any[],
      };
    }

    assignments?.forEach((a: any) => {
      if (days[a.date]) {
        const vehicleForDay = vehicles?.find(
          (v: any) => v.booking_id === a.booking_id && v.date === a.date
        );
        const dietForDay = diets?.find(
          (d: any) => d.booking_id === a.booking_id && d.date === a.date
        );
        const partnersForDay = partners?.filter(
          (p: any) => p.booking_id === a.booking_id && p.date === a.date
        ) ?? [];

        // Match hotel: check if this day falls within check_in/check_out
        const hotelForBooking = bookingHotels?.find((bh: any) => {
          if (bh.booking_id !== a.booking_id) return false;
          if (bh.check_in && bh.check_out) {
            return a.date >= bh.check_in && a.date <= bh.check_out;
          }
          return true; // fallback: show on all days
        });

        days[a.date].assignments.push({
          ...a,
          vehicle: vehicleForDay?.vehicle,
          diet: dietForDay,
          partners: partnersForDay.map((p: any) => p.employee?.first_name).filter(Boolean),
          hotel: hotelForBooking ? {
            name: hotelForBooking.hotel?.name,
            address: hotelForBooking.hotel?.address,
            city: hotelForBooking.hotel?.city,
            phone: hotelForBooking.hotel?.phone,
            checkIn: hotelForBooking.check_in,
            checkOut: hotelForBooking.check_out,
            notes: hotelForBooking.notes,
            isCheckInDay: a.date === hotelForBooking.check_in,
            isCheckOutDay: a.date === hotelForBooking.check_out,
          } : null,
        });
      }
    });

    return Object.values(days);
  }, [assignments, vehicles, diets, partners, bookingHotels, weekStart]);

  // Find next upcoming shift
  const nextShift = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    for (const day of dayData) {
      if (day.dateStr >= todayStr && day.assignments.length > 0) {
        return day;
      }
    }
    return null;
  }, [dayData]);

  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Min vagtplan</h1>
            <p className="text-muted-foreground">
              Uge {weekNumber} • {format(weekStart, "d. MMM", { locale: da })} – {format(weekEnd, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setReferenceDate(new Date())}>
              I dag
            </Button>
            <Button variant="outline" size="icon" onClick={() => setReferenceDate(d => addWeeks(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setReferenceDate(d => addWeeks(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Next shift highlight */}
        {nextShift && nextShift.assignments.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <CalendarDays className="h-4 w-4" />
                Næste vagt: {nextShift.dayName} {format(nextShift.date, "d/M")}
              </div>
              {nextShift.assignments.map((a: any, i: number) => (
                <div key={i} className="text-sm text-foreground">
                  {(a.booking as any)?.location?.name} • {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Indlæser vagtplan...</div>
        ) : (
          <div className="space-y-3">
            {dayData.map((day: any) => {
              const isDayToday = isToday(day.date);
              const isPast = isBefore(day.date, new Date()) && !isDayToday;

              return (
                <Card
                  key={day.dateStr}
                  className={cn(
                    "transition-colors",
                    isDayToday && "border-primary/50 bg-primary/5",
                    isPast && day.assignments.length === 0 && "opacity-50"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {day.dayName.slice(0, 3).toUpperCase()} {format(day.date, "d/M")}
                        </span>
                        {isDayToday && (
                          <Badge variant="default" className="text-xs">I dag</Badge>
                        )}
                      </div>
                    </div>

                    {day.assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Ingen vagt</p>
                    ) : (
                      <div className="space-y-3">
                        {day.assignments.map((a: any, idx: number) => {
                          const booking = a.booking as any;
                          const location = booking?.location;
                          const client = booking?.client;
                          const campaign = booking?.campaign;

                          return (
                            <div key={idx} className="space-y-1.5">
                              {/* Location */}
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-foreground">
                                  {location?.name || "Ukendt lokation"}
                                  {location?.address_city && `, ${location.address_city}`}
                                </span>
                              </div>

                              {/* Client / Campaign */}
                              {(client?.name || campaign?.name) && (
                                <p className="text-sm text-muted-foreground ml-6">
                                  {client?.name}{campaign?.name ? ` – ${campaign.name}` : ""}
                                </p>
                              )}

                              {/* Time */}
                              <div className="flex items-center gap-2 ml-6">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm text-foreground">
                                  {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
                                </span>
                              </div>

                              {/* Partners */}
                              {a.partners.length > 0 && (
                                <div className="flex items-center gap-2 ml-6">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm text-foreground">
                                    Makker: {a.partners.join(", ")}
                                  </span>
                                </div>
                              )}

                              {/* Badges row */}
                              <div className="flex items-center gap-2 ml-6 flex-wrap">
                                {a.vehicle && (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-100 dark:border-yellow-700 gap-1">
                                    <Car className="h-3 w-3" />
                                    {(a.vehicle as any)?.name}
                                  </Badge>
                                )}
                                {a.diet && (
                                  <Badge variant="outline" className="bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-700 gap-1">
                                    <Utensils className="h-3 w-3" />
                                    Diæt
                                  </Badge>
                                )}
                                {a.hotel && (
                                  <Badge variant="outline" className="bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-700 gap-1">
                                    <Hotel className="h-3 w-3" />
                                    {a.hotel.name || "Hotel"}
                                  </Badge>
                                )}
                              </div>

                              {/* Hotel detail callout on check-in day */}
                              {a.hotel?.isCheckInDay && (
                                <div className="ml-6 mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Hotel className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{a.hotel.name || "Hotel"}</span>
                                  </div>
                                  {(a.hotel.address || a.hotel.city) && (
                                    <p className="text-sm text-foreground ml-5 mb-1">
                                      {[a.hotel.address, a.hotel.city].filter(Boolean).join(", ")}
                                    </p>
                                  )}
                                  <div className="text-sm text-foreground ml-5 space-y-0.5">
                                    <p>Indtjekning: {format(parseISO(a.hotel.checkIn), "EEEE d. MMM", { locale: da })}</p>
                                    <p>Udtjekning: {format(parseISO(a.hotel.checkOut), "EEEE d. MMM", { locale: da })}</p>
                                  </div>
                                  {a.hotel.phone && (
                                    <p className="text-xs text-muted-foreground ml-5 mt-1">Tlf: {a.hotel.phone}</p>
                                  )}
                                  {a.hotel.notes && (
                                    <p className="text-xs text-muted-foreground ml-5 mt-1 italic">{a.hotel.notes}</p>
                                  )}
                                </div>
                              )}

                              {/* Hotel checkout reminder */}
                              {a.hotel?.isCheckOutDay && !a.hotel?.isCheckInDay && (
                                <div className="ml-6 mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                                  <div className="flex items-center gap-1.5">
                                    <Hotel className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Udtjekning i dag – {a.hotel.name}</span>
                                  </div>
                                </div>
                              )}

                              {/* Booking comment callout */}
                              {booking?.comment && (
                                <div className="ml-6 mt-2 p-3 rounded-lg bg-accent/50 border border-border">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-xs font-semibold text-primary">Note</span>
                                  </div>
                                  <p className="text-sm text-foreground">{booking.comment}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </VagtFlowLayout>
  );
}
