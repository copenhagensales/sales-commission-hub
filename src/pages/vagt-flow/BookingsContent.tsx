import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Calendar as CalendarIcon, AlertTriangle, X, Pencil, Car, Tent, Utensils, Hotel, CheckCircle2, UserPlus, Undo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useBookingHotels } from "@/hooks/useBookingHotels";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { format, addDays, getWeek, startOfWeek, parseISO } from "date-fns";
import { getWeekStartDate, getWeekYear } from "@/lib/calculations";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { EditBookingDialog } from "@/components/vagt-flow/EditBookingDialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function BookingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEditFmBookings } = usePermissions();
  const now = new Date();
  
  // Read week/year from URL or use current
  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");
  const [selectedWeek, setSelectedWeek] = useState(
    weekParam ? parseInt(weekParam) : getWeek(now, { weekStartsOn: 1 })
  );
  const [selectedYear, setSelectedYear] = useState(
    yearParam ? parseInt(yearParam) : getWeekYear(now)
  );
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [deleteAssignmentData, setDeleteAssignmentData] = useState<{
    id: string;
    employeeName: string;
    dayName: string;
    date: string;
  } | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([`${selectedYear}-${selectedWeek}`]));
  const [editBookingDialogBooking, setEditBookingDialogBooking] = useState<any>(null);
  const [deleteDayData, setDeleteDayData] = useState<{
    bookingId: string;
    dayIndex: number;
    dateLabel: string;
    date: string;
    assignmentCount: number;
    currentBookedDays: number[];
  } | null>(null);

  // Update URL when week/year changes
  useEffect(() => {
    const currentTab = searchParams.get("tab") || "bookings";
    setSearchParams({ tab: currentTab, week: selectedWeek.toString(), year: selectedYear.toString() });
  }, [selectedWeek, selectedYear]);

  const weekStart = getWeekStartDate(selectedYear, selectedWeek);
  const DAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  // Market types to exclude from regular bookings view
  const MARKET_TYPES = ["Markeder", "Messer"];

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-bookings-list", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data: bookingData, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city, type, daily_rate),
          clients(id, name),
          client_campaigns:campaign_id(id, name),
          booking_assignment(id, date, employee_id)
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .order("start_date");
      if (error) throw error;
      
      // Filter out markets/fairs - they have their own tab now
      const filteredData = bookingData?.filter((b: any) => 
        !MARKET_TYPES.includes(b.location?.type)
      ) || [];
      
      const employeeIds = [...new Set(
        filteredData?.flatMap(b => b.booking_assignment?.map((a: any) => a.employee_id) || []) || []
      )];
      
      let employeeMap = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: empData } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name")
          .in("id", employeeIds);
        
        employeeMap = new Map(empData?.map(e => [e.id, `${e.first_name} ${e.last_name}`]) || []);
      }
      
      return filteredData?.map(booking => ({
        ...booking,
        booking_assignment: booking.booking_assignment?.map((a: any) => ({
          ...a,
          employee_name: employeeMap.get(a.employee_id) || "Ukendt"
        }))
      }));
    },
  });

  // Fetch market bookings for the selected week (shown separately)
  const { data: marketBookings } = useQuery({
    queryKey: ["vagt-market-bookings-week", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data: bookingData, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city, type, daily_rate),
          clients(id, name),
          client_campaigns:campaign_id(id, name),
          booking_assignment(id, date, employee_id)
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .order("start_date");
      if (error) throw error;

      // Only keep markets/fairs
      const marketData = bookingData?.filter((b: any) =>
        MARKET_TYPES.includes(b.location?.type)
      ) || [];

      const employeeIds = [...new Set(
        marketData.flatMap(b => (b as any).booking_assignment?.map((a: any) => a.employee_id) || [])
      )];

      let employeeMap = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: empData } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name")
          .in("id", employeeIds);
        employeeMap = new Map(empData?.map(e => [e.id, `${e.first_name} ${e.last_name}`]) || []);
      }

      return marketData.map((booking: any) => ({
        ...booking,
        booking_assignment: booking.booking_assignment?.map((a: any) => ({
          ...a,
          employee_name: employeeMap.get(a.employee_id) || "Ukendt"
        }))
      }));
    },
  });

  // hotelMap built below after allBookingIds

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

  // Fetch Fieldmarketing employees via team_members (has public RLS for authenticated users)
  const { data: employees = [] } = useQuery({
    queryKey: ["vagt-employees-for-booking-fieldmarketing"],
    queryFn: async () => {
      // First get the Fieldmarketing team ID
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", "Fieldmarketing")
        .maybeSingle();

      if (teamError) throw teamError;
      if (!teamData) return [];

      // Get all employees who are members of the Fieldmarketing team via team_members
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          employee:employee_id(
            id,
            first_name,
            last_name,
            is_active
          )
        `)
        .eq("team_id", teamData.id);

      if (error) throw error;
      
      return (data || [])
        .filter((tm: any) => tm.employee && tm.employee.is_active)
        .map((tm: any) => ({
          id: tm.employee.id,
          full_name: `${tm.employee.first_name} ${tm.employee.last_name}`,
          team: teamData.name,
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

  // Combine all booking IDs (normal + market) for shared queries
  const allBookingIds = useMemo(() => {
    const ids = [
      ...(bookings?.map((b: any) => b.id) || []),
      ...(marketBookings?.map((b: any) => b.id) || []),
    ];
    return [...new Set(ids)];
  }, [bookings, marketBookings]);

  // Fetch hotel assignments for all bookings
  const { data: bookingHotels } = useBookingHotels(allBookingIds.length > 0 ? allBookingIds : undefined);
  const hotelMap = useMemo(() => {
    const map: Record<string, { hotelName: string; status: string; checkIn: string | null; checkOut: string | null }> = {};
    (bookingHotels || []).forEach((bh: any) => {
      map[bh.booking_id] = { hotelName: bh.hotel?.name || "Ukendt hotel", status: bh.status, checkIn: bh.check_in || null, checkOut: bh.check_out || null };
    });
    return map;
  }, [bookingHotels]);

  const { data: bookingVehicles = [] } = useQuery({
    queryKey: ["vagt-booking-vehicles", selectedWeek, selectedYear, allBookingIds],
    queryFn: async () => {
      if (allBookingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("booking_vehicle")
        .select("id, booking_id, vehicle_id, date, vehicle:vehicle_id(name, license_plate)")
        .in("booking_id", allBookingIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allBookingIds.length > 0,
  });

  // Fetch booking_diet data for diet tags

  const { data: bookingDiets = [] } = useQuery({
    queryKey: ["vagt-booking-diets", selectedWeek, selectedYear],
    queryFn: async () => {
      if (allBookingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("booking_diet")
        .select("id, booking_id, date, created_at, created_by")
        .in("booking_id", allBookingIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allBookingIds.length > 0,
  });

  // Fetch diet salary type for quick-add
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
  });

  // Build lookup: booking_id + date -> diet info (created_at, created_by)
  const dietByBookingDate = useMemo(() => {
    const map = new Map<string, { created_at: string | null; created_by: string | null }>();
    for (const d of bookingDiets as any[]) {
      if (!d.date) continue;
      const key = `${d.booking_id}_${d.date}`;
      if (!map.has(key)) {
        map.set(key, { created_at: d.created_at, created_by: d.created_by });
      }
    }
    return map;
  }, [bookingDiets]);

  // Fetch employee names for diet created_by user ids
  const dietCreatorUserIds = useMemo(() => {
    const ids = new Set<string>();
    dietByBookingDate.forEach(v => { if (v.created_by) ids.add(v.created_by); });
    return Array.from(ids);
  }, [dietByBookingDate]);

  const { data: dietCreatorNames } = useQuery({
    queryKey: ["diet-creator-names", dietCreatorUserIds],
    queryFn: async () => {
      if (dietCreatorUserIds.length === 0) return {};
      const { data } = await supabase
        .from("employee_master_data")
        .select("auth_user_id, first_name, last_name")
        .in("auth_user_id", dietCreatorUserIds);
      const map: Record<string, string> = {};
      for (const e of data || []) {
        if (e.auth_user_id) map[e.auth_user_id] = `${e.first_name} ${e.last_name}`.trim();
      }
      return map;
    },
    enabled: dietCreatorUserIds.length > 0,
  });

  // Build lookup: booking_id + date -> unique vehicles
  const vehiclesByBookingDate = useMemo(() => {
    const map = new Map<string, { name: string; plate: string; vehicleId: string }[]>();
    for (const bv of bookingVehicles as any[]) {
      if (!bv.vehicle || !bv.date) continue;
      const key = `${bv.booking_id}_${bv.date}`;
      const existing = map.get(key) || [];
      const alreadyAdded = existing.some(v => v.vehicleId === bv.vehicle_id);
      if (!alreadyAdded) {
        existing.push({ name: bv.vehicle.name, plate: bv.vehicle.license_plate, vehicleId: bv.vehicle_id });
      }
      map.set(key, existing);
    }
    return map;
  }, [bookingVehicles]);

  // Fetch approved absences for employees in this week's bookings
  const { data: employeeAbsences = [] } = useQuery({
    queryKey: ["employee-absences-for-booking", selectedWeek, selectedYear],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      // Fetch approved absences that overlap with the selected week
      const { data: absences, error } = await supabase
        .from("absence_request_v2")
        .select("employee_id, start_date, end_date, type")
        .eq("status", "approved")
        .lte("start_date", endStr)
        .gte("end_date", startStr);

      if (error) throw error;
      return absences || [];
    },
    enabled: !!weekStart,
  });

  // Build a map of employee_id -> date -> absence_type for quick lookup
  const absenceMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    
    for (const absence of employeeAbsences) {
      if (!map.has(absence.employee_id)) {
        map.set(absence.employee_id, new Map());
      }
      
      // Expand date range to individual dates (use parseISO to avoid timezone issues)
      const start = parseISO(absence.start_date);
      const end = parseISO(absence.end_date);
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = format(current, "yyyy-MM-dd");
        map.get(absence.employee_id)!.set(dateStr, absence.type);
        current.setDate(current.getDate() + 1);
      }
    }
    
    return map;
  }, [employeeAbsences]);

  // Helper to check if employee has absence on date
  const getAbsenceType = (employeeId: string, date: Date): string | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return absenceMap.get(employeeId)?.get(dateStr) || null;
  };

  // Get Danish label for absence type
  const getAbsenceLabel = (type: string): string => {
    switch (type) {
      case "sick": return "Syg";
      case "vacation": return "Ferie";
      case "day_off": return "Fridag";
      default: return "Fravær";
    }
  };

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
      // Check if RLS silently blocked the insert
      if (!data || data.length === 0) {
        throw new Error("Du har ikke rettigheder til at tilføje medarbejdere. Kontakt din administrator.");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Medarbejdere tilføjet", description: `${data.length} tildelinger oprettet` });
    },
    onError: (error: any) => {
      console.error("Fejl ved tilføjelse af medarbejdere:", error);
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
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
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
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Medarbejder fjernet fra vagt" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const removeDayMutation = useMutation({
    mutationFn: async ({ bookingId, dayIndex, date, currentBookedDays }: {
      bookingId: string; dayIndex: number; date: string; currentBookedDays: number[];
    }) => {
      const { error: delErr } = await supabase
        .from("booking_assignment")
        .delete()
        .eq("booking_id", bookingId)
        .eq("date", date);
      if (delErr) throw delErr;

      const newBookedDays = currentBookedDays.filter(d => d !== dayIndex);

      if (newBookedDays.length === 0) {
        const { error: bookErr } = await supabase.from("booking").delete().eq("id", bookingId);
        if (bookErr) throw bookErr;
      } else {
        const { error: updErr } = await supabase
          .from("booking")
          .update({ booked_days: newBookedDays })
          .eq("id", bookingId);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Dag fjernet fra booking" });
      setDeleteDayData(null);
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setDeleteDayData(null);
    },
  });

  const addDayMutation = useMutation({
    mutationFn: async ({ bookingId, dayIndex, currentBookedDays }: {
      bookingId: string; dayIndex: number; currentBookedDays: number[];
    }) => {
      const newBookedDays = [...currentBookedDays, dayIndex].sort((a, b) => a - b);
      const { error } = await supabase
        .from("booking")
        .update({ booked_days: newBookedDays })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Dag tilføjet til booking" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const addVehicleToDayMutation = useMutation({
    mutationFn: async ({ bookingId, vehicleId, date }: {
      bookingId: string; vehicleId: string; date: string;
    }) => {
      const { error } = await supabase.from("booking_vehicle").insert({
        booking_id: bookingId,
        vehicle_id: vehicleId,
        date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-booking-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Bil tilføjet" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const removeVehicleFromDayMutation = useMutation({
    mutationFn: async ({ bookingId, vehicleId, date }: {
      bookingId: string; vehicleId: string; date: string;
    }) => {
      const { error } = await supabase
        .from("booking_vehicle")
        .delete()
        .eq("booking_id", bookingId)
        .eq("vehicle_id", vehicleId)
        .eq("date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-booking-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
      toast({ title: "Bil fjernet fra dag" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const addDietToDayMutation = useMutation({
    mutationFn: async ({ bookingId, date, employeeIds }: {
      bookingId: string; date: string; employeeIds: string[];
    }) => {
      if (!dietSalaryType) throw new Error("Diæt lønart ikke fundet");
      const { data: { user } } = await supabase.auth.getUser();
      const inserts = employeeIds.map(employeeId => ({
        booking_id: bookingId,
        employee_id: employeeId,
        salary_type_id: dietSalaryType.id,
        date,
        amount: dietSalaryType.amount || 0,
        created_by: user?.id || null,
      }));
      if (inserts.length === 0) throw new Error("Ingen medarbejdere tildelt denne dag");
      const { error } = await supabase.from("booking_diet").upsert(inserts, { onConflict: "booking_id,employee_id,date,salary_type_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-booking-diets"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      toast({ title: "Diæt tilføjet" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const removeDietFromDayMutation = useMutation({
    mutationFn: async ({ bookingId, date }: {
      bookingId: string; date: string;
    }) => {
      const { error } = await supabase
        .from("booking_diet")
        .delete()
        .eq("booking_id", bookingId)
        .eq("date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-booking-diets"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings-week"] });
      toast({ title: "Diæt fjernet fra dag" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });


  const DayQuickAddButtons = ({ booking, dayDate, dayAssignments }: {
    booking: any;
    dayDate: Date;
    dayAssignments: any[];
  }) => {
    const dateStr = format(dayDate, "yyyy-MM-dd");
    const assignedEmployeeIds = new Set(dayAssignments?.map((a: any) => a.employee_id) || []);
    const availableEmployees = employees.filter(e => !assignedEmployeeIds.has(e.id));
    
    const dayVehicleIds = new Set(
      (bookingVehicles as any[])
        .filter(bv => bv.booking_id === booking.id && bv.date === dateStr)
        .map(bv => bv.vehicle_id)
    );
    const availableVehicles = vehicles.filter(v => !dayVehicleIds.has(v.id));

    return (
      <div className="mt-1 flex items-center justify-center gap-1 opacity-0 group-hover/day:opacity-100 transition-opacity">
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="bg-primary/20 text-primary rounded-full p-0.5 hover:bg-primary/30 transition-colors"
              title="Tilføj medarbejder"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="center" side="bottom">
            <p className="text-xs font-medium mb-1 text-muted-foreground">Tilføj medarbejder</p>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {availableEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Ingen ledige</p>
              ) : (
                availableEmployees.map(emp => (
                  <button
                    key={emp.id}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      bulkAssignMutation.mutate([{
                        bookingId: booking.id,
                        employeeId: emp.id,
                        dates: [dateStr],
                        startTime: booking.start_date ? "09:00" : "09:00",
                        endTime: booking.end_date ? "17:00" : "17:00",
                      }]);
                    }}
                  >
                    {emp.full_name}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="bg-yellow-200/60 text-yellow-800 rounded-full p-0.5 hover:bg-yellow-200 transition-colors dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60"
              title="Tilføj bil"
            >
              <Car className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="center" side="bottom">
            <p className="text-xs font-medium mb-1 text-muted-foreground">Tilføj bil</p>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {availableVehicles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Ingen ledige</p>
              ) : (
                availableVehicles.map(v => (
                  <button
                    key={v.id}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      addVehicleToDayMutation.mutate({
                        bookingId: booking.id,
                        vehicleId: v.id,
                        date: dateStr,
                      });
                    }}
                  >
                    {v.name} {v.license_plate ? `(${v.license_plate})` : ''}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        {/* Diet toggle button - only show if no diet on this day yet */}
        {!dietByBookingDate.has(`${booking.id}_${dateStr}`) && dietSalaryType && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const employeeIds = dayAssignments?.map((a: any) => a.employee_id) || [];
              if (employeeIds.length === 0) {
                toast({ title: "Ingen medarbejdere", description: "Tilføj medarbejdere først", variant: "destructive" });
                return;
              }
              addDietToDayMutation.mutate({
                bookingId: booking.id,
                date: dateStr,
                employeeIds,
              });
            }}
            className="bg-orange-200/60 text-orange-800 rounded-full p-0.5 hover:bg-orange-200 transition-colors dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
            title="Tilføj diæt"
          >
            <Utensils className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  // Confirm week mutation
  const confirmWeekMutation = useMutation({
    mutationFn: async () => {
      const draftIds = [
        ...(bookings?.filter((b: any) => b.status === 'draft').map((b: any) => b.id) || []),
        ...(marketBookings?.filter((b: any) => b.status === 'draft').map((b: any) => b.id) || []),
      ];
      if (draftIds.length === 0) return;
      const { error } = await supabase
        .from("booking")
        .update({ status: 'confirmed' })
        .in("id", draftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Uge bekræftet", description: "Alle kladder er nu bekræftet." });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const confirmSingleMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("booking")
        .update({ status: 'confirmed' })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Booking bekræftet" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const revertToDraftMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('booking')
        .update({ status: 'draft' })
        .eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Booking sat tilbage til kladde" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const draftCount = (bookings?.filter((b: any) => b.status === 'draft').length || 0) + (marketBookings?.filter((b: any) => b.status === 'draft').length || 0);

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
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-center min-w-[80px] hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer">
                <div className="text-3xl font-bold">{selectedWeek}</div>
                <div className="text-xs text-muted-foreground">{selectedYear}</div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover" align="center">
              <Calendar
                mode="single"
                selected={weekStart}
                onSelect={(date) => {
                  if (date) {
                    const newWeek = getWeek(date, { weekStartsOn: 1 });
                    const newYear = getWeekYear(date);
                    setSelectedWeek(newWeek);
                    setSelectedYear(newYear);
                  }
                }}
                showWeekNumber
                weekStartsOn={1}
                locale={da}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronUp className="h-4 w-4 rotate-90" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4">
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
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle statusser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statusser</SelectItem>
                  <SelectItem value="draft">Kladder</SelectItem>
                  <SelectItem value="confirmed">Bekræftede</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draftCount > 0 && canEditFmBookings && (
              <Button
                onClick={() => confirmWeekMutation.mutate()}
                disabled={confirmWeekMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Bekræft uge ({draftCount} {draftCount === 1 ? 'kladde' : 'kladder'})
              </Button>
            )}
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
                      <CalendarIcon className="h-5 w-5 text-primary" />
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
                    <div key={booking.id} className={cn(
                      "p-4 border-b last:border-b-0 hover:bg-muted/50",
                      booking.status === 'draft' && "border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="cursor-pointer"
                            onClick={() => navigate(`/vagt-flow/locations/${booking.location_id}?week=${selectedWeek}&year=${selectedYear}`)}
                          >
                            <p className="font-medium hover:underline">{booking.location?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.location?.address_city} • {booking.location?.type}
                            </p>
                          </div>
                          {booking.status === 'draft' && (
                            <>
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700">
                                Kladde
                              </Badge>
                              {canEditFmBookings && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                                  onClick={(e) => { e.stopPropagation(); confirmSingleMutation.mutate(booking.id); }}
                                  disabled={confirmSingleMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Bekræft
                                </Button>
                              )}
                            </>
                          )}
                          {booking.status === 'confirmed' && canEditFmBookings && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs gap-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-950"
                              onClick={(e) => { e.stopPropagation(); revertToDraftMutation.mutate(booking.id); }}
                              disabled={revertToDraftMutation.isPending}
                            >
                              <Undo2 className="h-3 w-3" />
                              Til kladde
                            </Button>
                          )}
                          {hotelMap[booking.id] && (
                            <Badge className={cn(
                              "flex items-center gap-1",
                              hotelMap[booking.id].status === 'confirmed'
                                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
                                : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700"
                            )}>
                              <Hotel className="h-3 w-3" />
                              {hotelMap[booking.id].hotelName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditFmBookings && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditBookingDialogBooking(booking)}
                                title="Rediger booking"
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteBookingId(booking.id)}
                                title="Slet booking"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
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
                              className={cn(
                                "p-2 rounded-lg text-center text-xs relative group/day",
                                isBooked ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                              )}
                            >
                              {/* Delete day button - hover only */}
                              {canEditFmBookings && isBooked && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDayData({
                                      bookingId: booking.id,
                                      dayIndex: idx,
                                      dateLabel: `${day} d. ${format(dayDate, "d/M")}`,
                                      date: format(dayDate, "yyyy-MM-dd"),
                                      assignmentCount: dayAssignments?.length || 0,
                                      currentBookedDays: booking.booked_days || [],
                                    });
                                  }}
                                  className="absolute top-1 right-1 opacity-0 group-hover/day:opacity-100 
                                             bg-destructive text-destructive-foreground rounded-full p-0.5
                                             hover:bg-destructive/90 transition-opacity z-10"
                                  title="Fjern denne dag fra bookingen"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                              {/* Add day button - hover only on non-booked days */}
                              {canEditFmBookings && !isBooked && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addDayMutation.mutate({
                                      bookingId: booking.id,
                                      dayIndex: idx,
                                      currentBookedDays: booking.booked_days || [],
                                    });
                                  }}
                                  className="absolute top-1 right-1 opacity-0 group-hover/day:opacity-100 
                                             bg-primary text-primary-foreground rounded-full p-0.5
                                             hover:bg-primary/90 transition-opacity z-10"
                                  title="Tilføj denne dag til bookingen"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                              <p className="font-medium">{day}</p>
                              <p className="text-muted-foreground">{format(dayDate, "d/M")}</p>
                              {isBooked && dayAssignments?.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {dayAssignments.map((assignment: any) => {
                                    const absenceType = getAbsenceType(assignment.employee_id, dayDate);
                                    const hasAbsence = !!absenceType;
                                    
                                    return (
                                      <div 
                                        key={assignment.id} 
                                        className={cn(
                                          "text-[10px] font-medium truncate flex items-center justify-center gap-0.5 group relative",
                                          hasAbsence ? "text-destructive" : "text-primary"
                                        )}
                                        title={hasAbsence ? getAbsenceLabel(absenceType) : undefined}
                                      >
                                        {hasAbsence && <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />}
                                        <span>{assignment.employee_name?.split(' ')[0]}</span>
                                        
                                        {/* Delete button - only visible for editors on hover */}
                                        {canEditFmBookings && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteAssignmentData({
                                                id: assignment.id,
                                                employeeName: assignment.employee_name,
                                                dayName: day,
                                                date: format(dayDate, "d. MMM", { locale: da })
                                              });
                                            }}
                                            className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 
                                                       bg-destructive text-destructive-foreground rounded-full p-0.5 
                                                       hover:bg-destructive/90 transition-opacity z-10"
                                            title="Fjern medarbejder fra denne dag"
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {(() => {
                                const dateStr = format(dayDate, "yyyy-MM-dd");
                                const dayVehicles = vehiclesByBookingDate.get(`${booking.id}_${dateStr}`);
                                if (!dayVehicles?.length) return null;
                                return (
                                  <div className="mt-1 flex flex-col items-center gap-0.5">
                                    {dayVehicles.map((v, i) => (
                                      <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300">
                                        <Car className="h-2 w-2" />
                                        {v.name}
                                        {canEditFmBookings && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeVehicleFromDayMutation.mutate({
                                                bookingId: booking.id,
                                                vehicleId: v.vehicleId,
                                                date: dateStr,
                                              });
                                            }}
                                            className="ml-0.5 opacity-0 group-hover/day:opacity-100 transition-opacity hover:text-destructive"
                                            title="Fjern bil fra dag"
                                          >
                                            <X className="h-2 w-2" />
                                          </button>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                );
                              })()}
                              {(() => {
                                const dateStr = format(dayDate, "yyyy-MM-dd");
                                const dietInfo = dietByBookingDate.get(`${booking.id}_${dateStr}`);
                                if (!dietInfo) return null;
                                const creatorName = dietInfo.created_by && dietCreatorNames?.[dietInfo.created_by];
                                const createdTime = dietInfo.created_at ? format(new Date(dietInfo.created_at), "HH:mm 'd.' dd/MM", { locale: da }) : null;
                                const tooltipText = creatorName
                                  ? `Tilføjet af ${creatorName} kl. ${createdTime}`
                                  : createdTime ? `Tilføjet kl. ${createdTime}` : "Diæt";
                                return (
                                  <div className="mt-1 flex flex-col items-center">
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-orange-100 text-orange-800 border border-orange-300 cursor-default">
                                            <Utensils className="h-2 w-2" />
                                            Diæt
                                            {canEditFmBookings && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  removeDietFromDayMutation.mutate({
                                                    bookingId: booking.id,
                                                    date: dateStr,
                                                  });
                                                }}
                                                className="ml-0.5 opacity-0 group-hover/day:opacity-100 transition-opacity hover:text-destructive"
                                                title="Fjern diæt fra dag"
                                              >
                                                <X className="h-2 w-2" />
                                              </button>
                                            )}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          {tooltipText}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                );
                              })()}
                              {canEditFmBookings && isBooked && (
                                <DayQuickAddButtons
                                  booking={booking}
                                  dayDate={dayDate}
                                  dayAssignments={dayAssignments || []}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick actions removed - now in EditBookingDialog */}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))
      )}

      {/* Market bookings section */}
      {marketBookings && marketBookings.length > 0 && (
        <Collapsible
          open={expandedWeeks.has(`${selectedYear}-${selectedWeek}-markets`)}
          onOpenChange={() => toggleWeekExpand(`${selectedYear}-${selectedWeek}-markets`)}
          defaultOpen
        >
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Tent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">Markeder denne uge</h3>
                    <p className="text-sm text-muted-foreground">{marketBookings.length} marked{marketBookings.length !== 1 ? 'er' : ''}</p>
                  </div>
                </div>
                {expandedWeeks.has(`${selectedYear}-${selectedWeek}-markets`) ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-6 pb-6 pt-4 space-y-4">
              {marketBookings.map((booking: any) => (
                <div key={booking.id} className={`p-4 border rounded-lg hover:bg-muted/50 ${booking.status === 'draft' ? 'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10' : 'bg-card'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="cursor-pointer"
                      onClick={() => navigate(`/vagt-flow/locations/${booking.location_id}?week=${selectedWeek}&year=${selectedYear}`)}
                    >
                      <p className="font-medium hover:underline">{booking.location?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.location?.address_city} • {booking.location?.type}
                        {booking.clients?.name ? ` • ${booking.clients.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.status === 'draft' && (
                        <>
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700">
                            Kladde
                          </Badge>
                          {canEditFmBookings && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                              onClick={(e) => { e.stopPropagation(); confirmSingleMutation.mutate(booking.id); }}
                              disabled={confirmSingleMutation.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Bekræft
                            </Button>
                          )}
                        </>
                      )}
                      {booking.status === 'confirmed' && canEditFmBookings && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-950"
                          onClick={(e) => { e.stopPropagation(); revertToDraftMutation.mutate(booking.id); }}
                          disabled={revertToDraftMutation.isPending}
                        >
                          <Undo2 className="h-3 w-3" />
                          Til kladde
                        </Button>
                      )}
                      {canEditFmBookings && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditBookingDialogBooking(booking)}
                            title="Rediger booking"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteBookingId(booking.id)}
                            title="Slet booking"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Days grid - same as regular bookings */}
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
                          className={cn(
                            "p-2 rounded-lg text-center text-xs relative group/day",
                            isBooked ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                          )}
                        >
                          {/* Delete day button - hover only */}
                          {canEditFmBookings && isBooked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDayData({
                                  bookingId: booking.id,
                                  dayIndex: idx,
                                  dateLabel: `${day} d. ${format(dayDate, "d/M")}`,
                                  date: format(dayDate, "yyyy-MM-dd"),
                                  assignmentCount: dayAssignments?.length || 0,
                                  currentBookedDays: booking.booked_days || [],
                                });
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover/day:opacity-100 
                                         bg-destructive text-destructive-foreground rounded-full p-0.5
                                         hover:bg-destructive/90 transition-opacity z-10"
                              title="Fjern denne dag fra bookingen"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          {/* Add day button - hover only on non-booked days */}
                          {canEditFmBookings && !isBooked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addDayMutation.mutate({
                                  bookingId: booking.id,
                                  dayIndex: idx,
                                  currentBookedDays: booking.booked_days || [],
                                });
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover/day:opacity-100 
                                         bg-primary text-primary-foreground rounded-full p-0.5
                                         hover:bg-primary/90 transition-opacity z-10"
                              title="Tilføj denne dag til bookingen"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          <p className="font-medium">{day}</p>
                          <p className="text-muted-foreground">{format(dayDate, "d/M")}</p>
                          {isBooked && dayAssignments?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {dayAssignments.map((assignment: any) => (
                                <div
                                  key={assignment.id}
                                  className={cn(
                                    "text-[10px] font-medium truncate flex items-center justify-center gap-0.5 group relative",
                                    "text-primary"
                                  )}
                                >
                                  <span>{assignment.employee_name?.split(' ')[0]}</span>
                                  
                                  {/* Delete employee button - hover only */}
                                  {canEditFmBookings && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteAssignmentData({
                                          id: assignment.id,
                                          employeeName: assignment.employee_name,
                                          dayName: day,
                                          date: format(dayDate, "d. MMM", { locale: da })
                                        });
                                      }}
                                      className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 
                                                 bg-destructive text-destructive-foreground rounded-full p-0.5 
                                                 hover:bg-destructive/90 transition-opacity z-10"
                                      title="Fjern medarbejder fra denne dag"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {(() => {
                            const dateStr = format(dayDate, "yyyy-MM-dd");
                            const dayVehicles = vehiclesByBookingDate.get(`${booking.id}_${dateStr}`);
                            if (!dayVehicles?.length) return null;
                            return (
                              <div className="mt-1 flex flex-col items-center gap-0.5">
                                {dayVehicles.map((v, i) => (
                                  <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300">
                                    <Car className="h-2 w-2" />
                                    {v.name}
                                    {canEditFmBookings && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeVehicleFromDayMutation.mutate({
                                            bookingId: booking.id,
                                            vehicleId: v.vehicleId,
                                            date: dateStr,
                                          });
                                        }}
                                        className="ml-0.5 opacity-0 group-hover/day:opacity-100 transition-opacity hover:text-destructive"
                                        title="Fjern bil fra dag"
                                      >
                                        <X className="h-2 w-2" />
                                      </button>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            );
                          })()}
                          {(() => {
                            const dateStr = format(dayDate, "yyyy-MM-dd");
                            const dietInfo = dietByBookingDate.get(`${booking.id}_${dateStr}`);
                            if (!dietInfo) return null;
                            const creatorName = dietInfo.created_by && dietCreatorNames?.[dietInfo.created_by];
                            const createdTime = dietInfo.created_at ? format(new Date(dietInfo.created_at), "HH:mm 'd.' dd/MM", { locale: da }) : null;
                            const tooltipText = creatorName
                              ? `Tilføjet af ${creatorName} kl. ${createdTime}`
                              : createdTime ? `Tilføjet kl. ${createdTime}` : "Diæt";
                            return (
                              <div className="mt-1 flex flex-col items-center">
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-orange-100 text-orange-800 border border-orange-300 cursor-default">
                                        <Utensils className="h-2 w-2" />
                                        Diæt
                                        {canEditFmBookings && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeDietFromDayMutation.mutate({
                                                bookingId: booking.id,
                                                date: dateStr,
                                              });
                                            }}
                                            className="ml-0.5 opacity-0 group-hover/day:opacity-100 transition-opacity hover:text-destructive"
                                            title="Fjern diæt fra dag"
                                          >
                                            <X className="h-2 w-2" />
                                          </button>
                                        )}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      {tooltipText}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            );
                          })()}
                          {(() => {
                            const hotelInfo = hotelMap[booking.id];
                            if (!hotelInfo) return null;
                            const dateStr = format(dayDate, "yyyy-MM-dd");
                            if (hotelInfo.checkIn && hotelInfo.checkOut) {
                              if (dateStr < hotelInfo.checkIn || dateStr > hotelInfo.checkOut) return null;
                            }
                            return (
                              <div className="mt-1 flex flex-col items-center">
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-blue-100 text-blue-800 border border-blue-300">
                                  <Hotel className="h-2 w-2" />
                                  {hotelInfo.hotelName}
                                </Badge>
                              </div>
                            );
                          })()}
                          {canEditFmBookings && isBooked && (
                            <DayQuickAddButtons
                              booking={booking}
                              dayDate={dayDate}
                              dayAssignments={dayAssignments || []}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}


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

      {/* Delete single assignment confirmation */}
      <AlertDialog 
        open={!!deleteAssignmentData} 
        onOpenChange={() => setDeleteAssignmentData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern medarbejder fra vagt?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil fjerne <strong>{deleteAssignmentData?.employeeName}</strong> fra {deleteAssignmentData?.dayName} d. {deleteAssignmentData?.date}?
              <br /><br />
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAssignmentData) {
                  deleteAssignmentMutation.mutate(deleteAssignmentData.id);
                  setDeleteAssignmentData(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete day from booking confirmation */}
      <AlertDialog open={!!deleteDayData} onOpenChange={() => setDeleteDayData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern dag fra booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Vil du fjerne <strong>{deleteDayData?.dateLabel}</strong> fra denne booking?
              {(deleteDayData?.assignmentCount ?? 0) > 0 && (
                <>
                  <br /><br />
                  {deleteDayData?.assignmentCount} medarbejder{deleteDayData?.assignmentCount !== 1 ? 'e' : ''} vil også blive fjernet.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDayData) {
                  removeDayMutation.mutate({
                    bookingId: deleteDayData.bookingId,
                    dayIndex: deleteDayData.dayIndex,
                    date: deleteDayData.date,
                    currentBookedDays: deleteDayData.currentBookedDays,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fjern dag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditBookingDialog
        open={!!editBookingDialogBooking}
        onOpenChange={(open) => !open && setEditBookingDialogBooking(null)}
        booking={editBookingDialogBooking}
        weekNumber={selectedWeek}
        year={selectedYear}
        weekStart={weekStart}
        employees={employees}
        vehicles={vehicles}
        onAddEmployeeAssignments={(assignments) => {
          if (!editBookingDialogBooking) return;
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
          if (!editBookingDialogBooking) return;
          const inserts = assignment.dates.map(date => ({
            booking_id: editBookingDialogBooking.id,
            vehicle_id: assignment.vehicleId,
            date,
          }));
          const { error } = await supabase.from("booking_vehicle").insert(inserts);
          if (error) {
            toast({ title: "Fejl", description: error.message, variant: "destructive" });
          } else {
            queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
            toast({ title: "Bil tilføjet" });
          }
        }}
      />

    </div>
  );
}
