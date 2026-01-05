import { useState, useMemo } from "react";
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
import { Search, ChevronDown, ChevronRight, Calendar as CalendarIcon, Clock, Palmtree, Thermometer, TrendingUp, Coins, SlidersHorizontal, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Helper function to fetch employees with activity on a specific client
// Uses agent_name (email) from sales, matches to agents, then maps to employees via employee_agent_mapping
async function fetchEmployeesWithClientActivity(clientId: string): Promise<string[]> {
  if (clientId === "all") return [];
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  // Get user's auth token for RLS-protected tables
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseKey;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}` };
  
  // Get unique agent_names (emails) from sales for this client
  const salesRes = await fetch(
    `${supabaseUrl}/rest/v1/sales?select=agent_name&client_id=eq.${clientId}`,
    { headers }
  );
  const salesData: { agent_name: string }[] = await salesRes.json();
  const agentEmails = [...new Set(salesData.map(s => s.agent_name).filter(Boolean))];
  
  // Get FM seller IDs for this client  
  const fmRes = await fetch(
    `${supabaseUrl}/rest/v1/fieldmarketing_sales?select=seller_id&client_id=eq.${clientId}`,
    { headers }
  );
  const fmData: { seller_id: string }[] = await fmRes.json();
  
  // Get all agent mappings with agent email info
  const mappingsRes = await fetch(
    `${supabaseUrl}/rest/v1/employee_agent_mapping?select=employee_id,agents(email)`,
    { headers }
  );
  const mappingsData: { employee_id: string; agents: { email: string } | null }[] = await mappingsRes.json();
  
  // Find employee_ids where agent email matches sales agent_name
  const employeeIdsFromSales = mappingsData
    .filter(m => m.agents?.email && agentEmails.includes(m.agents.email))
    .map(m => m.employee_id);
  
  const fmEmployeeIds = fmData.map(s => s.seller_id);
  return [...new Set([...employeeIdsFromSales, ...fmEmployeeIds])];
}

const reportColumnOptions = [
  { id: "hours", label: "Timer", icon: Clock },
  { id: "sick_days", label: "Sygdom", icon: Thermometer },
  { id: "vacation_days", label: "Ferie", icon: Palmtree },
  { id: "sales", label: "Salg", icon: TrendingUp },
  { id: "commission", label: "Provision", icon: Coins },
  { id: "revenue", label: "Omsætning", icon: DollarSign },
];

interface DailyEntry {
  date: string;
  hours: number;
  is_sick: boolean;
  is_vacation: boolean;
  sales_count: number;
  revenue: number;
  commission: number;
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
  daily_entries: DailyEntry[];
}

export default function DailyReports() {
  const [period, setPeriod] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["hours", "sick_days", "vacation_days", "sales", "commission", "revenue"]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

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

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["daily-report-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["daily-report-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
  });

  const { data: employeesWithClientActivity = [] } = useQuery({
    queryKey: ["daily-report-employees-with-client-activity", selectedClient],
    queryFn: () => fetchEmployeesWithClientActivity(selectedClient),
    enabled: selectedClient !== "all",
  });

  // Filter employees based on selected client activity
  const filteredEmployees = useMemo(() => {
    if (selectedClient === "all") {
      return employees;
    }
    return employees.filter(emp => employeesWithClientActivity.includes(emp.id));
  }, [employees, selectedClient, employeesWithClientActivity]);

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
    queryKey: ["daily-report-data", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd"), selectedTeam, selectedEmployee, selectedClient],
    queryFn: async () => {
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Get user's auth token for RLS-protected tables like sales
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseKey;
      let employeeIds: string[] = [];
      let filteredEmployees: any[] = [];
      let agentMappings: any[] = [];

      // When a specific client is selected, find employees who have sales for that client
      // This handles employees without team assignments
      if (selectedClient !== "all") {
        // First, fetch all sales for this client in the date range to get agent emails
        const salesForClientUrl = `${supabaseUrl}/rest/v1/sales?select=agent_email,client_campaigns!inner(client_id)&client_campaigns.client_id=eq.${selectedClient}&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
        const salesForClientRes = await fetch(salesForClientUrl, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${authToken}` }
        });
        const salesForClient = await salesForClientRes.json();
        
        // Get unique agent emails from these sales
        const agentEmails = [...new Set(
          (salesForClient || [])
            .map((s: any) => s.agent_email?.toLowerCase())
            .filter(Boolean)
        )] as string[];
        
        console.log("[DailyReport] Client sales agent emails:", agentEmails);
        
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
          
          // Fetch employee details for these IDs
          if (employeeIds.length > 0) {
            const { data: empData } = await supabase
              .from("employee_master_data")
              .select(`id, first_name, last_name, team_members(team:teams(id, name))`)
              .in("id", employeeIds)
              .eq("is_active", true);
            
            filteredEmployees = empData || [];
          }
        }
        
        console.log("[DailyReport] Employees found for client:", filteredEmployees.length);
      } else {
        // Original logic: fetch all active employees and filter by team
        let employeeQuery = supabase
          .from("employee_master_data")
          .select(`
            id,
            first_name,
            last_name,
            team_members(team:teams(id, name))
          `)
          .eq("is_active", true);

        if (selectedEmployee !== "all") {
          employeeQuery = employeeQuery.eq("id", selectedEmployee);
        }

        const { data: employeesData, error: empError } = await employeeQuery;
        if (empError) throw empError;

        filteredEmployees = employeesData || [];
        if (selectedTeam !== "all") {
          filteredEmployees = filteredEmployees.filter(emp => 
            emp.team_members?.some((tm: any) => tm.team?.id === selectedTeam)
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

      // Fetch team standard shift data
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id, team_id")
        .in("employee_id", employeeIds);

      const teamIds = [...new Set(teamMembers?.map(tm => tm.team_id) || [])];
      
      const { data: primaryShifts } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, start_time, end_time")
        .in("team_id", teamIds)
        .eq("is_primary", true);

      const { data: shiftDays } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", primaryShifts?.map(s => s.id) || []);

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
      let salesData: any[] = [];
      if (uniqueAgentIdentifiers.length > 0) {
        // Get emails only from unique identifiers (filter out numeric external IDs)
        // Normalize to lowercase for case-insensitive matching
        const emailIdentifiers = uniqueAgentIdentifiers
          .filter(id => id.includes("@"))
          .map(e => e.toLowerCase());
        
        if (emailIdentifiers.length > 0) {
          // Use REST API directly to support dynamic !inner join for client filtering
          const joinType = selectedClient !== "all" ? "!inner" : "";
          
          // Build query - don't encode !inner as it needs to be literal for PostgREST
          const selectParts = [
            "id", "agent_name", "agent_email", "sale_datetime", "client_campaign_id",
            `client_campaigns${joinType}(client_id)`,
            "sale_items(quantity,mapped_commission,mapped_revenue,products(counts_as_sale))"
          ];
          const selectClause = selectParts.join(",");
          // Use eq for exact match (case-insensitive handled by lowercasing both sides)
          // The agent_email in sales is stored in various cases, so match lowercase
          const emailOrFilter = emailIdentifiers.map(e => `agent_email.ilike.${encodeURIComponent(e)}`).join(",");
          
          // Build URL without encoding the select clause (PostgREST needs literal !inner)
          let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
          salesUrl += `&or=(${emailOrFilter})`;
          salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
          
          if (selectedClient !== "all") {
            salesUrl += `&client_campaigns.client_id=eq.${selectedClient}`;
          }
          
          console.log("[DailyReport] Sales URL:", salesUrl);
          
          const salesRes = await fetch(salesUrl, {
            headers: { 
              apikey: supabaseKey, 
              Authorization: `Bearer ${authToken}`,
              Accept: "application/json"
            }
          });
          
          if (!salesRes.ok) {
            console.error("[DailyReport] Sales fetch failed:", salesRes.status, await salesRes.text());
            salesData = [];
          } else {
            salesData = await salesRes.json();
          }
          console.log("[DailyReport] Sales fetched:", salesData.length, salesData.map((s: any) => ({ agent: s.agent_email, items: s.sale_items?.length })));
        }
      }

      // Fetch fieldmarketing sales (linked directly to employee via seller_id)
      const { data: fmSalesData } = await supabase
        .from("fieldmarketing_sales")
        .select(`
          id,
          seller_id,
          registered_at,
          product_name,
          client_id
        `)
        .in("seller_id", employeeIds)
        .gte("registered_at", `${startStr}T00:00:00`)
        .lte("registered_at", `${endStr}T23:59:59`);
      
      console.log("[DailyReport] FM Sales fetched:", fmSalesData?.length);
      
      // Fetch products with campaign overrides for FM commission lookup
      // First get all products
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, commission_dkk");
      
      // Get campaign overrides - use the first override found per product (simplification)
      const { data: campaignOverrides } = await supabase
        .from("product_campaign_overrides")
        .select("product_id, commission_dkk");
      
      // Build commission map: prefer campaign override, fallback to base commission
      const productCommissionMap = new Map<string, number>();
      const overrideByProductId = new Map<string, number>();
      
      campaignOverrides?.forEach(o => {
        // Take first override found (highest commission to be generous)
        const existing = overrideByProductId.get(o.product_id);
        if (!existing || o.commission_dkk > existing) {
          overrideByProductId.set(o.product_id, o.commission_dkk);
        }
      });
      
      allProducts?.forEach(p => {
        if (p.name) {
          const override = overrideByProductId.get(p.id);
          const commission = override ?? p.commission_dkk ?? 0;
          productCommissionMap.set(p.name.toLowerCase(), commission);
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
          ? primaryShifts?.find(ps => ps.team_id === empTeamMembership.team_id)
          : null;
        const empShiftDays = empPrimaryShift 
          ? shiftDays?.filter(sd => sd.shift_id === empPrimaryShift.id) || []
          : [];

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
          
          if (!shiftForDay || !shiftForDay.start_time || !shiftForDay.end_time) {
            continue;
          }

          const [startH, startM] = shiftForDay.start_time.split(':').map(Number);
          const [endH, endM] = shiftForDay.end_time.split(':').map(Number);
          const rawHours = (endH + endM / 60) - (startH + startM / 60);
          // Standard 30 min break for shifts over 6 hours
          const breakMinutes = rawHours > 6 ? 30 : 0;
          const hours = rawHours - (breakMinutes / 60);

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

          // Fieldmarketing sales via seller_id
          const empFmSales = (fmSalesData || []).filter((s: any) => {
            const saleDate = s.registered_at;
            return s.seller_id === empId && saleDate >= dayStart && saleDate <= dayEnd;
          });

          // Count regular sales using sale_items with counts_as_sale (same as KPI)
          let salesCount = 0;
          let revenue = 0;
          let commission = 0;
          empSales.forEach((sale: any) => {
            (sale.sale_items || []).forEach((item: any) => {
              const countsAsSale = item.products?.counts_as_sale !== false;
              if (countsAsSale) {
                salesCount += Number(item.quantity) || 1;
              }
              revenue += Number(item.mapped_revenue) || 0;
              commission += Number(item.mapped_commission) || 0;
            });
          });

          // Add fieldmarketing sales - match commission by product_name
          empFmSales.forEach((sale: any) => {
            salesCount += 1;
            const productName = (sale.product_name || "").toLowerCase();
            commission += productCommissionMap.get(productName) || 0;
            // FM sales don't have mapped_revenue, so we skip revenue for those
          });

          dailyEntries.push({
            date: dayStr,
            hours: Math.round(hours * 100) / 100,
            is_sick: isSick,
            is_vacation: isVacation,
            sales_count: salesCount,
            revenue: Math.round(revenue),
            commission: Math.round(commission),
          });

          totalHours += hours;
          if (isSick) sickDays++;
          if (isVacation) vacationDays++;
          totalSales += salesCount;
          totalRevenue += revenue;
          totalCommission += commission;
        }

        if (dailyEntries.length > 0) {
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
            daily_entries: dailyEntries.sort((a, b) => b.date.localeCompare(a.date)),
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
                
                <div className="flex-1 space-y-4">
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
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <div className="flex items-center justify-between w-full">
                          <SelectValue placeholder="Alle" />
                          <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
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
                      <TableHead>Medarbejder</TableHead>
                      <TableHead>Team</TableHead>
                      {selectedColumns.includes("hours") && <TableHead className="text-right">Timer</TableHead>}
                      {selectedColumns.includes("sick_days") && <TableHead className="text-center">Sygdom</TableHead>}
                      {selectedColumns.includes("vacation_days") && <TableHead className="text-center">Ferie</TableHead>}
                      {selectedColumns.includes("sales") && <TableHead className="text-right text-foreground">Salg</TableHead>}
                      {selectedColumns.includes("commission") && <TableHead className="text-right text-foreground">Provision</TableHead>}
                      {selectedColumns.includes("revenue") && <TableHead className="text-right text-foreground">Omsætning</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <>
                        {/* Main row - aggregated or single day */}
                        <TableRow 
                          key={row.employee_id}
                          className={cn(isMultipleDays && "cursor-pointer hover:bg-muted/50")}
                          onClick={isMultipleDays ? () => toggleEmployeeExpanded(row.employee_id) : undefined}
                        >
                          {isMultipleDays && (
                            <TableCell className="w-8 p-2">
                              {expandedEmployees.has(row.employee_id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          )}
                          {!isMultipleDays && (
                            <TableCell className="font-medium">
                              {format(parseISO(row.daily_entries[0]?.date || format(dateRange.start, "yyyy-MM-dd")), "d. MMM", { locale: da })}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{row.employee_name}</TableCell>
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

                        {/* Expanded daily details */}
                        {isMultipleDays && expandedEmployees.has(row.employee_id) && row.daily_entries.map((entry) => (
                          <TableRow key={`${row.employee_id}-${entry.date}`} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="text-muted-foreground pl-6">
                              {format(parseISO(entry.date), "EEEE d. MMM", { locale: da })}
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
                    ))}
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
