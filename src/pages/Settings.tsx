import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, RefreshCw, Send, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const [loading, setLoading] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState("TDC");
  const [salesDays, setSalesDays] = useState(7);
  const [results, setResults] = useState<any>(null);

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Adversus integration & test</p>
        </div>

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
                Hent Salg
              </CardTitle>
              <CardDescription>Hent seneste salg fra Adversus</CardDescription>
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
                  max={90}
                />
              </div>
              <Button onClick={testFetchSales} disabled={loading === "sales"} className="w-full">
                {loading === "sales" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Hent Salg
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
