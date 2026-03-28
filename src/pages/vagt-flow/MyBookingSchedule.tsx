import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, MapPin, Clock, Users, Car, Utensils, CalendarDays, MessageSquare, Hotel, Package, CheckCircle2 } from "lucide-react";
import { startOfWeek, addDays, addWeeks, format, isToday, isBefore, parseISO, getISOWeek } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VehicleReturnCallout } from "@/components/vagt-flow/VehicleReturnCallout";

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export default function MyBookingSchedule() {
  const { user } = useAuth();
  const [referenceDate, setReferenceDate] = useState(new Date());
  const queryClient = useQueryClient();

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

  // Fetch employee name for notifications
  const { data: employeeName } = useQuery({
    queryKey: ["my-employee-name", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name")
        .eq("id", employeeId)
        .maybeSingle();
      return data ? `${data.first_name} ${data.last_name}` : null;
    },
    enabled: !!employeeId,
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
            id, status, week_number, year, start_date, end_date,
            location:location_id ( id, name, address_city, address_street ),
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

      const confirmed = (data ?? []).filter(
        (a: any) => a.booking?.status === 'confirmed'
      );
      return confirmed;
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
        .select("id, booking_id, date, vehicle:vehicle_id ( id, name, license_plate )")
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
        .select("booking_id, check_in, check_out, check_in_time, check_out_time, notes, status, hotel:hotel_id ( name, address, city, phone )")
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

  // Fetch existing vehicle return confirmations by booking_id + vehicle_id
  const { data: vehicleConfirmations } = useQuery({
    queryKey: ["vehicle-return-confirmations", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("vehicle_return_confirmation")
        .select("id, booking_id, vehicle_id, booking_date, confirmed_at")
        .in("booking_id", bookingIds);
      return data ?? [];
    },
    enabled: bookingIds.length > 0,
  });

  // Vehicle return confirmation mutation
  const confirmVehicleReturn = useMutation({
    mutationFn: async ({ bookingId, vehicleId, vehicleName, bookingDate, photo }: { bookingId: string; vehicleId: string; vehicleName: string; bookingDate: string; photo?: File }) => {
      let photoUrl: string | null = null;

      // Upload photo if provided
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${bookingId}/${vehicleId}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("vehicle-return-photos")
          .upload(path, photo, { contentType: photo.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("vehicle-return-photos")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      // Call edge function that handles both DB upsert and email notification
      const { data: fnData, error: fnError } = await supabase.functions.invoke("notify-vehicle-returned", {
        body: {
          booking_id: bookingId,
          vehicle_id: vehicleId,
          vehicle_name: vehicleName,
          booking_date: bookingDate,
          photo_url: photoUrl,
          employee_id: employeeId,
        },
      });

      if (fnError) throw new Error(fnError.message || "Funktionskald fejlede");

      // Parse response for notification status
      const result = typeof fnData === "string" ? JSON.parse(fnData) : fnData;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (result: any) => {
      if (result?.notified > 0) {
        toast.success("Nøgle aflevering bekræftet og notifikation sendt!");
      } else {
        toast.success("Nøgle aflevering bekræftet!", { description: "Ingen FM-ledere fundet til notifikation." });
      }
      queryClient.invalidateQueries({ queryKey: ["vehicle-return-confirmations"] });
    },
    onError: (err: any) => {
      toast.error("Kunne ikke bekræfte: " + err.message);
    },
  });

  // Undo vehicle return confirmation
  const undoVehicleReturn = useMutation({
    mutationFn: async ({ bookingId, vehicleId, bookingDate }: { bookingId: string; vehicleId: string; bookingDate: string }) => {
      const { error } = await (supabase as any)
        .from("vehicle_return_confirmation")
        .delete()
        .eq("booking_id", bookingId)
        .eq("vehicle_id", vehicleId)
        .eq("booking_date", bookingDate);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aflevering fortrudt");
      queryClient.invalidateQueries({ queryKey: ["vehicle-return-confirmations"] });
    },
    onError: (err: any) => {
      toast.error("Kunne ikke fortryde: " + err.message);
    },
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

        // Match hotel
        const hotelForBooking = bookingHotels?.find((bh: any) => {
          if (bh.booking_id !== a.booking_id) return false;
          if (bh.check_in && bh.check_out) {
            return a.date >= bh.check_in && a.date <= bh.check_out;
          }
          return true;
        }) ?? bookingHotels?.find((bh: any) => {
          if (bh.check_in && bh.check_out) {
            return a.date >= bh.check_in && a.date <= bh.check_out;
          }
          return false;
        });

        const isFirstShiftDay = hotelForBooking ? (() => {
          const allDatesWithHotel = assignments
            ?.filter((ass: any) => {
              if (!hotelForBooking.check_in || !hotelForBooking.check_out) return true;
              return ass.date >= hotelForBooking.check_in && ass.date <= hotelForBooking.check_out;
            })
            .map((ass: any) => ass.date)
            .sort() ?? [];
          return allDatesWithHotel[0] === a.date;
        })() : false;

        const isLastShiftDay = hotelForBooking ? (() => {
          const allDatesWithHotel = assignments
            ?.filter((ass: any) => {
              if (!hotelForBooking.check_in || !hotelForBooking.check_out) return false;
              return ass.date >= hotelForBooking.check_in && ass.date <= hotelForBooking.check_out;
            })
            .map((ass: any) => ass.date)
            .sort() ?? [];
          return allDatesWithHotel[allDatesWithHotel.length - 1] === a.date;
        })() : false;

        // Stands/roll-ups: use booking's start_date/end_date
        const booking = a.booking;
        const isFirstBookingDay = booking?.start_date ? a.date === booking.start_date : false;
        const isLastBookingDay = booking?.end_date ? a.date === booking.end_date : false;

        // Vehicle last day: check if this is the last date this vehicle is booked for this booking
        const isLastVehicleDay = vehicleForDay ? (() => {
          const vehicleId = vehicleForDay.vehicle?.id;
          const vehicleName = (vehicleForDay.vehicle?.name ?? "").toLowerCase();
          // Exclude GreenMobility
          if (vehicleName.includes("greenmobility") || vehicleName.includes("green mobility")) return false;
          const allDatesForVehicle = vehicles
            ?.filter((v: any) => v.booking_id === a.booking_id && v.vehicle?.id === vehicleId)
            .map((v: any) => v.date)
            .sort() ?? [];
          return allDatesForVehicle[allDatesForVehicle.length - 1] === a.date;
        })() : false;

        // Check if vehicle return already confirmed
        const vehicleReturnConfirmed = vehicleForDay && isLastVehicleDay
          ? vehicleConfirmations?.find((c: any) => c.booking_id === a.booking_id && c.vehicle_id === vehicleForDay.vehicle?.id && c.booking_date === a.date)
          : null;

        days[a.date].assignments.push({
          ...a,
          vehicle: vehicleForDay?.vehicle,
          vehicleBookingId: vehicleForDay?.id,
          diet: dietForDay,
          partners: partnersForDay.map((p: any) => p.employee?.first_name).filter(Boolean),
          isFirstBookingDay,
          isLastBookingDay,
          isLastVehicleDay,
          vehicleReturnConfirmed,
          hotel: hotelForBooking ? {
            name: hotelForBooking.hotel?.name,
            address: hotelForBooking.hotel?.address,
            city: hotelForBooking.hotel?.city,
            phone: hotelForBooking.hotel?.phone,
            checkIn: hotelForBooking.check_in,
            checkOut: hotelForBooking.check_out,
            checkInTime: hotelForBooking.check_in_time,
            checkOutTime: hotelForBooking.check_out_time,
            notes: hotelForBooking.notes,
            isCheckInDay: isFirstShiftDay,
            isCheckOutDay: isLastShiftDay && !isFirstShiftDay,
          } : null,
        });
      }
    });

    return Object.values(days);
  }, [assignments, vehicles, diets, partners, bookingHotels, vehicleConfirmations, weekStart]);

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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">Min vagtplan</h1>
            <p className="text-xs text-muted-foreground">
              Uge {weekNumber} · {format(weekStart, "d. MMM", { locale: da })} – {format(weekEnd, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => setReferenceDate(new Date())}>
              I dag
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setReferenceDate(d => addWeeks(d, -1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setReferenceDate(d => addWeeks(d, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Next shift highlight */}
        {nextShift && nextShift.assignments.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs mb-0.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Næste vagt: {nextShift.dayName} {format(nextShift.date, "d/M")}
            </div>
            {nextShift.assignments.map((a: any, i: number) => (
              <div key={i} className="text-xs text-foreground">
                {(a.booking as any)?.location?.name} · {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Indlæser vagtplan...</div>
        ) : (
          <div className="space-y-2">
            {dayData.map((day: any) => {
              const isDayToday = isToday(day.date);
              const isPast = isBefore(day.date, new Date()) && !isDayToday;

              if (isPast && day.assignments.length === 0) return null;

              if (day.assignments.length === 0) {
                return (
                  <div
                    key={day.dateStr}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border/50"
                  >
                    <span className="font-medium">{day.dayName.slice(0, 3).toUpperCase()} {format(day.date, "d/M")}</span>
                    {isDayToday && <Badge variant="default" className="text-[10px] h-4 px-1.5">I dag</Badge>}
                    <span className="italic">– Ingen vagt</span>
                  </div>
                );
              }

              return (
                <Card
                  key={day.dateStr}
                  className={cn(
                    "transition-colors",
                    isDayToday && "border-primary/50 bg-primary/5"
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm text-foreground">
                        {day.dayName.slice(0, 3).toUpperCase()} {format(day.date, "d/M")}
                      </span>
                      {isDayToday && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5">I dag</Badge>
                      )}
                    </div>

                    <div className="space-y-3">
                      {day.assignments.map((a: any, idx: number) => {
                        const booking = a.booking as any;
                        const location = booking?.location;
                        const client = booking?.client;
                        const campaign = booking?.campaign;

                        return (
                          <div key={idx} className="border-l-2 border-primary/40 pl-3 space-y-1">
                            <div className="font-semibold text-sm text-foreground leading-tight">
                              {location?.name || "Ukendt lokation"}
                            </div>

                            {(location?.address_street || location?.address_city) && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.address_street, location.address_city].filter(Boolean).join(", "))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                              >
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="underline">{[location.address_street, location.address_city].filter(Boolean).join(", ")}</span>
                              </a>
                            )}

                            {(client?.name || campaign?.name) && (
                              <p className="text-xs text-muted-foreground">
                                {client?.name}{campaign?.name ? ` – ${campaign.name}` : ""}
                              </p>
                            )}

                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-foreground">
                                {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
                              </span>
                            </div>

                            {a.partners.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-foreground">
                                  Makker: {a.partners.join(", ")}
                                </span>
                              </div>
                            )}

                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {a.vehicle && (
                                <Badge variant="outline" className="text-[11px] py-0 px-1.5 h-5 bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-100 dark:border-yellow-700 gap-1">
                                  <Car className="h-2.5 w-2.5" />
                                  {(a.vehicle as any)?.name}
                                </Badge>
                              )}
                              {a.diet && (
                                <Badge variant="outline" className="text-[11px] py-0 px-1.5 h-5 bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-700 gap-1">
                                  <Utensils className="h-2.5 w-2.5" />
                                  Diæt
                                </Badge>
                              )}
                              {a.hotel && (
                                <Badge variant="outline" className="text-[11px] py-0 px-1.5 h-5 bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-700 gap-1">
                                  <Hotel className="h-2.5 w-2.5" />
                                  {a.hotel.name || "Hotel"}
                                </Badge>
                              )}
                            </div>

                            {/* Stands/roll-ups reminders */}
                            {a.isFirstBookingDay && (
                              <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-600/10 border border-green-500/20 dark:bg-green-500/10 dark:border-green-400/20">
                                <Package className="w-3.5 h-3.5 text-green-700 dark:text-green-300 shrink-0" />
                                <span className="text-[11px] font-medium text-green-700 dark:text-green-300">Husk at medbringe stande og roll-ups</span>
                              </div>
                            )}
                            {a.isLastBookingDay && !a.isFirstBookingDay && (
                              <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-orange-600/10 border border-orange-500/20 dark:bg-orange-500/10 dark:border-orange-400/20">
                                <Package className="w-3.5 h-3.5 text-orange-700 dark:text-orange-300 shrink-0" />
                                <span className="text-[11px] font-medium text-orange-700 dark:text-orange-300">Husk at tage stande og roll-ups med hjem</span>
                              </div>
                            )}

                            {/* Vehicle return callout */}
                            {a.isLastVehicleDay && (
                              <VehicleReturnCallout
                                vehicleName={(a.vehicle as any)?.name ?? "Bil"}
                                confirmed={a.vehicleReturnConfirmed}
                                isConfirming={confirmVehicleReturn.isPending}
                                isUndoing={undoVehicleReturn.isPending}
                                onConfirm={(photo?: File) =>
                                  confirmVehicleReturn.mutate({
                                    bookingId: a.booking_id,
                                    vehicleId: (a.vehicle as any)?.id,
                                    vehicleName: (a.vehicle as any)?.name ?? "Bil",
                                    bookingDate: a.date,
                                    photo,
                                  })
                                }
                                onUndo={() =>
                                  undoVehicleReturn.mutate({
                                    bookingId: a.booking_id,
                                    vehicleId: (a.vehicle as any)?.id,
                                    bookingDate: a.date,
                                  })
                                }
                              />
                            )}

                            {/* Hotel detail callout */}
                            {a.hotel && (
                              <div className="mt-1 px-2.5 py-1.5 rounded-md bg-blue-600/10 border border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-400/20">
                                {a.hotel.isCheckInDay && (
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-0.5">Indtjekning i dag</div>
                                )}
                                {a.hotel.isCheckOutDay && !a.hotel.isCheckInDay && (
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-0.5">Udtjekning i dag</div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Hotel className="w-3 h-3 text-blue-700 dark:text-blue-300 shrink-0" />
                                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{a.hotel.name || "Hotel"}</span>
                                </div>
                                {(a.hotel.address || a.hotel.city) && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.hotel.address, a.hotel.city].filter(Boolean).join(", "))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 mt-0.5"
                                  >
                                    <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="text-[11px] text-blue-600 dark:text-blue-400 underline">{[a.hotel.address, a.hotel.city].filter(Boolean).join(", ")}</span>
                                  </a>
                                )}
                                <div className="text-[11px] text-foreground ml-4 mt-0.5 flex flex-wrap gap-x-2">
                                  <span>Ind: {format(parseISO(a.hotel.checkIn), "EEE d/M", { locale: da })}{a.hotel.checkInTime ? ` kl. ${a.hotel.checkInTime.slice(0, 5)}` : ""}</span>
                                  <span>Ud: {format(parseISO(a.hotel.checkOut), "EEE d/M", { locale: da })}{a.hotel.checkOutTime ? ` kl. ${a.hotel.checkOutTime.slice(0, 5)}` : ""}</span>
                                  {a.hotel.phone && <span>Tlf: {a.hotel.phone}</span>}
                                </div>
                                {a.hotel.notes && (
                                  <p className="text-[11px] text-foreground/70 ml-4 mt-0.5 italic">{a.hotel.notes}</p>
                                )}
                              </div>
                            )}

                            {/* Booking comment callout */}
                            {booking?.comment && (
                              <div className="mt-1 px-2.5 py-1.5 rounded-md bg-accent/50 border border-border">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <MessageSquare className="w-3 h-3 text-primary" />
                                  <span className="text-[11px] font-semibold text-primary">Note</span>
                                </div>
                                <p className="text-xs text-foreground">{booking.comment}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
