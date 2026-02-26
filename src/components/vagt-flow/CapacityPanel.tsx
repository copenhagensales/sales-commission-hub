import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, MapPin, Users, Target } from "lucide-react";
import { startOfWeek, addDays, format, parseISO, isWithinInterval } from "date-fns";
import { da } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CapacityPanelProps {
  selectedDate: Date;
  weekNumber: number;
  year: number;
}

const DAY_LABELS = ["M", "T", "O", "T", "F", "L", "S"];

export function CapacityPanel({ selectedDate, weekNumber, year }: CapacityPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch Fieldmarketing clients
  const { data: fieldmarketingClients = [] } = useQuery({
    queryKey: ["fieldmarketing-clients-capacity"],
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

  const { data: allEmployees } = useQuery({
    queryKey: ["vagt-active-employees-capacity-master"],
    queryFn: async () => {
      // Fetch team memberships with team names
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name) {
          const existing = employeeTeamMap.get(tm.employee_id);
          if (existing) {
            employeeTeamMap.set(tm.employee_id, `${existing}, ${tm.team.name}`);
          } else {
            employeeTeamMap.set(tm.employee_id, tm.team.name);
          }
        }
      });

      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true);

      if (error) throw error;
      return data?.filter(e => employeeTeamMap.has(e.id)).map(e => ({
        id: e.id,
        full_name: `${e.first_name} ${e.last_name}`,
        team: employeeTeamMap.get(e.id) || null,
        is_active: true,
      }));
    },
  });

  const fieldmarketingIds = allEmployees?.map(e => e.id) || [];

  // Fetch employee special shifts to identify "no shift" employees
  const { data: employeesWithNoShifts = [] } = useQuery({
    queryKey: ["employee-no-shifts-capacity", fieldmarketingIds],
    queryFn: async () => {
      if (fieldmarketingIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("employee_standard_shifts")
        .select("employee_id, shift_id")
        .in("employee_id", fieldmarketingIds);
      if (error) throw error;
      
      // Get shift IDs and check which have no days configured
      const shiftIds = [...new Set(data?.map(d => d.shift_id) || [])];
      if (shiftIds.length === 0) return [];
      
      const { data: days } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id")
        .in("shift_id", shiftIds);
      
      const shiftsWithDays = new Set((days || []).map(d => d.shift_id));
      
      // Return employees whose shift has no days (= "Ingen vagter")
      return data?.filter(d => !shiftsWithDays.has(d.shift_id)).map(d => d.employee_id) || [];
    },
    enabled: fieldmarketingIds.length > 0,
  });

  const { data: absencesData, isLoading: absencesLoading } = useQuery({
    queryKey: ["vagt-week-absences-capacity-v2", year, weekNumber, fieldmarketingIds],
    queryFn: async () => {
      if (fieldmarketingIds.length === 0) return [];
      
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      const { data: absences, error: absencesError } = await supabase
        .from("absence_request_v2")
        .select("id, employee_id, start_date, end_date, status")
        .in("employee_id", fieldmarketingIds)
        .in("status", ["approved", "pending"])
        .lte("start_date", weekEndStr)
        .gte("end_date", weekStartStr);

      if (absencesError) throw absencesError;
      
      const employeeMap = new Map(allEmployees?.map(e => [e.id, { id: e.id, team: e.team, is_active: true }]));
      
      return absences?.map(a => ({
        ...a,
        employee: employeeMap.get(a.employee_id),
      }));
    },
    enabled: fieldmarketingIds.length > 0,
  });

  const { data: weekBookings } = useQuery({
    queryKey: ["vagt-week-bookings-capacity", year, weekNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`id, start_date, end_date, client_id, clients(name)`)
        .eq("week_number", weekNumber)
        .eq("year", year);

      if (error) throw error;
      return data;
    },
  });

  // Get employee count per client (excluding "no shift" employees)
  const getEmployeeCountForClient = () => {
    return allEmployees?.filter(e => 
      !employeesWithNoShifts.includes(e.id)
    ).length || 0;
  };

  // Get bookings per day per client
  const getBookingsForClientDay = (clientId: string, date: Date) => {
    return weekBookings?.filter((booking: any) => {
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);
      return booking.client_id === clientId && 
        isWithinInterval(date, { start: bookingStart, end: bookingEnd });
    }).length || 0;
  };

  // Get absent employees per day per client
  const getAbsencesForDay = (date: Date) => {
    let absent = 0;
    absencesData?.forEach((absence: any) => {
      const employee = absence.employee;
      if (!employee || !employee.is_active) return;
      if (employeesWithNoShifts.includes(absence.employee_id)) return;

      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);

      if (isWithinInterval(date, { start: absenceStart, end: absenceEnd })) {
        absent++;
      }
    });
    return absent;
  };

  // Calculate shared capacity (single pool across all clients)
  const totalEmployees = getEmployeeCountForClient();

  const sharedDayData = weekDates.map((date) => {
    const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
    const absent = getAbsencesForDay(date);
    const available = isWeekendDay ? 0 : totalEmployees - absent;
    const capacity = Math.floor(available / 2);

    const clientBookings = fieldmarketingClients.map((client: any) => ({
      clientId: client.id,
      clientName: client.name,
      booked: getBookingsForClientDay(client.id, date),
    }));
    const totalBooked = clientBookings.reduce((sum, cb) => sum + cb.booked, 0);
    const remaining = capacity - totalBooked;

    return { date, available, capacity, totalBooked, remaining, absent, isWeekend: isWeekendDay, clientBookings };
  });

  const getManglerColor = (remaining: number) => {
    if (remaining < 0) return "text-destructive font-bold";
    if (remaining === 0) return "text-muted-foreground";
    return "text-green-600 dark:text-green-400 font-bold";
  };

  if (absencesLoading) return null;

  if (fieldmarketingClients.length === 0) {
    return (
      <Card className="border-muted">
        <CardContent className="py-4 text-center text-muted-foreground text-sm">
          Ingen kunder tildelt Fieldmarketing team
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted">
      <CardContent className="pt-4 pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Kapacitet uge {weekNumber}</span>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-1">
            <div className="text-[10px] text-muted-foreground mb-2">1 lokation = 2 medarbejdere</div>

            <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 items-center">
              {/* Day headers */}
              <div className="w-32" />
              {DAY_LABELS.map((label, idx) => (
                <div key={idx} className="text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}

              {/* Row: På vagt */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-32">
                <Users className="h-3 w-3 shrink-0" /> På vagt
              </div>
              {sharedDayData.map((day, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className="text-center text-xs font-medium text-muted-foreground">
                      {day.isWeekend ? "-" : day.available}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                    <p className="text-xs">{totalEmployees} total − {day.absent} fraværende = {day.available} på vagt</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* Row: Kapacitet (lokationer) */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-32">
                <MapPin className="h-3 w-3 shrink-0" /> Kapacitet
              </div>
              {sharedDayData.map((day, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className="text-center text-xs font-medium text-muted-foreground">
                      {day.isWeekend ? "-" : day.capacity}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                    <p className="text-xs">{day.available} på vagt ÷ 2 = {day.capacity} lokationer</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* Spacer row */}
              <div className="col-span-8 h-1" />

              {/* Per-client booking rows */}
              {fieldmarketingClients.map((client: any) => (
                <>
                  <div key={client.id} className="flex items-center gap-1.5 text-xs text-muted-foreground w-32 pl-4">
                    {client.name}
                  </div>
                  {sharedDayData.map((day, idx) => {
                    const cb = day.clientBookings.find(b => b.clientId === client.id);
                    return (
                      <div key={idx} className="text-center text-xs font-medium">{cb?.booked || 0}</div>
                    );
                  })}
                </>
              ))}

              {/* Total booked row */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground w-32">
                <MapPin className="h-3 w-3 shrink-0" /> Total booket
              </div>
              {sharedDayData.map((day, idx) => (
                <div key={idx} className="text-center text-xs font-semibold">{day.totalBooked}</div>
              ))}

              {/* Spacer row */}
              <div className="col-span-8 h-1" />

              {/* Row: Mangler */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-32">
                <Target className="h-3 w-3 shrink-0" /> Mangler
              </div>
              {sharedDayData.map((day, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className={`text-center text-xs ${day.isWeekend ? "text-muted-foreground" : getManglerColor(day.remaining)}`}>
                      {day.isWeekend ? "-" : day.remaining}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                    <p className="text-xs">{day.capacity} kapacitet − {day.totalBooked} booket = {day.remaining} mangler</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}