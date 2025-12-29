import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users, Phone, ShoppingCart, Database, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApiDataOverview() {
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [agentSearch, setAgentSearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [callsSearch, setCallsSearch] = useState("");

  // Fetch all unique API sources dynamically
  const { data: apiSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["api-overview-sources"],
    queryFn: async () => {
      // Get sources from agents, sales, and calls
      const [agentSources, saleSources, callSources, integrationTypes] = await Promise.all([
        supabase.from("agents").select("source").not("source", "is", null),
        supabase.from("sales").select("source").not("source", "is", null),
        supabase.from("dialer_calls").select("integration_type").not("integration_type", "is", null),
        supabase.from("api_integrations").select("type, name"),
      ]);

      const sources = new Set<string>();
      
      agentSources.data?.forEach(r => r.source && sources.add(r.source.toLowerCase()));
      saleSources.data?.forEach(r => r.source && sources.add(r.source.toLowerCase()));
      callSources.data?.forEach(r => r.integration_type && sources.add(r.integration_type.toLowerCase()));
      integrationTypes.data?.forEach(r => r.type && sources.add(r.type.toLowerCase()));

      return Array.from(sources).sort();
    },
  });

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

  // Filter functions
  const filteredAgents = agents?.filter(agent => {
    if (!agentSearch) return true;
    const search = agentSearch.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(search) ||
      agent.email?.toLowerCase().includes(search) ||
      agent.external_adversus_id?.toLowerCase().includes(search) ||
      agent.external_dialer_id?.toLowerCase().includes(search)
    );
  }) || [];

  const filteredSales = sales?.filter(sale => {
    if (!salesSearch) return true;
    const search = salesSearch.toLowerCase();
    return (
      sale.agent_name?.toLowerCase().includes(search) ||
      sale.agent_email?.toLowerCase().includes(search) ||
      sale.adversus_external_id?.toLowerCase().includes(search) ||
      sale.customer_phone?.toLowerCase().includes(search) ||
      sale.customer_company?.toLowerCase().includes(search)
    );
  }) || [];

  const filteredCalls = calls?.filter(call => {
    if (!callsSearch) return true;
    const search = callsSearch.toLowerCase();
    return (
      call.external_id?.toLowerCase().includes(search) ||
      call.agent_external_id?.toLowerCase().includes(search) ||
      call.campaign_external_id?.toLowerCase().includes(search) ||
      call.status?.toLowerCase().includes(search)
    );
  }) || [];

  const providerStats = {
    agents: agents?.length || 0,
    activeAgents: agents?.filter(a => a.is_active).length || 0,
    sales: sales?.length || 0,
    calls: calls?.length || 0,
  };

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

  return (
    <div className="space-y-6">
      {/* Provider Selector */}
      <Tabs value={effectiveProvider} onValueChange={setSelectedProvider}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          {apiSources.map(source => (
            <TabsTrigger key={source} value={source} className="gap-2 capitalize">
              <Database className="h-4 w-4" />
              {source}
            </TabsTrigger>
          ))}
        </TabsList>

        {apiSources.map(source => (
          <TabsContent key={source} value={source} className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.agents}</div>
                  <p className="text-xs text-muted-foreground">
                    {providerStats.activeAgents} active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.sales}</div>
                  <p className="text-xs text-muted-foreground">Total records</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.calls}</div>
                  <p className="text-xs text-muted-foreground">Total records</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">{source}</div>
                  <p className="text-xs text-muted-foreground">API Provider</p>
                </CardContent>
              </Card>
            </div>

            {/* Data Sections */}
            <Tabs defaultValue="agents" className="space-y-4">
              <TabsList>
                <TabsTrigger value="agents" className="gap-2">
                  <Users className="h-4 w-4" />
                  Agents ({filteredAgents.length})
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Sales ({filteredSales.length})
                </TabsTrigger>
                <TabsTrigger value="calls" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Calls ({filteredCalls.length})
                </TabsTrigger>
              </TabsList>

              {/* Agents Tab */}
              <TabsContent value="agents">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize">Agents from {source}</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search agents..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {agentsLoading ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : filteredAgents.length === 0 ? (
                      <EmptyState 
                        icon={<Users className="h-12 w-12" />}
                        title="No agents found"
                        description={agentSearch ? "Try adjusting your search" : `No agents from ${source} yet`}
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>External ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Updated</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAgents.slice(0, 100).map((agent) => (
                              <TableRow key={agent.id}>
                                <TableCell className="font-medium">{agent.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {agent.email}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {agent.external_adversus_id || agent.external_dialer_id || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={agent.is_active ? "default" : "secondary"}>
                                    {agent.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {agent.updated_at ? format(new Date(agent.updated_at), "dd/MM/yyyy HH:mm") : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {filteredAgents.length > 100 && (
                          <p className="text-sm text-muted-foreground text-center mt-4">
                            Showing 100 of {filteredAgents.length} agents
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sales Tab */}
              <TabsContent value="sales">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize">Sales from {source}</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search sales..."
                          value={salesSearch}
                          onChange={(e) => setSalesSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {salesLoading ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : filteredSales.length === 0 ? (
                      <EmptyState 
                        icon={<ShoppingCart className="h-12 w-12" />}
                        title="No sales found"
                        description={salesSearch ? "Try adjusting your search" : `No sales from ${source} yet`}
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>External ID</TableHead>
                              <TableHead>Agent</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Sale Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSales.slice(0, 100).map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell className="font-mono text-xs">
                                  {sale.adversus_external_id || "-"}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{sale.agent_name || "-"}</div>
                                    <div className="text-xs text-muted-foreground">{sale.agent_email || "-"}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{sale.customer_company || "-"}</div>
                                    <div className="text-xs text-muted-foreground">{sale.customer_phone || "-"}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusVariant(sale.validation_status)}>
                                    {sale.validation_status || sale.status || "unknown"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm") : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {filteredSales.length > 100 && (
                          <p className="text-sm text-muted-foreground text-center mt-4">
                            Showing 100 of {filteredSales.length} sales
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Calls Tab */}
              <TabsContent value="calls">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize">Calls from {source}</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search calls..."
                          value={callsSearch}
                          onChange={(e) => setCallsSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {callsLoading ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : filteredCalls.length === 0 ? (
                      <EmptyState 
                        icon={<Phone className="h-12 w-12" />}
                        title="No calls found"
                        description={callsSearch ? "Try adjusting your search" : `No calls from ${source} yet`}
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>External ID</TableHead>
                              <TableHead>Agent ID</TableHead>
                              <TableHead>Campaign</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Start Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCalls.slice(0, 100).map((call) => (
                              <TableRow key={call.id}>
                                <TableCell className="font-mono text-xs">
                                  {call.external_id || "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {call.agent_external_id || "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {call.campaign_external_id || "-"}
                                </TableCell>
                                <TableCell>
                                  {call.duration_seconds ? formatDuration(call.duration_seconds) : "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{call.status || "unknown"}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {call.start_time ? format(new Date(call.start_time), "dd/MM/yyyy HH:mm") : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {filteredCalls.length > 100 && (
                          <p className="text-sm text-muted-foreground text-center mt-4">
                            Showing 100 of {filteredCalls.length} calls
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
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

function getStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "validated":
    case "approved":
      return "default";
    case "pending":
      return "outline";
    case "cancelled":
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}
