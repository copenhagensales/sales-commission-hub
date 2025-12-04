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
  const [isExpanded, setIsExpanded] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: allEmployees } = useQuery({
    queryKey: ["vagt-active-employees-capacity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee")
        .select("id, full_name, team, is_active")
        .eq("is_active", true)
        .not("team", "is", null);

      if (error) throw error;
      return data;
    },
  });

  const { data: absencesData, isLoading: absencesLoading } = useQuery({
    queryKey: ["vagt-week-absences-capacity", year, weekNumber],
    queryFn: async () => {
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      const { data: absences, error: absencesError } = await supabase
        .from("employee_absence")
        .select(`
          id,
          employee_id,
          start_date,
          end_date,
          employee:employee_id (id, team, is_active)
        `)
        .eq("status", "APPROVED")
        .lte("start_date", weekEndStr)
        .gte("end_date", weekStartStr);

      if (absencesError) throw absencesError;
      return absences;
    },
  });

  const { data: weekBookings } = useQuery({
    queryKey: ["vagt-week-bookings-capacity", year, weekNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`id, start_date, end_date, brand:brand_id (name)`)
        .eq("week_number", weekNumber)
        .eq("year", year)
        .in("status", ["Planlagt", "Bekræftet"]);

      if (error) throw error;
      return data;
    },
  });

  const eesyTotal = allEmployees?.filter(e => e.team === "Eesy").length || 0;
  const youseeTotal = allEmployees?.filter(e => e.team === "YouSee").length || 0;

  const bookingsByDayAndBrand = weekDates.map((date) => {
    let eesyBooked = 0;
    let youseeBooked = 0;

    weekBookings?.forEach((booking: any) => {
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);

      if (isWithinInterval(date, { start: bookingStart, end: bookingEnd })) {
        if (booking.brand?.name === "Eesy") eesyBooked++;
        else if (booking.brand?.name === "YouSee") youseeBooked++;
      }
    });

    return { date, eesyBooked, youseeBooked };
  });

  const absencesByDayAndTeam = weekDates.map((date, idx) => {
    let eesyAbsent = 0;
    let youseeAbsent = 0;

    absencesData?.forEach((absence: any) => {
      const employee = absence.employee;
      if (!employee || !employee.is_active) return;

      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);

      if (isWithinInterval(date, { start: absenceStart, end: absenceEnd })) {
        if (employee.team === "Eesy") eesyAbsent++;
        else if (employee.team === "YouSee") youseeAbsent++;
      }
    });

    const eesyLocations = Math.floor((eesyTotal - eesyAbsent) / 2);
    const youseeLocations = Math.floor((youseeTotal - youseeAbsent) / 2);

    return {
      date,
      eesyAvailable: eesyTotal - eesyAbsent,
      youseeAvailable: youseeTotal - youseeAbsent,
      eesyLocations,
      youseeLocations,
      eesyBooked: bookingsByDayAndBrand[idx].eesyBooked,
      youseeBooked: bookingsByDayAndBrand[idx].youseeBooked,
      eesyRemaining: eesyLocations - bookingsByDayAndBrand[idx].eesyBooked,
      youseeRemaining: youseeLocations - bookingsByDayAndBrand[idx].youseeBooked,
    };
  });

  if (absencesLoading) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
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
          <div className="mt-4 space-y-4">
            {/* Day headers */}
            <div className="flex justify-end gap-1 mb-2">
              {DAY_LABELS.map((label, idx) => (
                <div key={idx} className="w-7 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>

            {/* Team Eesy */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Team Eesy ({eesyTotal} medarbejdere)
              </div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 mb-1">
                <span className="text-sm text-muted-foreground">Ledige</span>
                <div className="flex gap-1">
                  {absencesByDayAndTeam.map((day, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          day.eesyRemaining <= 0 ? "bg-destructive/20 text-destructive" :
                          day.eesyRemaining <= 2 ? "bg-yellow-500/20 text-yellow-600" :
                          "bg-green-500/20 text-green-600"
                        }`}>
                          {day.eesyRemaining}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                        <p className="text-xs">{day.eesyLocations} kap. - {day.eesyBooked} booket = {day.eesyRemaining} ledige</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>

            {/* Team YouSee */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Team YouSee ({youseeTotal} medarbejdere)
              </div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">Ledige</span>
                <div className="flex gap-1">
                  {absencesByDayAndTeam.map((day, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          day.youseeRemaining <= 0 ? "bg-destructive/20 text-destructive" :
                          day.youseeRemaining <= 2 ? "bg-yellow-500/20 text-yellow-600" :
                          "bg-green-500/20 text-green-600"
                        }`}>
                          {day.youseeRemaining}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{format(day.date, "EEEE d. MMM", { locale: da })}</p>
                        <p className="text-xs">{day.youseeLocations} kap. - {day.youseeBooked} booket = {day.youseeRemaining} ledige</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
