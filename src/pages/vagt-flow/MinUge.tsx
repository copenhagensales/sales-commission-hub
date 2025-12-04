import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandBadge } from "@/components/vagt-flow/BrandBadge";
import { ChevronLeft, ChevronRight, MapPin, Clock, Phone, Navigation } from "lucide-react";
import { useState } from "react";
import { startOfWeek, endOfWeek, addWeeks, format, isSameDay, eachDayOfInterval, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function VagtMinUge() {
  const { user } = useAuth();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(addWeeks(new Date(), currentWeekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["vagt-my-assignments", user?.id, currentWeekOffset],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("booking_assignment")
        .select(`
          *,
          booking (
            *,
            location (name, address_street, address_city, contact_person_name, contact_phone),
            brand (name, color_hex)
          )
        `)
        .eq("employee_id", user.id)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date")
        .order("start_time");

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const onMyWayMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("booking_assignment")
        .update({ on_my_way_at: new Date().toISOString() })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tak!", description: "Vi har registreret, at du er på vej." });
      queryClient.invalidateQueries({ queryKey: ["vagt-my-assignments"] });
      setSelectedAssignment(null);
    },
  });

  const openInMaps = (address: string, city: string) => {
    const query = encodeURIComponent(`${address}, ${city}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const weekNumber = format(weekStart, "w", { locale: da });
  const year = format(weekStart, "yyyy");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Min uge</h1>
            <p className="text-muted-foreground">
              Uge {weekNumber}, {year} ({format(weekStart, "d/M")} - {format(weekEnd, "d/M")})
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentWeekOffset(0)} disabled={currentWeekOffset === 0}>
              Denne uge
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekOffset((prev) => prev + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4">
            {weekDays.map((day) => {
              const dayAssignments = assignments?.filter((a: any) => isSameDay(parseISO(a.date), day));

              return (
                <Card key={day.toISOString()}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{format(day, "EEEE d. MMMM", { locale: da })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dayAssignments && dayAssignments.length > 0 ? (
                      <div className="space-y-3">
                        {dayAssignments.map((assignment: any) => (
                          <div
                            key={assignment.id}
                            className="p-4 rounded-lg bg-muted hover:bg-accent transition-colors cursor-pointer"
                            onClick={() => setSelectedAssignment(assignment)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <BrandBadge
                                  brandName={assignment.booking.brand.name}
                                  brandColor={assignment.booking.brand.color_hex}
                                />
                                <p className="font-medium">{assignment.booking.location.name}</p>
                                <p className="text-sm text-muted-foreground">{assignment.booking.location.address_city}</p>
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-4 w-4" />
                                  {assignment.start_time?.slice(0, 5)} - {assignment.end_time?.slice(0, 5)}
                                </div>
                                {assignment.on_my_way_at && (
                                  <p className="text-xs text-green-600 font-medium">✓ Registreret på vej</p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm">Se detaljer</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Fri</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-md">
          {selectedAssignment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BrandBadge
                    brandName={selectedAssignment.booking.brand.name}
                    brandColor={selectedAssignment.booking.brand.color_hex}
                  />
                  Vagtdetaljer
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Lokation</h3>
                  <p className="text-sm">{selectedAssignment.booking.location.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAssignment.booking.location.address_street}</p>
                  <p className="text-sm text-muted-foreground">{selectedAssignment.booking.location.address_city}</p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">Tidspunkt</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {selectedAssignment.start_time?.slice(0, 5)} - {selectedAssignment.end_time?.slice(0, 5)}
                  </div>
                </div>

                {selectedAssignment.booking.location.contact_person_name && (
                  <div>
                    <h3 className="font-medium mb-1">Kontaktperson</h3>
                    <p className="text-sm">{selectedAssignment.booking.location.contact_person_name}</p>
                    {selectedAssignment.booking.location.contact_phone && (
                      <a href={`tel:${selectedAssignment.booking.location.contact_phone}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {selectedAssignment.booking.location.contact_phone}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openInMaps(selectedAssignment.booking.location.address_street, selectedAssignment.booking.location.address_city)}
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Åbn i Maps
                  </Button>
                </div>

                {!selectedAssignment.on_my_way_at && isSameDay(parseISO(selectedAssignment.date), new Date()) && (
                  <Button className="w-full" size="lg" onClick={() => onMyWayMutation.mutate(selectedAssignment.id)} disabled={onMyWayMutation.isPending}>
                    {onMyWayMutation.isPending ? "Registrerer..." : "Jeg er på vej"}
                  </Button>
                )}

                {selectedAssignment.on_my_way_at && (
                  <div className="p-3 rounded-lg bg-green-500/10 text-green-600 text-sm text-center font-medium">
                    ✓ Du har registreret, at du er på vej
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
