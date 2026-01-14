import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWithinInterval, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileText, Users, Car, Trash2, AlertTriangle, Ban, Check } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  team: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  license_plate: string;
}

interface EmployeeAbsence {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
}

interface ExistingAssignment {
  id: string;
  employee_id: string;
  date: string;
  booking_id: string;
  booking?: {
    location?: { name: string };
  };
}

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  weekNumber: number;
  year: number;
  weekStart: Date;
  employees: Employee[];
  vehicles: Vehicle[];
  onAddEmployeeAssignments: (assignments: { employeeId: string; dates: string[] }[]) => void;
  onAddVehicleAssignment: (assignment: { vehicleId: string; dates: string[] }) => void;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function EditBookingDialog({ 
  open, 
  onOpenChange, 
  booking,
  weekNumber,
  year,
  weekStart,
  employees,
  vehicles,
  onAddEmployeeAssignments,
  onAddVehicleAssignment,
}: EditBookingDialogProps) {
  const queryClient = useQueryClient();
  
  // Booking tab state
  const [clientId, setClientId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // Employee tab state
  const [selectedEmployees, setSelectedEmployees] = useState<(string | null)[]>([null]);
  const [selectedEmployeeDays, setSelectedEmployeeDays] = useState<Set<number>>(new Set());

  // Vehicle tab state
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedVehicleDays, setSelectedVehicleDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (booking) {
      setClientId(booking.client_id || "");
      setCampaignId(booking.campaign_id || "");
      setStatus(booking.status || "Bekræftet");
    }
  }, [booking]);

  useEffect(() => {
    if (open) {
      setSelectedEmployees([null]);
      setSelectedEmployeeDays(new Set());
      setSelectedVehicle(null);
      setSelectedVehicleDays(new Set());
    }
  }, [open]);

  // Fetch fieldmarketing clients
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients-for-edit"],
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
    enabled: open,
  });

  // Fetch campaigns based on selected client
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-edit", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase
        .from("client_campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .order("name");
      return data || [];
    },
    enabled: open && !!clientId,
  });

  // Employee tab queries
  const weekEnd = addDays(weekStart, 6);
  const employeeIds = employees?.map(e => e.id) || [];

  const { data: absences = [] } = useQuery({
    queryKey: ["employee-absences-week-v2-edit", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), employeeIds],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("id, employee_id, start_date, end_date, type, status")
        .in("employee_id", employeeIds)
        .in("status", ["approved", "pending"])
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .gte("end_date", format(weekStart, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data as EmployeeAbsence[];
    },
    enabled: open && employeeIds.length > 0,
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["existing-assignments-week-edit", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), employeeIds, booking?.id],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      
      const weekDates = Array.from({ length: 7 }, (_, i) => 
        format(addDays(weekStart, i), "yyyy-MM-dd")
      );
      
      let query = supabase
        .from("booking_assignment")
        .select("id, employee_id, date, booking_id, booking:booking_id(location:location_id(name))")
        .in("employee_id", employeeIds)
        .in("date", weekDates);
      
      if (booking?.id) {
        query = query.neq("booking_id", booking.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ExistingAssignment[];
    },
    enabled: open && employeeIds.length > 0,
  });

  // Fetch current booking's assignments with employee names
  const { data: currentBookingAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["current-booking-assignments", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      
      const { data, error } = await supabase
        .from("booking_assignment")
        .select(`
          id, employee_id, date,
          employee:employee_id(id, full_name)
        `)
        .eq("booking_id", booking.id)
        .order("date");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!booking?.id,
  });

  // Fetch current vehicle assignments
  const { data: currentVehicleAssignments = [], refetch: refetchVehicleAssignments } = useQuery({
    queryKey: ["current-vehicle-assignments", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      
      const { data, error } = await supabase
        .from("booking_vehicle")
        .select(`
          id, vehicle_id, date,
          vehicle:vehicle_id(id, name, license_plate)
        `)
        .eq("booking_id", booking.id)
        .order("date");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!booking?.id,
  });

  const { data: fieldmarketingTeam } = useQuery({
    queryKey: ["fieldmarketing-team-id-dialog-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "Fieldmarketing")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: primaryShiftsData } = useQuery({
    queryKey: ["primary-shifts-for-booking-edit", fieldmarketingTeam?.id],
    queryFn: async () => {
      if (!fieldmarketingTeam?.id) return { shifts: [], days: [] };
      
      const { data: shiftData, error } = await supabase
        .from("team_standard_shifts")
        .select("id, start_time, end_time")
        .eq("team_id", fieldmarketingTeam.id)
        .eq("is_active", true)
        .limit(1);
      if (error) throw error;
      if (!shiftData || shiftData.length === 0) return { shifts: [], days: [] };

      const { data: days } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week")
        .eq("shift_id", shiftData[0].id);

      return { shifts: shiftData, days: days || [] };
    },
    enabled: open && !!fieldmarketingTeam?.id,
  });

  const { data: employeeSpecialShifts } = useQuery({
    queryKey: ["employee-special-shifts-for-booking-edit", employeeIds],
    queryFn: async () => {
      if (employeeIds.length === 0) return { assignments: [], shiftDays: {} as Record<string, number[]> };
      
      const { data, error } = await supabase
        .from("employee_standard_shifts")
        .select("employee_id, shift_id")
        .in("employee_id", employeeIds);
      if (error) throw error;
      
      const shiftIds = [...new Set(data?.map(d => d.shift_id) || [])];
      let shiftDaysMap: Record<string, number[]> = {};
      
      if (shiftIds.length > 0) {
        const { data: days } = await supabase
          .from("team_standard_shift_days")
          .select("shift_id, day_of_week")
          .in("shift_id", shiftIds);
        
        (days || []).forEach(d => {
          if (!shiftDaysMap[d.shift_id]) shiftDaysMap[d.shift_id] = [];
          shiftDaysMap[d.shift_id].push(d.day_of_week);
        });
      }
      
      return { assignments: data || [], shiftDays: shiftDaysMap };
    },
    enabled: open && employeeIds.length > 0,
  });

  // Helper functions for employee tab
  const hasShiftOnDay = useCallback((employeeId: string, dayIndex: number): boolean => {
    const dbDayOfWeek = dayIndex + 1;
    
    const specialShift = employeeSpecialShifts?.assignments?.find(
      s => s.employee_id === employeeId
    );
    
    if (specialShift) {
      const days = employeeSpecialShifts?.shiftDays?.[specialShift.shift_id] || [];
      if (days.length === 0) return false;
      return days.includes(dbDayOfWeek);
    }
    
    const primaryShift = primaryShiftsData?.shifts?.[0];
    if (!primaryShift) return false;
    
    const hasDayConfig = primaryShiftsData?.days?.some(d => d.day_of_week === dbDayOfWeek);
    if (hasDayConfig) return true;
    
    return dbDayOfWeek >= 1 && dbDayOfWeek <= 5;
  }, [primaryShiftsData, employeeSpecialShifts]);

  const hasNoShiftsAtAll = useCallback((employeeId: string): boolean => {
    const specialShift = employeeSpecialShifts?.assignments?.find(
      s => s.employee_id === employeeId
    );
    if (specialShift) {
      const days = employeeSpecialShifts?.shiftDays?.[specialShift.shift_id] || [];
      return days.length === 0;
    }
    return false;
  }, [employeeSpecialShifts]);

  const absencesByEmployeeAndDay = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    
    absences.forEach((absence) => {
      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = addDays(weekStart, dayIndex);
        if (isWithinInterval(dayDate, { start: absenceStart, end: absenceEnd })) {
          const key = absence.employee_id;
          if (!map.has(key)) {
            map.set(key, new Map());
          }
          map.get(key)!.set(dayIndex, absence.type);
        }
      }
    });
    
    return map;
  }, [absences, weekStart]);

  const bookingsByEmployeeAndDay = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    
    existingAssignments.forEach((assignment) => {
      const assignmentDate = parseISO(assignment.date);
      const dayIndex = Math.floor((assignmentDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayIndex >= 0 && dayIndex < 7) {
        const key = assignment.employee_id;
        if (!map.has(key)) {
          map.set(key, new Map());
        }
        const locationName = (assignment.booking as any)?.location?.name || "Anden lokation";
        map.get(key)!.set(dayIndex, locationName);
      }
    });
    
    return map;
  }, [existingAssignments, weekStart]);

  const employeesWithAbsence = useMemo(() => {
    const result: { employeeId: string; employeeName: string; days: { dayIndex: number; type: string }[] }[] = [];
    
    selectedEmployees.forEach((empId) => {
      if (!empId) return;
      const absenceDays = absencesByEmployeeAndDay.get(empId);
      if (absenceDays) {
        const overlappingDays = Array.from(selectedEmployeeDays)
          .filter((d) => absenceDays.has(d))
          .map((d) => ({ dayIndex: d, type: absenceDays.get(d) || "Fravær" }));
        if (overlappingDays.length > 0) {
          const emp = employees.find((e) => e.id === empId);
          if (emp) {
            result.push({
              employeeId: empId,
              employeeName: emp.full_name,
              days: overlappingDays,
            });
          }
        }
      }
    });
    
    return result;
  }, [selectedEmployees, selectedEmployeeDays, absencesByEmployeeAndDay, employees]);

  const employeesAlreadyBooked = useMemo(() => {
    const result: { employeeId: string; employeeName: string; days: { dayIndex: number; location: string }[] }[] = [];
    
    selectedEmployees.forEach((empId) => {
      if (!empId) return;
      const bookedDays = bookingsByEmployeeAndDay.get(empId);
      if (bookedDays) {
        const overlappingDays = Array.from(selectedEmployeeDays)
          .filter((d) => bookedDays.has(d))
          .map((d) => ({ dayIndex: d, location: bookedDays.get(d) || "Anden lokation" }));
        if (overlappingDays.length > 0) {
          const emp = employees.find((e) => e.id === empId);
          if (emp) {
            result.push({
              employeeId: empId,
              employeeName: emp.full_name,
              days: overlappingDays,
            });
          }
        }
      }
    });
    
    return result;
  }, [selectedEmployees, selectedEmployeeDays, bookingsByEmployeeAndDay, employees]);

  const employeesWithNoShift = useMemo(() => {
    const result: { employeeId: string; employeeName: string; days: number[] }[] = [];
    
    selectedEmployees.forEach((empId) => {
      if (!empId) return;
      const daysWithoutShift = Array.from(selectedEmployeeDays).filter(dayIndex => !hasShiftOnDay(empId, dayIndex));
      
      if (daysWithoutShift.length > 0) {
        const emp = employees.find((e) => e.id === empId);
        if (emp) {
          result.push({
            employeeId: empId,
            employeeName: emp.full_name,
            days: daysWithoutShift,
          });
        }
      }
    });
    
    return result;
  }, [selectedEmployees, selectedEmployeeDays, hasShiftOnDay, employees]);

  const hasAbsenceOnDay = (employeeId: string, dayIndex: number) => {
    return absencesByEmployeeAndDay.get(employeeId)?.has(dayIndex) || false;
  };

  const isBookedOnDay = (employeeId: string, dayIndex: number) => {
    return bookingsByEmployeeAndDay.get(employeeId)?.has(dayIndex) || false;
  };

  const anySelectedHasAbsenceOnDay = (dayIndex: number) => {
    return selectedEmployees.some((empId) => empId && hasAbsenceOnDay(empId, dayIndex));
  };

  const anySelectedIsBookedOnDay = (dayIndex: number) => {
    return selectedEmployees.some((empId) => empId && isBookedOnDay(empId, dayIndex));
  };

  const anySelectedHasNoShiftOnDay = (dayIndex: number) => {
    return selectedEmployees.some((empId) => empId && !hasShiftOnDay(empId, dayIndex));
  };

  // Calculate which booked days are missing employees
  const daysWithoutStaff = useMemo(() => {
    if (!booking?.booked_days || booking.booked_days.length === 0) return [];
    
    const bookedDays = booking.booked_days as number[];
    const missingDays: number[] = [];
    
    bookedDays.forEach((dayIndex: number) => {
      const dateStr = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
      const hasStaff = currentBookingAssignments.some(
        (a: { date: string }) => a.date === dateStr
      );
      if (!hasStaff) {
        missingDays.push(dayIndex);
      }
    });
    
    return missingDays;
  }, [booking?.booked_days, currentBookingAssignments, weekStart]);

  // Group current assignments by employee for display
  const groupedEmployeeAssignments = useMemo(() => {
    const grouped: Record<string, { employee: any; dates: string[] }> = {};
    currentBookingAssignments.forEach((a: any) => {
      if (!grouped[a.employee_id]) {
        grouped[a.employee_id] = { employee: a.employee, dates: [] };
      }
      grouped[a.employee_id].dates.push(a.date);
    });
    return grouped;
  }, [currentBookingAssignments]);

  // Group current vehicle assignments for display
  const groupedVehicleAssignments = useMemo(() => {
    const grouped: Record<string, { vehicle: any; dates: string[] }> = {};
    currentVehicleAssignments.forEach((a: any) => {
      if (!grouped[a.vehicle_id]) {
        grouped[a.vehicle_id] = { vehicle: a.vehicle, dates: [] };
      }
      grouped[a.vehicle_id].dates.push(a.date);
    });
    return grouped;
  }, [currentVehicleAssignments]);

  // Booking tab mutation
  const updateBookingMutation = useMutation({
    mutationFn: async (updates: {
      client_id: string | null;
      campaign_id: string | null;
      status: "Planlagt" | "Bekræftet" | "Afsluttet" | "Aflyst";
    }) => {
      const { error } = await supabase
        .from("booking")
        .update(updates)
        .eq("id", booking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Booking opdateret");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Fejl ved opdatering: " + error.message);
    },
  });

  // Remove employee assignment mutation
  const removeEmployeeAssignmentMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("booking_assignment")
        .delete()
        .eq("booking_id", booking.id)
        .eq("employee_id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Medarbejder fjernet fra booking");
    },
    onError: (error: any) => {
      toast.error("Fejl ved fjernelse: " + error.message);
    },
  });

  // Remove vehicle assignment mutation
  const removeVehicleAssignmentMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from("booking_vehicle")
        .delete()
        .eq("booking_id", booking.id)
        .eq("vehicle_id", vehicleId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchVehicleAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Bil fjernet fra booking");
    },
    onError: (error: any) => {
      toast.error("Fejl ved fjernelse: " + error.message);
    },
  });

  const handleSaveBooking = () => {
    if (!clientId) {
      toast.error("Vælg venligst en kunde");
      return;
    }
    if (!campaignId) {
      toast.error("Vælg venligst en kampagne");
      return;
    }
    // Block Bekræftet status if missing staff
    if (status === "Bekræftet" && daysWithoutStaff.length > 0) {
      const missingDayNames = daysWithoutStaff.map(d => DAY_NAMES[d]).join(", ");
      toast.error(`Kan ikke bekræfte: Mangler medarbejder på ${missingDayNames}`);
      return;
    }
    updateBookingMutation.mutate({
      client_id: clientId,
      campaign_id: campaignId,
      status: status as "Planlagt" | "Bekræftet" | "Afsluttet" | "Aflyst",
    });
  };

  // Employee tab handlers
  const addEmployeeSlot = () => {
    setSelectedEmployees([...selectedEmployees, null]);
  };

  const removeEmployeeSlot = (index: number) => {
    setSelectedEmployees(selectedEmployees.filter((_, i) => i !== index));
  };

  const updateEmployee = (index: number, value: string) => {
    const updated = [...selectedEmployees];
    updated[index] = value;
    setSelectedEmployees(updated);
  };

  const toggleEmployeeDay = (dayIndex: number) => {
    const newSet = new Set(selectedEmployeeDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedEmployeeDays(newSet);
  };

  const isDayInBookingRange = (dayIndex: number) => {
    if (!booking) return false;
    if (booking.booked_days && booking.booked_days.length > 0) {
      return booking.booked_days.includes(dayIndex);
    }
    const dayDateStr = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
    return dayDateStr >= booking.start_date && dayDateStr <= booking.end_date;
  };

  const getDateForDay = (dayIndex: number) => {
    return format(addDays(weekStart, dayIndex), "d. MMM", { locale: da });
  };

  const totalEmployeeAssignments = selectedEmployees.filter(e => e !== null).length * selectedEmployeeDays.size;

  const handleAddEmployees = () => {
    const validEmployees = selectedEmployees.filter((e): e is string => e !== null);
    if (validEmployees.length === 0 || selectedEmployeeDays.size === 0) return;

    const assignments = validEmployees.map(employeeId => ({
      employeeId,
      dates: Array.from(selectedEmployeeDays)
        .filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))
        .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
    })).filter(a => a.dates.length > 0);

    if (assignments.length === 0) return;

    onAddEmployeeAssignments(assignments);
    setSelectedEmployees([null]);
    setSelectedEmployeeDays(new Set());
  };

  // Vehicle tab handlers
  const toggleVehicleDay = (dayIndex: number) => {
    const newSet = new Set(selectedVehicleDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedVehicleDays(newSet);
  };

  const totalVehicleAssignments = selectedVehicle ? selectedVehicleDays.size : 0;

  const handleAddVehicle = () => {
    if (!selectedVehicle || selectedVehicleDays.size === 0) return;

    onAddVehicleAssignment({
      vehicleId: selectedVehicle,
      dates: Array.from(selectedVehicleDays).map(dayIndex => 
        format(addDays(weekStart, dayIndex), "yyyy-MM-dd")
      ),
    });
    setSelectedVehicle(null);
    setSelectedVehicleDays(new Set());
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger booking</DialogTitle>
          <p className="text-sm text-muted-foreground">{booking.location?.name} • Uge {weekNumber}, {year}</p>
        </DialogHeader>
        
        <Tabs defaultValue="booking" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="booking" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Booking
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Medarbejdere
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Biler
            </TabsTrigger>
          </TabsList>
          
          {/* Booking Tab */}
          <TabsContent value="booking" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="client">Kunde *</Label>
              <Select value={clientId} onValueChange={(v) => {
                setClientId(v);
                setCampaignId("");
              }}>
                <SelectTrigger className={!clientId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Kampagne *</Label>
              <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)} disabled={!clientId}>
                <SelectTrigger className={clientId && !campaignId ? "border-destructive" : ""}>
                  <SelectValue placeholder={clientId ? "Vælg kampagne" : "Vælg først kunde"} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns?.map((campaign: any) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planlagt">Planlagt</SelectItem>
                  <SelectItem value="Bekræftet">Bekræftet</SelectItem>
                  <SelectItem value="Afsluttet">Afsluttet</SelectItem>
                  <SelectItem value="Aflyst">Aflyst</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning for missing staff */}
            {daysWithoutStaff.length > 0 && (
              <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      Mangler medarbejder på følgende dage:
                    </p>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {daysWithoutStaff.map(d => `${DAY_NAMES[d]} (${format(addDays(weekStart, d), "d. MMM", { locale: da })})`).join(", ")}
                    </p>
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Tilføj mindst 1 medarbejder per dag for at kunne sætte status til "Bekræftet"
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button onClick={handleSaveBooking} disabled={updateBookingMutation.isPending}>
                {updateBookingMutation.isPending ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          </TabsContent>
          
          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4 mt-4">
            {/* Existing employee assignments */}
            {Object.keys(groupedEmployeeAssignments).length > 0 && (
              <div className="space-y-2 border-b pb-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Tilknyttede medarbejdere ({currentBookingAssignments.length} vagter)
                </p>
                <div className="grid gap-1">
                  {Object.entries(groupedEmployeeAssignments).map(([empId, { employee, dates }]) => {
                    const dateLabels = dates.map((d: string) => {
                      const dayIndex = Math.floor((parseISO(d).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                      return `${DAY_NAMES[dayIndex]?.slice(0, 3) || '?'} ${format(parseISO(d), "d/M")}`;
                    });
                    return (
                      <div key={empId} className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Check className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="font-medium">{(employee as any)?.full_name || "Ukendt"}</span>
                          <span className="text-xs text-muted-foreground">
                            {dateLabels.join(", ")}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100 shrink-0"
                          onClick={() => removeEmployeeAssignmentMutation.mutate(empId)}
                          disabled={removeEmployeeAssignmentMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Tilføj medarbejdere {selectedEmployees.filter(e => e !== null).length > 0 && (
                  <span className="font-normal text-muted-foreground">
                    ({selectedEmployees.filter(e => e !== null).length} valgt)
                  </span>
                )}
              </p>
              
              {selectedEmployees.map((emp, index) => {
                const hasAbsence = emp && absencesByEmployeeAndDay.has(emp);
                const hasBooking = emp && bookingsByEmployeeAndDay.has(emp);
                const absenceTypes = emp && hasAbsence 
                  ? [...new Set(Array.from(absencesByEmployeeAndDay.get(emp)!.values()))]
                  : [];
                return (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={emp || ""}
                      onValueChange={(value) => updateEmployee(index, value)}
                    >
                      <SelectTrigger className={`flex-1 bg-background text-foreground ${hasAbsence ? "border-red-500 bg-red-50 dark:bg-red-950/20" : hasBooking ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                        <SelectValue placeholder={`Medarbejder ${index + 1} (valgfri)`} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {employees
                          .filter(e => !selectedEmployees.includes(e.id) || e.id === emp)
                          .map((employee) => {
                            const empAbsences = absencesByEmployeeAndDay.get(employee.id);
                            const empBookings = bookingsByEmployeeAndDay.get(employee.id);
                            const empHasAbsence = !!empAbsences;
                            const empHasBooking = !!empBookings;
                            const empHasNoShifts = hasNoShiftsAtAll(employee.id);
                            return (
                              <SelectItem 
                                key={employee.id} 
                                value={employee.id} 
                                className={`text-popover-foreground ${empHasNoShifts ? "text-gray-400 bg-gray-50 dark:bg-gray-950/20" : empHasAbsence ? "text-red-600 bg-red-50 dark:bg-red-950/20" : empHasBooking ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                              >
                                <span className="flex items-center gap-2">
                                  {employee.full_name}
                                  {empHasNoShifts && (
                                    <>
                                      <Ban className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs text-gray-400">(Ingen vagter)</span>
                                    </>
                                  )}
                                  {!empHasNoShifts && empHasAbsence && (
                                    <>
                                      <AlertTriangle className="h-3 w-3 text-red-500" />
                                      <span className="text-xs text-red-500">(Fravær)</span>
                                    </>
                                  )}
                                  {!empHasNoShifts && empHasBooking && !empHasAbsence && (
                                    <>
                                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                                      <span className="text-xs text-amber-500">(Booket)</span>
                                    </>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    {hasAbsence && (
                      <span className="text-xs text-red-600 whitespace-nowrap">
                        {absenceTypes.join(", ")}
                      </span>
                    )}
                    {selectedEmployees.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEmployeeSlot(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              
              {selectedEmployees.length < employees.length && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEmployeeSlot}
                  className="w-full border-dashed"
                >
                  + Tilføj medarbejder
                </Button>
              )}
            </div>

            {/* Warnings */}
            {employeesWithAbsence.length > 0 && (
              <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-800 dark:text-red-200">Fravær registreret</p>
                    <ul className="mt-1 space-y-1 text-red-700 dark:text-red-300">
                      {employeesWithAbsence.map((e) => (
                        <li key={e.employeeId}>{e.employeeName} - {e.days.map(d => DAY_NAMES[d.dayIndex]).join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {employeesAlreadyBooked.length > 0 && (
              <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">Allerede booket</p>
                    <ul className="mt-1 space-y-1 text-amber-700 dark:text-amber-300">
                      {employeesAlreadyBooked.map((e) => (
                        <li key={e.employeeId}>{e.employeeName} - {e.days.map(d => DAY_NAMES[d.dayIndex]).join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {employeesWithNoShift.length > 0 && (
              <div className="rounded-lg border border-gray-400 bg-gray-50 dark:bg-gray-950/20 p-3">
                <div className="flex items-start gap-2">
                  <Ban className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Ingen vagt planlagt</p>
                    <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                      {employeesWithNoShift.map((e) => (
                        <li key={e.employeeId}>{e.employeeName} - {e.days.map(d => DAY_NAMES[d]).join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Vælg dage:</p>
              <div className="space-y-1">
                {DAY_NAMES.map((dayName, index) => {
                  const inRange = isDayInBookingRange(index);
                  const hasAbsenceWarning = anySelectedHasAbsenceOnDay(index);
                  const hasBookingWarning = anySelectedIsBookedOnDay(index);
                  const hasNoShiftWarning = anySelectedHasNoShiftOnDay(index);
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        inRange ? "hover:bg-muted/50 cursor-pointer" : "opacity-50"
                      } ${selectedEmployeeDays.has(index) ? "border-primary bg-primary/5" : ""} ${
                        hasAbsenceWarning && inRange ? "border-red-500" : 
                        hasBookingWarning && inRange ? "border-amber-500" : 
                        hasNoShiftWarning && inRange ? "border-gray-400 bg-gray-50 dark:bg-gray-950/20" : ""
                      }`}
                      onClick={() => inRange && toggleEmployeeDay(index)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedEmployeeDays.has(index)}
                          disabled={!inRange}
                          onCheckedChange={() => inRange && toggleEmployeeDay(index)}
                        />
                        <span>{dayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAbsenceWarning && inRange && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {hasBookingWarning && !hasAbsenceWarning && inRange && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        {hasNoShiftWarning && !hasAbsenceWarning && !hasBookingWarning && inRange && (
                          <span className="text-xs text-gray-400">Ingen vagt</span>
                        )}
                        <span className="text-sm text-muted-foreground">{getDateForDay(index)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary of what will be added */}
            {selectedEmployees.some(e => e !== null) && selectedEmployeeDays.size > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm font-medium">Du er ved at tilføje:</p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {selectedEmployees.filter((e): e is string => e !== null).map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    const validDays = Array.from(selectedEmployeeDays)
                      .filter(d => hasShiftOnDay(empId, d) && isDayInBookingRange(d))
                      .map(d => DAY_NAMES[d]);
                    return validDays.length > 0 ? (
                      <li key={empId}>• {emp?.full_name}: {validDays.join(", ")}</li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={handleAddEmployees}
                disabled={totalEmployeeAssignments === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Tilføj {totalEmployeeAssignments} vagt{totalEmployeeAssignments !== 1 ? "er" : ""}
              </Button>
            </div>
          </TabsContent>
          
          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="space-y-4 mt-4">
            {/* Existing vehicle assignments */}
            {Object.keys(groupedVehicleAssignments).length > 0 && (
              <div className="space-y-2 border-b pb-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600" />
                  Tilknyttede biler ({currentVehicleAssignments.length} dage)
                </p>
                <div className="grid gap-1">
                  {Object.entries(groupedVehicleAssignments).map(([vehId, { vehicle, dates }]) => {
                    const dateLabels = dates.map((d: string) => {
                      const dayIndex = Math.floor((parseISO(d).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                      return `${DAY_NAMES[dayIndex]?.slice(0, 3) || '?'} ${format(parseISO(d), "d/M")}`;
                    });
                    return (
                      <div key={vehId} className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Car className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="font-medium">{(vehicle as any)?.name || "Ukendt"}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(vehicle as any)?.license_plate}) • {dateLabels.join(", ")}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100 shrink-0"
                          onClick={() => removeVehicleAssignmentMutation.mutate(vehId)}
                          disabled={removeVehicleAssignmentMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Tilføj bil</p>
              <Select
                value={selectedVehicle || ""}
                onValueChange={setSelectedVehicle}
              >
                <SelectTrigger className="bg-background text-foreground">
                  <SelectValue placeholder="Vælg en bil" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id} className="text-popover-foreground">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        <span>{vehicle.name}</span>
                        <span className="text-muted-foreground text-xs">({vehicle.license_plate})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Vælg dage:</p>
              <div className="space-y-1">
                {DAY_NAMES.map((dayName, index) => {
                  const inRange = isDayInBookingRange(index);
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        inRange ? "hover:bg-muted/50 cursor-pointer" : "opacity-50"
                      } ${selectedVehicleDays.has(index) ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : ""}`}
                      onClick={() => inRange && toggleVehicleDay(index)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedVehicleDays.has(index)}
                          disabled={!inRange}
                          onCheckedChange={() => inRange && toggleVehicleDay(index)}
                        />
                        <span className={selectedVehicleDays.has(index) ? "text-blue-800 dark:text-blue-200" : ""}>{dayName}</span>
                      </div>
                      <span className={`text-sm ${selectedVehicleDays.has(index) ? "text-blue-600" : "text-muted-foreground"}`}>
                        {getDateForDay(index)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary of what will be added */}
            {selectedVehicle && selectedVehicleDays.size > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Du er ved at tilføje:</p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  • {vehicles.find(v => v.id === selectedVehicle)?.name}: {Array.from(selectedVehicleDays).filter(d => isDayInBookingRange(d)).map(d => DAY_NAMES[d]).join(", ")}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={handleAddVehicle}
                disabled={totalVehicleAssignments === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Tilføj bil til {totalVehicleAssignments} dag{totalVehicleAssignments !== 1 ? "e" : ""}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
