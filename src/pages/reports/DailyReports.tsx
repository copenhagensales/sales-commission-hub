import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileSpreadsheet, SlidersHorizontal, Search, ChevronDown, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const reportColumnOptions = [
  { id: "hours", label: "Timer" },
  { id: "shifts", label: "Vagter" },
  { id: "sick_days", label: "Sygdage" },
  { id: "vacation_days", label: "Feriedage" },
  { id: "sales", label: "Salg" },
  { id: "revenue", label: "Omsætning" },
  { id: "commission", label: "Provision" },
];

export default function DailyReports() {
  const [period, setPeriod] = useState<string>("today");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["hours", "shifts", "sales", "commission"]);
  const [filterOpen, setFilterOpen] = useState(false);

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

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
        .select("id, name, client_id, clients(name)")
        .order("name");
      return data || [];
    },
  });

  const handleSearch = () => {
    const filters = {
      period,
      team: selectedTeam,
      employee: selectedEmployee,
      client: selectedClient,
      campaign: selectedCampaign,
      columns: selectedColumns,
    };
    console.log("Searching daily report with filters:", filters);
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
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dagsrapporter</h1>
            <p className="text-muted-foreground">
              Træk daglige rapporter og oversigter
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
                          <SelectItem value="all">"Alle"</SelectItem>
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
                          <SelectItem value="all">"Alle"</SelectItem>
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
                          <SelectItem value="all">"Alle"</SelectItem>
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
                          <SelectItem value="all">"Alle"</SelectItem>
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
              <Calendar className="h-5 w-5" />
              Dagsrapport
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {periodOptions.find(p => p.value === period)?.label || "I dag"}
              {selectedTeam !== "all" && ` • ${teams.find(t => t.id === selectedTeam)?.name}`}
              {selectedEmployee !== "all" && ` • ${employees.find(e => e.id === selectedEmployee)?.first_name} ${employees.find(e => e.id === selectedEmployee)?.last_name}`}
              {selectedClient !== "all" && ` • ${clients.find(c => c.id === selectedClient)?.name}`}
              {selectedCampaign !== "all" && ` • ${campaigns.find(c => c.id === selectedCampaign)?.name}`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[350px] text-center text-muted-foreground">
              <Calendar className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Klik på søgeikonet for at filtrere</p>
              <p className="text-sm mt-1">
                Vælg filtre og klik "SØG" for at generere dagsrapporten
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
