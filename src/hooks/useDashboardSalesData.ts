import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, eachDayOfInterval, getDay } from "date-fns";
import { chunk, fetchAllRows } from "@/utils/supabasePagination";
import { fetchAllPostgrestRows } from "@/utils/postgrestFetch";
import { BREAK_THRESHOLD_MINUTES, BREAK_DURATION_MINUTES } from "@/lib/calculations";
import { REFRESH_PROFILES } from "@/utils/tvMode";
import { trackFetch } from "@/utils/fetchPerformance";
import { resolveHoursSourceBatch, type HoursSourceResult } from "@/lib/resolveHoursSource";

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
  dataAsOf: string | null;
  isLoading: boolean;
}

interface UseDashboardSalesDataParams {
  clientId?: string;
  clientName?: string; // Alternative to clientId - will look up client by name
  startDate: Date;
  endDate: Date;
  teamId?: string;
  enabled?: boolean;
  refetchInterval?: number; // Auto-refresh interval in milliseconds
  useNewAssignments?: boolean; // Feature flag for new hours resolver
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
  refetchInterval,
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
    refetchInterval,
    queryFn: () => trackFetch("dashboard-sales-data", async () => {
      const AGENT_EMAIL_CHUNK_SIZE = 150;
      const SALES_EMAIL_FILTER_CHUNK_SIZE = 75;
      const SALES_FETCH_BATCH_SIZE = 3;
      const MAX_SALES_ROWS = 20000;

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseKey;
      const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}` };

      const buildEmailOrFilter = (emails: string[]) =>
        emails
          .map((email) => `email.ilike.${encodeURIComponent(email)}`)
          .join(",");

      const fetchAgentsByEmails = async (emails: string[]) => {
        const agentChunks = chunk(emails, AGENT_EMAIL_CHUNK_SIZE);
        const results = await Promise.all(
          agentChunks.map(async (emailChunk) => {
            const agentsUrl = `${supabaseUrl}/rest/v1/agents?select=id,email,external_dialer_id&or=(${buildEmailOrFilter(emailChunk)})`;
            return fetchAllPostgrestRows<{ id: string; email: string; external_dialer_id: string | null }>(agentsUrl, headers);
          })
        );

        return results.flat();
      };

      // Resolve clientId from clientName if provided
      let resolvedClientId = clientId;
      if (!resolvedClientId && clientName) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id")
          .ilike("name", `%${clientName}%`)
          .limit(1);
        if (clients && clients.length > 0) {
          resolvedClientId = clients[0].id;
        }
      }

      let employeeIds: string[] = [];
      let filteredEmployees: any[] = [];
      let agentMappings: any[] = [];

      // Step 1: Find employees based on client or team filter
      if (resolvedClientId) {
        // Find employees who have sales for this client via agent mapping
        const salesUrl = `${supabaseUrl}/rest/v1/sales?select=agent_email,client_campaigns!inner(client_id)&client_campaigns.client_id=eq.${resolvedClientId}&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
        const salesForClient = await fetchAllPostgrestRows<any>(salesUrl, headers, {
          maxRows: MAX_SALES_ROWS,
          onMaxRowsExceeded: "error",
        });

        const agentEmails = [
          ...new Set(
            (salesForClient || [])
              .map((s: any) => s.agent_email?.toLowerCase())
              .filter(Boolean)
          ),
        ] as string[];

        if (agentEmails.length > 0) {
          const matchingAgents = await fetchAgentsByEmails(agentEmails);
          const matchingAgentIds = matchingAgents.map((a) => a.id);

          if (matchingAgentIds.length > 0) {
            const mappings = await fetchAllRows<{employee_id: string; agent_id: string}>(
              "employee_agent_mapping",
              "employee_id, agent_id",
              (q) => q.in("agent_id", matchingAgentIds)
            );

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
        .eq("is_active", true);

      const { data: shiftDays } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", primaryShifts?.map((s) => s.id) || []);

      // Fetch timestamps for teams using 'timestamp' hours_source
      const teamsUsingTimestamps = primaryShifts?.filter((s) => s.hours_source === "timestamp").map((s) => s.team_id) || [];
      let timeStampsData: any[] = [];
      if (teamsUsingTimestamps.length > 0) {
        const timestampTeamIds = new Set(teamsUsingTimestamps);
        const employeesWithTimestampTeams = teamMembers
          ?.filter((tm) => timestampTeamIds.has(tm.team_id))
          .map((tm) => tm.employee_id) || [];

        if (employeesWithTimestampTeams.length > 0) {
          const { data: stamps } = await supabase
            .from("time_stamps")
            .select("employee_id, clock_in, clock_out, break_minutes")
            .in("employee_id", employeesWithTimestampTeams)
            .gte("clock_in", startStr)
            .lte("clock_in", endStr + "T23:59:59");
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
      
      // Build a map: product_id -> array of rules (sorted by priority desc for later selection)
      const pricingRulesMap = new Map<string, Array<{ 
        campaign_mapping_ids: string[] | null; 
        conditions: any;
        commission: number; 
        revenue: number; 
        priority: number;
      }>>();
      
      // Step 4: Fetch sales matched by agent_email - include dialer_campaign_id and product_id for override lookup
      const salesPromise = async () => {
        if (uniqueAgentIdentifiers.length === 0) return [] as any[];

        const emailIdentifiers = uniqueAgentIdentifiers.filter((id) => id.includes("@")).map((e) => e.toLowerCase());
        if (emailIdentifiers.length === 0) return [] as any[];

        const joinType = resolvedClientId ? "!inner" : "";
        const selectParts = [
          "id",
          "agent_email",
          "sale_datetime",
          "client_campaign_id",
          "dialer_campaign_id",
          `client_campaigns${joinType}(client_id)`,
          "sale_items(quantity,mapped_commission,mapped_revenue,product_id,products(counts_as_sale))",
        ];
        const selectClause = selectParts.join(",");
        const salesEmailChunks = chunk(emailIdentifiers, SALES_EMAIL_FILTER_CHUNK_SIZE);
        const rowsById = new Map<string, any>();

        for (let i = 0; i < salesEmailChunks.length; i += SALES_FETCH_BATCH_SIZE) {
          const batch = salesEmailChunks.slice(i, i + SALES_FETCH_BATCH_SIZE);

          const batchRows = await Promise.all(
            batch.map(async (emailChunk) => {
              const emailOrFilter = emailChunk
                .map((email) => `agent_email.ilike.${encodeURIComponent(email)}`)
                .join(",");

              let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
              salesUrl += `&or=(${emailOrFilter})`;
              salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;

              if (resolvedClientId) {
                salesUrl += `&client_campaigns.client_id=eq.${resolvedClientId}`;
              }

              return fetchAllPostgrestRows<any>(salesUrl, headers, {
                maxRows: MAX_SALES_ROWS,
                onMaxRowsExceeded: "error",
                requestTimeoutMs: 20000,
              });
            })
          );

          batchRows.flat().forEach((row) => {
            if (row?.id) rowsById.set(row.id, row);
          });

          if (rowsById.size > MAX_SALES_ROWS) {
            throw new Error(`Dashboard sales fetch exceeded safe limit (${MAX_SALES_ROWS})`);
          }
        }

        return Array.from(rowsById.values());
      };

      // Step 5: Fetch fieldmarketing sales from unified sales table
      const fmSalesPromise = fetchAllRows<{id: string; sale_datetime: string; raw_payload: any; client_campaign_id: string | null}>(
        "sales",
        "id, sale_datetime, raw_payload, client_campaign_id",
        (q) => {
          let filtered = q
            .eq("source", "fieldmarketing")
            .gte("sale_datetime", `${startStr}T00:00:00`)
            .lte("sale_datetime", `${endStr}T23:59:59`);
          if (resolvedClientId) {
            filtered = filtered.contains("raw_payload", { fm_client_id: resolvedClientId } as any);
          }
          return filtered;
        },
        { orderBy: "sale_datetime", ascending: false }
      );

      const [salesData, fmSalesData] = await Promise.all([salesPromise(), fmSalesPromise]);

      const shouldFetchPricingRules = salesData.length > 0 || fmSalesData.length > 0;
      const hasDialerCampaignIds = salesData.some((sale: any) => Boolean(sale.dialer_campaign_id));

      // Fetch product pricing rules for commission/revenue (replaces product_campaign_overrides)
      const [{ data: productPricingRules }, campaignMappings, allProducts] = await Promise.all([
        shouldFetchPricingRules
          ? supabase
              .from("product_pricing_rules")
              .select("product_id, campaign_mapping_ids, conditions, commission_dkk, revenue_dkk, priority, is_active")
              .eq("is_active", true)
          : Promise.resolve({ data: [] as any[] }),
        hasDialerCampaignIds
          ? fetchAllRows<{id: string; adversus_campaign_id: string}>("adversus_campaign_mappings", "id, adversus_campaign_id")
          : Promise.resolve([] as {id: string; adversus_campaign_id: string}[]),
        fmSalesData.length > 0
          ? fetchAllRows<{id: string; name: string; commission_dkk: number; revenue_dkk: number}>("products", "id, name, commission_dkk, revenue_dkk")
          : Promise.resolve([] as {id: string; name: string; commission_dkk: number; revenue_dkk: number}[]),
      ]);

      productPricingRules?.forEach(rule => {
        if (!rule.product_id) return;
        const existing = pricingRulesMap.get(rule.product_id) || [];
        existing.push({
          campaign_mapping_ids: rule.campaign_mapping_ids,
          conditions: rule.conditions || {},
          commission: rule.commission_dkk ?? 0,
          revenue: rule.revenue_dkk ?? 0,
          priority: rule.priority ?? 0,
        });
        // Keep sorted by priority desc
        existing.sort((a, b) => b.priority - a.priority);
        pricingRulesMap.set(rule.product_id, existing);
      });
      
      // Helper function to find best matching rule
      const findMatchingRule = (productId: string, campaignMappingId: string | null) => {
        const rules = pricingRulesMap.get(productId);
        if (!rules || rules.length === 0) return null;
        
        // Find the first rule that matches (highest priority wins due to sort)
        for (const rule of rules) {
          // If rule has no campaign restrictions (null or empty array), it applies to all
          if (!rule.campaign_mapping_ids || rule.campaign_mapping_ids.length === 0) {
            return rule;
          }
          // Check if the campaign matches
          if (campaignMappingId && rule.campaign_mapping_ids.includes(campaignMappingId)) {
            return rule;
          }
        }
        
        // Fallback: return rule with null campaign_mapping_ids (applies to all)
        return rules.find(r => !r.campaign_mapping_ids || r.campaign_mapping_ids.length === 0) || null;
      };

      // Fetch campaign mappings for dialer_campaign_id resolution
      const dialerCampaignToMappingId = new Map<string, string>();
      campaignMappings?.forEach(m => {
        if (m.adversus_campaign_id) {
          dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
        }
      });

      // Step 6: Get product commission/revenue maps for FM

      const productCommissionMap = new Map<string, number>();
      const productRevenueMap = new Map<string, number>();
      const overrideByProductId = new Map<string, { commission: number; revenue: number }>();

      // Use pricing rules for FM products as well
      productPricingRules?.forEach((rule) => {
        if (!rule.product_id) return;
        const existing = overrideByProductId.get(rule.product_id);
        if (!existing || (rule.commission_dkk ?? 0) > (existing.commission ?? 0)) {
          overrideByProductId.set(rule.product_id, {
            commission: rule.commission_dkk ?? 0,
            revenue: rule.revenue_dkk ?? 0,
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

      // Step 7: Build lookup maps used during aggregation (reduces repeated scans)
      const daysInRange = eachDayOfInterval({ start: startOfDay(startDate), end: endOfDay(endDate) });
      const dayCountByWeekday = new Map<number, number>();
      daysInRange.forEach((day) => {
        const dayOfWeek = getDay(day);
        const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
        dayCountByWeekday.set(adjustedDayOfWeek, (dayCountByWeekday.get(adjustedDayOfWeek) || 0) + 1);
      });

      const teamMemberByEmployeeId = new Map<string, string>();
      (teamMembers || []).forEach((tm) => {
        teamMemberByEmployeeId.set(tm.employee_id, tm.team_id);
      });

      const primaryShiftByTeamId = new Map<string, any>();
      (primaryShifts || []).forEach((shift) => {
        primaryShiftByTeamId.set(shift.team_id, shift);
      });

      const shiftByIdAndDay = new Map<string, Map<number, any>>();
      (shiftDays || []).forEach((shiftDay) => {
        const existing = shiftByIdAndDay.get(shiftDay.shift_id) || new Map<number, any>();
        existing.set(shiftDay.day_of_week, shiftDay);
        shiftByIdAndDay.set(shiftDay.shift_id, existing);
      });

      const shiftHoursByShiftIdAndDay = new Map<string, Map<number, number>>();
      shiftByIdAndDay.forEach((days, shiftId) => {
        const hoursByDay = new Map<number, number>();
        days.forEach((shiftDay, dayOfWeek) => {
          if (!shiftDay?.start_time || !shiftDay?.end_time) {
            hoursByDay.set(dayOfWeek, 0);
            return;
          }

          const [startH, startM] = shiftDay.start_time.split(":").map(Number);
          const [endH, endM] = shiftDay.end_time.split(":").map(Number);
          const rawHours = endH + endM / 60 - (startH + startM / 60);
          const breakMinutes = (rawHours * 60) > BREAK_THRESHOLD_MINUTES ? BREAK_DURATION_MINUTES : 0;
          hoursByDay.set(dayOfWeek, rawHours - breakMinutes / 60);
        });
        shiftHoursByShiftIdAndDay.set(shiftId, hoursByDay);
      });

      const employeeIdsByAgentEmail = new Map<string, string[]>();
      (agentMappings || []).forEach((mapping) => {
        const employeeId = mapping.employee_id as string;
        const email = (mapping.agents as any)?.email?.toLowerCase() as string | undefined;
        if (!employeeId || !email) return;

        const existing = employeeIdsByAgentEmail.get(email) || [];
        existing.push(employeeId);
        employeeIdsByAgentEmail.set(email, existing);
      });

      const timestampHoursByEmployeeId = new Map<string, number>();
      (timeStampsData || []).forEach((timestamp) => {
        if (!timestamp.clock_in || !timestamp.clock_out || !timestamp.employee_id) return;

        const clockInDate = new Date(timestamp.clock_in);
        const clockOutDate = new Date(timestamp.clock_out);
        if (Number.isNaN(clockInDate.getTime()) || Number.isNaN(clockOutDate.getTime())) return;

        const rawHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
        const breakMins = timestamp.break_minutes || 0;
        const computedHours = Math.max(0, rawHours - breakMins / 60);

        const current = timestampHoursByEmployeeId.get(timestamp.employee_id) || 0;
        timestampHoursByEmployeeId.set(timestamp.employee_id, current + computedHours);
      });

      const regularTotalsByEmployeeId = new Map<string, { sales: number; revenue: number; commission: number }>();
      (salesData || []).forEach((sale: any) => {
        const saleEmail = (sale.agent_email || "").toLowerCase();
        const matchedEmployees = employeeIdsByAgentEmail.get(saleEmail);
        if (!matchedEmployees || matchedEmployees.length === 0) return;

        let saleCount = 0;
        let saleRevenue = 0;
        let saleCommission = 0;

        const dialerCampaignId = sale.dialer_campaign_id;
        const campaignMappingId = dialerCampaignId ? dialerCampaignToMappingId.get(dialerCampaignId) : null;

        (sale.sale_items || []).forEach((item: any) => {
          const countsAsSale = item.products?.counts_as_sale !== false;
          if (countsAsSale) {
            saleCount += Number(item.quantity) || 1;
          }

          const matchingRule = item.product_id ? findMatchingRule(item.product_id, campaignMappingId || null) : null;
          if (matchingRule) {
            saleRevenue += matchingRule.revenue;
            saleCommission += matchingRule.commission;
          } else {
            saleRevenue += Number(item.mapped_revenue) || 0;
            saleCommission += Number(item.mapped_commission) || 0;
          }
        });

        matchedEmployees.forEach((employeeId) => {
          const current = regularTotalsByEmployeeId.get(employeeId) || { sales: 0, revenue: 0, commission: 0 };
          regularTotalsByEmployeeId.set(employeeId, {
            sales: current.sales + saleCount,
            revenue: current.revenue + saleRevenue,
            commission: current.commission + saleCommission,
          });
        });
      });

      const fmTotalsByEmployeeId = new Map<string, { sales: number; revenue: number; commission: number }>();
      (fmSalesData || []).forEach((sale: any) => {
        const employeeId = (sale.raw_payload as any)?.fm_seller_id;
        if (!employeeId) return;

        const productName = ((sale.raw_payload as any)?.fm_product_name || "").toLowerCase();
        const saleRevenue = productRevenueMap.get(productName) || 0;
        const saleCommission = productCommissionMap.get(productName) || 0;

        const current = fmTotalsByEmployeeId.get(employeeId) || { sales: 0, revenue: 0, commission: 0 };
        fmTotalsByEmployeeId.set(employeeId, {
          sales: current.sales + 1,
          revenue: current.revenue + saleRevenue,
          commission: current.commission + saleCommission,
        });
      });

      // Step 8: Aggregate per employee
      const employeeStats: DashboardEmployeeStats[] = [];

      let grandTotalSales = 0;
      let grandTotalRevenue = 0;
      let grandTotalCommission = 0;
      let grandTotalHours = 0;

      for (const emp of filteredEmployees) {
        const empId = emp.id;
        const teamName = emp.team_members?.[0]?.team?.name || null;

        const empTeamId = teamMemberByEmployeeId.get(empId);
        const empPrimaryShift = empTeamId ? primaryShiftByTeamId.get(empTeamId) : null;
        const hoursSource = empPrimaryShift?.hours_source || "shift";

        let totalHours = 0;
        if (hoursSource === "timestamp") {
          totalHours = timestampHoursByEmployeeId.get(empId) || 0;
        } else if (empPrimaryShift) {
          const shiftHoursByDay = shiftHoursByShiftIdAndDay.get(empPrimaryShift.id);
          if (shiftHoursByDay) {
            shiftHoursByDay.forEach((hoursForDay, dayOfWeek) => {
              const occurrences = dayCountByWeekday.get(dayOfWeek) || 0;
              totalHours += hoursForDay * occurrences;
            });
          }
        }

        const regularTotals = regularTotalsByEmployeeId.get(empId) || { sales: 0, revenue: 0, commission: 0 };
        const fmTotals = fmTotalsByEmployeeId.get(empId) || { sales: 0, revenue: 0, commission: 0 };

        const totalSales = regularTotals.sales + fmTotals.sales;
        const totalRevenue = regularTotals.revenue + fmTotals.revenue;
        const totalCommission = regularTotals.commission + fmTotals.commission;

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
        dataAsOf: new Date().toISOString(),
      };
    }),
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    ...REFRESH_PROFILES.dashboard,
  });

  return {
    totalSales: data?.totalSales || 0,
    totalRevenue: data?.totalRevenue || 0,
    totalCommission: data?.totalCommission || 0,
    totalHours: data?.totalHours || 0,
    employeeStats: data?.employeeStats || [],
    dataAsOf: data?.dataAsOf || null,
    isLoading,
  };
}
