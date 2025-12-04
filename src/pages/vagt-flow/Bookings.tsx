import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Calendar, Car, AlertTriangle, Users, FileText, X } from "lucide-react";
import { format, startOfWeek, addDays, getWeek, getYear } from "date-fns";
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

export default function VagtBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [selectedWeek, setSelectedWeek] = useState(getWeek(now, { weekStartsOn: 1 }));
  const [selectedYear, setSelectedYear] = useState(getYear(now));
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([`${selectedYear}-${selectedWeek}`]));
  const [absenceExpanded, setAbsenceExpanded] = useState(true);
  const [openAssignPopover, setOpenAssignPopover] = useState<string | null>(null);
  const [addEmployeeDialogBooking, setAddEmployeeDialogBooking] = useState<any>(null);

  const weekStart = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });
  const DAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-bookings-list", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city, type),
          brand(name, color_hex),
          booking_assignment(id, date, employee_id, employee:employee(full_name))
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
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

  const { data: absences } = useQuery({
    queryKey: ["vagt-absences-week", selectedWeek, selectedYear],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      const { data, error } = await supabase
        .from("employee_absence")
        .select(`*, employee:employee(full_name, team)`)
        .gte("start_date", format(weekStart, "yyyy-MM-dd"))
        .lte("end_date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vagt-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicleMileage } = useQuery({
    queryKey: ["vagt-vehicle-mileage", selectedWeek, selectedYear],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      const { data, error } = await supabase
        .from("vehicle_mileage")
        .select(`*, vehicle:vehicle(name)`)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["vagt-employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee")
        .select("id, full_name, team")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Booking slettet" });
      setDeleteBookingId(null);
    },
  });

  const assignEmployeeMutation = useMutation({
    mutationFn: async ({ bookingId, employeeId, date }: { bookingId: string; employeeId: string; date: string }) => {
      const { error } = await supabase.from("booking_assignment").insert({
        booking_id: bookingId,
        employee_id: employeeId,
        date: date,
        start_time: "09:00",
        end_time: "17:00",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      setOpenAssignPopover(null);
    },
    onError: () => {
      toast({ title: "Kunne ikke tildele medarbejder", variant: "destructive" });
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
      toast({ title: "Medarbejdere tildelt" });
      setAddEmployeeDialogBooking(null);
    },
    onError: () => {
      toast({ title: "Kunne ikke tildele medarbejdere", variant: "destructive" });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("booking_assignment").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Tildeling fjernet" });
    },
  });

  const filteredBookings = bookings?.filter((b: any) => {
    if (brandFilter !== "all" && b.brand_id !== brandFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    return true;
  });

  // Group bookings by brand
  const bookingsByBrand = filteredBookings?.reduce((acc: any, booking: any) => {
    const brandId = booking.brand_id;
    if (!acc[brandId]) {
      acc[brandId] = {
        brand: booking.brand,
        bookings: [],
      };
    }
    acc[brandId].bookings.push(booking);
    return acc;
  }, {});

  // Group absences by team
  const absencesByTeam = absences?.reduce((acc: any, absence: any) => {
    const team = absence.employee?.team || "Uden team";
    if (!acc[team]) acc[team] = [];
    acc[team].push(absence);
    return acc;
  }, {});

  const toggleWeek = (weekKey: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey);
    } else {
      newExpanded.add(weekKey);
    }
    setExpandedWeeks(newExpanded);
  };

  const expandAll = () => {
    if (bookingsByBrand) {
      const allKeys = Object.keys(bookingsByBrand).map((brandId) => `${selectedYear}-${selectedWeek}-${brandId}`);
      setExpandedWeeks(new Set([`${selectedYear}-${selectedWeek}`, ...allKeys]));
    }
  };

  const collapseAll = () => {
    setExpandedWeeks(new Set());
  };

  const getAbsenceDays = (absence: any) => {
    const days: number[] = [];
    const start = new Date(absence.start_date);
    const end = new Date(absence.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      days.push(dayIndex);
    }
    return days;
  };

  const getAssignmentForDay = (booking: any, dayIndex: number) => {
    const targetDate = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
    return booking.booking_assignment?.find((a: any) => a.date === targetDate);
  };

  const getVehicleForDay = (bookingId: string, dayIndex: number) => {
    const targetDate = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
    return vehicleMileage?.find((vm: any) => vm.booking_id === bookingId && vm.date === targetDate);
  };

  const hasUnderstaffing = (booking: any) => {
    const assignments = booking.booking_assignment?.length || 0;
    const expected = booking.expected_staff_count || 2;
    return assignments < expected;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight italic">Vagtplan</h1>
            <p className="text-muted-foreground">Overblik over alle vagter</p>
          </div>
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => navigate(`/vagt-flow/book-week?week=${selectedWeek}&year=${selectedYear}`)}
          >
            <Plus className="h-4 w-4 mr-2" /> Book uge
          </Button>
        </div>

        {/* Week selector and filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground mb-2 block">Vælg uge</label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedWeek((w) => w - 1)}
                >
                  ← Forrige uge
                </Button>
                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-md bg-background">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Uge {selectedWeek}, {selectedYear}</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedWeek((w) => w + 1)}
                >
                  Næste uge →
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle status</SelectItem>
                    <SelectItem value="Planlagt">Planlagt</SelectItem>
                    <SelectItem value="Bekræftet">Bekræftet</SelectItem>
                    <SelectItem value="Aflyst">Aflyst</SelectItem>
                    <SelectItem value="Afsluttet">Afsluttet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground mb-2 block">Brand</label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger>
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Absence section */}
        {absences && absences.length > 0 && (
          <Collapsible open={absenceExpanded} onOpenChange={setAbsenceExpanded}>
            <Card className="border-orange-200 bg-orange-50/50">
              <CollapsibleTrigger className="w-full">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">Fravær uge {selectedWeek}</span>
                    <span className="text-muted-foreground text-sm">({absences.length} medarbejdere)</span>
                  </div>
                  {absenceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {Object.entries(absencesByTeam || {}).map(([team, teamAbsences]: [string, any]) => (
                    <div key={team} className="mb-4">
                      <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Team {team}</p>
                      {teamAbsences.map((absence: any) => (
                        <div key={absence.id} className="flex items-center justify-between py-2">
                          <span>{absence.employee?.full_name}</span>
                          <div className="flex gap-1">
                            {DAYS.map((day, idx) => {
                              const isAbsent = getAbsenceDays(absence).includes(idx);
                              return (
                                <div
                                  key={idx}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                    isAbsent 
                                      ? "bg-orange-500 text-white" 
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {day.charAt(0)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Expand/Collapse buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            <ChevronDown className="h-4 w-4 mr-1" /> Udvid alle uger
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <ChevronUp className="h-4 w-4 mr-1" /> Kollaps alle uger
          </Button>
        </div>

        {/* Bookings by brand */}
        {isLoading ? (
          <p>Indlæser...</p>
        ) : bookingsByBrand && Object.keys(bookingsByBrand).length > 0 ? (
          Object.entries(bookingsByBrand).map(([brandId, data]: [string, any]) => {
            const weekKey = `${selectedYear}-${selectedWeek}-${brandId}`;
            const isExpanded = expandedWeeks.has(weekKey);
            
            return (
              <Collapsible key={brandId} open={isExpanded} onOpenChange={() => toggleWeek(weekKey)}>
                <Card>
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 cursor-pointer flex-1">
                        <span className="font-bold text-lg">Uge {selectedWeek}, {selectedYear}</span>
                        <Badge style={{ backgroundColor: data.brand?.color_hex, color: "#fff" }}>
                          {data.brand?.name}
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {data.bookings.length} booking{data.bookings.length !== 1 ? "s" : ""}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-primary border-primary">
                        <FileText className="h-4 w-4 mr-1" /> Eksporter PDF
                      </Button>
                    </div>
                  </CardContent>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-6">
                      {data.bookings.map((booking: any) => (
                        <div key={booking.id} className="border rounded-lg p-4 space-y-4">
                          {/* Booking header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge style={{ backgroundColor: data.brand?.color_hex, color: "#fff" }}>
                                {data.brand?.name}
                              </Badge>
                              <span className="font-medium">{booking.location?.name}</span>
                              {hasUnderstaffing(booking) && (
                                <Badge variant="outline" className="border-orange-500 text-orange-500 gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Underbemanding
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline"
                                className={
                                  booking.status === "Planlagt" ? "border-yellow-500 text-yellow-600" :
                                  booking.status === "Bekræftet" ? "border-green-500 text-green-600" :
                                  booking.status === "Aflyst" ? "border-red-500 text-red-600" :
                                  "border-gray-500 text-gray-600"
                                }
                              >
                                {booking.status}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary"
                                onClick={() => setAddEmployeeDialogBooking(booking)}
                              >
                                <Plus className="h-4 w-4 mr-1" /> Tilføj
                              </Button>
                              <Button variant="ghost" size="sm" className="text-primary">
                                <Car className="h-4 w-4 mr-1" /> Bil
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setDeleteBookingId(booking.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Employee assignments */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Medarbejdere</p>
                            <div className="grid grid-cols-7 gap-2">
                              {DAYS.map((day, idx) => {
                                const assignment = getAssignmentForDay(booking, idx);
                                const targetDate = format(addDays(weekStart, idx), "yyyy-MM-dd");
                                const isBooked = new Date(booking.start_date) <= addDays(weekStart, idx) && 
                                                 new Date(booking.end_date) >= addDays(weekStart, idx);
                                const popoverKey = `${booking.id}-${idx}`;
                                
                                return (
                                  <Popover
                                    key={idx}
                                    open={openAssignPopover === popoverKey}
                                    onOpenChange={(open) => setOpenAssignPopover(open ? popoverKey : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <div
                                        className={`p-2 rounded-lg text-center cursor-pointer transition-colors hover:ring-2 hover:ring-primary/50 ${
                                          assignment 
                                            ? "bg-green-100 border-green-200 border" 
                                            : isBooked 
                                              ? "bg-red-50 border border-red-200 hover:bg-red-100"
                                              : "bg-muted/30 hover:bg-muted/50"
                                        }`}
                                      >
                                        <p className="text-xs text-muted-foreground">{day}</p>
                                        <p className="text-sm font-medium truncate">
                                          {assignment?.employee?.full_name?.split(" ")[0] || "-"}
                                        </p>
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2" align="start">
                                      <div className="space-y-2">
                                        <p className="text-sm font-medium px-2 py-1">
                                          {assignment ? "Skift medarbejder" : "Tildel medarbejder"}
                                        </p>
                                        {assignment && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start text-destructive hover:text-destructive"
                                            onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                                          >
                                            <X className="h-4 w-4 mr-2" />
                                            Fjern tildeling
                                          </Button>
                                        )}
                                        <div className="max-h-48 overflow-y-auto">
                                          {employees?.map((emp) => (
                                            <Button
                                              key={emp.id}
                                              variant="ghost"
                                              size="sm"
                                              className="w-full justify-start"
                                              onClick={() => {
                                                if (assignment) {
                                                  removeAssignmentMutation.mutate(assignment.id, {
                                                    onSuccess: () => {
                                                      assignEmployeeMutation.mutate({
                                                        bookingId: booking.id,
                                                        employeeId: emp.id,
                                                        date: targetDate,
                                                      });
                                                    },
                                                  });
                                                } else {
                                                  assignEmployeeMutation.mutate({
                                                    bookingId: booking.id,
                                                    employeeId: emp.id,
                                                    date: targetDate,
                                                  });
                                                }
                                              }}
                                            >
                                              <Users className="h-4 w-4 mr-2" />
                                              {emp.full_name}
                                              {emp.team && (
                                                <span className="ml-auto text-xs text-muted-foreground">{emp.team}</span>
                                              )}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })}
                            </div>
                          </div>

                          {/* Vehicle assignments */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Biler</p>
                            <div className="grid grid-cols-7 gap-2">
                              {DAYS.map((day, idx) => {
                                const vehicle = getVehicleForDay(booking.id, idx);
                                return (
                                  <div
                                    key={idx}
                                    className={`p-2 rounded-lg text-center ${
                                      vehicle ? "bg-blue-50 border border-blue-200" : "bg-muted/30"
                                    }`}
                                  >
                                    <p className="text-xs text-muted-foreground">{day}</p>
                                    <p className="text-sm truncate flex items-center justify-center gap-1">
                                      {vehicle ? (
                                        <>
                                          <Car className="h-3 w-3" />
                                          {vehicle.vehicle?.name}
                                        </>
                                      ) : "-"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ingen bookinger i denne uge
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne booking?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBookingId && deleteMutation.mutate(deleteBookingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddEmployeeDialog
        open={!!addEmployeeDialogBooking}
        onOpenChange={(open) => !open && setAddEmployeeDialogBooking(null)}
        booking={addEmployeeDialogBooking}
        weekNumber={selectedWeek}
        year={selectedYear}
        weekStart={weekStart}
        employees={employees || []}
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
    </MainLayout>
  );
}
