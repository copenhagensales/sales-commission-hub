import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isTvMode } from "@/utils/tvMode";
import { calculatePayrollPeriod } from "@/lib/calculations";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

// Get distinct color for each client
const getClientColor = (index: number) => {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"
  ];
  return colors[index % colors.length];
};

function UnitedClientBreakdown() {
  const tvMode = isTvMode();
  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);

  const { data: teamClients } = useQuery({
    queryKey: ["united-team-clients"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%united%")
        .maybeSingle();
      if (!team) return [];
      const { data: clients } = await supabase
        .from("team_clients")
        .select(`client_id, clients (id, name, logo_url)`)
        .eq("team_id", team.id);
      return (clients || []).map((tc: any) => tc.clients).filter(Boolean);
    },
  });

  const { data: clientSalesData } = useQuery({
    queryKey: ["united-client-sales-cached", teamClients?.map((c: any) => c.id)],
    queryFn: async () => {
      if (!teamClients || teamClients.length === 0) return [];
      const clientIds = teamClients.map((c: any) => c.id);
      const { data } = await supabase
        .from("kpi_cached_values")
        .select("period_type, scope_id, value")
        .eq("kpi_slug", "sales_count")
        .eq("scope_type", "client")
        .in("scope_id", clientIds)
        .in("period_type", ["today", "this_week", "payroll_period"]);

      const clientMap = new Map<string, { today: number; week: number; payroll: number }>();
      for (const row of data || []) {
        if (!row.scope_id) continue;
        if (!clientMap.has(row.scope_id)) clientMap.set(row.scope_id, { today: 0, week: 0, payroll: 0 });
        const entry = clientMap.get(row.scope_id)!;
        if (row.period_type === "today") entry.today = row.value;
        else if (row.period_type === "this_week") entry.week = row.value;
        else if (row.period_type === "payroll_period") entry.payroll = row.value;
      }

      return teamClients.map((client: any) => {
        const cached = clientMap.get(client.id);
        return {
          clientId: client.id, clientName: client.name,
          salesToday: cached?.today || 0, salesWeek: cached?.week || 0, salesMonth: cached?.payroll || 0,
        };
      }).sort((a, b) => b.salesMonth - a.salesMonth);
    },
    enabled: !!teamClients && teamClients.length > 0,
    staleTime: 30000, refetchInterval: 60000,
  });

  const { data: clientHoursMap } = useQuery({
    queryKey: ["united-client-hours-v2", teamClients?.map((c: any) => c.id), payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!teamClients || teamClients.length === 0) return new Map<string, number>();
      const hoursMap = new Map<string, number>();
      await Promise.all(teamClients.map(async (client: any) => {
        const { data: campaigns } = await supabase.from("client_campaigns").select("id").eq("client_id", client.id);
        if (!campaigns || campaigns.length === 0) { hoursMap.set(client.id, 0); return; }
        const sales = await fetchAllRows<any>("sales", "agent_email", (q) =>
          q.in("client_campaign_id", campaigns.map(c => c.id)).gte("sale_datetime", payrollPeriod.start.toISOString()),
          { orderBy: "sale_datetime", ascending: false }
        );
        const agentEmails = [...new Set((sales || []).map(s => s.agent_email?.toLowerCase()).filter(Boolean))];
        if (agentEmails.length === 0) { hoursMap.set(client.id, 0); return; }
        const { data: agents } = await supabase.from("agents").select("id, email").in("email", agentEmails as string[]);
        const agentIds = (agents || []).map(a => a.id);
        if (agentIds.length === 0) { hoursMap.set(client.id, 0); return; }
        const { data: agentMappings } = await supabase.from("employee_agent_mapping").select("employee_id, agent_id").in("agent_id", agentIds);
        const employeeIds = [...new Set((agentMappings || []).map(m => m.employee_id))];
        if (employeeIds.length === 0) { hoursMap.set(client.id, 0); return; }
        const { data: shifts } = await supabase.from("shift")
          .select("employee_id, start_time, end_time, break_minutes")
          .in("employee_id", employeeIds)
          .gte("date", format(payrollPeriod.start, "yyyy-MM-dd"))
          .lte("date", format(new Date(), "yyyy-MM-dd"));
        let totalHours = 0;
        (shifts || []).forEach(shift => {
          if (shift.start_time && shift.end_time) {
            const start = new Date(`2000-01-01T${shift.start_time}`);
            const end = new Date(`2000-01-01T${shift.end_time}`);
            let diffMs = end.getTime() - start.getTime();
            if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
            let hours = diffMs / (1000 * 60 * 60);
            hours -= (shift.break_minutes ?? (hours > 6 ? 30 : 0)) / 60;
            totalHours += Math.max(0, hours);
          }
        });
        hoursMap.set(client.id, totalHours);
      }));
      return hoursMap;
    },
    enabled: !!teamClients && teamClients.length > 0,
  });

  if (tvMode || !clientSalesData || clientSalesData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Package className="h-5 w-5" />
          Salg per opgave
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {clientSalesData
            .filter(client => client.salesWeek > 0)
            .map((client, index) => {
              const clientHours = clientHoursMap?.get(client.clientId) || 0;
              const salesPerHour = clientHours > 0 ? client.salesMonth / clientHours : 0;
              return (
                <div key={client.clientId} className="relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
                  <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${getClientColor(index)}`} />
                  <div className="flex flex-col gap-3">
                    <h4 className="font-semibold text-sm truncate pl-2">{client.clientName}</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-muted-foreground">Dag</p>
                        <p className="font-bold text-primary text-lg">{client.salesToday}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Uge</p>
                        <p className="font-bold text-primary text-lg">{client.salesWeek}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Løn</p>
                        <p className="font-bold text-primary text-lg">{client.salesMonth}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2 border-t">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Salg/time:</span>
                      <span className="text-sm font-semibold text-primary">
                        {salesPerHour > 0 ? salesPerHour.toFixed(2) : "–"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function UnitedDashboard() {
  const { data: unitedTeam } = useQuery({
    queryKey: ["united-team-with-clients"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams").select("id").ilike("name", "%united%").maybeSingle();
      if (!team) return { id: undefined as string | undefined, clientIds: [] as string[] };
      const { data: tc } = await supabase
        .from("team_clients")
        .select("client_id")
        .eq("team_id", team.id);
      const clientIds = (tc || []).map((x: any) => x.client_id).filter(Boolean);
      return { id: team.id as string, clientIds };
    },
  });

  return (
    <ClientDashboard
      config={{
        slug: "united",
        teamId: unitedTeam?.id,
        title: "United – Overblik",
        features: {
          showMonth: false,
          aggregateClientIds: unitedTeam?.clientIds,
        },
        extraContent: <UnitedClientBreakdown />,
      }}
    />
  );
}
