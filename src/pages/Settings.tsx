import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, RefreshCw, Send, Database, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const [loading, setLoading] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState("TDC");
  const [salesDays, setSalesDays] = useState(7);
  const [syncDays, setSyncDays] = useState(30);
  const [results, setResults] = useState<any>(null);
  const [tdcMonthlyData, setTdcMonthlyData] = useState<{ month: string; count: number }[] | null>(null);
  const [tdcMonthlyLoading, setTdcMonthlyLoading] = useState(false);
  const [tdcMonthlyError, setTdcMonthlyError] = useState<string | null>(null);
  const testFetchCampaigns = async () => {
    setLoading("campaigns");
    try {
      const { data, error } = await supabase.functions.invoke("sync-adversus", {
        body: { action: "fetch-campaigns", filter: campaignFilter },
      });
      if (error) throw error;
      setResults({ type: "campaigns", data });
      toast.success(`Fandt ${data.total} kampagner`);
    } catch (err: any) {
      toast.error(err.message || "Fejl ved hentning af kampagner");
    } finally {
      setLoading(null);
    }
  };

  const testFetchSales = async () => {
    setLoading("sales");
    try {
      const { data, error } = await supabase.functions.invoke("sync-adversus", {
        body: { action: "fetch-sales", days: salesDays },
      });
      if (error) throw error;
      setResults({ type: "sales", data });
      toast.success(`Fandt ${data.total} salg`);
    } catch (err: any) {
      toast.error(err.message || "Fejl ved hentning af salg");
    } finally {
      setLoading(null);
    }
  };

  const syncSalesToDb = async () => {
    setLoading("sync");
    try {
      const { data, error } = await supabase.functions.invoke("sync-adversus", {
        body: { action: "sync-sales-to-db", days: syncDays },
      });
      if (error) throw error;
      setResults({ type: "sync", data });
      toast.success(data.message || `Synced ${data.created} sales`);
    } catch (err: any) {
      toast.error(err.message || "Sync fejlede");
    } finally {
      setLoading(null);
    }
  };

  const syncTdcOctober2025 = async () => {
    setLoading("sync-tdc-october-2025");
    try {
      const { data, error } = await supabase.functions.invoke("sync-adversus", {
        body: { action: "sync-tdc-october-2025" },
      });
      if (error) throw error;
      setResults({ type: "sync-tdc-october-2025", data });
      toast.success(data?.message || "Sync af TDC Erhverv (oktober 2025) gennemført");
    } catch (err: any) {
      toast.error(err.message || "Sync af TDC Erhverv (oktober 2025) fejlede");
    } finally {
      setLoading(null);
    }
  };

  const testWebhook = async () => {
    setLoading("webhook");
    try {
      const mockPayload = {
        type: "result",
        event_time: new Date().toISOString(),
        payload: {
          result_id: Date.now(),
          campaign: { id: "1234", name: "TDC Erhverv Test" },
          user: { id: "55", name: "Test Agent", email: "test@company.com" },
          lead: { id: 400500, phone: "88888888", company: "Test Company ApS" },
          products: [
            { id: 1, externalId: "42", title: "Test Produkt", quantity: 1, unitPrice: 500 },
          ],
        },
      };
      const { data, error } = await supabase.functions.invoke("adversus-webhook", {
        body: mockPayload,
      });
      if (error) throw error;
      setResults({ type: "webhook", data });
      toast.success("Webhook test successful!");
    } catch (err: any) {
      toast.error(err.message || "Webhook fejlede");
    } finally {
      setLoading(null);
    }
  };

  const loadTdcMonthlyData = async () => {
    setTdcMonthlyLoading(true);
    setTdcMonthlyError(null);
    try {
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%tdc erhverv%")
        .limit(1);

      if (clientsError) throw clientsError;

      const tdcClientId = clients?.[0]?.id as string | undefined;

      if (!tdcClientId) {
        setTdcMonthlyData([]);
        toast.info("Ingen klient fundet med navnet 'TDC Erhverv'");
        return;
      }

      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", tdcClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c) => c.id as string);

      if (!campaignIds.length) {
        setTdcMonthlyData([]);
        toast.info("Ingen kampagner fundet for TDC Erhverv");
        return;
      }

      type SaleWithItems = {
        id: string;
        sale_datetime: string;
        sale_items: { quantity: number | null }[];
      };

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, sale_datetime, sale_items ( quantity )")
        .in("client_campaign_id", campaignIds);

      if (salesError) throw salesError;

      const typedSales = (sales || []) as unknown as SaleWithItems[];

      const monthlyMap = new Map<string, number>();

      typedSales.forEach((sale) => {
        const date = new Date(sale.sale_datetime);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const units =
          sale.sale_items?.reduce((sum, item) => {
            const qty = Number(item.quantity ?? 0);
            return sum + (qty || 0);
          }, 0) ?? 0;
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + units);
      });

      const monthlyArray = Array.from(monthlyMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setTdcMonthlyData(monthlyArray);
      toast.success("TDC Erhverv månedsoversigt opdateret");
    } catch (error: any) {
      console.error("Fejl ved hentning af TDC Erhverv månedsdata", error);
      const message = error?.message || "Kunne ikke hente TDC Erhverv månedsdata";
      setTdcMonthlyError(message);
      toast.error(message);
    } finally {
      setTdcMonthlyLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Adversus integration & test</p>
        </div>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Webhook URL (til Adversus)
            </CardTitle>
            <CardDescription>Kopier denne URL til Adversus webhook-konfiguration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm break-all">
                https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/adversus-webhook
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText("https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/adversus-webhook");
                  toast.success("Kopieret!");
                }}
              >
                Kopier
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Hent Kampagner
              </CardTitle>
              <CardDescription>Test forbindelse til Adversus API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignFilter">Filter (kampagne navn)</Label>
                <Input
                  id="campaignFilter"
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  placeholder="f.eks. TDC"
                />
              </div>
              <Button onClick={testFetchCampaigns} disabled={loading === "campaigns"} className="w-full">
                {loading === "campaigns" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Hent Kampagner
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Hent Salg (kun visning)
              </CardTitle>
              <CardDescription>Se seneste salg fra Adversus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="salesDays">Antal dage tilbage</Label>
                <Input
                  id="salesDays"
                  type="number"
                  value={salesDays}
                  onChange={(e) => setSalesDays(Number(e.target.value))}
                  min={1}
                  max={370}
                />
              </div>
              <Button onClick={testFetchSales} disabled={loading === "sales"} className="w-full" variant="outline">
                {loading === "sales" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Hent Salg (vis kun)
              </Button>
            </CardContent>
          </Card>

          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-green-600" />
                Sync Salg til Database
              </CardTitle>
              <CardDescription>Hent salg fra Adversus og gem i databasen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="syncDays">Antal dage tilbage</Label>
                <Input
                  id="syncDays"
                  type="number"
                  value={syncDays}
                  onChange={(e) => setSyncDays(Number(e.target.value))}
                  min={1}
                  max={370}
                />
              </div>
              <Button onClick={syncSalesToDb} disabled={loading === "sync"} className="w-full bg-green-600 hover:bg-green-700">
                {loading === "sync" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Sync til Database
              </Button>
              <Button
                onClick={syncTdcOctober2025}
                disabled={loading === "sync-tdc-october-2025"}
                variant="outline"
                className="w-full mt-2"
              >
                {loading === "sync-tdc-october-2025" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Sync kun TDC Erhverv (oktober 2025)
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test Webhook
              </CardTitle>
              <CardDescription>Send en mock webhook payload for at teste flowet</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={testWebhook} disabled={loading === "webhook"} variant="outline">
                {loading === "webhook" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Send Test Webhook
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-dashed border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Debug: TDC Erhverv salg pr. måned
                </span>
                <Button size="sm" onClick={loadTdcMonthlyData} disabled={tdcMonthlyLoading}>
                  {tdcMonthlyLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Opdater
                </Button>
              </CardTitle>
              <CardDescription>
                Viser samlet antal solgte produkter (sale_items.quantity) pr. måned for TDC Erhverv.
                Oktober 2025 vil være nøglen <code>2025-10</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tdcMonthlyError && (
                <p className="text-sm text-destructive">{tdcMonthlyError}</p>
              )}
              {!tdcMonthlyError && (!tdcMonthlyData || tdcMonthlyData.length === 0) && !tdcMonthlyLoading && (
                <p className="text-sm text-muted-foreground">
                  Ingen data endnu. Klik "Opdater" for at hente TDC Erhverv-salg.
                </p>
              )}
              {tdcMonthlyData && tdcMonthlyData.length > 0 && (
                <div className="rounded-md border bg-muted/40">
                  <div className="grid grid-cols-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Måned (ÅÅÅÅ-MM)</span>
                    <span className="text-right">Antal salg (stk.)</span>
                  </div>
                  <div className="max-h-64 overflow-auto text-sm">
                    {tdcMonthlyData.map((row) => {
                      const isOctober2025 = row.month === "2025-10";
                      return (
                        <div
                          key={row.month}
                          className={`grid grid-cols-2 items-center px-3 py-1.5 border-b last:border-b-0 ${
                            isOctober2025 ? "bg-primary/10 font-medium" : ""
                          }`}
                        >
                          <span>{row.month}</span>
                          <span className="text-right tabular-nums">{row.count.toLocaleString("da-DK")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Resultat ({results.type})</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(results.data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
