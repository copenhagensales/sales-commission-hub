import { useState, useMemo, useEffect } from "react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, getDay, isSameDay } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ChevronDown, ChevronRight, Calendar as CalendarIcon, Clock, Palmtree, Thermometer, TrendingUp, Coins, SlidersHorizontal, DollarSign, Building2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package } from "lucide-react";
import { MultiSelectFilter, type MultiOption } from "@/components/reports/MultiSelectFilter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useCurrentEmployee } from "@/hooks/useShiftPlanning";
import { BREAK_THRESHOLD_MINUTES, BREAK_DURATION_MINUTES } from "@/lib/calculations";
import { fetchAllRows } from "@/utils/supabasePagination";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { resolveHoursSourceBatch, type HoursSourceResult } from "@/lib/resolveHoursSource";

// Helper function to fetch employees with activity on specific clients
// Uses agent_email from sales, matches to agents, then maps to employees via employee_agent_mapping
async function fetchEmployeesWithClientActivity(clientIds: string[]): Promise<string[]> {
  if (clientIds.length === 0) return [];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Get user's auth token for RLS-protected tables
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseKey;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}` };

  // Get unique agent emails for each client (RPC takes single id, so loop)
  const agentEmailSets = await Promise.all(
    clientIds.map((cid) => supabase.rpc("get_distinct_agent_emails_for_client", { p_client_id: cid }))
  );
  const agentEmails = [
    ...new Set(
      agentEmailSets.flatMap((res) => (res.data || []).map((r: any) => r.agent_email).filter(Boolean))
    ),
  ];

  // Get FM seller IDs for these clients from unified sales table (paginated)
  const fmData = await fetchAllRows<{ raw_payload: { fm_seller_id: string; fm_client_id: string } }>(
    "sales", "raw_payload",
    (q) => q.eq("source", "fieldmarketing")
  );
  const clientIdSet = new Set(clientIds);
  const fmDataFiltered = fmData.filter((d) => d.raw_payload?.fm_client_id && clientIdSet.has(d.raw_payload.fm_client_id));
  const fmEmployeeIds = fmDataFiltered.map((s) => s.raw_payload?.fm_seller_id).filter(Boolean);

  // Get all agent mappings with agent email info
  const mappingsRes = await fetch(
    `${supabaseUrl}/rest/v1/employee_agent_mapping?select=employee_id,agents(email)`,
    { headers }
  );
  const mappingsData: { employee_id: string; agents: { email: string } | null }[] = await mappingsRes.json();

  const employeeIdsFromSales = mappingsData
    .filter((m) => m.agents?.email && agentEmails.includes(m.agents.email))
    .map((m) => m.employee_id);

  return [...new Set([...employeeIdsFromSales, ...fmEmployeeIds])];
}

const reportColumnOptions = [
  { id: "hours", label: "Timer", icon: Clock },
  { id: "sick_days", label: "Sygdom", icon: Thermometer },
  { id: "vacation_days", label: "Ferie", icon: Palmtree },
  { id: "sales", label: "Salg", icon: TrendingUp },
  { id: "clients", label: "Kunder", icon: Building2 },
  { id: "commission", label: "Provision", icon: Coins },
  { id: "revenue", label: "Omsætning", icon: DollarSign },
];

interface ProductSaleDetail {
  product_name: string;
  campaign_name: string;
  quantity: number;
  commission: number;
  revenue: number;
}

interface DailyEntry {
  date: string;
  hours: number;
  is_sick: boolean;
  is_vacation: boolean;
  sales_count: number;
  revenue: number;
  commission: number;
  clients: string[];
  missing_shift: boolean;
  product_details: ProductSaleDetail[];
}

interface EmployeeReportData {
  employee_id: string;
  employee_name: string;
  team_name: string | null;
  total_hours: number;
  sick_days: number;
  vacation_days: number;
  total_sales: number;
  total_revenue: number;
  total_commission: number;
  clients: string[];
  daily_entries: DailyEntry[];
  has_missing_shifts: boolean;
  product_details: ProductSaleDetail[];
}

export default function DailyReports() {
  const { scopeReportsDaily } = usePermissions();
  const { data: currentEmployee } = useCurrentEmployee();
  const useNewAssignmentsFlag = useFeatureFlag('employee_client_assignments');
  
  const [period, setPeriod] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["hours", "sick_days", "vacation_days", "sales", "clients", "commission", "revenue"]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<"active" | "inactive" | "all">("all");
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const toggleEmployeeExpanded = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    
    switch (period) {
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(today) };
      case "last_week":
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return { start: lastWeekStart, end: lastWeekEnd };
      case "this_month":
        return { start: startOfMonth(now), end: endOfDay(today) };
      case "custom":
        if (customStartDate && customEndDate) {
          const cappedEnd = customEndDate > today ? today : customEndDate;
          return { start: startOfDay(customStartDate), end: endOfDay(cappedEnd) };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      default: // today
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [period, customStartDate, customEndDate]);

  const isMultipleDays = useMemo(() => {
    return !isSameDay(dateRange.start, dateRange.end);
  }, [dateRange]);

  // Fetch teams where current user is leader (for scope = "team")
  const { data: ledTeamIds = [] } = useQuery({
    queryKey: ["daily-report-led-teams", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("team_leader_id", currentEmployee.id);
      
      // Also check junction table for assistant roles
      const { data: assistantTeams } = await supabase
        .from("team_assistant_leaders")
        .select("team_id")
        .eq("employee_id", currentEmployee.id);
      
      const leaderTeamIds = data?.map(t => t.id) || [];
      const assistantTeamIds = assistantTeams?.map(t => t.team_id) || [];
      return [...new Set([...leaderTeamIds, ...assistantTeamIds])];
    },
    enabled: !!currentEmployee?.id && scopeReportsDaily === "team",
  });

  // Fetch all teams
  const { data: allTeams = [] } = useQuery({
    queryKey: ["daily-report-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  // Filter teams based on scope
  const teams = useMemo(() => {
    if (scopeReportsDaily === "alt") return allTeams; // Owner sees all
    if (scopeReportsDaily === "team") return allTeams.filter(t => ledTeamIds.includes(t.id));
    return []; // "egen" = only self, no teams
  }, [allTeams, scopeReportsDaily, ledTeamIds]);

  // Auto-select team based on scope restrictions
  useEffect(() => {
    // For team-scoped users: pre-select their team(s) when none are selected
    if (scopeReportsDaily === "team" && teams.length > 0 && selectedTeams.length === 0) {
      setSelectedTeams([teams[0].id]);
    }
  }, [scopeReportsDaily, teams, selectedTeams]);

  // Fetch employees - use employee_master_data when we need inactive employees
  // since employee_basic_info view filters to is_active = true only
  const { data: employees = [] } = useQuery({
    queryKey: ["daily-report-employees", employeeStatusFilter],
    queryFn: async () => {
      if (employeeStatusFilter === "active") {
        const { data } = await supabase
          .from("employee_basic_info")
          .select("id, first_name, last_name, is_active")
          .eq("is_active", true)
          .order("first_name");
        return data || [];
      }
      // For inactive or all, query employee_master_data directly
      let query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, is_active")
        .order("first_name");

      if (employeeStatusFilter === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const { data: employeesWithClientActivity = [] } = useQuery({
    queryKey: ["daily-report-employees-with-client-activity", selectedClients.sort().join(",")],
    queryFn: () => fetchEmployeesWithClientActivity(selectedClients),
    enabled: selectedClients.length > 0,
  });

  // Fetch team memberships for employee dropdown filtering
  const { data: employeeTeamMemberships = [] } = useQuery({
    queryKey: ["daily-report-employee-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("employee_id, team_id");
      return data || [];
    },
  });

  // Fetch team↔client mapping (for cascading filters)
  const { data: teamClientLinks = [] } = useQuery({
    queryKey: ["daily-report-team-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_clients")
        .select("team_id, client_id");
      return data || [];
    },
  });

  // Compute employee IDs that match selected teams
  const employeeIdsInSelectedTeams = useMemo(() => {
    if (selectedTeams.length === 0) return null; // null = no team filter
    const teamSet = new Set(selectedTeams);
    return new Set(
      employeeTeamMemberships
        .filter((tm) => teamSet.has(tm.team_id))
        .map((tm) => tm.employee_id)
    );
  }, [selectedTeams, employeeTeamMemberships]);

  // Compute client IDs linked to selected teams
  const clientIdsInSelectedTeams = useMemo(() => {
    if (selectedTeams.length === 0) return null;
    const teamSet = new Set(selectedTeams);
    return new Set(
      teamClientLinks.filter((l) => teamSet.has(l.team_id)).map((l) => l.client_id)
    );
  }, [selectedTeams, teamClientLinks]);

  // Filter employees for the dropdown (in-scope vs out-of-scope handled by MultiSelectFilter)
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (employeeIdsInSelectedTeams) {
      result = result.filter((emp) => employeeIdsInSelectedTeams.has(emp.id));
    }

    if (selectedClients.length > 0) {
      result = result.filter((emp) => employeesWithClientActivity.includes(emp.id));
    }

    return result;
  }, [employees, employeeIdsInSelectedTeams, selectedClients, employeesWithClientActivity]);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["daily-report-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ["daily-report-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id")
        .order("name");
      return data || [];
    },
  });

  // Fetch report data
  const { data: reportData = [], isLoading: isLoadingReport, refetch: fetchReport } = useQuery({
    queryKey: ["daily-report-data", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd"), selectedTeams.sort().join(","), selectedEmployees.sort().join(","), selectedClients.sort().join(","), selectedCampaigns.sort().join(","), employeeStatusFilter, scopeReportsDaily, ledTeamIds, currentEmployee?.id, useNewAssignmentsFlag],
    queryFn: async () => {
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");
      let employeeIds: string[] = [];
      let filteredEmployees: any[] = [];
      let agentMappings: any[] = [];

      // When specific clients are selected, find employees who have sales for those clients
      // This handles employees without team assignments
      if (selectedClients.length > 0) {
        // First, fetch all sales for these clients in the date range to get agent emails (paginated)
        const salesForClient = await fetchAllRows<{ agent_email: string }>(
          "sales", "agent_email, client_campaigns!inner(client_id)",
          (q) => q
            .in("client_campaigns.client_id", selectedClients)
            .gte("sale_datetime", `${startStr}T00:00:00`)
            .lte("sale_datetime", `${endStr}T23:59:59`)
        );

        // Get unique agent emails from these sales
        const agentEmails = [...new Set(
          (salesForClient || [])
            .map((s: any) => s.agent_email?.toLowerCase())
            .filter(Boolean)
        )] as string[];

        // ALSO fetch seller_ids from unified sales table for these clients
        const fmSellersForClient = await fetchAllRows<{ raw_payload: any }>(
          "sales", "raw_payload",
          (q) => q.eq("source", "fieldmarketing")
            .gte("sale_datetime", `${startStr}T00:00:00`)
            .lte("sale_datetime", `${endStr}T23:59:59`),
          { orderBy: "sale_datetime", ascending: false }
        );

        const selectedClientSet = new Set(selectedClients);
        const fmEmployeeIds = [...new Set(
          (fmSellersForClient || [])
            .filter((s: any) => s.raw_payload?.fm_client_id && selectedClientSet.has(s.raw_payload.fm_client_id))
            .map((s: any) => s.raw_payload?.fm_seller_id)
            .filter(Boolean)
        )] as string[];

        console.log("[DailyReport] Client sales agent emails:", agentEmails);
        console.log("[DailyReport] FM seller IDs for clients:", fmEmployeeIds.length);

        if (agentEmails.length > 0) {
          // Find agents matching these emails
          const { data: agentsData } = await supabase
            .from("agents")
            .select("id, email, external_dialer_id");

          // Filter agents by email (case-insensitive)
          const matchingAgents = (agentsData || []).filter(a =>
            agentEmails.includes(a.email?.toLowerCase())
          );
          const matchingAgentIds = matchingAgents.map(a => a.id);

          // Get employee mappings for these agents
          if (matchingAgentIds.length > 0) {
            const { data: mappings } = await supabase
              .from("employee_agent_mapping")
              .select("employee_id, agent_id")
              .in("agent_id", matchingAgentIds);

            employeeIds = [...new Set((mappings || []).map(m => m.employee_id))];

            // Build agent mappings structure for later use
            agentMappings = (mappings || []).map(m => {
              const agent = matchingAgents.find(a => a.id === m.agent_id);
              return {
                employee_id: m.employee_id,
                agent_id: m.agent_id,
                agents: agent ? { email: agent.email, external_dialer_id: agent.external_dialer_id } : null
              };
            });
          }
        }

        // Combine with FM employee IDs
        employeeIds = [...new Set([...employeeIds, ...fmEmployeeIds])];

        // Apply selected employees filter (intersection)
        if (selectedEmployees.length > 0) {
          const empSet = new Set(selectedEmployees);
          employeeIds = employeeIds.filter((id) => empSet.has(id));
        }

        // Fetch employee details for all IDs (from sales AND fieldmarketing)
        if (employeeIds.length > 0) {
          let empQuery = supabase
            .from("employee_master_data")
            .select(`id, first_name, last_name, last_team_id, team_members(team:teams(id, name))`)
            .in("id", employeeIds);

          if (employeeStatusFilter === "active") {
            empQuery = empQuery.eq("is_active", true);
          } else if (employeeStatusFilter === "inactive") {
            empQuery = empQuery.eq("is_active", false);
          }

          const { data: empData } = await empQuery;

          filteredEmployees = empData || [];

          // Apply team filter if specific teams are selected
          if (selectedTeams.length > 0) {
            const teamSet = new Set(selectedTeams);
            filteredEmployees = filteredEmployees.filter(emp =>
              emp.team_members?.some((tm: any) => tm.team?.id && teamSet.has(tm.team.id))
              || teamSet.has((emp as any).last_team_id)
            );
          }

          // Update employeeIds to match filtered list
          employeeIds = filteredEmployees.map((e: any) => e.id);
        }

        console.log("[DailyReport] Employees found for clients:", filteredEmployees.length);
      } else {
        // Original logic: fetch all active employees and filter by team
        let employeeQuery = supabase
          .from("employee_master_data")
          .select(`
            id,
            first_name,
            last_name,
            last_team_id,
            team_members(team:teams(id, name))
          `)

        if (employeeStatusFilter === "active") {
          employeeQuery = employeeQuery.eq("is_active", true);
        } else if (employeeStatusFilter === "inactive") {
          employeeQuery = employeeQuery.eq("is_active", false);
        }
        // "all" = no filter

        if (selectedEmployees.length > 0) {
          employeeQuery = employeeQuery.in("id", selectedEmployees);
        }

        const { data: employeesData, error: empError } = await employeeQuery;
        if (empError) throw empError;

        filteredEmployees = employeesData || [];

        // Apply scope-based filtering first
        if (scopeReportsDaily === "team" && ledTeamIds.length > 0) {
          // Team scope: only employees from user's led teams
          filteredEmployees = filteredEmployees.filter(emp =>
            emp.team_members?.some((tm: any) => ledTeamIds.includes(tm.team?.id))
            || ledTeamIds.includes((emp as any).last_team_id)
          );
        } else if (scopeReportsDaily === "egen" && currentEmployee?.id) {
          // Own scope: only current user's data
          filteredEmployees = filteredEmployees.filter(emp => emp.id === currentEmployee.id);
        }

        // Then apply selected team filter
        if (selectedTeams.length > 0) {
          const teamSet = new Set(selectedTeams);
          filteredEmployees = filteredEmployees.filter(emp =>
            emp.team_members?.some((tm: any) => tm.team?.id && teamSet.has(tm.team.id))
            || teamSet.has((emp as any).last_team_id)
          );
        }

        employeeIds = filteredEmployees.map(e => e.id);

        // Fetch agent mappings for all filtered employees
        if (employeeIds.length > 0) {
          const { data: mappingsData } = await supabase
            .from("employee_agent_mapping")
            .select("employee_id, agent_id, agents(email, external_dialer_id)")
            .in("employee_id", employeeIds);
          
          agentMappings = mappingsData || [];
        }
      }

      if (filteredEmployees.length === 0) return [];

      // Fetch absences
      const { data: absences } = await supabase
        .from("absence_request_v2")
        .select("employee_id, type, start_date, end_date, status")
        .in("employee_id", employeeIds)
        .lte("start_date", endStr)
        .gte("end_date", startStr)
        .eq("status", "approved");

      // Resolve hours source (new system vs legacy)
      const hoursSourceMap = useNewAssignmentsFlag
        ? await resolveHoursSourceBatch(employeeIds)
        : null;

      // Fetch team standard shift data
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id, team_id")
        .in("employee_id", employeeIds);

      const teamIds = [...new Set(teamMembers?.map(tm => tm.team_id) || [])];
      
      const { data: primaryShifts } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, start_time, end_time, hours_source")
        .in("team_id", teamIds)
        .eq("is_active", true);

      const { data: shiftDays } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", primaryShifts?.map(s => s.id) || []);

      // Determine which employees need timestamps
      let employeesNeedingTimestamps: string[] = [];
      if (hoursSourceMap) {
        employeesNeedingTimestamps = employeeIds.filter(id => hoursSourceMap[id]?.source === 'timestamp');
      } else {
        const teamsUsingTimestamps = primaryShifts?.filter(s => s.hours_source === 'timestamp').map(s => s.team_id) || [];
        if (teamsUsingTimestamps.length > 0) {
          employeesNeedingTimestamps = teamMembers
            ?.filter(tm => teamsUsingTimestamps.includes(tm.team_id))
            .map(tm => tm.employee_id) || [];
        }
      }

      let timeStampsData: any[] = [];
      if (employeesNeedingTimestamps.length > 0) {
        const { data: stamps } = await supabase
          .from("time_stamps")
          .select("employee_id, clock_in, clock_out, break_minutes, client_id")
          .in("employee_id", employeesNeedingTimestamps)
          .gte("clock_in", startStr)
          .lte("clock_in", endStr + "T23:59:59");
        // Map timestamps with computed date field for matching
        timeStampsData = (stamps || []).map(ts => ({
          ...ts,
          date: ts.clock_in ? format(parseISO(ts.clock_in), 'yyyy-MM-dd') : null
        }));
      }

      // Build list of all possible agent identifiers for fetching sales
      const allAgentIdentifiers: string[] = [];
      agentMappings?.forEach(m => {
        const agent = m.agents as any;
        if (agent?.email) allAgentIdentifiers.push(agent.email);
        if (agent?.external_dialer_id) allAgentIdentifiers.push(agent.external_dialer_id);
      });
      const uniqueAgentIdentifiers = [...new Set(allAgentIdentifiers)];
      
      console.log("[DailyReport] Agent mappings found:", agentMappings?.length);
      console.log("[DailyReport] Unique agent identifiers:", uniqueAgentIdentifiers);

      // Fetch sales with sale_items - same logic as KPI sales-count
      // Sales are linked to clients via client_campaign_id -> client_campaigns.client_id
      // Match on agent_email (contains email) rather than agent_name (contains full name)
      // Also fetch dialer_campaign_id for campaign override lookup
      let salesData: any[] = [];
      if (uniqueAgentIdentifiers.length > 0) {
        // Get emails only from unique identifiers (filter out numeric external IDs)
        // Normalize to lowercase for case-insensitive matching
        const emailIdentifiers = uniqueAgentIdentifiers
          .filter(id => id.includes("@"))
          .map(e => e.toLowerCase());
        
        if (emailIdentifiers.length > 0) {
          // Use fetchAllRows with dynamic !inner join for client filtering (paginated)
          const joinType = selectedClients.length > 0 ? "!inner" : "";
          const selectClause = `id,agent_name,agent_email,sale_datetime,client_campaign_id,dialer_campaign_id,client_campaigns${joinType}(client_id),sale_items(quantity,mapped_commission,mapped_revenue,product_id,products(name,counts_as_sale))`;

          const emailOrFilter = emailIdentifiers.map(e => `agent_email.ilike.${e}`).join(",");

          try {
            salesData = await fetchAllRows(
              "sales", selectClause,
              (q) => {
                let query = q
                   .or(emailOrFilter)
                   .neq("source", "fieldmarketing")
                   .gte("sale_datetime", `${startStr}T00:00:00`)
                  .lte("sale_datetime", `${endStr}T23:59:59`);
                if (selectedClients.length > 0) {
                  query = query.in("client_campaigns.client_id", selectedClients);
                }
                return query;
              }
            );
          } catch (err) {
            console.error("[DailyReport] Sales fetch failed:", err);
            salesData = [];
          }
          console.log("[DailyReport] Sales fetched:", salesData.length);
        }
      }
      
      // Fetch campaign mappings to resolve dialer_campaign_id -> campaign_mapping_id
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id, adversus_campaign_name");
      
      const dialerCampaignToMappingId = new Map<string, string>();
      const dialerCampaignToName = new Map<string, string>();
      campaignMappings?.forEach(m => {
        if (m.adversus_campaign_id) {
          dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
          if (m.adversus_campaign_name) {
            dialerCampaignToName.set(m.adversus_campaign_id, m.adversus_campaign_name);
          }
        }
      });
      
      // Fetch product pricing rules (replaces product_campaign_overrides)
      const { data: productPricingRules } = await supabase
        .from("product_pricing_rules")
        .select("product_id, campaign_mapping_ids, campaign_match_mode, commission_dkk, revenue_dkk, priority, is_active")
        .eq("is_active", true);
      
      // Build a map for pricing rules lookup
      const pricingRulesMap = new Map<string, Array<{ 
        campaign_mapping_ids: string[] | null; 
        campaign_match_mode: "include" | "exclude";
        commission: number; 
        revenue: number; 
        priority: number;
      }>>();
      
      productPricingRules?.forEach(rule => {
        if (!rule.product_id) return;
        const existing = pricingRulesMap.get(rule.product_id) || [];
        existing.push({
          campaign_mapping_ids: rule.campaign_mapping_ids,
          campaign_match_mode: (rule.campaign_match_mode === "exclude" ? "exclude" : "include"),
          commission: rule.commission_dkk ?? 0,
          revenue: rule.revenue_dkk ?? 0,
          priority: rule.priority ?? 0,
        });
        existing.sort((a, b) => b.priority - a.priority);
        pricingRulesMap.set(rule.product_id, existing);
      });
      
      // Helper function to find best matching rule
      const findMatchingRule = (productId: string, campaignMappingId: string | null) => {
        const rules = pricingRulesMap.get(productId);
        if (!rules || rules.length === 0) return null;
        
        for (const rule of rules) {
          const ids = rule.campaign_mapping_ids;
          if (!ids || ids.length === 0) return rule;
          if (rule.campaign_match_mode === "exclude") {
            if (!campaignMappingId || !ids.includes(campaignMappingId)) return rule;
          } else {
            if (campaignMappingId && ids.includes(campaignMappingId)) return rule;
          }
        }
        return rules.find(r => !r.campaign_mapping_ids || r.campaign_mapping_ids.length === 0) || null;
      };
      
      // Build a map: product_id + campaign_mapping_id -> { commission, revenue } for backward compatibility
      // Only populated for include-mode rules with explicit campaigns.
      const campaignOverrideMap = new Map<string, { commission: number; revenue: number }>();
      productPricingRules?.forEach(o => {
        if (!o.product_id) return;
        const mode = o.campaign_match_mode === "exclude" ? "exclude" : "include";
        if (mode === "include" && o.campaign_mapping_ids && o.campaign_mapping_ids.length > 0) {
          o.campaign_mapping_ids.forEach(campId => {
            const key = `${o.product_id}_${campId}`;
            if (!campaignOverrideMap.has(key)) {
              campaignOverrideMap.set(key, {
                commission: o.commission_dkk ?? 0,
                revenue: o.revenue_dkk ?? 0
              });
            }
          });
        }
      });

      // Fetch fieldmarketing sales from unified sales table (linked directly to employee via raw_payload->>'fm_seller_id')
      const rawFmSalesData = await fetchAllRows<{
        id: string; agent_name: string; sale_datetime: string;
        raw_payload: any; client_campaign_id: string | null;
      }>(
        "sales",
        "id, agent_name, sale_datetime, raw_payload, client_campaign_id",
        (q) => q.eq("source", "fieldmarketing")
          .gte("sale_datetime", `${startStr}T00:00:00`)
          .lte("sale_datetime", `${endStr}T23:59:59`),
        { orderBy: "sale_datetime", ascending: false }
      );
      
      // Filter by employeeIds using raw_payload fm_seller_id
      const fmSalesData = (rawFmSalesData || []).filter(sale => {
        const sellerId = (sale.raw_payload as any)?.fm_seller_id;
        return sellerId && employeeIds.includes(sellerId);
      }).filter(sale => {
        // Filter by clients if selected
        if (selectedClients.length > 0) {
          const clientId = (sale.raw_payload as any)?.fm_client_id;
          return clientId && selectedClients.includes(clientId);
        }
        return true;
      });
      
      console.log("[DailyReport] FM Sales fetched:", fmSalesData?.length);
      
      // Fetch products with campaign overrides for FM commission and revenue lookup
      // First get all products
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk");
      
      // Use pricing rules for FM products as well
      const overrideByProductId = new Map<string, { commission: number; revenue: number }>();
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
      
      // Build commission and revenue maps: prefer pricing rule, fallback to base values
      const productCommissionMap = new Map<string, number>();
      const productRevenueMap = new Map<string, number>();
      
      allProducts?.forEach(p => {
        if (p.name) {
          const override = overrideByProductId.get(p.id);
          const commission = override?.commission ?? p.commission_dkk ?? 0;
          const revenue = override?.revenue ?? p.revenue_dkk ?? 0;
          productCommissionMap.set(p.name.toLowerCase(), commission);
          productRevenueMap.set(p.name.toLowerCase(), revenue);
        }
      });

      // Build report data - aggregate per employee with daily breakdown
      const report: EmployeeReportData[] = [];
      const daysInRange = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

      for (const emp of filteredEmployees) {
        const empId = emp.id;
        const teamName = emp.team_members?.[0]?.team?.name || null;
        
        const empTeamMembership = teamMembers?.find(tm => tm.employee_id === empId);
        const empPrimaryShift = empTeamMembership 
          ? (primaryShifts?.find(ps => ps.team_id === empTeamMembership.team_id && ps.hours_source === 'shift')
             || primaryShifts?.find(ps => ps.team_id === empTeamMembership.team_id))
          : null;
        const empShiftDays = empPrimaryShift 
          ? shiftDays?.filter(sd => sd.shift_id === empPrimaryShift.id) || []
          : [];
        // Use new resolver if available, otherwise legacy
        const hoursSource = hoursSourceMap
          ? (hoursSourceMap[empId]?.source || 'shift')
          : (empPrimaryShift?.hours_source || 'shift');

        // Get all agent identifiers for this employee
        const empAgentMappings = agentMappings?.filter(m => m.employee_id === empId) || [];
        const empAgentIdentifiers: string[] = [];
        empAgentMappings.forEach(m => {
          const agent = m.agents as any;
          if (agent?.email) empAgentIdentifiers.push(agent.email);
          if (agent?.external_dialer_id) empAgentIdentifiers.push(agent.external_dialer_id);
        });

        const dailyEntries: DailyEntry[] = [];
        let totalHours = 0;
        let sickDays = 0;
        let vacationDays = 0;
        let totalSales = 0;
        let totalRevenue = 0;
        let totalCommission = 0;

        for (const day of daysInRange) {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayOfWeek = getDay(day);
          const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          
          const shiftForDay = empShiftDays.find(sd => sd.day_of_week === adjustedDayOfWeek);
          
          // Calculate hours based on hours_source setting
          let hours = 0;
          let missingShift = false;
          
          if (hoursSource === 'timestamp') {
            // Use actual timestamp data
            const empTimestamp = timeStampsData.find(ts => ts.employee_id === empId && ts.date === dayStr);
            if (empTimestamp?.clock_in && empTimestamp?.clock_out) {
              const [inH, inM] = empTimestamp.clock_in.split(':').map(Number);
              const [outH, outM] = empTimestamp.clock_out.split(':').map(Number);
              const rawHours = (outH + outM / 60) - (inH + inM / 60);
              const breakMins = empTimestamp.break_minutes || 0;
              hours = Math.max(0, rawHours - (breakMins / 60));
            } else {
              // No timestamp - mark as missing shift
              missingShift = true;
            }
          } else {
            // Use planned shift times (original logic)
            if (!shiftForDay || !shiftForDay.start_time || !shiftForDay.end_time) {
              // No shift for this day - mark as missing but don't skip yet
              missingShift = true;
              hours = 0;
            } else {
              const [startH, startM] = shiftForDay.start_time.split(':').map(Number);
              const [endH, endM] = shiftForDay.end_time.split(':').map(Number);
              const rawHours = (endH + endM / 60) - (startH + startM / 60);
              // Use central break constants
              const breakMinutes = (rawHours * 60) > BREAK_THRESHOLD_MINUTES ? BREAK_DURATION_MINUTES : 0;
              hours = rawHours - (breakMinutes / 60);
            }
          }

          const empAbsences = absences?.filter(a => 
            a.employee_id === empId && 
            a.start_date <= dayStr && 
            a.end_date >= dayStr
          ) || [];
          const isSick = empAbsences.some(a => a.type === "sick");
          const isVacation = empAbsences.some(a => a.type === "vacation");

          const dayStart = `${dayStr}T00:00:00`;
          const dayEnd = `${dayStr}T23:59:59`;
          
          // Regular sales via agent mapping - match by agent_email (case-insensitive)
          const empAgentIdentifiersLower = empAgentIdentifiers.map(id => id.toLowerCase());
          const empSales = empAgentIdentifiersLower.length > 0
            ? salesData.filter((s: any) => {
                const saleDate = s.sale_datetime;
                const saleEmail = (s.agent_email || "").toLowerCase();
                return empAgentIdentifiersLower.includes(saleEmail) && saleDate >= dayStart && saleDate <= dayEnd;
              })
            : [];

          // Fieldmarketing sales via raw_payload->>'fm_seller_id' (now uses sale_datetime)
          const empFmSales = (fmSalesData || []).filter((s: any) => {
            const saleDate = s.sale_datetime;
            const sellerId = (s.raw_payload as any)?.fm_seller_id;
            return sellerId === empId && saleDate >= dayStart && saleDate <= dayEnd;
          });

          // Count regular sales using sale_items with counts_as_sale (same as KPI)
          let salesCount = 0;
          let revenue = 0;
          let commission = 0;
          const dayClientIds = new Set<string>();
          const dayProductMap = new Map<string, { quantity: number; commission: number; revenue: number }>();
          
          empSales.forEach((sale: any) => {
            // Collect client_id from this sale
            const clientId = sale.client_campaigns?.client_id;
            if (clientId) {
              dayClientIds.add(clientId);
            }
            
            // Get campaign mapping id for this sale's dialer campaign
            const dialerCampaignId = sale.dialer_campaign_id;
            const campaignMappingId = dialerCampaignId ? dialerCampaignToMappingId.get(dialerCampaignId) : null;
            const campaignName = dialerCampaignId ? (dialerCampaignToName.get(dialerCampaignId) || "Ukendt kampagne") : "Ukendt kampagne";
            
            (sale.sale_items || []).forEach((item: any) => {
              const countsAsSale = item.products?.counts_as_sale !== false;
              const qty = Number(item.quantity) || 1;
              if (countsAsSale) {
                salesCount += qty;
              }
              
              // Use pre-calculated mapped values from sale_items
              const itemRevenue = Number(item.mapped_revenue) || 0;
              const itemCommission = Number(item.mapped_commission) || 0;
              revenue += itemRevenue;
              commission += itemCommission;
              
              // Aggregate by product name + campaign name
              const productName = item.products?.name || "Ukendt produkt";
              const productKey = `${productName}|||${campaignName}`;
              const existing = dayProductMap.get(productKey);
              if (existing) {
                existing.quantity += qty;
                existing.commission += itemCommission;
                existing.revenue += itemRevenue;
              } else {
                dayProductMap.set(productKey, { quantity: qty, commission: itemCommission, revenue: itemRevenue });
              }
            });
          });

          // Add fieldmarketing sales - match commission and revenue by product_name from raw_payload
          empFmSales.forEach((sale: any) => {
            salesCount += 1;
            const rawPayload = sale.raw_payload as any;
            const productName = (rawPayload?.fm_product_name || "").toLowerCase();
            const fmCommission = productCommissionMap.get(productName) || 0;
            const fmRevenue = productRevenueMap.get(productName) || 0;
            commission += fmCommission;
            revenue += fmRevenue;
            // FM sales have client_id in raw_payload
            const clientId = rawPayload?.fm_client_id;
            if (clientId) {
              dayClientIds.add(clientId);
            }
            // Aggregate FM product with "Fieldmarketing" as campaign
            const displayName = rawPayload?.fm_product_name || "Ukendt FM-produkt";
            const productKey = `${displayName}|||Fieldmarketing`;
            const existing = dayProductMap.get(productKey);
            if (existing) {
              existing.quantity += 1;
              existing.commission += fmCommission;
              existing.revenue += fmRevenue;
            } else {
              dayProductMap.set(productKey, { quantity: 1, commission: fmCommission, revenue: fmRevenue });
            }
          });

          // Build product details sorted by quantity desc
          const dayProductDetails: ProductSaleDetail[] = Array.from(dayProductMap.entries())
            .map(([key, data]) => {
              const [pName, cName] = key.split("|||");
              return { product_name: pName, campaign_name: cName, quantity: data.quantity, commission: Math.round(data.commission), revenue: Math.round(data.revenue) };
            })
            .sort((a, b) => b.quantity - a.quantity);

          // Map client IDs to names
          const dayClientNames = Array.from(dayClientIds)
            .map(cid => clients.find((c: any) => c.id === cid)?.name)
            .filter(Boolean) as string[];

          // Skip days with no activity at all (no hours, no sales, not sick, not vacation)
          if (hours === 0 && salesCount === 0 && !isSick && !isVacation) {
            continue;
          }

          dailyEntries.push({
            date: dayStr,
            hours: Math.round(hours * 100) / 100,
            is_sick: isSick,
            is_vacation: isVacation,
            sales_count: salesCount,
            revenue: Math.round(revenue),
            commission: Math.round(commission),
            clients: dayClientNames,
            missing_shift: missingShift && salesCount > 0,
            product_details: dayProductDetails,
          });

          totalHours += hours;
          if (isSick) sickDays++;
          if (isVacation) vacationDays++;
          totalSales += salesCount;
          totalRevenue += revenue;
          totalCommission += commission;
        }

        if (dailyEntries.length > 0) {
          // Collect all unique client names from all daily entries
          const allClientNames = new Set<string>();
          dailyEntries.forEach(entry => entry.clients.forEach(c => allClientNames.add(c)));
          
          // Check if any day has missing shift with sales
          const hasMissingShifts = dailyEntries.some(entry => entry.missing_shift);
          
          // Aggregate product details across all days for employee-level summary
          const empProductMap = new Map<string, { quantity: number; commission: number; revenue: number }>();
          dailyEntries.forEach(entry => {
            entry.product_details.forEach(pd => {
              const empKey = `${pd.product_name}|||${pd.campaign_name}`;
              const existing = empProductMap.get(empKey);
              if (existing) {
                existing.quantity += pd.quantity;
                existing.commission += pd.commission;
                existing.revenue += pd.revenue;
              } else {
                empProductMap.set(empKey, { quantity: pd.quantity, commission: pd.commission, revenue: pd.revenue });
              }
            });
          });
          const empProductDetails: ProductSaleDetail[] = Array.from(empProductMap.entries())
            .map(([key, data]) => {
              const [pName, cName] = key.split("|||");
              return { product_name: pName, campaign_name: cName, ...data };
            })
            .sort((a, b) => b.quantity - a.quantity);
          
          report.push({
            employee_id: empId,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            team_name: teamName,
            total_hours: Math.round(totalHours * 100) / 100,
            sick_days: sickDays,
            vacation_days: vacationDays,
            total_sales: totalSales,
            total_revenue: Math.round(totalRevenue),
            total_commission: Math.round(totalCommission),
            clients: Array.from(allClientNames),
            daily_entries: dailyEntries.sort((a, b) => b.date.localeCompare(a.date)),
            has_missing_shifts: hasMissingShifts,
            product_details: empProductDetails,
          });
        }
      }

      return report.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    },
    enabled: hasSearched,
  });

  const handleSearch = () => {
    setHasSearched(true);
    setExpandedEmployees(new Set());
    fetchReport();
    toast.success("Dagsrapport genereres...");
    setFilterOpen(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedTeam !== "all") count++;
    if (selectedEmployee !== "all") count++;
    if (selectedClient !== "all") count++;
    if (selectedCampaign !== "all") count++;
    if (employeeStatusFilter !== "active") count++;
    return count;
  };

  const periodOptions = [
    { value: "today", label: "I dag" },
    { value: "yesterday", label: "I går" },
    { value: "this_week", label: "Denne uge" },
    { value: "last_week", label: "Sidste uge" },
    { value: "this_month", label: "Denne måned" },
    { value: "custom", label: "Brugerdefineret" },
  ];

  const totals = useMemo(() => {
    return reportData.reduce(
      (acc, row) => ({
        hours: acc.hours + row.total_hours,
        sales: acc.sales + row.total_sales,
        revenue: acc.revenue + row.total_revenue,
        commission: acc.commission + row.total_commission,
      }),
      { hours: 0, sales: 0, revenue: 0, commission: 0 }
    );
  }, [reportData]);

  const sortedReportData = useMemo(() => {
    if (!sortColumn) return reportData;
    
    return [...reportData].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortColumn) {
        case "employee":
          aVal = a.employee_name.toLowerCase();
          bVal = b.employee_name.toLowerCase();
          break;
        case "team":
          aVal = (a.team_name || "").toLowerCase();
          bVal = (b.team_name || "").toLowerCase();
          break;
        case "hours":
          aVal = a.total_hours;
          bVal = b.total_hours;
          break;
        case "sales":
          aVal = a.total_sales;
          bVal = b.total_sales;
          break;
        case "commission":
          aVal = a.total_commission;
          bVal = b.total_commission;
          break;
        case "revenue":
          aVal = a.total_revenue;
          bVal = b.total_revenue;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal, "da") 
          : bVal.localeCompare(aVal, "da");
      }
      
      return sortDirection === "asc" 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    });
  }, [reportData, sortColumn, sortDirection]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dagsrapporter</h1>
            <p className="text-muted-foreground">
              Dagssedler for medarbejdere med vagtregistrering
            </p>
          </div>
          
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10">
                <Search className="h-5 w-5" />
                {getActiveFilterCount() > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="right" 
              className="w-[340px] p-0 border-0 bg-gradient-to-b from-emerald-600 via-teal-600 to-cyan-700"
            >
              <div className="flex flex-col h-full p-6">
                <SheetHeader className="mb-6">
                  <SheetTitle className="text-white text-lg">Filtre</SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 space-y-4 overflow-y-auto">
                  {/* Periode */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Periode</label>
                    <Select value={period} onValueChange={setPeriod}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom date range */}
                  {period === "custom" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/70 font-medium">Fra dato</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                                !customStartDate && "text-white/50"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customStartDate ? format(customStartDate, "d. MMM yyyy", { locale: da }) : "Vælg startdato"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={customStartDate}
                              onSelect={setCustomStartDate}
                              initialFocus
                              className="p-3 pointer-events-auto"
                              locale={da}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/70 font-medium">Til dato</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                                !customEndDate && "text-white/50"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customEndDate ? format(customEndDate, "d. MMM yyyy", { locale: da }) : "Vælg slutdato"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={customEndDate}
                              onSelect={setCustomEndDate}
                              initialFocus
                              className="p-3 pointer-events-auto"
                              locale={da}
                              disabled={(date) => customStartDate ? date < customStartDate : false}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {/* Teams */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Teams</label>
                    <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); setSelectedEmployee("all"); }}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue placeholder="Alle" />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {scopeReportsDaily === "alt" && (
                          <SelectItem value="all">Alle</SelectItem>
                        )}
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Medarbejder status */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Medarbejder status</label>
                    <Select value={employeeStatusFilter} onValueChange={(v) => setEmployeeStatusFilter(v as "active" | "inactive" | "all")}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktive</SelectItem>
                        <SelectItem value="inactive">Inaktive</SelectItem>
                        <SelectItem value="all">Alle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Medarbejdere */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Medarbejdere</label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue placeholder="Alle" />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {filteredEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kunder */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Kunder</label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue placeholder="Alle" />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kampagner */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/70 font-medium">Kampagner</label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue placeholder="Alle" />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <div className="pt-6 border-t border-white/20">
                  <Button 
                    onClick={handleSearch}
                    className="w-full bg-white text-emerald-700 hover:bg-white/90 font-semibold"
                  >
                    SØG
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Report Content Area */}
        <Card className="min-h-[500px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Dagssedler
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {periodOptions.find(p => p.value === period)?.label || "I dag"}
              {" • "}
              {format(dateRange.start, "d. MMM", { locale: da })}
              {isMultipleDays && ` - ${format(dateRange.end, "d. MMM", { locale: da })}`}
              {selectedTeam !== "all" && ` • ${teams.find(t => t.id === selectedTeam)?.name}`}
              {selectedEmployee !== "all" && ` • ${employees.find(e => e.id === selectedEmployee)?.first_name} ${employees.find(e => e.id === selectedEmployee)?.last_name}`}
            </p>
          </CardHeader>
          <CardContent>
            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center text-muted-foreground">
                <CalendarIcon className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Klik på søgeikonet for at filtrere</p>
                <p className="text-sm mt-1">
                  Vælg filtre og klik "SØG" for at generere dagssedler
                </p>
              </div>
            ) : isLoadingReport ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
                <p>Henter data...</p>
              </div>
            ) : reportData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center text-muted-foreground">
                <CalendarIcon className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Ingen registreringer fundet</p>
                <p className="text-sm mt-1">
                  Der er ingen medarbejdere med vagtregistrering i den valgte periode
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isMultipleDays && <TableHead className="w-8"></TableHead>}
                      {!isMultipleDays && <TableHead>Dato</TableHead>}
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("employee")}
                      >
                        <div className="flex items-center">
                          Medarbejder
                          <SortIcon column="employee" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("team")}
                      >
                        <div className="flex items-center">
                          Team
                          <SortIcon column="team" />
                        </div>
                      </TableHead>
                      {selectedColumns.includes("hours") && (
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("hours")}
                        >
                          <div className="flex items-center justify-end">
                            Timer
                            <SortIcon column="hours" />
                          </div>
                        </TableHead>
                      )}
                      {selectedColumns.includes("sick_days") && <TableHead className="text-center">Sygdom</TableHead>}
                      {selectedColumns.includes("vacation_days") && <TableHead className="text-center">Ferie</TableHead>}
                      {selectedColumns.includes("sales") && (
                        <TableHead 
                          className="text-right text-foreground cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("sales")}
                        >
                          <div className="flex items-center justify-end">
                            Salg
                            <SortIcon column="sales" />
                          </div>
                        </TableHead>
                      )}
                      {selectedColumns.includes("clients") && <TableHead className="text-foreground">Kunder</TableHead>}
                      {selectedColumns.includes("commission") && (
                        <TableHead 
                          className="text-right text-foreground cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("commission")}
                        >
                          <div className="flex items-center justify-end">
                            Provision
                            <SortIcon column="commission" />
                          </div>
                        </TableHead>
                      )}
                      {selectedColumns.includes("revenue") && (
                        <TableHead 
                          className="text-right text-foreground cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("revenue")}
                        >
                          <div className="flex items-center justify-end">
                            Omsætning
                            <SortIcon column="revenue" />
                          </div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReportData.map((row) => {
                      const isExpanded = expandedEmployees.has(row.employee_id);
                      const productDetails = isMultipleDays ? row.product_details : (row.daily_entries[0]?.product_details || []);
                      const colCount = 2 + (isMultipleDays ? 1 : 1) + selectedColumns.length;
                      
                      return (
                      <>
                        {/* Main row - aggregated or single day */}
                        <TableRow 
                          key={row.employee_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleEmployeeExpanded(row.employee_id)}
                        >
                          {isMultipleDays && (
                            <TableCell className="w-8 p-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          )}
                          {!isMultipleDays && (
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                {format(parseISO(row.daily_entries[0]?.date || format(dateRange.start, "yyyy-MM-dd")), "d. MMM", { locale: da })}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {row.employee_name}
                              {row.has_missing_shifts && (
                                <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500 text-xs">
                                  <AlertTriangle className="h-3 w-3" />
                                  Vagt mangler
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.team_name || "-"}</TableCell>
                          {selectedColumns.includes("hours") && (
                            <TableCell className="text-right font-medium">
                              {row.total_hours > 0 ? `${row.total_hours.toFixed(1)}t` : "-"}
                            </TableCell>
                          )}
                          {selectedColumns.includes("sick_days") && (
                            <TableCell className="text-center">
                              {row.sick_days > 0 ? (
                                <Badge variant="destructive" className="gap-1">
                                  <Thermometer className="h-3 w-3" />
                                  {row.sick_days} {row.sick_days === 1 ? "dag" : "dage"}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                          )}
                          {selectedColumns.includes("vacation_days") && (
                            <TableCell className="text-center">
                              {row.vacation_days > 0 ? (
                                <Badge className="gap-1 bg-amber-500 hover:bg-amber-600">
                                  <Palmtree className="h-3 w-3" />
                                  {row.vacation_days} {row.vacation_days === 1 ? "dag" : "dage"}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                          )}
                          {selectedColumns.includes("sales") && (
                            <TableCell className="text-right text-foreground">
                              <span className={row.total_sales > 0 ? "font-medium" : ""}>
                                {row.total_sales}
                              </span>
                            </TableCell>
                          )}
                          {selectedColumns.includes("clients") && (
                            <TableCell className="text-foreground">
                              {row.clients.length > 0 ? row.clients.join(", ") : "-"}
                            </TableCell>
                          )}
                          {selectedColumns.includes("commission") && (
                            <TableCell className="text-right text-foreground">
                              <span className={row.total_commission > 0 ? "font-medium" : ""}>
                                {row.total_commission.toLocaleString("da-DK")} kr.
                              </span>
                            </TableCell>
                          )}
                          {selectedColumns.includes("revenue") && (
                            <TableCell className="text-right text-foreground">
                              <span className={row.total_revenue > 0 ? "font-medium" : ""}>
                                {row.total_revenue.toLocaleString("da-DK")} kr.
                              </span>
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Product breakdown row */}
                        {isExpanded && productDetails.length > 0 && (
                          <TableRow key={`${row.employee_id}-products`} className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={colCount} className="p-0">
                              <div className="pl-10 pr-4 py-3">
                                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  <Package className="h-3.5 w-3.5" />
                                  Produktopdeling
                                </div>
                                <div className="rounded-md border border-border/50 overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30">
                                        <TableHead className="text-xs py-2">Produkt</TableHead>
                                        <TableHead className="text-xs py-2">Kampagne</TableHead>
                                        <TableHead className="text-xs py-2 text-right">Antal</TableHead>
                                        <TableHead className="text-xs py-2 text-right">Provision</TableHead>
                                        <TableHead className="text-xs py-2 text-right">Omsætning</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {productDetails.map((pd) => (
                                        <TableRow key={`${pd.product_name}-${pd.campaign_name}`} className="border-border/30">
                                          <TableCell className="py-1.5 text-sm">{pd.product_name}</TableCell>
                                          <TableCell className="py-1.5 text-sm text-muted-foreground">{pd.campaign_name}</TableCell>
                                          <TableCell className="py-1.5 text-sm text-right">{pd.quantity}</TableCell>
                                          <TableCell className="py-1.5 text-sm text-right">{pd.commission.toLocaleString("da-DK")} kr.</TableCell>
                                          <TableCell className="py-1.5 text-sm text-right">{pd.revenue.toLocaleString("da-DK")} kr.</TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow className="bg-muted/20 font-medium border-t">
                                        <TableCell className="py-1.5 text-sm">Total</TableCell>
                                        <TableCell className="py-1.5 text-sm"></TableCell>
                                        <TableCell className="py-1.5 text-sm text-right">
                                          {productDetails.reduce((s, p) => s + p.quantity, 0)}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-sm text-right">
                                          {productDetails.reduce((s, p) => s + p.commission, 0).toLocaleString("da-DK")} kr.
                                        </TableCell>
                                        <TableCell className="py-1.5 text-sm text-right">
                                          {productDetails.reduce((s, p) => s + p.revenue, 0).toLocaleString("da-DK")} kr.
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Expanded daily details */}
                        {isMultipleDays && isExpanded && row.daily_entries.map((entry) => (
                          <TableRow key={`${row.employee_id}-${entry.date}`} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="text-muted-foreground pl-6">
                              <div className="flex items-center gap-2">
                                {format(parseISO(entry.date), "EEEE d. MMM", { locale: da })}
                                {entry.missing_shift && (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    Vagt mangler
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            {selectedColumns.includes("hours") && (
                              <TableCell className="text-right text-muted-foreground">
                                {entry.hours > 0 ? `${entry.hours.toFixed(1)}t` : "-"}
                              </TableCell>
                            )}
                            {selectedColumns.includes("sick_days") && (
                              <TableCell className="text-center">
                                {entry.is_sick ? (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <Thermometer className="h-3 w-3" />
                                    Syg
                                  </Badge>
                                ) : "-"}
                              </TableCell>
                            )}
                            {selectedColumns.includes("vacation_days") && (
                              <TableCell className="text-center">
                                {entry.is_vacation ? (
                                  <Badge className="gap-1 bg-amber-500 hover:bg-amber-600 text-xs">
                                    <Palmtree className="h-3 w-3" />
                                    Ferie
                                  </Badge>
                                ) : "-"}
                              </TableCell>
                            )}
                            {selectedColumns.includes("sales") && (
                              <TableCell className="text-right text-foreground/70">
                                {entry.sales_count}
                              </TableCell>
                            )}
                            {selectedColumns.includes("clients") && (
                              <TableCell className="text-foreground/70">
                                {entry.clients.length > 0 ? entry.clients.join(", ") : "-"}
                              </TableCell>
                            )}
                            {selectedColumns.includes("commission") && (
                              <TableCell className="text-right text-foreground/70">
                                {entry.commission.toLocaleString("da-DK")} kr.
                              </TableCell>
                            )}
                            {selectedColumns.includes("revenue") && (
                              <TableCell className="text-right text-foreground/70">
                                {entry.revenue.toLocaleString("da-DK")} kr.
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Summary row */}
                <div className="border-t bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total ({reportData.length} medarbejdere)</span>
                    <div className="flex items-center gap-6 text-sm">
                      {selectedColumns.includes("hours") && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{totals.hours.toFixed(1)}t</span>
                        </span>
                      )}
                      {selectedColumns.includes("sales") && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-foreground" />
                          <span className="font-medium text-foreground">{totals.sales} salg</span>
                        </span>
                      )}
                      {selectedColumns.includes("commission") && (
                        <span className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-foreground" />
                          <span className="font-medium text-foreground">{totals.commission.toLocaleString("da-DK")} kr.</span>
                        </span>
                      )}
                      {selectedColumns.includes("revenue") && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-foreground" />
                          <span className="font-medium text-foreground">{totals.revenue.toLocaleString("da-DK")} kr.</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
