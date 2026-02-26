import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, MapPin, Calendar } from "lucide-react";
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

  // Calculate capacity data per client per day
  const capacityByClient = fieldmarketingClients.map((client: any) => {
    const totalEmployees = getEmployeeCountForClient();
    
    const dayData = weekDates.map((date) => {
      const absent = getAbsencesForDay(date);
      const available = totalEmployees - absent;
      const capacity = Math.floor(available / 2);
      const booked = getBookingsForClientDay(client.id, date);
      const remaining = capacity - booked;
      
      return { date, capacity, booked, remaining, absent };
    });

    return {
      client,
      totalEmployees,
      dayData,
    };
  });

  // Get info text for client
  const getInfoText = (dayData: { booked: number; capacity: number }[]) => {
    const weekdayData = dayData.slice(0, 5);
    const minRemaining = Math.min(...weekdayData.map(d => d.capacity - d.booked));
    const maxRemaining = Math.max(...weekdayData.map(d => d.capacity - d.booked));
    
    if (minRemaining === maxRemaining) {
      return `${maxRemaining} ledige lok. alle hverdage`;
    }
    
    const minDays = weekdayData
      .map((d, i) => ({ rem: d.capacity - d.booked, day: ["mandag", "tirsdag", "onsdag", "torsdag", "fredag"][i] }))
      .filter(d => d.rem === minRemaining)
      .map(d => d.day);
    
    return `${minRemaining} ledige lok. ${minDays.join(" & ")}, ${maxRemaining} øvrige dage`;
  };

  const getFillColor = (booked: number, capacity: number) => {
    if (capacity === 0) return "bg-muted";
    const ratio = booked / capacity;
    if (ratio > 1) return "bg-destructive";
    if (ratio > 0.8) return "bg-destructive/80";
    if (ratio >= 0.5) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTextColor = (booked: number, capacity: number) => {
    if (capacity === 0) return "text-muted-foreground";
    const ratio = booked / capacity;
    if (ratio > 1) return "text-destructive font-bold";
    if (ratio > 0.8) return "text-destructive";
    if (ratio >= 0.5) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
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
          <div className="mt-4 space-y-6">
            {/* Day headers */}
            <div className="flex justify-end gap-1 mb-2 pr-3">
              {DAY_LABELS.map((label, idx) => (
                <div key={idx} className="w-7 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>

            {capacityByClient.map(({ client, totalEmployees, dayData }) => (
              <div key={client.id} className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {client.name} ({totalEmployees} medarbejdere)
                </div>
                
                {/* Compact booket/kapacitet row */}
                <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Booket / Kap.
                  </span>
                  <div className="flex gap-1">
                    {dayData.map((day, idx) => (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div className="w-10 flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-bold ${getTextColor(day.booked, day.capacity)}`}>
                              {day.booked}/{day.capacity}
                            </span>
                            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getFillColor(day.booked, day.capacity)}`}
                                style={{ width: `${day.capacity > 0 ? Math.min((day.booked / day.capacity) * 100, 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                          <p className="text-xs">{day.capacity} kap. – {day.booked} booket = {day.capacity - day.booked} ledige</p>
                          <p className="text-xs text-muted-foreground">{day.absent} fraværende</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Info text */}
                <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
                  <span>💡</span>
                  {getInfoText(dayData)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}