import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">API Endpoint</p>
                <code className="block bg-muted/50 p-3 rounded text-xs break-all border">
                  https://api.adversus.io/
                </code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Webhook URL</p>
                <code className="block bg-muted/50 p-3 rounded text-xs break-all border">
                  https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/adversus-webhook
                </code>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Aktiverede datakilder</p>
              <div className="flex flex-wrap gap-2">
                {enabledSources.length > 0 ? (
                  enabledSources.map((source) => (
                    <Badge key={source} variant="secondary">
                      {sourceLabels[source] ?? source}
                    </Badge>
                  ))
                ) : (
                  <>
                    <Badge variant="outline" className="text-muted-foreground">Ingen aktiveret</Badge>
                  </>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Edge funktioner</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <code className="font-mono text-xs bg-muted/50 px-1 rounded">sync-adversus</code> - Synkroniserer salgsdata til database</li>
                <li>• <code className="font-mono text-xs bg-muted/50 px-1 rounded">adversus-webhook</code> - Modtager realtime events fra Adversus</li>
                <li>• <code className="font-mono text-xs bg-muted/50 px-1 rounded">backfill-opp</code> - Henter manglende OPP numre for TDC salg</li>
                <li>• <code className="font-mono text-xs bg-muted/50 px-1 rounded">fetch-single-opp</code> - Henter enkelt OPP nummer via lead ID</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Konfigurer API-nøgler og sync-indstillinger under <span className="font-medium">Indstillinger → API-integrationer</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
