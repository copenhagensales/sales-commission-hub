import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Phone, ShoppingCart, Database, Loader2, FileJson } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import EventDataTable from "./EventDataTable";
import AgentsDataTable from "./AgentsDataTable";
import SalesDataTable from "./SalesDataTable";
import CallsDataTable from "./CallsDataTable";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(220, 70%, 50%)",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function ApiDataOverview() {
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  // Fetch all unique API sources dynamically with counts
  const { data: sourceStats, isLoading: sourcesLoading } = useQuery({
    queryKey: ["api-overview-sources-stats"],
    queryFn: async () => {
      // Get sources from agents, sales, calls, and events with counts
      const [agentData, salesData, callsData, eventsData] = await Promise.all([
        supabase.from("agents").select("source").not("source", "is", null),
        supabase.from("sales").select("source").not("source", "is", null),
        supabase.from("dialer_calls").select("integration_type").not("integration_type", "is", null),
        supabase.from("adversus_events").select("id", { count: "exact", head: true }),
      ]);

      const sourceMap = new Map<string, { agents: number; sales: number; calls: number; events: number }>();
      
      agentData.data?.forEach(r => {
        if (r.source) {
          const key = r.source.toLowerCase();
          const existing = sourceMap.get(key) || { agents: 0, sales: 0, calls: 0, events: 0 };
          existing.agents += 1;
          sourceMap.set(key, existing);
        }
      });
      
      salesData.data?.forEach(r => {
        if (r.source) {
          const key = r.source.toLowerCase();
          const existing = sourceMap.get(key) || { agents: 0, sales: 0, calls: 0, events: 0 };
          existing.sales += 1;
          // For non-adversus providers, sales count as events (each sale originated from an API event)
          if (key !== "adversus") {
            existing.events += 1;
          }
          sourceMap.set(key, existing);
        }
      });
      
      callsData.data?.forEach(r => {
        if (r.integration_type) {
          const key = r.integration_type.toLowerCase();
          const existing = sourceMap.get(key) || { agents: 0, sales: 0, calls: 0, events: 0 };
          existing.calls += 1;
          sourceMap.set(key, existing);
        }
      });

      // Add adversus events count from dedicated events table
      const adversusStats = sourceMap.get("adversus") || { agents: 0, sales: 0, calls: 0, events: 0 };
      adversusStats.events = eventsData.count || 0;
      sourceMap.set("adversus", adversusStats);

      // Calculate total events across all providers
      let totalEvents = 0;
      sourceMap.forEach(stats => {
        totalEvents += stats.events;
      });

      return {
        sources: Array.from(sourceMap.keys()).sort(),
        bySource: Object.fromEntries(sourceMap),
        totalAgents: agentData.data?.length || 0,
        totalSales: salesData.data?.length || 0,
        totalCalls: callsData.data?.length || 0,
        totalEvents: totalEvents,
      };
    },
  });

  const apiSources = sourceStats?.sources || [];

  // Set default provider when sources are loaded
  const effectiveProvider = selectedProvider || (apiSources?.[0] ?? "");

  // Fetch agents by source (case-insensitive matching)
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["api-overview-agents", effectiveProvider],
    queryFn: async () => {
      if (!effectiveProvider) return [];
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .ilike("source", effectiveProvider)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveProvider,
  });

  // Fetch sales by source with pagination (case-insensitive matching)
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["api-overview-sales", effectiveProvider],
    queryFn: async () => {
      if (!effectiveProvider) return [];
      const allSales: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("sales")
          .select(`
            id,
            adversus_external_id,
            agent_name,
            agent_email,
            agent_external_id,
            customer_phone,
            customer_company,
            sale_datetime,
            validation_status,
            status,
            source,
            integration_type,
            dialer_campaign_id,
            created_at
          `)
          .ilike("source", effectiveProvider)
          .order("sale_datetime", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allSales.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allSales;
    },
    enabled: !!effectiveProvider,
  });

  // Fetch calls by integration type (case-insensitive matching)
  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ["api-overview-calls", effectiveProvider],
    queryFn: async () => {
      if (!effectiveProvider) return [];
      const allCalls: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("dialer_calls")
          .select(`
            id,
            external_id,
            integration_type,
            dialer_name,
            start_time,
            end_time,
            duration_seconds,
            status,
            agent_external_id,
            campaign_external_id,
            created_at
          `)
          .ilike("integration_type", effectiveProvider)
          .order("start_time", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allCalls.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allCalls;
    },
    enabled: !!effectiveProvider,
  });


  const providerStats = {
    agents: agents?.length || 0,
    activeAgents: agents?.filter(a => a.is_active).length || 0,
    sales: sales?.length || 0,
    calls: calls?.length || 0,
    events: sourceStats?.bySource?.[effectiveProvider.toLowerCase()]?.events || 0,
  };

  // Prepare pie chart data
  const agentsPieData = useMemo(() => {
    if (!sourceStats?.bySource) return [];
    return Object.entries(sourceStats.bySource)
      .filter(([_, stats]) => stats.agents > 0)
      .map(([name, stats]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: stats.agents,
      }))
      .sort((a, b) => b.value - a.value);
  }, [sourceStats]);

  const salesPieData = useMemo(() => {
    if (!sourceStats?.bySource) return [];
    return Object.entries(sourceStats.bySource)
      .filter(([_, stats]) => stats.sales > 0)
      .map(([name, stats]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: stats.sales,
      }))
      .sort((a, b) => b.value - a.value);
  }, [sourceStats]);

  const callsPieData = useMemo(() => {
    if (!sourceStats?.bySource) return [];
    return Object.entries(sourceStats.bySource)
      .filter(([_, stats]) => stats.calls > 0)
      .map(([name, stats]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: stats.calls,
      }))
      .sort((a, b) => b.value - a.value);
  }, [sourceStats]);

  if (sourcesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading API sources...</span>
      </div>
    );
  }

  if (!apiSources || apiSources.length === 0) {
    return (
      <EmptyState 
        icon={<Database className="h-12 w-12" />}
        title="No API data found"
        description="No data has been ingested from any API sources yet"
      />
    );
  }


  // Color mapping for providers
  const getProviderColor = (provider: string, index: number) => {
    const colors: Record<string, string> = {
      adversus: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
      enreach: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
      ase: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
      eesy: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
      lovablecph: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
      relatel_cphsales: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
      tryg: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
      m365: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30",
      economic: "from-teal-500/20 to-teal-600/10 border-teal-500/30",
    };
    const fallbackColors = [
      "from-violet-500/20 to-violet-600/10 border-violet-500/30",
      "from-rose-500/20 to-rose-600/10 border-rose-500/30",
      "from-sky-500/20 to-sky-600/10 border-sky-500/30",
    ];
    return colors[provider.toLowerCase()] || fallbackColors[index % fallbackColors.length];
  };

  const getProviderIconColor = (provider: string) => {
    const iconColors: Record<string, string> = {
      adversus: "text-blue-400",
      enreach: "text-emerald-400",
      ase: "text-purple-400",
      eesy: "text-amber-400",
      lovablecph: "text-pink-400",
      relatel_cphsales: "text-cyan-400",
      tryg: "text-orange-400",
      m365: "text-indigo-400",
      economic: "text-teal-400",
    };
    return iconColors[provider.toLowerCase()] || "text-primary";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Distribution Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Agents by Source ({sourceStats?.totalAgents || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={agentsPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {agentsPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Agents"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No agent data
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-400" />
              Sales by Source ({sourceStats?.totalSales || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {salesPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Sales"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-amber-400" />
              Calls by Source ({sourceStats?.totalCalls || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={callsPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {callsPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Calls"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No calls data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Selector */}
      <Tabs value={effectiveProvider} onValueChange={setSelectedProvider}>
        <ScrollArea className="w-full pb-2 mb-4">
          <TabsList className="inline-flex w-max min-w-full gap-1 bg-card/50 p-1">
            {apiSources.map((source, index) => (
              <TabsTrigger 
                key={source} 
                value={source} 
                className={`gap-1.5 capitalize text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r ${getProviderColor(source, index)} data-[state=active]:shadow-md transition-all`}
              >
                <Database className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${effectiveProvider === source ? getProviderIconColor(source) : ""}`} />
                {source}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        {apiSources.map((source, sourceIndex) => (
          <TabsContent key={source} value={source} className="space-y-4 sm:space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-purple-300 flex items-center gap-1.5 sm:gap-2">
                    <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400" />
                    Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-purple-100">
                    {(sourceStats?.bySource?.[source.toLowerCase()]?.events || 0).toLocaleString()}
                  </div>
                  <p className="text-[10px] sm:text-xs text-purple-300/70">API events</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-blue-300 flex items-center gap-1.5 sm:gap-2">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
                    Agents
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-blue-100">{providerStats.agents}</div>
                  <p className="text-[10px] sm:text-xs text-blue-300/70">
                    {providerStats.activeAgents} active
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-emerald-300 flex items-center gap-1.5 sm:gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                    Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-emerald-100">{providerStats.sales}</div>
                  <p className="text-[10px] sm:text-xs text-emerald-300/70">Total records</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-amber-300 flex items-center gap-1.5 sm:gap-2">
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
                    Calls
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-amber-100">{providerStats.calls}</div>
                  <p className="text-[10px] sm:text-xs text-amber-300/70">Total records</p>
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br col-span-2 sm:col-span-1 ${getProviderColor(source, sourceIndex)}`}>
                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className={`text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 ${getProviderIconColor(source)}`}>
                    <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-bold capitalize">{source}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">API Provider</p>
                </CardContent>
              </Card>
            </div>

            {/* Data Sections */}
            <Tabs defaultValue="events" className="space-y-4">
              <ScrollArea className="w-full pb-2">
                <TabsList className="inline-flex w-max min-w-full sm:w-auto gap-1">
                  <TabsTrigger value="events" className="gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Events</span>
                    <span className="sm:hidden">Evt</span>
                    <span className="text-[10px] sm:text-xs opacity-70">
                      ({sourceStats?.bySource?.[source.toLowerCase()]?.events?.toLocaleString() || providerStats.sales.toLocaleString()})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Agents</span>
                    <span className="sm:hidden">Agt</span>
                    <span className="text-[10px] sm:text-xs opacity-70">({agents?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Sales</span>
                    <span className="sm:hidden">Sls</span>
                    <span className="text-[10px] sm:text-xs opacity-70">({sales?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="calls" className="gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Calls</span>
                    <span className="sm:hidden">Cls</span>
                    <span className="text-[10px] sm:text-xs opacity-70">({calls?.length || 0})</span>
                  </TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" className="invisible" />
              </ScrollArea>

              {/* Events Tab */}
              <TabsContent value="events">
                <EventDataTable 
                  provider={source} 
                  providerColor={getProviderColor(source, sourceIndex)}
                  iconColor={getProviderIconColor(source)}
                />
              </TabsContent>

              {/* Agents Tab */}
              <TabsContent value="agents">
                <AgentsDataTable
                  provider={source}
                  providerColor={getProviderColor(source, sourceIndex)}
                  iconColor={getProviderIconColor(source)}
                  agents={agents || []}
                  isLoading={agentsLoading}
                />
              </TabsContent>

              {/* Sales Tab */}
              <TabsContent value="sales">
                <SalesDataTable
                  provider={source}
                  providerColor={getProviderColor(source, sourceIndex)}
                  iconColor={getProviderIconColor(source)}
                  sales={sales || []}
                  isLoading={salesLoading}
                />
              </TabsContent>

              {/* Calls Tab */}
              <TabsContent value="calls">
                <CallsDataTable
                  provider={source}
                  providerColor={getProviderColor(source, sourceIndex)}
                  iconColor={getProviderIconColor(source)}
                  calls={calls || []}
                  isLoading={callsLoading}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-4">{icon}</div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
