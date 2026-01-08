import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";

export interface DashboardEmployeeStats {
  employeeId: string;
  employeeName: string;
  teamName: string | null;
  totalHours: number;
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
}

export interface DashboardSalesData {
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  totalHours: number;
  employeeStats: DashboardEmployeeStats[];
  isLoading: boolean;
}

interface UseDashboardSalesDataParams {
  clientId?: string;
  clientName?: string; // Alternative to clientId - will look up client by name
  startDate: Date;
  endDate: Date;
  teamId?: string;
  enabled?: boolean;
}

/**
 * Central hook for dashboard sales data, using DailyReports logic.
 * Only includes sales with correct employee-agent mapping.
 * Also includes hours from shift planning / timestamps.
 */
export function useDashboardSalesData({
  clientId,
  clientName,
  startDate,
  endDate,
  teamId,
  enabled = true,
}: UseDashboardSalesDataParams): DashboardSalesData {
  const { data, isLoading } = useQuery({
    queryKey: [
      "dashboard-sales-data",
      clientId,
      clientName,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      teamId,
    ],
    queryFn: async () => {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseKey;
      const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}` };

      // Resolve clientId from clientName if provided
      let resolvedClientId = clientId;
      if (!resolvedClientId && clientName) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id")
          .ilike("name", `%${clientName}%`)
          .limit(1);
      }

      let employeeIds: string[] = [];
      let filteredEmployees: any[] = [];
      let agentMappings: any[] = [];

      // Step 1: Find employees based on client or team filter
      if (resolvedClientId) {
        // Find employees who have sales for this client via agent mapping
        const salesUrl = `${supabaseUrl}/rest/v1/sales?select=agent_email,client_campaigns!inner(client_id)&client_campaigns.client_id=eq.${resolvedClientId}&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
        const salesRes = await fetch(salesUrl, { headers });
        const salesForClient = await salesRes.json();

        const agentEmails = [
          ...new Set(
            (salesForClient || [])
              .map((s: any) => s.agent_email?.toLowerCase())
              .filter(Boolean)
          ),
        ] as string[];

        if (agentEmails.length > 0) {
          const { data: agentsData } = await supabase.from("agents").select("id, email, external_dialer_id");
          const matchingAgents = (agentsData || []).filter((a) =>
            agentEmails.includes(a.email?.toLowerCase())
          );
          const matchingAgentIds = matchingAgents.map((a) => a.id);

          if (matchingAgentIds.length > 0) {
            const { data: mappings } = await supabase
              .from("employee_agent_mapping")
              .select("employee_id, agent_id")
              .in("agent_id", matchingAgentIds);

            employeeIds = [...new Set((mappings || []).map((m) => m.employee_id))];

            agentMappings = (mappings || []).map((m) => {
              const agent = matchingAgents.find((a) => a.id === m.agent_id);
              return {
                employee_id: m.employee_id,
                agent_id: m.agent_id,
                agents: agent ? { email: agent.email, external_dialer_id: agent.external_dialer_id } : null,
              };
            });
          }

          if (employeeIds.length > 0) {
            let empQuery = supabase
              .from("employee_master_data")
              .select("id, first_name, last_name, team_members(team:teams(id, name))")
              .in("id", employeeIds)
              .eq("is_active", true);
            
            const { data: empData } = await empQuery;
            filteredEmployees = empData || [];
          }
        }
      } else {
        // No client filter - get all active employees, optionally filtered by team
        let employeeQuery = supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, team_members(team:teams(id, name))")
          .eq("is_active", true);

        const { data: employeesData } = await employeeQuery;
        filteredEmployees = employeesData || [];

        if (teamId) {
          filteredEmployees = filteredEmployees.filter((emp) =>
            emp.team_members?.some((tm: any) => tm.team?.id === teamId)
          );
        }

        employeeIds = filteredEmployees.map((e) => e.id);

        if (employeeIds.length > 0) {
          const { data: mappingsData } = await supabase
            .from("employee_agent_mapping")
            .select("employee_id, agent_id, agents(email, external_dialer_id)")
            .in("employee_id", employeeIds);
          agentMappings = mappingsData || [];
        }
      }

      if (filteredEmployees.length === 0) {
        return { totalSales: 0, totalRevenue: 0, totalCommission: 0, totalHours: 0, employeeStats: [] };
      }

      // Step 2: Get team shift configuration for hours calculation
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id, team_id")
        .in("employee_id", employeeIds);

      const teamIds = [...new Set(teamMembers?.map((tm) => tm.team_id) || [])];

      const { data: primaryShifts } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, start_time, end_time, hours_source")
        .in("team_id", teamIds)
        .eq("is_primary", true);

      const { data: shiftDays } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", primaryShifts?.map((s) => s.id) || []);

      // Fetch timestamps for teams using 'timestamp' hours_source
      const teamsUsingTimestamps = primaryShifts?.filter((s) => s.hours_source === "timestamp").map((s) => s.team_id) || [];
      let timeStampsData: any[] = [];
      if (teamsUsingTimestamps.length > 0) {
        const employeesWithTimestampTeams = teamMembers
          ?.filter((tm) => teamsUsingTimestamps.includes(tm.team_id))
          .map((tm) => tm.employee_id) || [];

        if (employeesWithTimestampTeams.length > 0) {
          const { data: stamps } = await supabase
            .from("time_stamps")
            .select("employee_id, date, clock_in, clock_out, break_minutes")
            .in("employee_id", employeesWithTimestampTeams)
            .gte("date", startStr)
            .lte("date", endStr);
          timeStampsData = stamps || [];
        }
      }

      // Step 3: Build agent identifiers for fetching sales
      const allAgentIdentifiers: string[] = [];
      agentMappings?.forEach((m) => {
        const agent = m.agents as any;
        if (agent?.email) allAgentIdentifiers.push(agent.email);
        if (agent?.external_dialer_id) allAgentIdentifiers.push(agent.external_dialer_id);
      });
      const uniqueAgentIdentifiers = [...new Set(allAgentIdentifiers)];

      // Step 4: Fetch sales matched by agent_email
      let salesData: any[] = [];
      if (uniqueAgentIdentifiers.length > 0) {
        const emailIdentifiers = uniqueAgentIdentifiers.filter((id) => id.includes("@")).map((e) => e.toLowerCase());

        if (emailIdentifiers.length > 0) {
          const joinType = resolvedClientId ? "!inner" : "";
          const selectParts = [
            "id",
            "agent_email",
            "sale_datetime",
            "client_campaign_id",
            `client_campaigns${joinType}(client_id)`,
            "sale_items(quantity,mapped_commission,mapped_revenue,products(counts_as_sale))",
          ];
          const selectClause = selectParts.join(",");
          const emailOrFilter = emailIdentifiers.map((e) => `agent_email.ilike.${encodeURIComponent(e)}`).join(",");

          let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
          salesUrl += `&or=(${emailOrFilter})`;
          salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;

          if (resolvedClientId) {
            salesUrl += `&client_campaigns.client_id=eq.${resolvedClientId}`;
          }

          const salesRes = await fetch(salesUrl, {
            headers: { ...headers, Accept: "application/json" },
          });

          if (salesRes.ok) {
            salesData = await salesRes.json();
          }
        }
      }

      // Step 5: Fetch fieldmarketing sales
      let fmQuery = supabase
        .from("fieldmarketing_sales")
        .select("id, seller_id, registered_at, product_name, client_id")
        .in("seller_id", employeeIds)
        .gte("registered_at", `${startStr}T00:00:00`)
        .lte("registered_at", `${endStr}T23:59:59`);

      if (resolvedClientId) {
        fmQuery = fmQuery.eq("client_id", resolvedClientId);
      }

      const { data: fmSalesData } = await fmQuery;

      // Step 6: Get product commission/revenue maps for FM
      const { data: allProducts } = await supabase.from("products").select("id, name, commission_dkk, revenue_dkk");
      const { data: campaignOverrides } = await supabase
        .from("product_campaign_overrides")
        .select("product_id, commission_dkk, revenue_dkk");

      const productCommissionMap = new Map<string, number>();
      const productRevenueMap = new Map<string, number>();
      const overrideByProductId = new Map<string, { commission: number; revenue: number }>();

      campaignOverrides?.forEach((o) => {
        const existing = overrideByProductId.get(o.product_id);
        if (!existing || (o.commission_dkk ?? 0) > (existing.commission ?? 0)) {
          overrideByProductId.set(o.product_id, {
            commission: o.commission_dkk ?? 0,
            revenue: o.revenue_dkk ?? 0,
          });
        }
      });

      allProducts?.forEach((p) => {
        if (p.name) {
          const override = overrideByProductId.get(p.id);
          const commission = override?.commission ?? p.commission_dkk ?? 0;
          const revenue = override?.revenue ?? p.revenue_dkk ?? 0;
          productCommissionMap.set(p.name.toLowerCase(), commission);
          productRevenueMap.set(p.name.toLowerCase(), revenue);
        }
      });

      // Step 7: Aggregate per employee
      const daysInRange = eachDayOfInterval({ start: startOfDay(startDate), end: endOfDay(endDate) });
      const employeeStats: DashboardEmployeeStats[] = [];

      let grandTotalSales = 0;
      let grandTotalRevenue = 0;
      let grandTotalCommission = 0;
      let grandTotalHours = 0;

      for (const emp of filteredEmployees) {
        const empId = emp.id;
        const teamName = emp.team_members?.[0]?.team?.name || null;

        const empTeamMembership = teamMembers?.find((tm) => tm.employee_id === empId);
        const empPrimaryShift = empTeamMembership
          ? primaryShifts?.find((ps) => ps.team_id === empTeamMembership.team_id)
          : null;
        const empShiftDays = empPrimaryShift ? shiftDays?.filter((sd) => sd.shift_id === empPrimaryShift.id) || [] : [];
        const hoursSource = empPrimaryShift?.hours_source || "shift";

        const empAgentMappings = agentMappings?.filter((m) => m.employee_id === empId) || [];
        const empAgentIdentifiers: string[] = [];
        empAgentMappings.forEach((m) => {
          const agent = m.agents as any;
          if (agent?.email) empAgentIdentifiers.push(agent.email.toLowerCase());
        });

        let totalHours = 0;
        let totalSales = 0;
        let totalRevenue = 0;
        let totalCommission = 0;

        for (const day of daysInRange) {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayOfWeek = getDay(day);
          const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

          const shiftForDay = empShiftDays.find((sd) => sd.day_of_week === adjustedDayOfWeek);

          let hours = 0;
          if (hoursSource === "timestamp") {
            const empTimestamp = timeStampsData.find((ts) => ts.employee_id === empId && ts.date === dayStr);
            if (empTimestamp?.clock_in && empTimestamp?.clock_out) {
              const [inH, inM] = empTimestamp.clock_in.split(":").map(Number);
              const [outH, outM] = empTimestamp.clock_out.split(":").map(Number);
              const rawHours = outH + outM / 60 - (inH + inM / 60);
              const breakMins = empTimestamp.break_minutes || 0;
              hours = Math.max(0, rawHours - breakMins / 60);
            }
          } else {
            if (shiftForDay?.start_time && shiftForDay?.end_time) {
              const [startH, startM] = shiftForDay.start_time.split(":").map(Number);
              const [endH, endM] = shiftForDay.end_time.split(":").map(Number);
              const rawHours = endH + endM / 60 - (startH + startM / 60);
              const breakMinutes = rawHours > 6 ? 30 : 0;
              hours = rawHours - breakMinutes / 60;
            }
          }

          totalHours += hours;

          const dayStart = `${dayStr}T00:00:00`;
          const dayEnd = `${dayStr}T23:59:59`;

          // Regular sales
          const empSales = empAgentIdentifiers.length > 0
            ? salesData.filter((s: any) => {
                const saleEmail = (s.agent_email || "").toLowerCase();
                return empAgentIdentifiers.includes(saleEmail) && s.sale_datetime >= dayStart && s.sale_datetime <= dayEnd;
              })
            : [];

          // FM sales
          const empFmSales = (fmSalesData || []).filter((s: any) => {
            return s.seller_id === empId && s.registered_at >= dayStart && s.registered_at <= dayEnd;
          });

          empSales.forEach((sale: any) => {
            (sale.sale_items || []).forEach((item: any) => {
              const countsAsSale = item.products?.counts_as_sale !== false;
              if (countsAsSale) {
                totalSales += Number(item.quantity) || 1;
              }
              totalRevenue += Number(item.mapped_revenue) || 0;
              totalCommission += Number(item.mapped_commission) || 0;
            });
          });

          empFmSales.forEach((sale: any) => {
            totalSales += 1;
            const productName = (sale.product_name || "").toLowerCase();
            totalCommission += productCommissionMap.get(productName) || 0;
            totalRevenue += productRevenueMap.get(productName) || 0;
          });
        }

        if (totalSales > 0 || totalHours > 0) {
          employeeStats.push({
            employeeId: empId,
            employeeName: `${emp.first_name} ${emp.last_name}`.trim(),
            teamName,
            totalHours: Math.round(totalHours * 100) / 100,
            totalSales,
            totalRevenue: Math.round(totalRevenue),
            totalCommission: Math.round(totalCommission),
          });
        }

        grandTotalSales += totalSales;
        grandTotalRevenue += totalRevenue;
        grandTotalCommission += totalCommission;
        grandTotalHours += totalHours;
      }

      // Sort by commission descending
      employeeStats.sort((a, b) => b.totalCommission - a.totalCommission);

      return {
        totalSales: grandTotalSales,
        totalRevenue: Math.round(grandTotalRevenue),
        totalCommission: Math.round(grandTotalCommission),
        totalHours: Math.round(grandTotalHours * 100) / 100,
        employeeStats,
      };
    },
    enabled,
    staleTime: 30000,
  });

  return {
    totalSales: data?.totalSales || 0,
    totalRevenue: data?.totalRevenue || 0,
    totalCommission: data?.totalCommission || 0,
    totalHours: data?.totalHours || 0,
    employeeStats: data?.employeeStats || [],
    isLoading,
  };
}
