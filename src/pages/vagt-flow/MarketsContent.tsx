import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Calendar as CalendarIcon, 
  Tent,
  Users,
  MapPin,
  Clock
} from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarketCalendarWidget } from "@/components/vagt-flow/MarketCalendarWidget";
import { EditBookingDialog } from "@/components/vagt-flow/EditBookingDialog";
import { getWeekStartDate } from "@/lib/calculations";

// Market/Fair location types
const MARKET_TYPES = ["Markeder", "Messer"];

export default function MarketsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [editBookingDialogBooking, setEditBookingDialogBooking] = useState<any>(null);
  const [pastSectionOpen, setPastSectionOpen] = useState(false);

  // Fetch market bookings (next 12 months)
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-market-bookings"],
    queryFn: async () => {
      const today = new Date();
      const sixMonthsAgo = addMonths(today, -6);
      const twelveMonthsFromNow = addMonths(today, 12);

      const { data: bookingData, error } = await supabase
        .from("booking")
        .select(`
          *,
          location!inner(id, name, address_city, region, type, daily_rate),
          clients(id, name),
          client_campaigns:campaign_id(id, name),
          booking_assignment(id, date, employee_id)
        `)
        .in("location.type", MARKET_TYPES)
        .gte("start_date", format(sixMonthsAgo, "yyyy-MM-dd"))
        .lte("start_date", format(twelveMonthsFromNow, "yyyy-MM-dd"))
        .order("start_date");

      if (error) throw error;
      
      // Fetch employee names for assignments
      const employeeIds = [...new Set(
        bookingData?.flatMap(b => b.booking_assignment?.map((a: any) => a.employee_id) || []) || []
      )];
      
      let employeeMap = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: empData } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name")
          .in("id", employeeIds);
        
        employeeMap = new Map(empData?.map(e => [e.id, `${e.first_name} ${e.last_name}`]) || []);
      }

      return bookingData?.map(booking => ({
        ...booking,
        booking_assignment: booking.booking_assignment?.map((a: any) => ({
          ...a,
          employee_name: employeeMap.get(a.employee_id) || "Ukendt"
        }))
      }));
    },
  });

  const { data: fieldmarketingClients } = useQuery({
    queryKey: ["fieldmarketing-team-clients-markets"],
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

  // Employees for EditBookingDialog (Fieldmarketing team)
  const { data: employees = [] } = useQuery({
    queryKey: ["vagt-employees-for-markets-fieldmarketing"],
    queryFn: async () => {
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", "Fieldmarketing")
        .maybeSingle();

      if (!teamData) return [];

      const { data } = await supabase
        .from("team_members")
        .select(`employee_id, employee:employee_id(id, first_name, last_name, is_active)`)
        .eq("team_id", teamData.id);

      return (data || [])
        .filter((tm: any) => tm.employee?.is_active)
        .map((tm: any) => ({
          id: tm.employee.id,
          full_name: `${tm.employee.first_name} ${tm.employee.last_name}`,
          team: teamData.name,
        }));
    },
  });

  // Vehicles for EditBookingDialog
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vagt-vehicles-for-markets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle")
        .select("id, name, license_plate")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("booking").delete().eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Marked-booking slettet" });
      setDeleteBookingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  // Bulk assign mutation for adding employees via EditBookingDialog
  const bulkAssignMutation = useMutation({
    mutationFn: async (assignments: { bookingId: string; employeeId: string; dates: string[]; startTime: string; endTime: string }[]) => {
      const inserts = assignments.flatMap(a => 
        a.dates.map(date => ({
          booking_id: a.bookingId,
          employee_id: a.employeeId,
          date,
          start_time: a.startTime || "09:00",
          end_time: a.endTime || "17:00",
        }))
      );
      const { data, error } = await supabase.from("booking_assignment").insert(inserts).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Medarbejdere tilføjet" });
    },
    onError: (error: any) => {
      const isUniqueViolation = error.message?.includes('unique') || 
                                error.message?.includes('duplicate') ||
                                error.code === '23505';
      const message = isUniqueViolation 
        ? "Medarbejder er allerede booket på en eller flere af de valgte dage"
        : error.message;
      toast({ title: "Fejl", description: message, variant: "destructive" });
    },
  });

  // Filter bookings
  const filtered = useMemo(() => {
    return bookings?.filter((b: any) => {
      const matchesClient = clientFilter === "all" || b.client_id === clientFilter;
      return matchesClient;
    }) || [];
  }, [bookings, clientFilter]);

  // Split into upcoming and past
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return {
      upcomingBookings: filtered.filter((b: any) => b.start_date >= todayStr),
      pastBookings: filtered.filter((b: any) => b.start_date < todayStr),
    };
  }, [filtered]);

  // Group by month (upcoming)
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, { label: string; bookings: any[] }> = {};
    for (const booking of upcomingBookings) {
      const startDate = parseISO(booking.start_date);
      const monthKey = format(startDate, "yyyy-MM");
      const monthLabel = format(startDate, "MMMM yyyy", { locale: da });
      if (!groups[monthKey]) {
        groups[monthKey] = { label: monthLabel, bookings: [] };
      }
      groups[monthKey].bookings.push(booking);
    }
    return groups;
  }, [upcomingBookings]);

  // Group by month (past)
  const pastGroupedByMonth = useMemo(() => {
    const groups: Record<string, { label: string; bookings: any[] }> = {};
    for (const booking of pastBookings) {
      const startDate = parseISO(booking.start_date);
      const monthKey = format(startDate, "yyyy-MM");
      const monthLabel = format(startDate, "MMMM yyyy", { locale: da });
      if (!groups[monthKey]) {
        groups[monthKey] = { label: monthLabel, bookings: [] };
      }
      groups[monthKey].bookings.push(booking);
    }
    return groups;
  }, [pastBookings]);


  const toggleMonthExpand = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getStaffingStatus = (booking: any) => {
    const assigned = booking.booking_assignment?.length || 0;
    const expected = booking.expected_staff_count || 2;
    
    if (assigned === 0) return { label: "Afventer bemanding", color: "bg-red-100 text-red-700" };
    if (assigned < expected) return { label: `${assigned}/${expected} bemandat`, color: "bg-yellow-100 text-yellow-700" };
    return { label: "Fuldt bemandat", color: "bg-green-100 text-green-700" };
  };

  const getDateDisplay = (booking: any) => {
    const start = parseISO(booking.start_date);
    const end = parseISO(booking.end_date);
    
    if (format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")) {
      return format(start, "d. MMM yyyy", { locale: da });
    }
    
    if (format(start, "yyyy-MM") === format(end, "yyyy-MM")) {
      return `${format(start, "d.", { locale: da })} - ${format(end, "d. MMM yyyy", { locale: da })}`;
    }
    
    return `${format(start, "d. MMM", { locale: da })} - ${format(end, "d. MMM yyyy", { locale: da })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-lg px-4 py-2">
          {upcomingBookings.length} kommende{pastBookings.length > 0 && ` · ${pastBookings.length} tidligere`}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle kunder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kunder</SelectItem>
                {fieldmarketingClients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar widget - always show */}
      {!isLoading && (
        <MarketCalendarWidget 
          bookings={filtered} 
          onBookingClick={(booking) => setEditBookingDialogBooking(booking)}
        />
      )}

      {/* Markets by month */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Indlæser markeder...</p>
          </CardContent>
        </Card>
      ) : Object.keys(groupedByMonth).length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Tent className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Ingen kommende markeder eller messer</p>
              <p className="text-sm text-muted-foreground mt-1">Book markeder via "Book uge" fanen</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByMonth).map(([monthKey, { label, bookings: monthBookings }]) => (
          <Collapsible
            key={monthKey}
            open={expandedMonths.has(monthKey)}
            onOpenChange={() => toggleMonthExpand(monthKey)}
            defaultOpen={true}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold capitalize">{label}</h3>
                      <p className="text-sm text-muted-foreground">{monthBookings.length} events</p>
                    </div>
                  </div>
                  {expandedMonths.has(monthKey) ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {monthBookings.map((booking: any) => {
                      const staffingStatus = getStaffingStatus(booking);
                      
                      return (
                        <div 
                          key={booking.id} 
                          className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setEditBookingDialogBooking(booking)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{booking.location?.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {booking.location?.type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  {getDateDisplay(booking)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {booking.location?.region || "Ukendt landsdel"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Uge {booking.week_number}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary">{booking.clients?.name || "Ukendt kunde"}</Badge>
                                <Badge className={staffingStatus.color}>
                                  <Users className="h-3 w-3 mr-1" />
                                  {staffingStatus.label}
                                </Badge>
                                {/* Display total price for markets */}
                                {booking.total_price != null && (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    {booking.total_price.toLocaleString("da-DK")} kr
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteBookingId(booking.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Assigned employees */}
                          {booking.booking_assignment && booking.booking_assignment.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Tildelte medarbejdere:</p>
                              <div className="flex flex-wrap gap-1">
                                {booking.booking_assignment.slice(0, 5).map((a: any) => (
                                  <Badge key={a.id} variant="secondary" className="text-xs">
                                    {a.employee_name}
                                  </Badge>
                                ))}
                                {booking.booking_assignment.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{booking.booking_assignment.length - 5} mere
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))
      )}

      {/* Past markets section */}
      {Object.keys(pastGroupedByMonth).length > 0 && (
        <Collapsible open={pastSectionOpen} onOpenChange={setPastSectionOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-muted-foreground">Tidligere markeder</h3>
                  <p className="text-sm text-muted-foreground">{pastBookings.length} afviklede events</p>
                </div>
              </div>
              {pastSectionOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-4 mt-4 opacity-70">
              {Object.entries(pastGroupedByMonth)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([monthKey, { label, bookings: monthBookings }]) => (
                <Card key={monthKey} className="bg-muted/20">
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-medium capitalize text-muted-foreground">{label}</h4>
                      <span className="text-sm text-muted-foreground">({monthBookings.length})</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {monthBookings.map((booking: any) => {
                        const staffingStatus = getStaffingStatus(booking);
                        return (
                          <div
                            key={booking.id}
                            className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setEditBookingDialogBooking(booking)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">{booking.location?.name}</h4>
                                  <Badge variant="outline" className="text-xs">{booking.location?.type}</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {getDateDisplay(booking)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {booking.location?.region || "Ukendt"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">{booking.clients?.name || "Ukendt"}</Badge>
                                  <Badge className={`text-xs ${staffingStatus.color}`}>
                                    <Users className="h-3 w-3 mr-1" />
                                    {staffingStatus.label}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteBookingId(booking.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet marked-booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette bookingen og alle tilknyttede vagter. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBookingId && deleteBookingMutation.mutate(deleteBookingId)}
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit booking dialog */}
      {editBookingDialogBooking && (
        <EditBookingDialog
          open={!!editBookingDialogBooking}
          onOpenChange={(open) => !open && setEditBookingDialogBooking(null)}
          booking={editBookingDialogBooking}
          weekNumber={editBookingDialogBooking.week_number}
          year={editBookingDialogBooking.year}
          weekStart={getWeekStartDate(editBookingDialogBooking.year, editBookingDialogBooking.week_number)}
          employees={employees}
          vehicles={vehicles}
          onAddEmployeeAssignments={(assignments) => {
            bulkAssignMutation.mutate(
              assignments.map(a => ({
                bookingId: editBookingDialogBooking.id,
                employeeId: a.employeeId,
                dates: a.dates,
                startTime: a.startTime,
                endTime: a.endTime,
              }))
            );
          }}
          onAddVehicleAssignment={async (assignment) => {
            const inserts = assignment.dates.map(date => ({
              booking_id: editBookingDialogBooking.id,
              vehicle_id: assignment.vehicleId,
              date,
            }));
            const { error } = await supabase.from("booking_vehicle").insert(inserts);
            if (error) {
              toast({ title: "Fejl", description: error.message, variant: "destructive" });
            } else {
              queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
              toast({ title: "Bil tilføjet" });
            }
          }}
        />
      )}
    </div>
  );
}
