import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Calendar, Car, AlertTriangle, Users, FileText, X } from "lucide-react";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { format, addDays, getWeek, getYear } from "date-fns";
import { getWeekStartDate } from "@/lib/vagt-flow-date-utils";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AddEmployeeDialog } from "@/components/vagt-flow/AddEmployeeDialog";
import { AddVehicleDialog } from "@/components/vagt-flow/AddVehicleDialog";

export default function BookingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canEditFmBookings } = usePermissions();
  const now = new Date();
  const [selectedWeek, setSelectedWeek] = useState(getWeek(now, { weekStartsOn: 1 }));
  const [selectedYear, setSelectedYear] = useState(getYear(now));
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([`${selectedYear}-${selectedWeek}`]));
  const [addEmployeeDialogBooking, setAddEmployeeDialogBooking] = useState<any>(null);
  const [addVehicleDialogBooking, setAddVehicleDialogBooking] = useState<any>(null);

  const weekStart = getWeekStartDate(selectedYear, selectedWeek);
  const DAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-bookings-list", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data: bookingData, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city, type),
          clients(id, name),
          client_campaigns:campaign_id(id, name),
          booking_assignment(id, date, employee_id)
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .order("start_date");
      if (error) throw error;
      
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
    queryKey: ["fieldmarketing-team-clients-bookings"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .single();
      
      if (!team) return [];
      
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);
      
      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
    },
  });

  // Fetch Fieldmarketing employees from employee_master_data
  const { data: employees = [] } = useQuery({
    queryKey: ["vagt-employees-for-booking-fieldmarketing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, department")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data?.map(e => ({
        id: e.id,
        full_name: `${e.first_name} ${e.last_name}`,
        team: e.department,
      })) || [];
    },
  });

  // Fetch vehicles for the dialog
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vagt-vehicles-for-booking"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle")
        .select("id, name, license_plate")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (assignments: { bookingId: string; employeeId: string; dates: string[] }[]) => {
      const inserts = assignments.flatMap(a => 
        a.dates.map(date => ({
          booking_id: a.bookingId,
          employee_id: a.employeeId,
          date,
          start_time: "09:00",
          end_time: "17:00",
        }))
      );
      const { error } = await supabase.from("booking_assignment").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Medarbejdere tilføjet" });
      setAddEmployeeDialogBooking(null);
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("booking").delete().eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Booking slettet" });
      setDeleteBookingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("booking_assignment").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Medarbejder fjernet fra vagt" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const filtered = bookings?.filter((b: any) => {
    const matchesClient = clientFilter === "all" || b.client_id === clientFilter;
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesClient && matchesStatus;
  });

  const groupedByClient = filtered?.reduce((acc: any, booking: any) => {
    const clientId = booking.client_id || "unknown";
    const clientName = booking.clients?.name || "Ukendt kunde";
    if (!acc[clientId]) {
      acc[clientId] = { name: clientName, bookings: [] };
    }
    acc[clientId].bookings.push(booking);
    return acc;
  }, {});

  const toggleWeekExpand = (key: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handlePrevWeek = () => {
    if (selectedWeek === 1) {
      setSelectedWeek(52);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeek === 52) {
      setSelectedWeek(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedWeek(selectedWeek + 1);
    }
  };

  const statusColors: Record<string, string> = {
    Planlagt: "bg-blue-100 text-blue-700",
    Bekræftet: "bg-green-100 text-green-700",
    Afsluttet: "bg-gray-100 text-gray-700",
    Aflyst: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bookinger</h2>
          <p className="text-muted-foreground">Oversigt over alle planlagte bookinger</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-xl border">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-bold">{selectedWeek}</div>
            <div className="text-xs text-muted-foreground">{selectedYear}</div>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronUp className="h-4 w-4 rotate-90" />
          </Button>
        </div>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle statusser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statusser</SelectItem>
                <SelectItem value="Bekræftet">Bekræftet</SelectItem>
                <SelectItem value="Afsluttet">Afsluttet</SelectItem>
                <SelectItem value="Aflyst">Aflyst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings by client */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Indlæser bookinger...</p>
          </CardContent>
        </Card>
      ) : !groupedByClient || Object.keys(groupedByClient).length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Ingen bookinger i uge {selectedWeek}, {selectedYear}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByClient).map(([clientId, { name, bookings: clientBookings }]: [string, any]) => (
          <Collapsible
            key={clientId}
            open={expandedWeeks.has(`${selectedYear}-${selectedWeek}-${clientId}`)}
            onOpenChange={() => toggleWeekExpand(`${selectedYear}-${selectedWeek}-${clientId}`)}
            defaultOpen
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">{name}</h3>
                      <p className="text-sm text-muted-foreground">{clientBookings.length} bookinger</p>
                    </div>
                  </div>
                  {expandedWeeks.has(`${selectedYear}-${selectedWeek}-${clientId}`) ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  {clientBookings.map((booking: any) => (
                    <div key={booking.id} className="p-4 border-b last:border-b-0 hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-3">
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/vagt-flow/locations/${booking.location_id}`)}
                        >
                          <p className="font-medium hover:underline">{booking.location?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.location?.address_city} • {booking.location?.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[booking.status] || "bg-gray-100 text-gray-700"}>
                            {booking.status}
                          </Badge>
                          {canEditFmBookings && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteBookingId(booking.id)}
                              title="Slet booking"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Days grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS.map((day, idx) => {
                          const isBooked = booking.booked_days?.includes(idx);
                          const dayDate = addDays(weekStart, idx);
                          const dayAssignments = booking.booking_assignment?.filter(
                            (a: any) => format(new Date(a.date), "yyyy-MM-dd") === format(dayDate, "yyyy-MM-dd")
                          );
                          
                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg text-center text-xs ${
                                isBooked ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                              }`}
                            >
                              <p className="font-medium">{day}</p>
                              <p className="text-muted-foreground">{format(dayDate, "d/M")}</p>
                              {isBooked && dayAssignments?.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {dayAssignments.map((assignment: any) => (
                                    <div key={assignment.id} className="text-[10px] text-primary font-medium truncate flex items-center justify-center gap-0.5 group">
                                      <span>{assignment.employee_name?.split(' ')[0]}</span>
                                      {canEditFmBookings && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteAssignmentMutation.mutate(assignment.id);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                                          title="Fjern medarbejder"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick actions - only show if user can edit */}
                      {canEditFmBookings && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddEmployeeDialogBooking(booking)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Tilføj medarbejder
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddVehicleDialogBooking(booking)}
                          >
                            <Car className="h-4 w-4 mr-1" />
                            Tilføj bil
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handling kan ikke fortrydes. Bookingen og alle tilhørende tildelinger vil blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBookingId && deleteBookingMutation.mutate(deleteBookingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Employee Dialog */}
      <AddEmployeeDialog
        open={!!addEmployeeDialogBooking}
        onOpenChange={(open) => !open && setAddEmployeeDialogBooking(null)}
        booking={addEmployeeDialogBooking}
        weekNumber={selectedWeek}
        year={selectedYear}
        weekStart={weekStart}
        employees={employees}
        onAddAssignments={(assignments) => {
          if (!addEmployeeDialogBooking) return;
          bulkAssignMutation.mutate(
            assignments.map(a => ({
              bookingId: addEmployeeDialogBooking.id,
              employeeId: a.employeeId,
              dates: a.dates,
            }))
          );
        }}
      />

      {/* Add Vehicle Dialog */}
      <AddVehicleDialog
        open={!!addVehicleDialogBooking}
        onOpenChange={(open) => !open && setAddVehicleDialogBooking(null)}
        booking={addVehicleDialogBooking}
        weekNumber={selectedWeek}
        year={selectedYear}
        weekStart={weekStart}
        vehicles={vehicles}
        onAddAssignments={() => {
          queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
          setAddVehicleDialogBooking(null);
        }}
      />

    </div>
  );
}
