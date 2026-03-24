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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileText, Users, Car, Trash2, AlertTriangle, Ban, Check, DollarSign, Utensils, Pencil, Building2, GraduationCap } from "lucide-react";
import { useBookingHotels, useUpdateBookingHotel, type BookingHotel } from "@/hooks/useBookingHotels";
import { AssignHotelDialog } from "@/components/vagt-flow/AssignHotelDialog";
import { Textarea } from "@/components/ui/textarea";
import { TimeSelect } from "@/components/ui/time-select";

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
  onAddEmployeeAssignments: (assignments: { employeeId: string; dates: string[]; startTime: string; endTime: string }[]) => void;
  onAddVehicleAssignment: (assignment: { vehicleId: string; dates: string[] }) => void;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function HotelTabContent({ booking }: { booking: any }) {
  const { data: bookingHotels = [], isLoading } = useBookingHotels(booking?.id ? [booking.id] : []);
  const updateBookingHotel = useUpdateBookingHotel();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<BookingHotel | null>(null);

  const hotelEntry = bookingHotels[0] || null;

  const [price, setPrice] = useState("");
  const [confNum, setConfNum] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (hotelEntry) {
      setPrice(hotelEntry.price_per_night?.toString() || "");
      setConfNum(hotelEntry.confirmation_number || "");
      setStatus(hotelEntry.status);
      setNotes(hotelEntry.notes || "");
    }
  }, [hotelEntry]);

  const handleSave = async () => {
    if (!hotelEntry) return;
    await updateBookingHotel.mutateAsync({
      id: hotelEntry.id,
      price_per_night: price ? Number(price) : undefined,
      confirmation_number: confNum || undefined,
      status,
      notes: notes || undefined,
    });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Indlæser...</p>;
  }

  if (!hotelEntry) {
    return (
      <div className="text-center py-8 space-y-3">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Intet hotel tildelt denne booking</p>
        <Button onClick={() => setAssignDialogOpen(true)}>
          <Building2 className="h-4 w-4 mr-2" />
          Tildel hotel
        </Button>
        {booking && (
          <AssignHotelDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            booking={{
              id: booking.id,
              start_date: booking.start_date,
              end_date: booking.end_date,
              location: booking.location,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{hotelEntry.hotel?.name}</p>
          <p className="text-sm text-muted-foreground">{hotelEntry.hotel?.city} • {hotelEntry.check_in} → {hotelEntry.check_out}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setEditingHotel(hotelEntry);
          setAssignDialogOpen(true);
        }}>
          <Pencil className="h-4 w-4 mr-1" />
          Rediger alle felter
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Samlet pris (DKK) *</Label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={!price ? "border-destructive" : ""}
            placeholder="Påkrævet"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Ubekræftet</SelectItem>
              <SelectItem value="confirmed">Bekræftet</SelectItem>
              <SelectItem value="cancelled">Annulleret</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Bekræftelsesnummer</Label>
          <Input value={confNum} onChange={(e) => setConfNum(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Bemærkninger</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateBookingHotel.isPending || !price}>
        {updateBookingHotel.isPending ? "Gemmer..." : "Gem ændringer"}
      </Button>

      {booking && (
        <AssignHotelDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          booking={{
            id: booking.id,
            start_date: booking.start_date,
            end_date: booking.end_date,
            location: booking.location,
          }}
          existingBookingHotel={editingHotel}
        />
      )}
    </div>
  );
}

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
  const [dailyRateOverride, setDailyRateOverride] = useState<string>("");
  const [useLocationRate, setUseLocationRate] = useState<boolean>(true);
  const [isEditingLocationRate, setIsEditingLocationRate] = useState<boolean>(false);
  const [locationRateInput, setLocationRateInput] = useState<string>("");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // Employee tab state
  const [selectedEmployees, setSelectedEmployees] = useState<(string | null)[]>([null]);
  const [selectedEmployeeDays, setSelectedEmployeeDays] = useState<Set<number>>(new Set());
  const [meetingStartTime, setMeetingStartTime] = useState<string>("09:00");
  const [meetingEndTime, setMeetingEndTime] = useState<string>("17:00");

  // Vehicle tab state
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedVehicleDays, setSelectedVehicleDays] = useState<Set<number>>(new Set());

  // Diet tab state
  const [selectedDietEmployee, setSelectedDietEmployee] = useState<string | null>(null);
  const [selectedDietDays, setSelectedDietDays] = useState<Set<number>>(new Set());

  // Training bonus tab state
  const [selectedTrainingEmployee, setSelectedTrainingEmployee] = useState<string | null>(null);
  const [selectedTrainingDays, setSelectedTrainingDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (booking) {
      setClientId(booking.client_id || "");
      setCampaignId(booking.campaign_id || "");
      setSelectedPlacementId(booking.placement_id || "");
      setComment(booking.comment || "");
      
      // Daily rate override
      const hasOverride = booking.daily_rate_override !== null && booking.daily_rate_override !== undefined;
      setUseLocationRate(!hasOverride);
      setDailyRateOverride(
        hasOverride 
          ? booking.daily_rate_override.toString() 
          : (booking.location?.daily_rate || 1000).toString()
      );
    }
  }, [booking]);

  useEffect(() => {
    if (open) {
      setSelectedEmployees([null]);
      setSelectedEmployeeDays(new Set());
      setSelectedVehicle(null);
      setSelectedVehicleDays(new Set());
      setSelectedDietEmployee(null);
      setSelectedDietDays(new Set());
      setSelectedTrainingEmployee(null);
      setSelectedTrainingDays(new Set());
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

  // Fetch placements for the booking's location
  const { data: bookingPlacements = [] } = useQuery({
    queryKey: ["location-placements-edit", booking?.location?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("location_placements")
        .select("*")
        .eq("location_id", booking.location.id)
        .order("name");
      return data || [];
    },
    enabled: open && !!booking?.location?.id,
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
        .select("id, employee_id, date")
        .eq("booking_id", booking.id)
        .order("date");
      
      if (error) throw error;
      
      // Get employee names from employees prop
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

  // Fetch diet salary type
  const { data: dietSalaryType } = useQuery({
    queryKey: ["diet-salary-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("id, name, amount")
        .ilike("name", "%diæt%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch training bonus salary type
  const { data: trainingBonusSalaryType } = useQuery({
    queryKey: ["training-bonus-salary-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("id, name, amount")
        .ilike("name", "%oplæringsbonus%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch current diet assignments (filtered by diet salary type)
  const { data: currentDietAssignments = [], refetch: refetchDietAssignments } = useQuery({
    queryKey: ["current-diet-assignments", booking?.id, dietSalaryType?.id],
    queryFn: async () => {
      if (!booking?.id || !dietSalaryType?.id) return [];
      
      const { data, error } = await supabase
        .from("booking_diet")
        .select("id, employee_id, date, amount")
        .eq("booking_id", booking.id)
        .eq("salary_type_id", dietSalaryType.id)
        .order("date");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!booking?.id && !!dietSalaryType?.id,
  });

  // Fetch current training bonus assignments
  const { data: currentTrainingAssignments = [], refetch: refetchTrainingAssignments } = useQuery({
    queryKey: ["current-training-assignments", booking?.id, trainingBonusSalaryType?.id],
    queryFn: async () => {
      if (!booking?.id || !trainingBonusSalaryType?.id) return [];
      
      const { data, error } = await supabase
        .from("booking_diet")
        .select("id, employee_id, date, amount")
        .eq("booking_id", booking.id)
        .eq("salary_type_id", trainingBonusSalaryType.id)
        .order("date");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!booking?.id && !!trainingBonusSalaryType?.id,
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

  // Fetch individual shifts from the shift table (highest priority in hierarchy)
  const { data: individualShifts = [] } = useQuery({
    queryKey: ["individual-shifts-for-booking-edit", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), employeeIds],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      
      const weekDates = Array.from({ length: 7 }, (_, i) => 
        format(addDays(weekStart, i), "yyyy-MM-dd")
      );
      
      const { data, error } = await supabase
        .from("shift")
        .select("employee_id, date")
        .in("employee_id", employeeIds)
        .in("date", weekDates);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && employeeIds.length > 0,
  });

  // Helper functions for employee tab - following shift hierarchy:
  // 1. Individual shift (shift table) - highest priority
  // 2. Employee special shift (employee_standard_shifts)
  // 3. Team primary shift (team_standard_shift_days) - lowest priority
  const hasShiftOnDay = useCallback((employeeId: string, dayIndex: number): boolean => {
    const dbDayOfWeek = dayIndex + 1;
    const dayDate = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
    
    // 1. Check individual shift first (highest priority)
    const hasIndividualShift = individualShifts.some(
      s => s.employee_id === employeeId && s.date === dayDate
    );
    if (hasIndividualShift) return true;
    
    // 2. Check special shift
    const specialShift = employeeSpecialShifts?.assignments?.find(
      s => s.employee_id === employeeId
    );
    
    if (specialShift) {
      const days = employeeSpecialShifts?.shiftDays?.[specialShift.shift_id] || [];
      if (days.length === 0) return false;
      return days.includes(dbDayOfWeek);
    }
    
    // 3. Fallback to team primary shift
    const primaryShift = primaryShiftsData?.shifts?.[0];
    if (!primaryShift) return false;
    
    const hasDayConfig = primaryShiftsData?.days?.some(d => d.day_of_week === dbDayOfWeek);
    if (hasDayConfig) return true;
    
    return dbDayOfWeek >= 1 && dbDayOfWeek <= 5;
  }, [weekStart, individualShifts, primaryShiftsData, employeeSpecialShifts]);

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

  // Group current assignments by employee for display (use employees prop for names)
  const groupedEmployeeAssignments = useMemo(() => {
    const grouped: Record<string, { employeeName: string; dates: string[] }> = {};
    currentBookingAssignments.forEach((a: any) => {
      if (!grouped[a.employee_id]) {
        const emp = employees.find(e => e.id === a.employee_id);
        grouped[a.employee_id] = { employeeName: emp?.full_name || "Ukendt", dates: [] };
      }
      grouped[a.employee_id].dates.push(a.date);
    });
    return grouped;
  }, [currentBookingAssignments, employees]);

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
      daily_rate_override: number | null;
      placement_id: string | null;
      comment: string | null;
    }) => {
      const { error } = await supabase
        .from("booking")
        .update(updates)
        .eq("id", booking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-billing-bookings"] });
      toast.success("Booking opdateret");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Fejl ved opdatering: " + error.message);
    },
  });

  // Update location daily rate mutation
  const updateLocationRateMutation = useMutation({
    mutationFn: async (newRate: number) => {
      if (!booking.location?.id) throw new Error("Ingen lokation fundet");
      const { error } = await supabase
        .from("location")
        .update({ daily_rate: newRate })
        .eq("id", booking.location.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-billing-bookings"] });
      setIsEditingLocationRate(false);
      toast.success("Lokationens standardpris opdateret");
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

  // Add diet assignment mutation
  const addDietMutation = useMutation({
    mutationFn: async ({ employeeId, dates }: { employeeId: string; dates: string[] }) => {
      if (!dietSalaryType) throw new Error("Diæt lønart ikke fundet");
      
      const inserts = dates.map(date => ({
        booking_id: booking.id,
        employee_id: employeeId,
        salary_type_id: dietSalaryType.id,
        date,
        amount: dietSalaryType.amount || 0,
      }));
      
      const { error } = await supabase
        .from("booking_diet")
        .upsert(inserts, { onConflict: "booking_id,employee_id,date,salary_type_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDietAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Diæt tilføjet");
      setSelectedDietEmployee(null);
      setSelectedDietDays(new Set());
    },
    onError: (error: any) => {
      toast.error("Fejl ved tilføjelse: " + error.message);
    },
  });

  // Remove diet assignment mutation
  const removeDietMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!dietSalaryType?.id) throw new Error("Diæt lønart ikke fundet");
      const { error } = await supabase
        .from("booking_diet")
        .delete()
        .eq("booking_id", booking.id)
        .eq("employee_id", employeeId)
        .eq("salary_type_id", dietSalaryType.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDietAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Diæt fjernet");
    },
    onError: (error: any) => {
      toast.error("Fejl ved fjernelse: " + error.message);
    },
  });

  // Add training bonus mutation
  const addTrainingBonusMutation = useMutation({
    mutationFn: async ({ employeeId, dates }: { employeeId: string; dates: string[] }) => {
      if (!trainingBonusSalaryType) throw new Error("Oplæringsbonus lønart ikke fundet");
      
      const inserts = dates.map(date => ({
        booking_id: booking.id,
        employee_id: employeeId,
        salary_type_id: trainingBonusSalaryType.id,
        date,
        amount: trainingBonusSalaryType.amount || 0,
      }));
      
      const { error } = await supabase
        .from("booking_diet")
        .upsert(inserts, { onConflict: "booking_id,employee_id,date,salary_type_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTrainingAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Oplæringsbonus tilføjet");
      setSelectedTrainingEmployee(null);
      setSelectedTrainingDays(new Set());
    },
    onError: (error: any) => {
      toast.error("Fejl ved tilføjelse: " + error.message);
    },
  });

  // Remove training bonus mutation
  const removeTrainingBonusMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!trainingBonusSalaryType?.id) throw new Error("Oplæringsbonus lønart ikke fundet");
      const { error } = await supabase
        .from("booking_diet")
        .delete()
        .eq("booking_id", booking.id)
        .eq("employee_id", employeeId)
        .eq("salary_type_id", trainingBonusSalaryType.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTrainingAssignments();
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast.success("Oplæringsbonus fjernet");
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
    
    // Parse daily rate override
    const parsedRate = parseFloat(dailyRateOverride);
    const rateOverride = useLocationRate ? null : (isNaN(parsedRate) ? null : parsedRate);

    // If placement is selected and using location rate, use placement rate as override
    const selectedPlacement = selectedPlacementId
      ? bookingPlacements.find((p: any) => p.id === selectedPlacementId)
      : null;
    const finalRateOverride = selectedPlacement && useLocationRate
      ? selectedPlacement.daily_rate
      : rateOverride;
    
    updateBookingMutation.mutate({
      client_id: clientId,
      campaign_id: campaignId,
      daily_rate_override: finalRateOverride,
      placement_id: selectedPlacementId || null,
      comment: comment.trim() || null,
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

    // Filter only days where employee has shift AND is not already booked elsewhere
    const assignments = validEmployees.map(employeeId => ({
      employeeId,
      startTime: meetingStartTime || "09:00",
      endTime: meetingEndTime || "17:00",
      dates: Array.from(selectedEmployeeDays)
        .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex))
        .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
    })).filter(a => a.dates.length > 0);

    if (assignments.length === 0) {
      toast.error("Ingen gyldige dage - medarbejdere er allerede booket");
      return;
    }

    onAddEmployeeAssignments(assignments);
    setSelectedEmployees([null]);
    setSelectedEmployeeDays(new Set());
    onOpenChange(false);
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

  // Diet tab handlers
  const toggleDietDay = (dayIndex: number) => {
    const newSet = new Set(selectedDietDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedDietDays(newSet);
  };

  const handleAddDiet = () => {
    if (!selectedDietEmployee || selectedDietDays.size === 0) return;

    const dates = Array.from(selectedDietDays)
      .filter(dayIndex => isDayInBookingRange(dayIndex))
      .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd"));

    if (dates.length === 0) return;

    addDietMutation.mutate({
      employeeId: selectedDietEmployee,
      dates,
    });
  };

  // Training bonus tab handlers
  const toggleTrainingDay = (dayIndex: number) => {
    const newSet = new Set(selectedTrainingDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedTrainingDays(newSet);
  };

  const handleAddTrainingBonus = () => {
    if (!selectedTrainingEmployee || selectedTrainingDays.size === 0) return;

    const dates = Array.from(selectedTrainingDays)
      .filter(dayIndex => isDayInBookingRange(dayIndex))
      .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd"));

    if (dates.length === 0) return;

    addTrainingBonusMutation.mutate({
      employeeId: selectedTrainingEmployee,
      dates,
    });
  };

  // Group current diet assignments by employee for display
  const groupedDietAssignments = useMemo(() => {
    const grouped: Record<string, { employeeName: string; dates: string[]; totalAmount: number }> = {};
    currentDietAssignments.forEach((a: any) => {
      if (!grouped[a.employee_id]) {
        const emp = employees.find(e => e.id === a.employee_id);
        grouped[a.employee_id] = { employeeName: emp?.full_name || "Ukendt", dates: [], totalAmount: 0 };
      }
      grouped[a.employee_id].dates.push(a.date);
      grouped[a.employee_id].totalAmount += Number(a.amount) || 0;
    });
    return grouped;
  }, [currentDietAssignments, employees]);

  // Group current training bonus assignments by employee for display
  const groupedTrainingAssignments = useMemo(() => {
    const grouped: Record<string, { employeeName: string; dates: string[]; totalAmount: number }> = {};
    currentTrainingAssignments.forEach((a: any) => {
      if (!grouped[a.employee_id]) {
        const emp = employees.find(e => e.id === a.employee_id);
        grouped[a.employee_id] = { employeeName: emp?.full_name || "Ukendt", dates: [], totalAmount: 0 };
      }
      grouped[a.employee_id].dates.push(a.date);
      grouped[a.employee_id].totalAmount += Number(a.amount) || 0;
    });
    return grouped;
  }, [currentTrainingAssignments, employees]);

  // Get employees assigned to this booking (for diet selection)
  const assignedEmployeeIds = useMemo(() => {
    return [...new Set(currentBookingAssignments.map((a: any) => a.employee_id))];
  }, [currentBookingAssignments]);

  const assignedEmployees = useMemo(() => {
    return employees.filter(e => assignedEmployeeIds.includes(e.id));
  }, [employees, assignedEmployeeIds]);

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger booking</DialogTitle>
          <p className="text-sm text-muted-foreground">{booking.location?.name} • Uge {weekNumber}, {year}</p>
        </DialogHeader>
        
        <Tabs defaultValue="booking" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="diet" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Diæt
            </TabsTrigger>
            <TabsTrigger value="hotel" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Hotel
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
                  {campaignId && !campaigns?.some((c: any) => c.id === campaignId) && (
                    <SelectItem value={campaignId}>
                      {booking?.client_campaigns?.name || "Indlæser..."}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Placement Selection - only shown when location has placements */}
            {bookingPlacements.length > 0 && (
              <div className="space-y-2">
                <Label>Placering</Label>
                <Select value={selectedPlacementId || "none"} onValueChange={(v) => {
                  const pid = v === "none" ? "" : v;
                  setSelectedPlacementId(pid);
                  if (pid) {
                    const placement = bookingPlacements.find((p: any) => p.id === pid);
                    if (placement && useLocationRate) {
                      setDailyRateOverride(placement.daily_rate.toString());
                    }
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg placering" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen placering (standardpris)</SelectItem>
                    {bookingPlacements.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.daily_rate} kr
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Daily Rate Section */}
            <div className="space-y-3 pt-3 border-t">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Dagspris
              </Label>
              
              <div className="space-y-3">
                {isEditingLocationRate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Lokationens standardpris:</span>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={locationRateInput}
                      onChange={(e) => setLocationRateInput(e.target.value)}
                      className="max-w-[140px] h-8"
                      autoFocus
                    />
                    <span className="text-sm">kr</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const newRate = parseFloat(locationRateInput);
                        if (!isNaN(newRate) && newRate >= 0) {
                          updateLocationRateMutation.mutate(newRate);
                        } else {
                          toast.error("Indtast en gyldig pris");
                        }
                      }}
                      disabled={updateLocationRateMutation.isPending}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setIsEditingLocationRate(false)}
                    >
                      <Ban className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Lokationens standardpris:</span>
                    <span className="font-medium text-foreground">
                      {(booking.location?.daily_rate || 1000).toLocaleString('da-DK')} kr
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setLocationRateInput((booking.location?.daily_rate || 1000).toString());
                        setIsEditingLocationRate(true);
                      }}
                      title="Rediger lokationens standardpris"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="useLocationRate"
                    checked={useLocationRate}
                    onCheckedChange={(checked) => {
                      setUseLocationRate(!!checked);
                      if (checked) {
                        setDailyRateOverride(
                          (booking.location?.daily_rate || 1000).toString()
                        );
                      }
                    }}
                  />
                  <Label htmlFor="useLocationRate" className="text-sm cursor-pointer font-normal">
                    Brug standardpris
                  </Label>
                </div>
                
                {!useLocationRate && (
                  <div className="space-y-2">
                    <Label htmlFor="dailyRate" className="text-sm font-normal">
                      Tilpasset dagspris for denne booking (kr)
                    </Label>
                    <Input
                      id="dailyRate"
                      type="number"
                      min="0"
                      step="100"
                      value={dailyRateOverride}
                      onChange={(e) => setDailyRateOverride(e.target.value)}
                      placeholder="F.eks. 1500"
                      className="max-w-[200px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Denne pris gælder kun for uge {weekNumber}, {year}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Comment field */}
            <div className="space-y-2 pt-3 border-t">
              <Label htmlFor="booking-comment">Bemærkning til sælger</Label>
              <Textarea
                id="booking-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Fx 'Stå ved elevatoren' eller 'Parkering bag bygningen'"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Bemærkningen vises for alle sælgere tildelt denne booking
              </p>
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
              <div className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Tilknyttede medarbejdere
                  </p>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {Object.keys(groupedEmployeeAssignments).length} medarbejdere • {currentBookingAssignments.length} vagter
                  </span>
                </div>
                <div className="grid gap-2">
                  {Object.entries(groupedEmployeeAssignments).map(([empId, { employeeName, dates }]) => {
                    const sortedDates = [...dates].sort();
                    const dateLabels = sortedDates.map((d: string) => {
                      const dayIndex = Math.floor((parseISO(d).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                      return DAY_NAMES[dayIndex]?.slice(0, 3) || format(parseISO(d), "d/M");
                    });
                    return (
                      <div key={empId} className="flex items-center justify-between bg-card border rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{employeeName}</p>
                            <p className="text-xs text-muted-foreground">
                              {dateLabels.join(" • ")}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeEmployeeAssignmentMutation.mutate(empId)}
                          disabled={removeEmployeeAssignmentMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
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

              {/* Meeting time controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mødetid</Label>
                  <TimeSelect value={meetingStartTime} onChange={setMeetingStartTime} placeholder="09:00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sluttid</Label>
                  <TimeSelect value={meetingEndTime} onChange={setMeetingEndTime} placeholder="17:00" />
                </div>
              </div>
              
              {selectedEmployees.map((emp, index) => {
                const bookedDays = (booking?.booked_days || []) as number[];
                const empAbsenceMap = emp ? absencesByEmployeeAndDay.get(emp) : undefined;
                const hasAbsence = emp && empAbsenceMap && bookedDays.some(d => empAbsenceMap.has(d));
                const empBookingMap = emp ? bookingsByEmployeeAndDay.get(emp) : undefined;
                const hasBooking = emp && empBookingMap && bookedDays.some(d => empBookingMap.has(d));
                const absenceTypes = hasAbsence
                  ? [...new Set(bookedDays.filter(d => empAbsenceMap!.has(d)).map(d => empAbsenceMap!.get(d)!))]
                  : [];
                return (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={emp || ""}
                      onValueChange={(value) => updateEmployee(index, value)}
                    >
                      <SelectTrigger className={`flex-1 bg-background text-foreground ${hasAbsence ? "border-green-700 bg-green-800 text-white dark:bg-green-900 dark:border-green-600" : hasBooking ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                        <SelectValue placeholder={`Medarbejder ${index + 1} (valgfri)`} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {employees
                          .filter(e => !selectedEmployees.includes(e.id) || e.id === emp)
                          .map((employee) => {
                            const empAbsences = absencesByEmployeeAndDay.get(employee.id);
                            const empBookings = bookingsByEmployeeAndDay.get(employee.id);
                            
                            // Only check if employee is booked on the SELECTED booked_days, not all days in the week
                            const bookedDaysArray = (booking?.booked_days || []) as number[];
                            const empHasBookingOnSelectedDays = bookedDaysArray.some(dayIndex => 
                              empBookings?.has(dayIndex)
                            );
                            const empHasAbsenceOnSelectedDays = bookedDaysArray.some(dayIndex => 
                              empAbsences?.has(dayIndex)
                            );
                            
                            const empHasNoShifts = hasNoShiftsAtAll(employee.id);
                            return (
                              <SelectItem 
                                key={employee.id} 
                                value={employee.id} 
                                className={`text-popover-foreground ${empHasNoShifts ? "text-gray-400 bg-gray-50 dark:bg-gray-950/20" : empHasAbsenceOnSelectedDays ? "text-red-600 bg-red-50 dark:bg-red-950/20" : empHasBookingOnSelectedDays ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                              >
                                <span className="flex items-center gap-2">
                                  {employee.full_name}
                                  {empHasNoShifts && (
                                    <>
                                      <Ban className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs text-gray-400">(Ingen vagter)</span>
                                    </>
                                  )}
                                  {!empHasNoShifts && empHasAbsenceOnSelectedDays && (
                                    <>
                                      <AlertTriangle className="h-3 w-3 text-red-500" />
                                      <span className="text-xs text-red-500">(Fravær)</span>
                                    </>
                                  )}
                                  {!empHasNoShifts && empHasBookingOnSelectedDays && !empHasAbsenceOnSelectedDays && (
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
                      <div key={vehId} className="flex items-center justify-between bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-md px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-yellow-800 dark:text-yellow-300 shrink-0" />
                            <span className="font-semibold text-yellow-900 dark:text-yellow-100">{(vehicle as any)?.name || "Ukendt"}</span>
                            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">({(vehicle as any)?.license_plate})</span>
                          </div>
                          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200 ml-6">{dateLabels.join(", ")}</span>
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

          {/* Diet Tab */}
          <TabsContent value="diet" className="space-y-4 mt-4">
            {/* Existing diet assignments */}
            {Object.keys(groupedDietAssignments).length > 0 && (
              <div className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-orange-600" />
                    Tilknyttede diæter
                  </p>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {Object.keys(groupedDietAssignments).length} medarbejdere • {currentDietAssignments.length} dage
                  </span>
                </div>
                <div className="grid gap-2">
                  {Object.entries(groupedDietAssignments).map(([empId, { employeeName, dates, totalAmount }]) => {
                    const sortedDates = [...dates].sort();
                    const dateLabels = sortedDates.map((d: string) => {
                      const dayIndex = Math.floor((parseISO(d).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                      return DAY_NAMES[dayIndex]?.slice(0, 3) || format(parseISO(d), "d/M");
                    });
                    return (
                      <div key={empId} className="flex items-center justify-between bg-card border rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
                            <Utensils className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{employeeName}</p>
                            <p className="text-xs text-muted-foreground">
                              {dateLabels.join(" • ")} • {totalAmount.toLocaleString('da-DK')} kr
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeDietMutation.mutate(empId)}
                          disabled={removeDietMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add diet section */}
            {assignedEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tilføj først medarbejdere til bookingen under "Medarbejdere" fanen.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tilføj diæt</p>
                  <Select
                    value={selectedDietEmployee || ""}
                    onValueChange={setSelectedDietEmployee}
                  >
                    <SelectTrigger className="bg-background text-foreground">
                      <SelectValue placeholder="Vælg medarbejder" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {assignedEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id} className="text-popover-foreground">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{employee.full_name}</span>
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
                          } ${selectedDietDays.has(index) ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : ""}`}
                          onClick={() => inRange && toggleDietDay(index)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedDietDays.has(index)}
                              disabled={!inRange}
                              onCheckedChange={() => inRange && toggleDietDay(index)}
                            />
                            <span className={selectedDietDays.has(index) ? "text-orange-800 dark:text-orange-200" : ""}>{dayName}</span>
                          </div>
                          <span className={`text-sm ${selectedDietDays.has(index) ? "text-orange-600" : "text-muted-foreground"}`}>
                            {getDateForDay(index)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Diet rate info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Diætsats: <span className="font-medium text-foreground">{(dietSalaryType?.amount || 0).toLocaleString('da-DK')} kr</span> per dag (fra lønart)</span>
                </div>

                {/* Summary of what will be added */}
                {selectedDietEmployee && selectedDietDays.size > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Du er ved at tilføje:</p>
                    <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                      • {assignedEmployees.find(e => e.id === selectedDietEmployee)?.full_name}: {Array.from(selectedDietDays).filter(d => isDayInBookingRange(d)).map(d => DAY_NAMES[d]).join(", ")}
                    </p>
                    <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                      Total: {(Array.from(selectedDietDays).filter(d => isDayInBookingRange(d)).length * (dietSalaryType?.amount || 0)).toLocaleString('da-DK')} kr
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    onClick={handleAddDiet}
                    disabled={!selectedDietEmployee || selectedDietDays.size === 0 || addDietMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {addDietMutation.isPending ? "Tilføjer..." : `Tilføj diæt til ${selectedDietDays.size} dag${selectedDietDays.size !== 1 ? "e" : ""}`}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Hotel Tab */}
          <TabsContent value="hotel" className="space-y-4 mt-4">
            <HotelTabContent booking={booking} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
