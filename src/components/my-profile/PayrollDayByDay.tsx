import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, TrendingUp, Palmtree, XCircle, Utensils, Star, Gift } from "lucide-react";
import { getVacationPayRate, VacationType } from "@/lib/calculations/vacation-pay";

interface PayrollDayByDayProps {
  employeeId: string;
  payrollPeriod: { start: Date; end: Date };
}

type DayData = {
  date: string;
  shift: { start_time: string; end_time: string; break_minutes: number | null } | null;
  sales: Array<{ product_name: string; quantity: number; commission: number }>;
  totalCommission: number;
};

export function PayrollDayByDay({ employeeId, payrollPeriod }: PayrollDayByDayProps) {
  const startStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const endStr = format(payrollPeriod.end, "yyyy-MM-dd");

  // 1. Get agent emails for this employee
  const { data: agentEmails = [] } = useQuery({
    queryKey: ["payroll-agent-emails", employeeId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("employee_agent_mapping")
        .select("agent_id, agents(email)")
        .eq("employee_id", employeeId);
      if (!data) return [];
      return data.map((m: { agents: { email: string } }) => m.agents.email.toLowerCase());
    },
    enabled: !!employeeId,
  });

  // 2. Get sales with items for the period
  const { data: salesData = [] } = useQuery({
    queryKey: ["payroll-sales", employeeId, startStr, endStr, agentEmails],
    queryFn: async () => {
      if (!agentEmails.length) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("sales")
        .select("id, sale_datetime, agent_email, sale_items(quantity, mapped_commission, product_id, products(name))")
        .in("agent_email", agentEmails)
        .gte("sale_datetime", `${startStr}T00:00:00`)
        .lte("sale_datetime", `${endStr}T23:59:59`)
        .neq("status", "rejected");
      return data || [];
    },
    enabled: agentEmails.length > 0,
  });

  // 3. Get shifts for the period
  const { data: shifts = [] } = useQuery({
    queryKey: ["payroll-shifts", employeeId, startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift")
        .select("date, start_time, end_time, break_minutes")
        .eq("employee_id", employeeId)
        .gte("date", startStr)
        .lte("date", endStr);
      return data || [];
    },
    enabled: !!employeeId,
  });

  // 4. Get employee master data (vacation_type, referral_bonus)
  const { data: employeeData } = useQuery({
    queryKey: ["payroll-employee-data", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("vacation_type, referral_bonus")
        .eq("id", employeeId)
        .single();
      return data;
    },
    enabled: !!employeeId,
  });

  // 5. Get cancelled sales commission
  const { data: cancelledTotal = 0 } = useQuery({
    queryKey: ["payroll-cancelled", employeeId, startStr, endStr, agentEmails],
    queryFn: async () => {
      if (!agentEmails.length) return 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("sales")
        .select("sale_items(mapped_commission)")
        .in("agent_email", agentEmails)
        .gte("sale_datetime", `${startStr}T00:00:00`)
        .lte("sale_datetime", `${endStr}T23:59:59`)
        .eq("validation_status", "cancelled");
      if (!data) return 0;
      let sum = 0;
      for (const sale of data) {
        for (const item of sale.sale_items || []) {
          sum += item.mapped_commission || 0;
        }
      }
      return sum;
    },
    enabled: agentEmails.length > 0,
  });

  // 6. Get diet (booking_diet) for the period
  const { data: dietTotal = 0 } = useQuery({
    queryKey: ["payroll-diet", employeeId, startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_diet")
        .select("amount")
        .eq("employee_id", employeeId)
        .gte("date", startStr)
        .lte("date", endStr);
      if (!data) return 0;
      return data.reduce((sum, d) => sum + (d.amount || 0), 0);
    },
    enabled: !!employeeId,
  });

  // 7. Get dagsbonus (daily_bonus_payouts) for the period
  const { data: dagsbonusTotal = 0 } = useQuery({
    queryKey: ["payroll-dagsbonus", employeeId, startStr, endStr],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("daily_bonus_payouts")
        .select("amount")
        .eq("employee_id", employeeId)
        .gte("date", startStr)
        .lte("date", endStr);
      if (!data) return 0;
      return data.reduce((sum: number, d: { amount: number }) => sum + (d.amount || 0), 0);
    },
    enabled: !!employeeId,
  });

  // Build day-by-day data
  const days: DayData[] = useMemo(() => {
    const allDays = eachDayOfInterval({ start: payrollPeriod.start, end: payrollPeriod.end });

    // Index shifts by date
    const shiftMap = new Map<string, { start_time: string; end_time: string; break_minutes: number | null }>();
    for (const s of shifts) {
      shiftMap.set(s.date, { start_time: s.start_time, end_time: s.end_time, break_minutes: s.break_minutes });
    }

    // Index sales by date
    const salesMap = new Map<string, Array<{ product_name: string; quantity: number; commission: number }>>();
    for (const sale of salesData) {
      const dateKey = format(new Date(sale.sale_datetime), "yyyy-MM-dd");
      if (!salesMap.has(dateKey)) salesMap.set(dateKey, []);
      const items = sale.sale_items || [];
      for (const item of items) {
        salesMap.get(dateKey)!.push({
          product_name: item.products?.name || "Ukendt produkt",
          quantity: item.quantity || 1,
          commission: item.mapped_commission || 0,
        });
      }
    }

    return allDays
      .filter((d) => {
        // Show days that have a shift or sales data — no hardcoded weekend filter
        const key = format(d, "yyyy-MM-dd");
        const hasShift = shiftMap.has(key);
        const hasSales = salesMap.has(key);
        return hasShift || hasSales;
      })
      .map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const sales = salesMap.get(key) || [];
        return {
          date: key,
          shift: shiftMap.get(key) || null,
          sales,
          totalCommission: sales.reduce((sum, s) => sum + s.commission, 0),
        };
      });
  }, [payrollPeriod, shifts, salesData]);

  const periodTotal = days.reduce((sum, d) => sum + d.totalCommission, 0);

  // Calculated summary values
  const vacationRate = getVacationPayRate((employeeData?.vacation_type as VacationType) ?? null);
  const feriepengeTotal = periodTotal * vacationRate;
  const referralBonus = employeeData?.referral_bonus ?? 0;

  const fmtKr = (v: number) => `${v.toLocaleString("da-DK")} kr`;

  return (
    <div className="space-y-4">
      {/* Summary stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Provision" value={fmtKr(periodTotal)} />
        <StatCard icon={Palmtree} label="Feriepenge" value={fmtKr(feriepengeTotal)} />
        <StatCard icon={XCircle} label="Annullering" value={fmtKr(cancelledTotal)} variant="destructive" />
        {dietTotal > 0 && <StatCard icon={Utensils} label="Diet" value={fmtKr(dietTotal)} />}
        {dagsbonusTotal > 0 && <StatCard icon={Star} label="Dagsbonus" value={fmtKr(dagsbonusTotal)} />}
        {referralBonus > 0 && <StatCard icon={Gift} label="Henvisningsbonus" value={fmtKr(referralBonus)} />}
      </div>

      {days.map((day) => {
        const hasActivity = day.shift || day.sales.length > 0;
        return (
          <Card key={day.date} className={!hasActivity ? "opacity-50" : undefined}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="capitalize">
                  {format(new Date(day.date), "EEEE d. MMMM", { locale: da })}
                </span>
                {day.shift && (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <Clock className="h-3 w-3" />
                    {day.shift.start_time.slice(0, 5)}–{day.shift.end_time.slice(0, 5)}
                    {day.shift.break_minutes ? ` (${day.shift.break_minutes} min pause)` : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            {day.sales.length > 0 && (
              <CardContent className="pt-0 px-4 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Produkt</TableHead>
                      <TableHead className="h-8 text-xs text-right">Antal</TableHead>
                      <TableHead className="h-8 text-xs text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {day.sales.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5 text-sm">{s.product_name}</TableCell>
                        <TableCell className="py-1.5 text-sm text-right">{s.quantity}</TableCell>
                        <TableCell className="py-1.5 text-sm text-right">
                          {s.commission.toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium">
                      <TableCell className="py-1.5 text-sm" colSpan={2}>
                        Total
                      </TableCell>
                      <TableCell className="py-1.5 text-sm text-right">
                        {day.totalCommission.toLocaleString("da-DK")} kr
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            )}
            {!hasActivity && (
              <CardContent className="pt-0 px-4 pb-3">
                <p className="text-xs text-muted-foreground">Ingen aktivitet</p>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Period summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            Total provision i perioden
          </div>
          <span className="text-lg font-bold">{periodTotal.toLocaleString("da-DK")} kr</span>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className={`h-3.5 w-3.5 ${variant === "destructive" ? "text-destructive" : ""}`} />
          {label}
        </div>
        <p className={`text-base font-semibold ${variant === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}