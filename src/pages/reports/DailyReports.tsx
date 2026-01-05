import { useState, useMemo } from "react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, parseISO } from "date-fns";
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
import { Search, ChevronDown, Calendar as CalendarIcon, Clock, Palmtree, Thermometer, TrendingUp, Coins, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const reportColumnOptions = [
  { id: "hours", label: "Timer", icon: Clock },
  { id: "sick_days", label: "Sygdom", icon: Thermometer },
  { id: "vacation_days", label: "Ferie", icon: Palmtree },
  { id: "sales", label: "Salg", icon: TrendingUp },
  { id: "commission", label: "Provision", icon: Coins },
];

interface DailyReportData {
  employee_id: string;
  employee_name: string;
  team_name: string | null;
  hours: number;
  is_sick: boolean;
  is_vacation: boolean;
  sales_count: number;
  commission: number;
  clock_in: string | null;
  clock_out: string | null;
}

export default function DailyReports() {
  const [period, setPeriod] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["hours", "sick_days", "vacation_days", "sales", "commission"]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "last_week":
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return { start: lastWeekStart, end: lastWeekEnd };
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom":
        if (customStartDate && customEndDate) {
          return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      default: // today
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [period, customStartDate, customEndDate]);

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

  // Fetch report data when search is triggered
  const { data: reportData = [], isLoading: isLoadingReport, refetch: fetchReport } = useQuery({
    queryKey: ["daily-report-data", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd"), selectedTeam, selectedEmployee],
    queryFn: async () => {
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");

      // Get employees with time stamps in the date range
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

      // Filter by team if selected
      let filteredEmployees = employeesData || [];
      if (selectedTeam !== "all") {
        filteredEmployees = filteredEmployees.filter(emp => 
          emp.team_members?.some((tm: any) => tm.team?.id === selectedTeam)
        );
      }

      if (filteredEmployees.length === 0) return [];

      const employeeIds = filteredEmployees.map(e => e.id);

      // Fetch time stamps
      const { data: timeStamps } = await supabase
        .from("time_stamps")
        .select("employee_id, clock_in, clock_out, effective_hours")
        .in("employee_id", employeeIds)
        .gte("clock_in", `${startStr}T00:00:00`)
        .lte("clock_in", `${endStr}T23:59:59`);

      // Fetch absences
      const { data: absences } = await supabase
        .from("absence_request_v2")
        .select("employee_id, type, start_date, end_date, status")
        .in("employee_id", employeeIds)
        .lte("start_date", endStr)
        .gte("end_date", startStr)
        .eq("status", "approved");

      // Fetch shifts to identify employees with registrations
      const { data: shifts } = await supabase
        .from("shift")
        .select("employee_id, date, start_time, end_time, planned_hours")
        .in("employee_id", employeeIds)
        .gte("date", startStr)
        .lte("date", endStr);

      // Fetch team standard shift data for employees without explicit shifts
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

      // Get employee-agent mappings
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(name)")
        .in("employee_id", employeeIds);

      const agentNames = agentMappings?.map(m => (m.agents as any)?.name).filter(Boolean) || [];

      // Fetch sales - join through agent mapping
      let salesData: any[] = [];
      if (agentNames.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select(`
            id,
            agent_name,
            status,
            sale_items(mapped_commission)
          `)
          .in("agent_name", agentNames)
          .gte("created_at", `${startStr}T00:00:00`)
          .lte("created_at", `${endStr}T23:59:59`)
          .eq("status", "approved");
        salesData = sales || [];
      }

      // Build report data
      const report: DailyReportData[] = [];

      for (const emp of filteredEmployees) {
        const empId = emp.id;
        const teamName = emp.team_members?.[0]?.team?.name || null;

        // Check if employee has any registration (shift, time stamp, or standard shift)
        const empShifts = shifts?.filter(s => s.employee_id === empId) || [];
        const empTimeStamps = timeStamps?.filter(ts => ts.employee_id === empId) || [];
        
        // Check if employee has a standard shift for the date range
        const empTeamMembership = teamMembers?.find(tm => tm.employee_id === empId);
        const hasStandardShift = empTeamMembership && primaryShifts?.some(ps => ps.team_id === empTeamMembership.team_id);

        // Only include employees who have some form of registration
        if (empShifts.length === 0 && empTimeStamps.length === 0 && !hasStandardShift) {
          continue;
        }

        // Calculate hours - prefer time stamps, fallback to planned_hours from shifts
        let hours = 0;
        if (empTimeStamps.length > 0) {
          hours = empTimeStamps.reduce((sum, ts) => {
            if (ts.effective_hours) return sum + ts.effective_hours;
            if (ts.clock_in && ts.clock_out) {
              const diffMs = new Date(ts.clock_out).getTime() - new Date(ts.clock_in).getTime();
              return sum + diffMs / (1000 * 60 * 60);
            }
            return sum;
          }, 0);
        } else if (empShifts.length > 0) {
          // Use planned hours from shifts if no time stamps
          hours = empShifts.reduce((sum, s) => sum + (s.planned_hours || 0), 0);
        }

        // Check absences
        const empAbsences = absences?.filter(a => a.employee_id === empId) || [];
        const isSick = empAbsences.some(a => a.type === "sick");
        const isVacation = empAbsences.some(a => a.type === "vacation");

        // Get clock in/out for display
        const firstClockIn = empTimeStamps.length > 0 
          ? empTimeStamps.sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())[0].clock_in 
          : null;
        const lastClockOut = empTimeStamps.length > 0 
          ? empTimeStamps
              .filter(ts => ts.clock_out)
              .sort((a, b) => new Date(b.clock_out!).getTime() - new Date(a.clock_out!).getTime())[0]?.clock_out 
          : null;

        // Get sales for this employee through agent mapping
        const empAgentMapping = agentMappings?.find(m => m.employee_id === empId);
        const agentName = (empAgentMapping?.agents as any)?.name;
        const empSales = agentName 
          ? salesData.filter(s => s.agent_name === agentName)
          : [];

        const salesCount = empSales.length;
        const commission = empSales.reduce((sum, sale) => {
          const saleCommission = sale.sale_items?.reduce((itemSum: number, item: any) => 
            itemSum + (item.mapped_commission || 0), 0) || 0;
          return sum + saleCommission;
        }, 0);

        report.push({
          employee_id: empId,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          team_name: teamName,
          hours: Math.round(hours * 100) / 100,
          is_sick: isSick,
          is_vacation: isVacation,
          sales_count: salesCount,
          commission: Math.round(commission),
          clock_in: firstClockIn,
          clock_out: lastClockOut,
        });
      }

      return report.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    },
    enabled: hasSearched,
  });

  const handleSearch = () => {
    setHasSearched(true);
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

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    return format(parseISO(isoString), "HH:mm");
  };

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
                          {employees.map((emp) => (
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
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rapport kolonner */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/70 font-medium">Kolonner i rapport</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20"
                          >
                            <span>
                              {selectedColumns.length === 0 
                                ? "Vælg kolonner" 
                                : `${selectedColumns.length} valgt`}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[290px] p-2" align="start">
                          <div className="space-y-1">
                            {reportColumnOptions.map((column) => (
                              <div 
                                key={column.id}
                                className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                                onClick={() => toggleColumn(column.id)}
                              >
                                <Checkbox 
                                  checked={selectedColumns.includes(column.id)}
                                  onCheckedChange={() => toggleColumn(column.id)}
                                />
                                <column.icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{column.label}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Search Button */}
                  <Button 
                    onClick={handleSearch} 
                    className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-6"
                    size="lg"
                  >
                    SØG
                  </Button>
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
              {period.includes("week") && ` - ${format(dateRange.end, "d. MMM", { locale: da })}`}
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
                      <TableHead>Medarbejder</TableHead>
                      <TableHead>Team</TableHead>
                      {selectedColumns.includes("hours") && <TableHead className="text-right">Timer</TableHead>}
                      {selectedColumns.includes("sick_days") && <TableHead className="text-center">Sygdom</TableHead>}
                      {selectedColumns.includes("vacation_days") && <TableHead className="text-center">Ferie</TableHead>}
                      {selectedColumns.includes("sales") && <TableHead className="text-right">Salg</TableHead>}
                      {selectedColumns.includes("commission") && <TableHead className="text-right">Provision</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <TableRow key={row.employee_id}>
                        <TableCell className="font-medium">{row.employee_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.team_name || "-"}</TableCell>
                        {selectedColumns.includes("hours") && (
                          <TableCell className="text-right font-medium">
                            {row.hours > 0 ? `${row.hours.toFixed(1)}t` : "-"}
                          </TableCell>
                        )}
                        {selectedColumns.includes("sick_days") && (
                          <TableCell className="text-center">
                            {row.is_sick ? (
                              <Badge variant="destructive" className="gap-1">
                                <Thermometer className="h-3 w-3" />
                                Syg
                              </Badge>
                            ) : "-"}
                          </TableCell>
                        )}
                        {selectedColumns.includes("vacation_days") && (
                          <TableCell className="text-center">
                            {row.is_vacation ? (
                              <Badge className="gap-1 bg-amber-500 hover:bg-amber-600">
                                <Palmtree className="h-3 w-3" />
                                Ferie
                              </Badge>
                            ) : "-"}
                          </TableCell>
                        )}
                        {selectedColumns.includes("sales") && (
                          <TableCell className="text-right">
                            {row.sales_count > 0 ? (
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {row.sales_count}
                              </span>
                            ) : "-"}
                          </TableCell>
                        )}
                        {selectedColumns.includes("commission") && (
                          <TableCell className="text-right">
                            {row.commission > 0 ? (
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {row.commission.toLocaleString("da-DK")} kr.
                              </span>
                            ) : "-"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Summary row */}
                <div className="border-t bg-muted/30 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{reportData.length} medarbejdere</span>
                    <div className="flex gap-6">
                      {selectedColumns.includes("hours") && (
                        <span>
                          <span className="text-muted-foreground">Total timer:</span>{" "}
                          <span className="font-medium">
                            {reportData.reduce((sum, r) => sum + r.hours, 0).toFixed(1)}t
                          </span>
                        </span>
                      )}
                      {selectedColumns.includes("sales") && (
                        <span>
                          <span className="text-muted-foreground">Total salg:</span>{" "}
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {reportData.reduce((sum, r) => sum + r.sales_count, 0)}
                          </span>
                        </span>
                      )}
                      {selectedColumns.includes("commission") && (
                        <span>
                          <span className="text-muted-foreground">Total provision:</span>{" "}
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {reportData.reduce((sum, r) => sum + r.commission, 0).toLocaleString("da-DK")} kr.
                          </span>
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