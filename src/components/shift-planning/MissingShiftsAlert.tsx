import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MissingShiftsAlertProps {
  weekStart: Date;
  weekEnd: Date;
  employees: Array<{
    id: string;
    first_name: string;
    last_name: string;
  }> | undefined;
  shifts: Array<{
    employee_id: string;
    date: string;
  }> | undefined;
  timeStamps: Array<{
    employee_id: string;
    clock_in: string;
  }> | undefined;
  onCreateShift?: (employeeId: string, date: Date) => void;
}

interface MissingSale {
  employeeId: string;
  employeeName: string;
  date: string;
  salesCount: number;
}

export function MissingShiftsAlert({
  weekStart,
  weekEnd,
  employees,
  shifts,
  timeStamps,
  onCreateShift,
}: MissingShiftsAlertProps) {
  // Fetch agent mappings to connect sales.agent_name to employees
  const { data: agentMappings } = useQuery({
    queryKey: ["employee-agent-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id");
      if (error) throw error;

      // Get agent names
      if (data.length === 0) return [];

      const agentIds = data.map((m) => m.agent_id);
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("id, name")
        .in("id", agentIds);
      if (agentsError) throw agentsError;

      return data.map((mapping) => ({
        employee_id: mapping.employee_id,
        agent_name: agents?.find((a) => a.id === mapping.agent_id)?.name || null,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch team memberships for employees
  const { data: teamMemberships } = useQuery({
    queryKey: ["team-memberships-for-missing-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_memberships" as any)
        .select("employee_id, team_id");
      if (error) throw error;
      return data as unknown as { employee_id: string; team_id: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch primary shifts with their day configurations
  const { data: primaryShiftsData } = useQuery({
    queryKey: ["primary-shifts-for-missing-shifts"],
    queryFn: async () => {
      const { data: shiftsData, error } = await supabase
        .from("team_standard_shifts" as any)
        .select("id, team_id, start_time, end_time")
        .eq("is_active", true);
      if (error) throw error;
      if (!shiftsData || shiftsData.length === 0) return { shifts: [] as { id: string; team_id: string; start_time: string; end_time: string }[], days: [] as { shift_id: string; day_of_week: number; start_time: string; end_time: string }[] };

      const shifts = shiftsData as unknown as { id: string; team_id: string; start_time: string; end_time: string }[];
      const shiftIds = shifts.map((s) => s.id);
      const { data: days, error: daysError } = await supabase
        .from("team_standard_shift_days" as any)
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", shiftIds);
      if (daysError) throw daysError;

      return { 
        shifts, 
        days: (days || []) as unknown as { shift_id: string; day_of_week: number; start_time: string; end_time: string }[]
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helper to check if employee has standard work times for a specific date
  const hasStandardWorkTimes = (employeeId: string, dateStr: string): boolean => {
    if (!teamMemberships || !primaryShiftsData) return false;

    const membership = teamMemberships.find((m) => m.employee_id === employeeId);
    if (!membership) return false;

    const primaryShift = primaryShiftsData.shifts.find(
      (s) => s.team_id === membership.team_id
    );
    if (!primaryShift) return false;

    const date = parseISO(dateStr);
    const dayOfWeek = date.getDay();

    // Check day-specific config first
    const dayConfig = primaryShiftsData.days.find(
      (d) => d.shift_id === primaryShift.id && d.day_of_week === dayOfWeek
    );

    if (dayConfig) {
      return !!(dayConfig.start_time && dayConfig.end_time);
    }

    // Fall back to general shift times
    return !!(primaryShift.start_time && primaryShift.end_time);
  };

  // Fetch sales for the week
  const { data: weeklySales } = useQuery({
    queryKey: [
      "weekly-sales-for-shifts",
      format(weekStart, "yyyy-MM-dd"),
      format(weekEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, agent_name, sale_datetime, status")
        .gte("sale_datetime", format(weekStart, "yyyy-MM-dd"))
        .lte("sale_datetime", `${format(weekEnd, "yyyy-MM-dd")}T23:59:59`)
        .in("status", ["pending", "approved"]);
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Calculate missing shifts (sales without corresponding shift, standard shift, or timestamp)
  const missingSales = useMemo<MissingSale[]>(() => {
    if (!weeklySales || !employees || !agentMappings) return [];

    // Group sales by agent_name and date
    const salesByAgentDate = new Map<string, number>();
    weeklySales.forEach((sale) => {
      if (!sale.agent_name || !sale.sale_datetime) return;
      const saleDate = sale.sale_datetime.split("T")[0];
      const key = `${sale.agent_name}|${saleDate}`;
      salesByAgentDate.set(key, (salesByAgentDate.get(key) || 0) + 1);
    });

    const missing: MissingSale[] = [];

    salesByAgentDate.forEach((count, key) => {
      const [agentName, dateStr] = key.split("|");

      // Find employee from agent mapping
      const mapping = agentMappings.find(
        (m) => m.agent_name?.toLowerCase() === agentName.toLowerCase()
      );
      if (!mapping) return;

      const employee = employees.find((e) => e.id === mapping.employee_id);
      if (!employee) return;

      // Check if employee has individual shift on this date
      const hasShift = shifts?.some(
        (s) => s.employee_id === employee.id && s.date === dateStr
      );
      if (hasShift) return;

      // Check if employee has standard work times for this date
      if (hasStandardWorkTimes(employee.id, dateStr)) return;

      // Check if employee has timestamp on this date
      const hasTimestamp = timeStamps?.some((ts) => {
        const tsDate = ts.clock_in.split("T")[0];
        return ts.employee_id === employee.id && tsDate === dateStr;
      });

      // If no shift, no standard work times, and no timestamp, this is a missing shift
      if (!hasTimestamp) {
        missing.push({
          employeeId: employee.id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          date: dateStr,
          salesCount: count,
        });
      }
    });

    // Sort by date
    return missing.sort((a, b) => a.date.localeCompare(b.date));
  }, [weeklySales, employees, agentMappings, shifts, timeStamps, teamMemberships, primaryShiftsData]);

  if (missingSales.length === 0) return null;

  return (
    <Collapsible defaultOpen={true}>
      <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Manglende vagter med salg
              </h3>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {missingSales.length} medarbejder
                {missingSales.length !== 1 ? "e" : ""} har registreret salg uden
                at have vagt
              </p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 text-orange-600 dark:text-orange-400 transition-transform data-[state=open]:rotate-180" />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-orange-200 dark:border-orange-800 divide-y divide-orange-200 dark:divide-orange-800">
            {missingSales.map((sale) => {
              const date = parseISO(sale.date);
              return (
                <div
                  key={`${sale.employeeId}-${sale.date}`}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                      {sale.employeeName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {sale.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(date, "EEEE d. MMM", { locale: da })} •{" "}
                        {sale.salesCount} salg
                      </p>
                    </div>
                  </div>
                  {onCreateShift && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                      onClick={() => onCreateShift(sale.employeeId, date)}
                    >
                      <Plus className="h-3 w-3" />
                      Opret vagt
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
