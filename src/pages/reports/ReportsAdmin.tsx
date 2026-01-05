import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, FileSpreadsheet, Download, Filter, X, Users, Building2, Target, Briefcase } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReportType = "sales" | "payroll";

interface DateRange {
  from: Date;
  to: Date;
}

export default function ReportsAdmin() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["report-teams"],
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
    queryKey: ["report-employees"],
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
    queryKey: ["report-clients"],
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
    queryKey: ["report-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id, clients(name)")
        .order("name");
      return data || [];
    },
  });

  const handleToggleTeam = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
  };

  const handleToggleClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleToggleCampaign = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) ? prev.filter(id => id !== campaignId) : [...prev, campaignId]
    );
  };

  const clearAllFilters = () => {
    setSelectedTeams([]);
    setSelectedEmployees([]);
    setSelectedClients([]);
    setSelectedCampaigns([]);
  };

  const hasFilters = selectedTeams.length > 0 || selectedEmployees.length > 0 || 
    selectedClients.length > 0 || selectedCampaigns.length > 0;

  const handleGenerateReport = () => {
    const filters = {
      reportType,
      dateRange: {
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
      },
      teams: selectedTeams,
      employees: selectedEmployees,
      clients: selectedClients,
      campaigns: selectedCampaigns,
    };
    console.log("Generating report with filters:", filters);
    toast.success(`${reportType === "sales" ? "Salgsrapport" : "Lønrapport"} genereres...`);
    // TODO: Implement actual report generation
  };

  const quickDateRanges = [
    { label: "Denne måned", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: "Sidste måned", from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
    { label: "Sidste 3 måneder", from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporter Admin</h1>
          <p className="text-muted-foreground">
            Træk administrative rapporter og oversigter
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          {/* Filter sidebar */}
          <div className="space-y-4">
            {/* Report Type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Rapporttype
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  onClick={() => setReportType("sales")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    reportType === "sales" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <Target className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Salgsrapport</p>
                    <p className="text-xs text-muted-foreground">Omsætning, provision og salgstal</p>
                  </div>
                </div>
                <div 
                  onClick={() => setReportType("payroll")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    reportType === "payroll" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <Briefcase className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Lønrapport</p>
                    <p className="text-xs text-muted-foreground">Løn, timer og tillæg</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Periode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {quickDateRanges.map((range) => (
                    <Badge
                      key={range.label}
                      variant={dateRange.from.getTime() === range.from.getTime() && dateRange.to.getTime() === range.to.getTime() ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setDateRange({ from: range.from, to: range.to })}
                    >
                      {range.label}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal h-9 text-sm">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {format(dateRange.from, "d. MMM yyyy", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                        locale={da}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal h-9 text-sm">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {format(dateRange.to, "d. MMM yyyy", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                        locale={da}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtre
                  </CardTitle>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" />
                      Ryd alle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Teams Filter */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Teams
                    {selectedTeams.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedTeams.length}</Badge>
                    )}
                  </Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={() => handleToggleTeam(team.id)}
                        />
                        <label htmlFor={`team-${team.id}`} className="text-sm cursor-pointer flex-1">
                          {team.name}
                        </label>
                      </div>
                    ))}
                    {teams.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Ingen teams fundet</p>
                    )}
                  </ScrollArea>
                </div>

                {/* Employees Filter */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Medarbejdere
                    {selectedEmployees.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedEmployees.length}</Badge>
                    )}
                  </Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {employees.map((emp) => (
                      <div key={emp.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => handleToggleEmployee(emp.id)}
                        />
                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                          {emp.first_name} {emp.last_name}
                        </label>
                      </div>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Ingen medarbejdere fundet</p>
                    )}
                  </ScrollArea>
                </div>

                {/* Clients Filter */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Kunder
                    {selectedClients.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedClients.length}</Badge>
                    )}
                  </Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {clients.map((client) => (
                      <div key={client.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={() => handleToggleClient(client.id)}
                        />
                        <label htmlFor={`client-${client.id}`} className="text-sm cursor-pointer flex-1">
                          {client.name}
                        </label>
                      </div>
                    ))}
                    {clients.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Ingen kunder fundet</p>
                    )}
                  </ScrollArea>
                </div>

                {/* Campaigns Filter */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Target className="h-3.5 w-3.5" />
                    Kampagner
                    {selectedCampaigns.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedCampaigns.length}</Badge>
                    )}
                  </Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {campaigns.map((campaign) => (
                      <div key={campaign.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`campaign-${campaign.id}`}
                          checked={selectedCampaigns.includes(campaign.id)}
                          onCheckedChange={() => handleToggleCampaign(campaign.id)}
                        />
                        <label htmlFor={`campaign-${campaign.id}`} className="text-sm cursor-pointer flex-1">
                          <span>{campaign.name}</span>
                          {campaign.clients && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({(campaign.clients as { name: string }).name})
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                    {campaigns.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Ingen kampagner fundet</p>
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button onClick={handleGenerateReport} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Generér rapport
            </Button>
          </div>

          {/* Report Preview Area */}
          <Card className="min-h-[600px]">
            <CardHeader>
              <CardTitle>
                {reportType === "sales" ? "Salgsrapport" : "Lønrapport"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(dateRange.from, "d. MMMM yyyy", { locale: da })} - {format(dateRange.to, "d. MMMM yyyy", { locale: da })}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <FileSpreadsheet className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Vælg filtre og klik "Generér rapport"</p>
                <p className="text-sm mt-1">
                  Rapporten vil blive vist her
                </p>
                {hasFilters && (
                  <div className="flex flex-wrap gap-2 mt-4 justify-center max-w-md">
                    {selectedTeams.length > 0 && (
                      <Badge variant="outline">{selectedTeams.length} teams</Badge>
                    )}
                    {selectedEmployees.length > 0 && (
                      <Badge variant="outline">{selectedEmployees.length} medarbejdere</Badge>
                    )}
                    {selectedClients.length > 0 && (
                      <Badge variant="outline">{selectedClients.length} kunder</Badge>
                    )}
                    {selectedCampaigns.length > 0 && (
                      <Badge variant="outline">{selectedCampaigns.length} kampagner</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
