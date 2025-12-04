import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Activity, ListOrdered, Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdversusStats {
  eventsTotal: number;
  eventsProcessed: number;
  salesTotal: number;
  saleItemsTotal: number;
}

export default function AdversusData() {
  useEffect(() => {
    document.title = "Datakilder info | CPH Sales";
  }, []);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdversusStats>({
    queryKey: ["adversus-stats"],
    queryFn: async () => {
      const [eventsTotalRes, eventsProcessedRes, salesRes, saleItemsRes] = await Promise.all([
        supabase.from("adversus_events").select("*", { count: "exact", head: true }),
        supabase.from("adversus_events").select("*", { count: "exact", head: true }).eq("processed", true),
        supabase.from("sales").select("*", { count: "exact", head: true }),
        supabase.from("sale_items").select("*", { count: "exact", head: true }),
      ]);

      if (eventsTotalRes.error) throw eventsTotalRes.error;
      if (eventsProcessedRes.error) throw eventsProcessedRes.error;
      if (salesRes.error) throw salesRes.error;
      if (saleItemsRes.error) throw saleItemsRes.error;

      return {
        eventsTotal: eventsTotalRes.count ?? 0,
        eventsProcessed: eventsProcessedRes.count ?? 0,
        salesTotal: salesRes.count ?? 0,
        saleItemsTotal: saleItemsRes.count ?? 0,
      } satisfies AdversusStats;
    },
  });

  const { data: recentEvents, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ["adversus-events-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_events")
        .select("id, external_id, event_type, received_at, created_at, processed, payload")
        .order("received_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      return data;
    },
  });

  const processedPercentage = stats && stats.eventsTotal > 0
    ? Math.round((stats.eventsProcessed / stats.eventsTotal) * 100)
    : 0;

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Datakilder info</h1>
            <p className="text-muted-foreground">
              Overblik over de datakilder der bruges til Adversus-integration og salg
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            Live data fra Adversus-integration
          </div>
        </header>

        {/* KPI kort */}
        <section aria-label="Adversus nøgletal" className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" /> Events modtaget
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : statsError ? (
                <p className="text-destructive text-sm">Kunne ikke hente data</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{stats?.eventsTotal ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rå webhook-events i tabellen <code className="font-mono">adversus_events</code>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Events behandlet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : statsError ? (
                <p className="text-destructive text-sm">Kunne ikke hente data</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{stats?.eventsProcessed ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {processedPercentage}% af alle events er markeret som processed
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ListOrdered className="h-4 w-4" /> Salg (records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : statsError ? (
                <p className="text-destructive text-sm">Kunne ikke hente data</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{stats?.salesTotal ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rækker i tabellen <code className="font-mono">sales</code>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> Produktlinjer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : statsError ? (
                <p className="text-destructive text-sm">Kunne ikke hente data</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{stats?.saleItemsTotal ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Linjer i tabellen <code className="font-mono">sale_items</code>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Seneste events */}
        <section aria-label="Seneste Adversus events" className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Seneste Adversus-events</h2>
            <Badge variant="outline" className="text-xs">
              {recentEvents?.length ?? 0} seneste events
            </Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              {eventsLoading ? (
                <p className="text-muted-foreground text-center py-8">Indlæser events...</p>
              ) : eventsError ? (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Kunne ikke hente events.</span>
                </div>
              ) : !recentEvents || recentEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Der er endnu ikke modtaget nogen events fra Adversus.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>External ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Modtaget</TableHead>
                        <TableHead>Oprettet</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="text-right">Detaljer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentEvents.map((event: any) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-mono text-xs">
                            {String(event.id).slice(0, 8)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {event.external_id || "-"}
                          </TableCell>
                          <TableCell>{event.event_type}</TableCell>
                          <TableCell>
                            {event.received_at
                              ? format(new Date(event.received_at), "dd.MM.yyyy HH:mm", { locale: da })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {event.created_at
                              ? format(new Date(event.created_at), "dd.MM.yyyy HH:mm", { locale: da })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {event.processed ? (
                              <Badge className="bg-emerald-500 text-white hover:bg-emerald-500/90">
                                Processeret
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500 text-amber-600">
                                Afventer
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEvent(event);
                                setDetailOpen(true);
                              }}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Vis alt
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Adversus event detaljer</DialogTitle>
                      </DialogHeader>
                      {selectedEvent && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">ID</p>
                              <p className="font-mono break-all text-xs">{selectedEvent.id}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">External ID</p>
                              <p className="font-mono break-all text-xs">{selectedEvent.external_id || "-"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Type</p>
                              <p>{selectedEvent.event_type}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <p>{selectedEvent.processed ? "Processeret" : "Afventer"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Modtaget</p>
                              <p>
                                {selectedEvent.received_at
                                  ? format(new Date(selectedEvent.received_at), "dd.MM.yyyy HH:mm", { locale: da })
                                  : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Oprettet</p>
                              <p>
                                {selectedEvent.created_at
                                  ? format(new Date(selectedEvent.created_at), "dd.MM.yyyy HH:mm", { locale: da })
                                  : "-"}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Payload (rå JSON fra Adversus)</p>
                            <pre className="bg-muted rounded-md p-3 text-xs max-h-80 overflow-auto font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(selectedEvent.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
