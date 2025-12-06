import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle2, XCircle, Settings, Zap } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
const sourceLabels: Record<string, string> = {
  campaigns: "Kampagner",
  sales: "Salg",
  users: "Brugere",
  leads: "Leads",
  products: "Produkter",
};

export function CphAdversusApiTab() {
  const { data: integration, isLoading } = useQuery({
    queryKey: ["adversus-integration"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_integrations")
        .select("*")
        .eq("type", "adversus")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: webhookStats } = useQuery({
    queryKey: ["adversus-webhook-stats"],
    queryFn: async () => {
      const [totalRes, last24hRes, latestRes] = await Promise.all([
        supabase.from("adversus_events").select("*", { count: "exact", head: true }),
        supabase.from("adversus_events")
          .select("*", { count: "exact", head: true })
          .gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("adversus_events")
          .select("received_at")
          .order("received_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      
      return {
        total: totalRes.count ?? 0,
        last24h: last24hRes.count ?? 0,
        lastReceived: latestRes.data?.received_at ?? null,
      };
    },
  });

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">CPH Adversus API</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Indlæser...</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const enabledSources = (integration?.enabled_sources as string[]) ?? [];
  const secrets = (integration?.secrets as string[]) ?? [];

  return (
    <section aria-label="CPH Adversus API" className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">CPH Adversus API</h2>
        {integration ? (
          <Badge variant={integration.is_active ? "default" : "secondary"} className="text-xs">
            {integration.is_active ? "Aktiv" : "Inaktiv"}
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            Ikke konfigureret
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Integration status</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {integration?.is_active ? (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktiv
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5" /> Inaktiv
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sync frekvens</span>
                <span className="text-sm">
                  {integration?.sync_frequency_minutes 
                    ? integration.sync_frequency_minutes >= 60 
                      ? `Hver ${integration.sync_frequency_minutes / 60} time${integration.sync_frequency_minutes > 60 ? "r" : ""}`
                      : `Hvert ${integration.sync_frequency_minutes} min`
                    : "Manuel"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sidst synket</span>
                <span className="text-sm">
                  {integration?.last_sync_at 
                    ? format(new Date(integration.last_sync_at), "dd.MM.yy HH:mm", { locale: da })
                    : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Stats Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Webhook statistik</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Events total</span>
                <span className="text-sm font-medium">{webhookStats?.total ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sidste 24 timer</span>
                <span className="text-sm font-medium">{webhookStats?.last24h ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Seneste event</span>
                <span className="text-sm">
                  {webhookStats?.lastReceived 
                    ? format(new Date(webhookStats.lastReceived), "dd.MM.yy HH:mm", { locale: da })
                    : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credentials Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">API-nøgler</p>
            </div>
            <div className="space-y-2">
              {secrets.length > 0 ? (
                secrets.map((secret) => (
                  <div key={secret} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-muted-foreground">
                      {secret === "ADVERSUS_API_USERNAME" ? "Brugernavn" : 
                       secret === "ADVERSUS_API_PASSWORD" ? "Adgangskode" : secret}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Ingen API-nøgler konfigureret</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Konfigurationstabel */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Felt</TableHead>
                <TableHead>Værdi</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">API Endpoint</TableCell>
                <TableCell className="font-mono text-xs">https://api.adversus.io/</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Webhook URL</TableCell>
                <TableCell className="font-mono text-xs">https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/adversus-webhook</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Sync frekvens</TableCell>
                <TableCell>{integration?.sync_frequency_minutes ?? 60} minutter</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Sidst synket</TableCell>
                <TableCell>
                  {integration?.last_sync_at 
                    ? format(new Date(integration.last_sync_at), "dd/MM/yyyy HH:mm", { locale: da })
                    : "Aldrig"
                  }
                </TableCell>
                <TableCell>
                  {integration?.last_sync_at ? (
                    <Badge variant="outline" className="text-green-400">Synkroniseret</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-400">Afventer</Badge>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Events total</TableCell>
                <TableCell>{webhookStats?.total ?? 0}</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Events sidste 24 timer</TableCell>
                <TableCell>{webhookStats?.last24h ?? 0}</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Seneste event</TableCell>
                <TableCell>
                  {webhookStats?.lastReceived 
                    ? format(new Date(webhookStats.lastReceived), "dd/MM/yyyy HH:mm", { locale: da })
                    : "-"
                  }
                </TableCell>
                <TableCell>-</TableCell>
              </TableRow>
              {enabledSources.length > 0 ? (
                enabledSources.map((source) => (
                  <TableRow key={source}>
                    <TableCell className="font-medium">Datakilde: {sourceLabels[source] ?? source}</TableCell>
                    <TableCell>Aktiveret</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Aktiv
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="font-medium">Datakilder</TableCell>
                  <TableCell>Ingen aktiveret</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-amber-400">Afventer</Badge>
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="font-medium">Edge funktion</TableCell>
                <TableCell className="font-mono text-xs">sync-adversus</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Edge funktion</TableCell>
                <TableCell className="font-mono text-xs">adversus-webhook</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Edge funktion</TableCell>
                <TableCell className="font-mono text-xs">backfill-opp</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Edge funktion</TableCell>
                <TableCell className="font-mono text-xs">fetch-single-opp</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-400">Aktiv</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Konfigurer API-nøgler og sync-indstillinger under <span className="font-medium">Indstillinger → API-integrationer</span>
      </p>
    </section>
  );
}
