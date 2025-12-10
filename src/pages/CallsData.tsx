import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, PhoneOff, PhoneMissed, Clock, CalendarIcon, Search, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, User, Building } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Call {
  id: string;
  external_id: string;
  integration_type: string;
  dialer_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  total_duration_seconds: number;
  status: string;
  agent_external_id: string;
  campaign_external_id: string;
  lead_external_id: string;
  recording_url: string | null;
  metadata: Record<string, any> | null;
  agent_id: string | null;
  agent?: { name: string; email: string } | null;
}

const PAGE_SIZE = 50;

type SortColumn = "start_time" | "duration_seconds" | "status" | "dialer_name" | "agent_external_id" | "campaign_external_id";
type SortDirection = "asc" | "desc";

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    ANSWERED: { label: "Besvaret", className: "bg-green-600 hover:bg-green-700", icon: <Phone className="h-3 w-3 mr-1" /> },
    NO_ANSWER: { label: "Ikke besvaret", className: "bg-yellow-600 hover:bg-yellow-700", icon: <PhoneMissed className="h-3 w-3 mr-1" /> },
    BUSY: { label: "Optaget", className: "bg-orange-600 hover:bg-orange-700", icon: <PhoneOff className="h-3 w-3 mr-1" /> },
    VOICEMAIL: { label: "Voicemail", className: "bg-purple-600 hover:bg-purple-700", icon: <Phone className="h-3 w-3 mr-1" /> },
    FAILED: { label: "Fejlet", className: "bg-red-600 hover:bg-red-700", icon: <PhoneOff className="h-3 w-3 mr-1" /> },
    OTHER: { label: "Andet", className: "bg-muted hover:bg-muted/80", icon: <Phone className="h-3 w-3 mr-1" /> },
  };
  const config = statusConfig[status] || statusConfig.OTHER;
  return (
    <Badge className={`${config.className} flex items-center`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

export default function CallsData() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("start_time");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["calls-stats", dateFrom, dateTo],
    queryFn: async () => {
      const fromDate = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
      const toDate = dateTo ? endOfDay(dateTo).toISOString() : undefined;

      let totalQuery = supabase.from("dialer_calls").select("id", { count: "exact", head: true });
      if (fromDate) totalQuery = totalQuery.gte("start_time", fromDate);
      if (toDate) totalQuery = totalQuery.lte("start_time", toDate);
      const { count: total } = await totalQuery;

      let answeredQuery = supabase.from("dialer_calls").select("id", { count: "exact", head: true }).eq("status", "ANSWERED");
      if (fromDate) answeredQuery = answeredQuery.gte("start_time", fromDate);
      if (toDate) answeredQuery = answeredQuery.lte("start_time", toDate);
      const { count: answered } = await answeredQuery;

      let noAnswerQuery = supabase.from("dialer_calls").select("id", { count: "exact", head: true }).eq("status", "NO_ANSWER");
      if (fromDate) noAnswerQuery = noAnswerQuery.gte("start_time", fromDate);
      if (toDate) noAnswerQuery = noAnswerQuery.lte("start_time", toDate);
      const { count: noAnswer } = await noAnswerQuery;

      // Calculate avg duration for answered calls
      let avgQuery = supabase.from("dialer_calls").select("duration_seconds").eq("status", "ANSWERED");
      if (fromDate) avgQuery = avgQuery.gte("start_time", fromDate);
      if (toDate) avgQuery = avgQuery.lte("start_time", toDate);
      const { data: durationData } = await avgQuery.limit(1000);
      
      const avgDuration = durationData && durationData.length > 0
        ? Math.round(durationData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / durationData.length)
        : 0;

      return {
        total: total || 0,
        answered: answered || 0,
        noAnswer: noAnswer || 0,
        avgDuration,
        answerRate: total ? Math.round((answered || 0) / total * 100) : 0,
      };
    },
  });

  // Fetch campaign mappings for lookup
  const { data: campaignMappings } = useQuery({
    queryKey: ["campaign-mappings-calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("adversus_campaign_mappings")
        .select("adversus_campaign_id, adversus_campaign_name");
      return new Map((data || []).map(m => [m.adversus_campaign_id, m.adversus_campaign_name]));
    },
  });

  // Fetch agents for lookup
  const { data: agentsMap } = useQuery({
    queryKey: ["agents-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, external_adversus_id, name, email");
      const map = new Map<string, { name: string; email: string }>();
      (data || []).forEach(a => {
        if (a.external_adversus_id) {
          map.set(a.external_adversus_id, { name: a.name, email: a.email });
        }
      });
      return map;
    },
  });

  // Fetch calls
  const { data: callsData, isLoading, refetch } = useQuery({
    queryKey: ["dialer-calls", activeTab, sourceFilter, statusFilter, campaignFilter, page, dateFrom, dateTo, searchTerm, sortColumn, sortDirection],
    queryFn: async () => {
      const fromDate = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
      const toDate = dateTo ? endOfDay(dateTo).toISOString() : undefined;

      let query = supabase
        .from("dialer_calls")
        .select(`
          id, external_id, integration_type, dialer_name, start_time, end_time,
          duration_seconds, total_duration_seconds, status, agent_external_id,
          campaign_external_id, lead_external_id, recording_url, metadata, agent_id,
          agents(name, email)
        `, { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc", nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (activeTab !== "all") {
        query = query.eq("integration_type", activeTab);
      }

      if (sourceFilter !== "all") {
        query = query.eq("dialer_name", sourceFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (campaignFilter !== "all") {
        query = query.eq("campaign_external_id", campaignFilter);
      }

      if (fromDate) {
        query = query.gte("start_time", fromDate);
      }

      if (toDate) {
        query = query.lte("start_time", toDate);
      }

      if (searchTerm) {
        query = query.or(`external_id.ilike.%${searchTerm}%,agent_external_id.ilike.%${searchTerm}%,lead_external_id.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const transformedData = (data || []).map((call: any) => ({
        ...call,
        agent: call.agents || (call.agent_external_id && agentsMap?.get(call.agent_external_id)) || null,
        agents: undefined,
      }));

      return { calls: transformedData as Call[], totalCount: count || 0 };
    },
    enabled: !!agentsMap,
  });

  const calls = callsData?.calls || [];
  const totalCount = callsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Get unique values for filters
  const { data: dialerNames } = useQuery({
    queryKey: ["dialer-names-calls"],
    queryFn: async () => {
      const { data } = await supabase.from("dialer_calls").select("dialer_name").not("dialer_name", "is", null);
      return [...new Set((data || []).map(c => c.dialer_name).filter(Boolean))] as string[];
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-calls", campaignMappings],
    queryFn: async () => {
      const { data } = await supabase.from("dialer_calls").select("campaign_external_id").not("campaign_external_id", "is", null);
      const uniqueIds = [...new Set((data || []).map(c => c.campaign_external_id).filter(Boolean))];
      return uniqueIds.map(id => ({
        id,
        name: campaignMappings?.get(id) || id,
      }));
    },
    enabled: !!campaignMappings,
  });

  const handleDatePreset = (days: number) => {
    setDateFrom(subDays(new Date(), days));
    setDateTo(new Date());
    setPage(0);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setPage(0);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getCampaignName = (campaignId: string) => {
    return campaignMappings?.get(campaignId) || campaignId;
  };

  const getAgentDisplay = (call: Call) => {
    if (call.agent?.name) return call.agent.name;
    if (agentsMap?.has(call.agent_external_id)) return agentsMap.get(call.agent_external_id)!.name;
    return call.agent_external_id || "-";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Opkaldsdata</h1>
            <p className="text-muted-foreground">Oversigt over alle opkald fra dialer-systemer</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Totalt opkald</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                Besvaret
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.answered?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PhoneMissed className="h-4 w-4 text-yellow-500" />
                Ikke besvaret
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats?.noAnswer?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Gns. varighed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats?.avgDuration || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Svarrate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.answerRate || 0}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); setSourceFilter("all"); }}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="adversus" className="gap-2">
              <Badge className="bg-blue-600 text-xs">Adversus</Badge>
            </TabsTrigger>
            <TabsTrigger value="enreach" className="gap-2">
              <Badge className="bg-purple-600 text-xs">Enreach</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Opkald
                      <Badge variant="secondary">{totalCount.toLocaleString()}</Badge>
                    </CardTitle>
                  </div>
                  
                  {/* Filters Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date Presets */}
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(1)}>I dag</Button>
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)}>7 dage</Button>
                      <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)}>30 dage</Button>
                    </div>

                    {/* Date From */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Fra"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} />
                      </PopoverContent>
                    </Popover>

                    {/* Date To */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Til"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} />
                      </PopoverContent>
                    </Popover>

                    {/* Dialer Filter */}
                    <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Dialer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle dialere</SelectItem>
                        {dialerNames?.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle status</SelectItem>
                        <SelectItem value="ANSWERED">Besvaret</SelectItem>
                        <SelectItem value="NO_ANSWER">Ikke besvaret</SelectItem>
                        <SelectItem value="BUSY">Optaget</SelectItem>
                        <SelectItem value="VOICEMAIL">Voicemail</SelectItem>
                        <SelectItem value="FAILED">Fejlet</SelectItem>
                        <SelectItem value="OTHER">Andet</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Campaign Filter */}
                    <Select value={campaignFilter} onValueChange={(v) => { setCampaignFilter(v); setPage(0); }}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Kampagne" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle kampagner</SelectItem>
                        {campaigns?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Søg ID, agent, lead..."
                        className="pl-9 w-[200px]"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Indlæser...
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("start_time")}>
                              <div className="flex items-center">Tidspunkt<SortIcon column="start_time" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("duration_seconds")}>
                              <div className="flex items-center">Varighed<SortIcon column="duration_seconds" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("status")}>
                              <div className="flex items-center">Status<SortIcon column="status" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("dialer_name")}>
                              <div className="flex items-center">Dialer<SortIcon column="dialer_name" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("agent_external_id")}>
                              <div className="flex items-center">Agent<SortIcon column="agent_external_id" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("campaign_external_id")}>
                              <div className="flex items-center">Kampagne<SortIcon column="campaign_external_id" /></div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {calls.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Ingen opkald fundet
                              </TableCell>
                            </TableRow>
                          ) : (
                            calls.map((call) => (
                              <TableRow
                                key={call.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setSelectedCall(call)}
                              >
                                <TableCell className="font-mono text-sm">
                                  {format(new Date(call.start_time), "dd.MM.yyyy, HH:mm:ss")}
                                </TableCell>
                                <TableCell>
                                  <span className={`font-mono ${call.duration_seconds > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                                    {formatDuration(call.duration_seconds)}
                                  </span>
                                </TableCell>
                                <TableCell>{getStatusBadge(call.status)}</TableCell>
                                <TableCell>{call.dialer_name}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    {getAgentDisplay(call)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Building className="h-3 w-3 text-muted-foreground" />
                                    {getCampaignName(call.campaign_external_id)}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Viser {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} af {totalCount.toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          onClick={() => setPage(p => p - 1)}
                        >
                          Forrige
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages - 1}
                          onClick={() => setPage(p => p + 1)}
                        >
                          Næste
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Opkaldsdetaljer</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ekstern ID</p>
                  <p className="font-mono">{selectedCall.external_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedCall.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Starttidspunkt</p>
                  <p>{format(new Date(selectedCall.start_time), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sluttidspunkt</p>
                  <p>{format(new Date(selectedCall.end_time), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Samtaletid</p>
                  <p className="text-lg font-bold text-green-500">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total varighed</p>
                  <p>{formatDuration(selectedCall.total_duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agent</p>
                  <p>{getAgentDisplay(selectedCall)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kampagne</p>
                  <p>{getCampaignName(selectedCall.campaign_external_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dialer</p>
                  <p>{selectedCall.dialer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Integration</p>
                  <Badge className={selectedCall.integration_type === "enreach" ? "bg-purple-600" : "bg-blue-600"}>
                    {selectedCall.integration_type}
                  </Badge>
                </div>
              </div>

              {selectedCall.recording_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Optagelse</p>
                  <audio controls className="w-full">
                    <source src={selectedCall.recording_url} />
                  </audio>
                </div>
              )}

              {selectedCall.metadata && Object.keys(selectedCall.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Metadata</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedCall.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
