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
        .select("id, name, email")
        .in("id", agentIds);
      if (agentsError) throw agentsError;

      return data.map((mapping) => {
        const agent = agents?.find((a) => a.id === mapping.agent_id);
        return {
          employee_id: mapping.employee_id,
          agent_name: agent?.name || null,
          agent_email: agent?.email || null,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

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
        .select("id, agent_name, agent_email, sale_datetime, status")
        .gte("sale_datetime", format(weekStart, "yyyy-MM-dd"))
        .lte("sale_datetime", `${format(weekEnd, "yyyy-MM-dd")}T23:59:59`)
        .or("status.in.(pending,approved),status.is.null");
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Calculate missing shifts (sales without corresponding shift or timestamp)
  const missingSales = useMemo<MissingSale[]>(() => {
    if (!weeklySales || !employees || !agentMappings) return [];

    // Group sales by agent identifier (prefer email) and date
    const salesByAgentDate = new Map<string, { count: number; agentEmail: string | null; agentName: string | null }>();
    weeklySales.forEach((sale) => {
      if (!sale.sale_datetime) return;
      const saleDate = sale.sale_datetime.split(/[T ]/)[0];
      // Use email as primary key if available, otherwise name
      const agentKey = sale.agent_email || sale.agent_name || "";
      if (!agentKey) return;
      const key = `${agentKey.toLowerCase()}|${saleDate}`;
      const existing = salesByAgentDate.get(key);
      if (existing) {
        existing.count++;
      } else {
        salesByAgentDate.set(key, { 
          count: 1, 
          agentEmail: sale.agent_email || null, 
          agentName: sale.agent_name || null 
        });
      }
    });

    const missing: MissingSale[] = [];

    salesByAgentDate.forEach((saleInfo, key) => {
      const [agentKey, dateStr] = key.split("|");

      // Find employee from agent mapping - prioritize email matching
      const mapping = agentMappings.find((m) => {
        const mappedEmail = m.agent_email?.toLowerCase();
        const mappedName = m.agent_name?.toLowerCase();
        
        // Primary: Match by email
        if (mappedEmail && agentKey === mappedEmail) return true;
        if (mappedEmail && saleInfo.agentName?.toLowerCase() === mappedEmail) return true;
        
        // Secondary: Match by name
        if (mappedName && agentKey === mappedName) return true;
        if (mappedName && saleInfo.agentName?.toLowerCase() === mappedName) return true;
        
        // Also check if agent_name is an email that matches
        if (mappedEmail && saleInfo.agentName?.toLowerCase()?.split('@')[0] === mappedEmail.split('@')[0]) return true;
        
        return false;
      });
      if (!mapping) return;

      const employee = employees.find((e) => e.id === mapping.employee_id);
      if (!employee) return;

      // Check if employee has shift on this date
      const hasShift = shifts?.some(
        (s) => s.employee_id === employee.id && s.date === dateStr
      );

      // Check if employee has timestamp on this date
      const hasTimestamp = timeStamps?.some((ts) => {
        const tsDate = ts.clock_in.split("T")[0];
        return ts.employee_id === employee.id && tsDate === dateStr;
      });

      // If no shift and no timestamp, this is a missing shift
      if (!hasShift && !hasTimestamp) {
        missing.push({
          employeeId: employee.id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          date: dateStr,
          salesCount: saleInfo.count,
        });
      }
    });

    // Sort by date
    return missing.sort((a, b) => a.date.localeCompare(b.date));
  }, [weeklySales, employees, agentMappings, shifts, timeStamps]);

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
