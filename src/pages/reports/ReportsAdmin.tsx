import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileSpreadsheet, Search, ChevronDown } from "lucide-react";
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

interface MultiOption {
  id: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Alle",
}: MultiSelectFilterProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((o) => o.id === selected[0])?.label ?? `${selected.length} valgt`;
    }
    return `${selected.length} valgt`;
  })();

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/70 font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <span className="truncate">{triggerText}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[290px] p-2" align="start">
          {selected.length > 0 && (
            <div className="flex justify-between items-center px-2 pb-2 mb-1 border-b">
              <span className="text-xs text-muted-foreground">{selected.length} valgt</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onChange([])}
              >
                Ryd
              </Button>
            </div>
          )}
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {options.length === 0 && (
              <div className="text-sm text-muted-foreground p-2">Ingen valgmuligheder</div>
            )}
            {options.map((option) => (
              <div
                key={option.id}
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                onClick={() => toggle(option.id)}
              >
                <Checkbox
                  checked={selected.includes(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                />
                <span className="text-sm">{option.label}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ReportsAdmin() {
  const [period, setPeriod] = useState<string>("this_month");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
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

  // Filter campaigns by selected clients
  const filteredCampaigns = useMemo(() => {
    if (selectedClients.length === 0) return campaigns;
    return campaigns.filter((c) => c.client_id && selectedClients.includes(c.client_id));
  }, [campaigns, selectedClients]);

  // If a previously selected campaign no longer matches the client filter, drop it silently on next render via memo
  const effectiveSelectedCampaigns = useMemo(() => {
    if (selectedClients.length === 0) return selectedCampaigns;
    const allowed = new Set(filteredCampaigns.map((c) => c.id));
    return selectedCampaigns.filter((id) => allowed.has(id));
  }, [selectedCampaigns, filteredCampaigns, selectedClients]);

  const teamOptions: MultiOption[] = useMemo(
    () => teams.map((t) => ({ id: t.id, label: t.name })),
    [teams]
  );
  const employeeOptions: MultiOption[] = useMemo(
    () => employees.map((e) => ({ id: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );
  const clientOptions: MultiOption[] = useMemo(
    () => clients.map((c) => ({ id: c.id, label: c.name })),
    [clients]
  );
  const campaignOptions: MultiOption[] = useMemo(
    () => filteredCampaigns.map((c) => ({ id: c.id, label: c.name })),
    [filteredCampaigns]
  );

  const handleSearch = () => {
    const filters = {
      period,
      teams: selectedTeams,
      employees: selectedEmployees,
      clients: selectedClients,
      campaigns: effectiveSelectedCampaigns,
      columns: selectedColumns,
    };
    console.log("Searching with filters:", filters);
    toast.success("Rapport genereres...");
    setFilterOpen(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedTeams.length > 0) count++;
    if (selectedEmployees.length > 0) count++;
    if (selectedClients.length > 0) count++;
    if (effectiveSelectedCampaigns.length > 0) count++;
    return count;
  };

  const periodOptions = [
    { value: "today", label: "I dag" },
    { value: "yesterday", label: "I går" },
    { value: "this_week", label: "Denne uge" },
    { value: "last_week", label: "Sidste uge" },
    { value: "this_month", label: "Denne måned" },
    { value: "last_month", label: "Sidste måned" },
    { value: "last_3_months", label: "Sidste 3 måneder" },
    { value: "this_year", label: "I år" },
  ];

  const summarize = (
    selected: string[],
    options: MultiOption[],
    singular: string,
    plural: string
  ): string | null => {
    if (selected.length === 0) return null;
    if (selected.length === 1) {
      return options.find((o) => o.id === selected[0])?.label ?? `1 ${singular}`;
    }
    return `${selected.length} ${plural}`;
  };

  const summaryParts = [
    periodOptions.find((p) => p.value === period)?.label || "Denne måned",
    summarize(selectedTeams, teamOptions, "team", "teams"),
    summarize(selectedEmployees, employeeOptions, "medarbejder", "medarbejdere"),
    summarize(selectedClients, clientOptions, "kunde", "kunder"),
    summarize(effectiveSelectedCampaigns, campaignOptions, "kampagne", "kampagner"),
  ].filter(Boolean);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rapporter</h1>
            <p className="text-muted-foreground">
              Træk administrative rapporter og oversigter
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

                    <MultiSelectFilter
                      label="Teams"
                      options={teamOptions}
                      selected={selectedTeams}
                      onChange={setSelectedTeams}
                    />

                    <MultiSelectFilter
                      label="Medarbejdere"
                      options={employeeOptions}
                      selected={selectedEmployees}
                      onChange={setSelectedEmployees}
                    />

                    <MultiSelectFilter
                      label="Kunder"
                      options={clientOptions}
                      selected={selectedClients}
                      onChange={setSelectedClients}
                    />

                    <MultiSelectFilter
                      label="Kampagner"
                      options={campaignOptions}
                      selected={effectiveSelectedCampaigns}
                      onChange={setSelectedCampaigns}
                    />

                    {/* Rapport kolonner */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/70 font-medium">Kolonner i rapport</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
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
              <FileSpreadsheet className="h-5 w-5" />
              Rapport
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {summaryParts.join(" • ")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[350px] text-center text-muted-foreground">
              <FileSpreadsheet className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Klik på søgeikonet for at filtrere</p>
              <p className="text-sm mt-1">
                Vælg filtre og klik "SØG" for at generere rapporten
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
