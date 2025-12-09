import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Activity, ListOrdered, Link as LinkIcon, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { CphAdversusApiTab } from "@/components/adversus/CphAdversusApiTab";

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

  const queryClient = useQueryClient();
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<{ remaining: number; lastProcessed: number } | null>(null);

  const { data: missingOppCount } = useQuery({
    queryKey: ["missing-opp-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .is("adversus_opp_number", null)
        .not("adversus_event_id", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const handleBackfillOpp = async () => {
    setIsBackfilling(true);
    let totalProcessed = 0;
    let remaining = 0;
    
    try {
      while (true) {
        const response = await supabase.functions.invoke("backfill-opp", {});
        
        // Log full response for debugging
        console.log("backfill-opp response:", response);
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        const data = response.data;
        console.log("backfill-opp data:", data);
        
        if (!data.success) {
          throw new Error(data.error || "Ukendt fejl");
        }
        
        // Safely handle undefined/null values - use explicit checks
        const successfulCount = typeof data.successful === 'number' ? data.successful : 0;
        const processedCount = typeof data.processed === 'number' ? data.processed : 0;
        const noOppCount = typeof data.noOppFound === 'number' ? data.noOppFound : 0;
        remaining = typeof data.remaining === 'number' ? data.remaining : 0;
        
        totalProcessed += successfulCount;
        
        // Only update status if we have valid numbers
        if (!isNaN(totalProcessed) && !isNaN(remaining)) {
          setBackfillStatus({ remaining, lastProcessed: totalProcessed });
        }
        
        // Show warning if OPP field not found in any sales
        if (processedCount > 0 && successfulCount === 0 && noOppCount > 0) {
          toast.warning(`${noOppCount} salg behandlet, men ingen OPP numre fundet. Tjek om 'OPP' feltet findes i Adversus.`);
        }
        
        // Log detailed results if available
        if (data.results && Array.isArray(data.results)) {
          const noOppResults = data.results.filter((r: any) => r.status === 'no_opp');
          const errorResults = data.results.filter((r: any) => r.status === 'error');
          
          if (noOppResults.length > 0) {
            console.log("Sales without OPP in Adversus:", noOppResults);
          }
          if (errorResults.length > 0) {
            console.log("Sales with errors:", errorResults);
          }
        }
        
        // Break if no more to process or nothing was processed
        if (remaining === 0 || processedCount === 0) {
          // Show specific message if nothing was found
          if (processedCount === 0 && totalProcessed === 0) {
            toast.info("Ingen salg fundet der mangler OPP nummer.");
          }
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (totalProcessed > 0) {
        toast.success(`Færdig! Opdaterede ${totalProcessed} salg med OPP.`);
      }
      queryClient.invalidateQueries({ queryKey: ["missing-opp-count"] });
    } catch (error) {
      console.error("Backfill error:", error);
      toast.error("Fejl ved OPP backfill: " + (error instanceof Error ? error.message : "Ukendt fejl"));
      if (totalProcessed > 0) {
        toast.info(`Nåede at opdatere ${totalProcessed} salg før fejlen.`);
      }
    } finally {
      setIsBackfilling(false);
    }
  };

  const { data: recentEvents, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ["adversus-events-recent", showAllEvents],
    queryFn: async () => {
      let query = supabase
        .from("adversus_events")
        .select("id, external_id, event_type, received_at, created_at, processed, payload")
        .order("received_at", { ascending: false });

      if (!showAllEvents) {
        query = query.limit(25);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });

  const { data: tdcImports, isLoading: tdcLoading, error: tdcError } = useQuery({
    queryKey: ["tdc-ann-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tdc_cancellation_imports")
        .select("id, uploaded_at, uploaded_by, raw_data")
        .order("uploaded_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data ?? [];
    },
  });

  const processedPercentage = stats && stats.eventsTotal > 0
    ? Math.round((stats.eventsProcessed / stats.eventsTotal) * 100)
    : 0;

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTdcImport, setSelectedTdcImport] = useState<any | null>(null);
  const [tdcDetailOpen, setTdcDetailOpen] = useState(false);

  const latestTdcImport = (tdcImports && tdcImports[0]) as any | undefined;

  const tdcRows = useMemo(() => {
    if (!latestTdcImport?.raw_data?.content_base64) return null;
    try {
      const base64 = latestTdcImport.raw_data.content_base64 as string;
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const workbook = XLSX.read(bytes, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      return json;
    } catch (error) {
      console.error("Fejl ved parsing af TDC ann Excel", error);
      return null;
    }
  }, [latestTdcImport]);

  const TDC_PRIORITY_HEADER_KEYWORDS = [
    "dato", "date", "ordrenr", "ordre id", "ordreid", "orderid", "order id", "status", "resultat",
  ];

  const normalizeTdcHeader = (header: string) => header.toLowerCase().replace(/[\s_]+/g, "");

  const isPriorityTdcHeader = (header: string) => {
    const norm = normalizeTdcHeader(header);
    return TDC_PRIORITY_HEADER_KEYWORDS.some((keyword) =>
      norm.includes(keyword.replace(/\s+/g, ""))
    );
  };

  const tdcHeaders = useMemo(() => {
    if (!tdcRows || tdcRows.length === 0) return [] as string[];
    const rawHeaders = Object.keys(tdcRows[0]);
    const priority: string[] = [];
    const others: string[] = [];
    rawHeaders.forEach((header) => {
      if (isPriorityTdcHeader(header)) {
        priority.push(header);
      } else {
        others.push(header);
      }
    });
    return [...priority, ...others];
  }, [tdcRows]);

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

          {(missingOppCount ?? 0) > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> Salg mangler OPP nummer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{missingOppCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Salg uden OPP nummer (hentes 10 ad gangen pga rate limiting)
                    </p>
                    {backfillStatus && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sidst hentet: {backfillStatus.lastProcessed} | Tilbage: {backfillStatus.remaining}
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={handleBackfillOpp} 
                    disabled={isBackfilling}
                    variant="outline"
                    className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-spin' : ''}`} />
                    {isBackfilling ? 'Henter...' : 'Hent OPP numre'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <Tabs defaultValue="adversus" className="space-y-4">
          <TabsList>
            <TabsTrigger value="adversus">Adversus CPH data</TabsTrigger>
            <TabsTrigger value="tdc-ann">TDC annulleringer</TabsTrigger>
            <TabsTrigger value="cph-api">CPH Adversus API</TabsTrigger>
          </TabsList>

          <TabsContent value="adversus">
            <section aria-label="Seneste Adversus events" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Adversus-events</h2>
                  <Badge variant="outline" className="text-xs">
                    {recentEvents?.length ?? 0} {showAllEvents ? "events" : "seneste events"}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllEvents(!showAllEvents)}
                  className="text-sm text-primary hover:underline"
                >
                  {showAllEvents ? "Vis kun seneste 25" : "Vis alle"}
                </button>
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
                            <TableHead>Kunde</TableHead>
                            <TableHead>Modtaget</TableHead>
                            <TableHead>Oprettet</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                            <TableHead className="text-right">Detaljer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentEvents.map((event: any) => {
                            const campaignName = event.payload?.payload?.campaign?.name || 
                                                 event.payload?.campaign?.name || 
                                                 "-";
                            return (
                            <TableRow key={event.id}>
                              <TableCell className="font-mono text-xs">
                                {String(event.id).slice(0, 8)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {event.external_id || "-"}
                              </TableCell>
                              <TableCell>{event.event_type}</TableCell>
                              <TableCell className="max-w-[150px] truncate" title={campaignName}>
                                {campaignName}
                              </TableCell>
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
                            );
                          })}
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
          </TabsContent>

          <TabsContent value="tdc-ann">
            <section aria-label="TDC annulleringer" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">TDC annulleringer</h2>
                  <p className="text-sm text-muted-foreground">
                    Overblik over Excel-importer til TDC annulleringer ("tdc ann") fra Indstillinger.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {tdcImports?.length ?? 0} importer
                </Badge>
              </div>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {tdcLoading ? (
                    <p className="text-muted-foreground text-center py-8">Indlæser TDC ann-importer...</p>
                  ) : tdcError ? (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>Kunne ikke hente TDC ann-importer.</span>
                    </div>
                  ) : !tdcImports || tdcImports.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Der er endnu ikke uploadet nogen TDC ann Excel-filer. Gå til Indstillinger &rarr; TDC annulleringer
                      for at uploade den nyeste fil.
                    </p>
                  ) : (
                    <>
                      {latestTdcImport && (
                        <div className="rounded-md border bg-muted/40 p-3 text-sm flex flex-col gap-1">
                          <p className="font-medium">Seneste import</p>
                          <p>
                            Dato:{" "}
                            {latestTdcImport.uploaded_at
                              ? format(new Date(latestTdcImport.uploaded_at), "dd.MM.yyyy HH:mm", { locale: da })
                              : "-"}
                          </p>
                          <p>
                            Filnavn:{" "}
                            {latestTdcImport.raw_data?.filename ??
                              latestTdcImport.raw_data?.originalName ??
                              "tdc ann (ukendt navn)"}
                          </p>
                          <p>
                            Størrelse:{" "}
                            {latestTdcImport.raw_data?.size
                              ? `${Math.round(latestTdcImport.raw_data.size / 1024)} kB`
                              : "-"}
                          </p>
                        </div>
                      )}

                      {tdcRows && tdcRows.length > 0 && tdcHeaders.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Linjer i seneste fil</p>
                          <div className="border rounded-md overflow-auto max-h-[600px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {tdcHeaders.map((header) => (
                                    <TableHead
                                      key={header}
                                      className={
                                        isPriorityTdcHeader(header)
                                          ? "font-semibold text-primary bg-muted/60"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {header}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tdcRows.map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {tdcHeaders.map((header) => (
                                      <TableCell
                                        key={header}
                                        className={isPriorityTdcHeader(header) ? "font-medium" : ""}
                                      >
                                        {String((row as Record<string, any>)[header] ?? "")}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Alle importer</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Dato</TableHead>
                              <TableHead>Filnavn</TableHead>
                              <TableHead>Størrelse</TableHead>
                              <TableHead>Uploadet af (id)</TableHead>
                              <TableHead className="text-right">Detaljer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tdcImports.map((imp: any) => (
                              <TableRow key={imp.id}>
                                <TableCell>
                                  {imp.uploaded_at
                                    ? format(new Date(imp.uploaded_at), "dd.MM.yyyy HH:mm", { locale: da })
                                    : "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {imp.raw_data?.filename ?? imp.raw_data?.originalName ?? "tdc ann"}
                                </TableCell>
                                <TableCell>
                                  {imp.raw_data?.size
                                    ? `${Math.round(imp.raw_data.size / 1024)} kB`
                                    : "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {imp.uploaded_by ? String(imp.uploaded_by).slice(0, 8) : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTdcImport(imp);
                                      setTdcDetailOpen(true);
                                    }}
                                    className="text-xs font-medium text-primary hover:underline"
                                  >
                                    Vis detaljer
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <Dialog open={tdcDetailOpen} onOpenChange={setTdcDetailOpen}>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>TDC ann-import detaljer</DialogTitle>
                            </DialogHeader>
                            {selectedTdcImport && (
                              <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-muted-foreground">Uploadet</p>
                                    <p>
                                      {selectedTdcImport.uploaded_at
                                        ? format(new Date(selectedTdcImport.uploaded_at), "dd.MM.yyyy HH:mm", { locale: da })
                                        : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Uploadet af (id)</p>
                                    <p className="font-mono text-xs">
                                      {selectedTdcImport.uploaded_by
                                        ? String(selectedTdcImport.uploaded_by).slice(0, 36)
                                        : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Filnavn</p>
                                    <p className="font-mono text-xs break-all">
                                      {selectedTdcImport.raw_data?.filename ??
                                        selectedTdcImport.raw_data?.originalName ??
                                        "tdc ann"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Størrelse</p>
                                    <p>
                                      {selectedTdcImport.raw_data?.size
                                        ? `${Math.round(selectedTdcImport.raw_data.size / 1024)} kB`
                                        : "-"}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-medium mb-2">Rå metadata (raw_data)</p>
                                  <pre className="bg-muted rounded-md p-3 text-xs max-h-80 overflow-auto font-mono whitespace-pre-wrap break-all">
                                    {JSON.stringify(selectedTdcImport.raw_data, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="cph-api">
            <CphAdversusApiTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
