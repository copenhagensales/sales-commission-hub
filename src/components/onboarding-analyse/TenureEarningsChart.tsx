import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, Cell } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";
import { differenceInMonths, parseISO, startOfMonth, subMonths, isSameMonth } from "date-fns";

interface TenureBucket {
  month: number;
  label: string;
  avgCommission: number;
  employeeCount: number;
  totalCommission: number;
}

export function TenureEarningsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenure-earnings-analysis"],
    queryFn: async () => {
      // Fetch ALL non-staff employees (active + former) with start/end dates
      const [empRes, mappingRes] = await Promise.all([
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, employment_start_date, employment_end_date, is_staff_employee")
          .not("employment_start_date", "is", null),
        supabase
          .from("employee_agent_mapping")
          .select("employee_id, agents!inner(email)"),
      ]);

      if (empRes.error) throw empRes.error;
      if (mappingRes.error) throw mappingRes.error;

      // Build employee info map (no is_active filter)
      const employeeInfo = new Map<string, { startDate: Date; endDate: Date | null; startDay: number }>();
      (empRes.data || []).forEach((e) => {
        if (!e.is_staff_employee && e.employment_start_date) {
          const startDate = parseISO(e.employment_start_date);
          const endDate = e.employment_end_date ? parseISO(e.employment_end_date) : null;
          employeeInfo.set(e.id, { startDate, endDate, startDay: startDate.getDate() });
        }
      });

      // Build emails lookup
      const allEmails: string[] = [];
      (mappingRes.data || []).forEach((m: any) => {
        const email = m.agents?.email?.toLowerCase();
        if (email && employeeInfo.has(m.employee_id)) {
          allEmails.push(email);
        }
      });

      if (allEmails.length === 0) return { buckets: [] };

      // Fetch sales data for last 18 months
      const now = new Date();
      const currentMonth = startOfMonth(now);
      const periodStart = startOfMonth(subMonths(now, 17));

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_sales_aggregates_v2",
        {
          p_start: periodStart.toISOString(),
          p_end: now.toISOString(),
          p_team_id: null,
          p_employee_id: null,
          p_client_id: null,
          p_group_by: "both",
          p_agent_emails: allEmails,
        }
      );

      if (rpcError) throw rpcError;

      const tenureBuckets = new Map<number, { totalCommission: number; employeeIds: Set<string> }>();

      (rpcData || []).forEach((row: any) => {
        const pipeIdx = (row.group_key || "").indexOf("|");
        if (pipeIdx === -1) return;

        const employeeId = row.group_key.substring(0, pipeIdx);
        const dateStr = row.group_key.substring(pipeIdx + 1);

        const info = employeeInfo.get(employeeId);
        if (!info) return;

        const saleMonth = startOfMonth(new Date(dateStr));
        const saleCalendarMonth = saleMonth.getMonth();

        // Skip July (6) and December (11) — holiday months
        if (saleCalendarMonth === 6 || saleCalendarMonth === 11) return;

        // Skip current (incomplete) month
        if (isSameMonth(saleMonth, currentMonth)) return;

        // Skip employee's last month if they left before the 20th
        if (info.endDate && isSameMonth(saleMonth, info.endDate) && info.endDate.getDate() < 20) return;

        // Calculate tenure month with partial-month adjustment
        const employeeStartMonth = startOfMonth(info.startDate);
        let tenureMonth = differenceInMonths(saleMonth, employeeStartMonth) + 1;

        // If employee started after the 10th, their first partial month doesn't count
        // Shift tenure months down by 1 (so next full month becomes "Month 1")
        if (info.startDay > 10) {
          tenureMonth = tenureMonth - 1;
        }

        if (tenureMonth < 1 || tenureMonth > 12) return;

        const commission = Number(row.total_commission) || 0;
        if (commission === 0) return;

        if (!tenureBuckets.has(tenureMonth)) {
          tenureBuckets.set(tenureMonth, { totalCommission: 0, employeeIds: new Set() });
        }
        const bucket = tenureBuckets.get(tenureMonth)!;
        bucket.totalCommission += commission;
        bucket.employeeIds.add(employeeId);
      });

      // Convert to array
      const buckets: TenureBucket[] = [];
      for (let m = 1; m <= 12; m++) {
        const bucket = tenureBuckets.get(m);
        if (bucket && bucket.employeeIds.size > 0) {
          buckets.push({
            month: m,
            label: `Mnd ${m}`,
            avgCommission: Math.round(bucket.totalCommission / bucket.employeeIds.size),
            employeeCount: bucket.employeeIds.size,
            totalCommission: Math.round(bucket.totalCommission),
          });
        }
      }

      return { buckets };
    },
    staleTime: 300000,
  });

  const buckets = data?.buckets || [];

  const growthFromMonth1 = useMemo(() => {
    if (buckets.length < 2) return null;
    const m1 = buckets.find((b) => b.month === 1);
    const last = buckets[buckets.length - 1];
    if (!m1 || m1.avgCommission === 0) return null;
    return Math.round(((last.avgCommission - m1.avgCommission) / m1.avgCommission) * 100);
  }, [buckets]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Indtjening per anciennitetsmåned
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (buckets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Indtjening per anciennitetsmåned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Ikke nok data til at vise analysen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Indtjening per anciennitetsmåned
          </CardTitle>
          {growthFromMonth1 !== null && (
            <span className={`text-sm font-medium ${growthFromMonth1 > 0 ? "text-green-600" : "text-red-600"}`}>
              {growthFromMonth1 > 0 ? "+" : ""}{growthFromMonth1}% fra mnd 1 → {buckets[buckets.length - 1].month}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Gennemsnitlig provision per medarbejder, grupperet efter anciennitetsmåned (inkl. tidligere medarbejdere · ekskl. ufuldstændige måneder, juli og december)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={buckets} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TenureBucket;
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-sm">
                    <p className="font-semibold">{d.label}</p>
                    <p>Gns. provision: <span className="font-mono font-medium">{d.avgCommission.toLocaleString("da-DK")} DKK</span></p>
                    <p className="text-muted-foreground">Baseret på {d.employeeCount} medarbejdere</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="avgCommission" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {buckets.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={`hsl(var(--primary) / ${0.4 + (idx / Math.max(buckets.length - 1, 1)) * 0.6})`}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="avgCommission"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3 justify-center">
          {buckets.map((b) => (
            <div key={b.month} className="text-center text-xs text-muted-foreground">
              <span className="font-medium">{b.label}</span>
              <br />
              n={b.employeeCount}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}