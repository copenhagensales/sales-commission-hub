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
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, department")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true)
        .not("department", "is", null);

      if (error) throw error;
      return data?.map(e => ({
        id: e.id,
        full_name: `${e.first_name} ${e.last_name}`,
        team: e.department,
        is_active: true,
      }));
    },
  });

  const fieldmarketingIds = allEmployees?.map(e => e.id) || [];

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
        .eq("year", year)
        .in("status", ["Planlagt", "Bekræftet"]);

      if (error) throw error;
      return data;
    },
  });

  // Get employee count per client (based on department matching client name)
  const getEmployeeCountForClient = (clientName: string) => {
    return allEmployees?.filter(e => 
      e.team?.toLowerCase().includes(clientName.toLowerCase())
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
  const getAbsencesForClientDay = (clientName: string, date: Date) => {
    let absent = 0;
    absencesData?.forEach((absence: any) => {
      const employee = absence.employee;
      if (!employee || !employee.is_active) return;

      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);

      if (isWithinInterval(date, { start: absenceStart, end: absenceEnd })) {
        if (employee.team?.toLowerCase().includes(clientName.toLowerCase())) {
          absent++;
        }
      }
    });
    return absent;
  };

  // Calculate capacity data per client per day
  const capacityByClient = fieldmarketingClients.map((client: any) => {
    const totalEmployees = getEmployeeCountForClient(client.name);
    
    const dayData = weekDates.map((date) => {
      const absent = getAbsencesForClientDay(client.name, date);
      const available = totalEmployees - absent;
      const capacity = Math.floor(available / 2); // 2 employees per location
      const booked = getBookingsForClientDay(client.id, date);
      const remaining = capacity - booked;
      
      return { date, capacity, booked, remaining };
    });

    return {
      client,
      totalEmployees,
      dayData,
    };
  });

  // Get info text for client
  const getInfoText = (dayData: { remaining: number }[]) => {
    const weekdayCapacities = dayData.slice(0, 5).map(d => d.remaining);
    const minCap = Math.min(...weekdayCapacities);
    const maxCap = Math.max(...weekdayCapacities);
    
    if (minCap === maxCap) {
      return `Kan booke op til ${maxCap} lokationer alle hverdage`;
    }
    
    const minDays = weekdayCapacities
      .map((c, i) => ({ cap: c, day: ["mandag", "tirsdag", "onsdag", "torsdag", "fredag"][i] }))
      .filter(d => d.cap === minCap)
      .map(d => d.day);
    
    return `Max ${minCap} lok. ${minDays.join(" & ")}, ${maxCap} lok. øvrige dage`;
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
                
                {/* Kapacitet row */}
                <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Kapacitet
                  </span>
                  <div className="flex gap-1">
                    {dayData.map((day, idx) => (
                      <div key={idx} className="w-7 h-7 flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {day.capacity}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Booket row */}
                <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> Booket
                  </span>
                  <div className="flex gap-1">
                    {dayData.map((day, idx) => (
                      <div key={idx} className="w-7 h-7 flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {day.booked}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ledige row */}
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">Ledige</span>
                  <div className="flex gap-1">
                    {dayData.map((day, idx) => (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            day.remaining <= 0 ? "bg-destructive/20 text-destructive" :
                            day.remaining <= 2 ? "bg-yellow-500/20 text-yellow-600" :
                            "bg-green-500 text-white"
                          }`}>
                            {day.remaining}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                          <p className="text-xs">{day.capacity} kap. - {day.booked} booket = {day.remaining} ledige</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Info text */}
                <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
                  <span className="text-yellow-500">💡</span>
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