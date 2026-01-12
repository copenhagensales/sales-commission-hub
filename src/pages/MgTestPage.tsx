import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Percent, 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  ShoppingCart,
  Megaphone,
  Activity,
  Table as TableIcon,
  Play
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import SalarySchemes from "./SalarySchemes";
import RelatelEventsTable from "@/components/relatel/RelatelEventsTable";
import { toast } from "sonner";

const RELATEL_INTEGRATION_ID = "657c2050-1faa-4233-a964-900fb9e7b8c6";

interface IntegrationLog {
  id: string;
  status: string;
  message: string;
  details: {
    source?: string;
    days?: number;
    campaignId?: string | null;
    results?: {
      campaigns?: { processed: number; errors: number };
      users?: { processed: number; errors: number; skipped?: number };
      sales?: { processed: number; errors: number };
      calls?: { processed: number; errors: number; matched?: number };
    };
    error?: string;
  };
  created_at: string;
}

interface DilaerIntegration {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_status: string | null;
  sync_frequency_minutes: number | null;
}

export default function MgTestPage() {
  const [activeTab, setActiveTab] = useState("salary-schemes");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">MG Test</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="salary-schemes" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Lønordninger
            </TabsTrigger>
            <TabsTrigger value="relatel-data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Relatel Status
            </TabsTrigger>
            <TabsTrigger value="relatel-events" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Relatel Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="salary-schemes" className="mt-6">
            <SalarySchemesTab />
          </TabsContent>

          <TabsContent value="relatel-data" className="mt-6">
            <RelatelDataTab />
          </TabsContent>

          <TabsContent value="relatel-events" className="mt-6">
            <RelatelEventsTable />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Inline the SalarySchemes content without MainLayout wrapper
function SalarySchemesTab() {
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-salary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salarySchemes = [] } = useQuery({
    queryKey: ["salary-schemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_schemes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: employeeSchemes = [] } = useQuery({
    queryKey: ["employee-salary-schemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salary_schemes")
        .select(`*, salary_schemes (*)`)
        .is("effective_to", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const employeeIds = data.map(d => d.employee_id);
      const { data: employeeData } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .in("id", employeeIds);
      
      const employeeMap = new Map(employeeData?.map(e => [e.id, e]) || []);
      
      return data.map(d => ({
        ...d,
        employee: employeeMap.get(d.employee_id)
      }));
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tilgængelige lønordninger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {salarySchemes.map((scheme: any) => (
              <div key={scheme.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{scheme.name}</span>
                  <Badge variant="secondary">{scheme.scheme_type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{scheme.description}</p>
                {scheme.percentage_value && (
                  <p className="text-sm font-medium text-primary">
                    {scheme.percentage_value}% af teamets DB
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktive tildelinger ({employeeSchemes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employeeSchemes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ingen lønordninger tildelt endnu
            </p>
          ) : (
            <div className="space-y-3">
              {employeeSchemes.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">
                        {assignment.employee?.first_name} {assignment.employee?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.employee?.job_title || "Ingen stilling"}
                      </p>
                    </div>
                    <Badge variant="outline">{assignment.salary_schemes?.name}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RelatelDataTab() {
  const queryClient = useQueryClient();
  
  // Fetch integration details
  const { data: integration, isLoading: loadingIntegration } = useQuery({
    queryKey: ["relatel-integration"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("*")
        .eq("id", RELATEL_INTEGRATION_ID)
        .single();
      if (error) throw error;
      return data as DilaerIntegration;
    },
  });

  // Fetch sync logs
  const { data: logs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["relatel-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_logs")
        .select("*")
        .eq("integration_id", RELATEL_INTEGRATION_ID)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as IntegrationLog[];
    },
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("integration-engine", {
        body: {
          source: "Relatel_CPHSALES",
          action: "sync",
          days: 7,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || "Synkronisering fejlede");
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Synkronisering gennemført: ${data.results?.sales?.processed || 0} salg hentet`);
      queryClient.invalidateQueries({ queryKey: ["relatel-logs"] });
      queryClient.invalidateQueries({ queryKey: ["relatel-events"] });
    },
    onError: (error: Error) => {
      toast.error(`Synkronisering fejlede: ${error.message}`);
    },
  });

  // Aggregate stats from latest successful sync
  const latestSuccess = logs.find(l => l.status === "success");
  const stats = latestSuccess?.details?.results;

  // Calculate totals from recent logs
  const last24hLogs = logs.filter(l => {
    const logTime = new Date(l.created_at).getTime();
    const now = Date.now();
    return now - logTime < 24 * 60 * 60 * 1000;
  });

  const totalSalesProcessed = last24hLogs
    .filter(l => l.status === "success")
    .reduce((acc, l) => acc + (l.details?.results?.sales?.processed || 0), 0);

  const errorCount = last24hLogs.filter(l => l.status === "error").length;
  const successCount = last24hLogs.filter(l => l.status === "success").length;

  if (loadingIntegration || loadingLogs) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integration Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {integration?.name || "Relatel_CPHSALES"}
              </CardTitle>
              <CardDescription>
                Provider: {integration?.provider?.toUpperCase()} • 
                Synk hver {integration?.sync_frequency_minutes || 15} min
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {integration?.is_active ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aktiv
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inaktiv
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Opdater
              </Button>
              <Button 
                size="sm" 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Synk nu
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">
                {integration?.last_sync_at 
                  ? format(new Date(integration.last_sync_at), "HH:mm", { locale: da })
                  : "-"
                }
              </p>
              <p className="text-xs text-muted-foreground">Sidste synk</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <ShoppingCart className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{totalSalesProcessed}</p>
              <p className="text-xs text-muted-foreground">Salg (24t)</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{successCount}</p>
              <p className="text-xs text-muted-foreground">Vellykkede synk</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <XCircle className="h-5 w-5 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Fejl (24t)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latest Sync Results */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seneste synkronisering</CardTitle>
            <CardDescription>
              {latestSuccess && format(new Date(latestSuccess.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.campaigns && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Kampagner</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.campaigns.processed}</p>
                  {stats.campaigns.errors > 0 && (
                    <p className="text-xs text-destructive">{stats.campaigns.errors} fejl</p>
                  )}
                </div>
              )}
              {stats.users && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Brugere</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.users.processed}</p>
                  {stats.users.skipped && (
                    <p className="text-xs text-muted-foreground">{stats.users.skipped} sprunget over</p>
                  )}
                </div>
              )}
              {stats.sales && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Salg</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.sales.processed}</p>
                  {stats.sales.errors > 0 && (
                    <p className="text-xs text-destructive">{stats.sales.errors} fejl</p>
                  )}
                </div>
              )}
              {stats.calls && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Opkald</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.calls.processed}</p>
                  {stats.calls.matched !== undefined && (
                    <p className="text-xs text-muted-foreground">{stats.calls.matched} matchede</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Synkroniseringshistorik</CardTitle>
          <CardDescription>De seneste 50 synkroniseringer</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 border rounded-lg flex items-start gap-3 ${
                    log.status === "error" ? "border-destructive/50 bg-destructive/5" : ""
                  }`}
                >
                  {log.status === "success" ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.message}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.details?.days || 2} dage
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.created_at), "d. MMM HH:mm:ss", { locale: da })}
                    </p>
                    {log.status === "error" && log.details?.error && (
                      <p className="text-xs text-destructive mt-1">{log.details.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
