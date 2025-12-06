import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, RefreshCw, Send, Database, Download, Upload, Key, CheckCircle2, Plus, Pencil, Trash2, Clock, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface ApiIntegration {
  id: string;
  name: string;
  type: string;
  sync_frequency_minutes: number | null;
  is_active: boolean;
  secrets: string[];
  enabled_sources: string[];
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

const secretLabels: Record<string, string> = {
  "ADVERSUS_API_USERNAME": "Brugernavn",
  "ADVERSUS_API_PASSWORD": "Adgangskode",
  "ECONOMIC_APP_SECRET_TOKEN": "App Secret Token",
  "ECONOMIC_AGREEMENT_GRANT_TOKEN": "Agreement Grant Token",
  "M365_TENANT_ID": "Tenant ID",
  "M365_CLIENT_ID": "Client ID",
  "M365_CLIENT_SECRET": "Client Secret",
  "M365_SENDER_EMAIL": "Afsender email",
};

// Available data sources for each API type
const availableDataSources: Record<string, { key: string; label: string; description: string }[]> = {
  adversus: [
    { key: "campaigns", label: "Kampagner", description: "Hent kampagneliste fra Adversus" },
    { key: "sales", label: "Salg", description: "Synkroniser salgsdata og ordrer" },
    { key: "users", label: "Brugere", description: "Hent agenter og medarbejdere" },
    { key: "leads", label: "Leads", description: "Synkroniser lead-data" },
    { key: "products", label: "Produkter", description: "Hent produktkatalog" },
  ],
  economic: [
    { key: "journal_entries", label: "Bogføringsposter", description: "Synkroniser bogføringsposter" },
    { key: "accounts", label: "Konti", description: "Hent kontoplan" },
    { key: "invoices", label: "Fakturaer", description: "Synkroniser fakturaer" },
    { key: "customers", label: "Kunder", description: "Hent kundedata" },
  ],
  m365: [
    { key: "send_emails", label: "Send emails", description: "Aktiver email-afsendelse" },
    { key: "calendar", label: "Kalender", description: "Synkroniser kalenderbegivenheder" },
    { key: "contacts", label: "Kontakter", description: "Hent kontaktdata" },
  ],
};

const frequencyOptions = [
  { value: "15", label: "Hvert 15. minut" },
  { value: "30", label: "Hvert 30. minut" },
  { value: "60", label: "Hver time" },
  { value: "120", label: "Hver 2. time" },
  { value: "360", label: "Hver 6. time" },
  { value: "720", label: "Hver 12. time" },
  { value: "1440", label: "Dagligt" },
  { value: "null", label: "Manuel (ingen automatik)" },
];

export default function Settings() {
  const [loading, setLoading] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState("TDC");
  const [salesDays, setSalesDays] = useState(7);
  const [syncDays, setSyncDays] = useState(30);
  const [results, setResults] = useState<any>(null);
  const [tdcMonthlyData, setTdcMonthlyData] = useState<{ month: string; count: number }[] | null>(null);
  const [tdcMonthlyLoading, setTdcMonthlyLoading] = useState(false);
  const [tdcMonthlyError, setTdcMonthlyError] = useState<string | null>(null);
  const [tdcFile, setTdcFile] = useState<File | null>(null);
  const [tdcUploadLoading, setTdcUploadLoading] = useState(false);
  const [tdcLastImport, setTdcLastImport] = useState<{ uploaded_at: string; uploaded_by: string | null } | null>(null);
  
  // API Integrations state
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; sync_frequency_minutes: string }>({ name: "", sync_frequency_minutes: "60" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: "", type: "", sync_frequency_minutes: "60" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
    loadLastTdcImport();
  }, []);

  const fetchIntegrations = async () => {
    setLoadingIntegrations(true);
    const { data, error } = await supabase
      .from("api_integrations")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching integrations:", error);
    } else {
      setIntegrations((data || []).map(d => ({
        ...d,
        secrets: Array.isArray(d.secrets) ? d.secrets : [],
        enabled_sources: Array.isArray(d.enabled_sources) ? d.enabled_sources : []
      })) as ApiIntegration[]);
    }
    setLoadingIntegrations(false);
  };

  const handleAddIntegration = async () => {
    if (!newIntegration.name.trim() || !newIntegration.type.trim()) {
      toast.error("Navn og type er påkrævet");
      return;
    }

    const { error } = await supabase.from("api_integrations").insert({
      name: newIntegration.name,
      type: newIntegration.type,
      sync_frequency_minutes: newIntegration.sync_frequency_minutes === "null" ? null : parseInt(newIntegration.sync_frequency_minutes),
      secrets: [],
    });

    if (error) {
      console.error("Error adding integration:", error);
      toast.error("Kunne ikke tilføje integration");
    } else {
      toast.success("Integration tilføjet");
      setAddDialogOpen(false);
      setNewIntegration({ name: "", type: "", sync_frequency_minutes: "60" });
      fetchIntegrations();
    }
  };

  const handleStartEdit = (integration: ApiIntegration) => {
    setEditingId(integration.id);
    setEditForm({
      name: integration.name,
      sync_frequency_minutes: integration.sync_frequency_minutes?.toString() || "null",
    });
  };

  const handleSaveEdit = async (id: string) => {
    const { error } = await supabase.from("api_integrations").update({
      name: editForm.name,
      sync_frequency_minutes: editForm.sync_frequency_minutes === "null" ? null : parseInt(editForm.sync_frequency_minutes),
    }).eq("id", id);

    if (error) {
      console.error("Error updating integration:", error);
      toast.error("Kunne ikke opdatere integration");
    } else {
      toast.success("Integration opdateret");
      setEditingId(null);
      fetchIntegrations();
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne integration?")) return;

    const { error } = await supabase.from("api_integrations").delete().eq("id", id);

    if (error) {
      console.error("Error deleting integration:", error);
      toast.error("Kunne ikke slette integration");
    } else {
      toast.success("Integration slettet");
      fetchIntegrations();
    }
  };

  const handleToggleSource = async (integrationId: string, sourceKey: string, currentSources: string[]) => {
    const newSources = currentSources.includes(sourceKey)
      ? currentSources.filter(s => s !== sourceKey)
      : [...currentSources, sourceKey];

    const { error } = await supabase
      .from("api_integrations")
      .update({ enabled_sources: newSources })
      .eq("id", integrationId);

    if (error) {
      console.error("Error updating sources:", error);
      toast.error("Kunne ikke opdatere datakilder");
    } else {
      setIntegrations(prev => prev.map(i => 
        i.id === integrationId ? { ...i, enabled_sources: newSources } : i
      ));
      toast.success("Datakilde opdateret");
    }
  };

  const formatFrequency = (minutes: number | null) => {
    if (minutes === null) return "Manuel";
    const option = frequencyOptions.find(o => o.value === minutes.toString());
    return option?.label || `${minutes} min`;
  };

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

  const loadLastTdcImport = async () => {
    try {
      const { data, error } = await supabase
        .from("tdc_cancellation_imports")
        .select("uploaded_at, uploaded_by")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTdcLastImport(data as { uploaded_at: string; uploaded_by: string | null });
      }
    } catch (error) {
      console.error("Fejl ved hentning af seneste TDC ann-import", error);
    }
  };

  const handleTdcUpload = async () => {
    if (!tdcFile) {
      toast.error("Vælg først en Excel-fil");
      return;
    }

    setTdcUploadLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Kunne ikke læse filen"));
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          resolve(base64);
        };
        reader.readAsDataURL(tdcFile);
      });

      const { data, error } = await supabase
        .from("tdc_cancellation_imports")
        .insert({
          row_index: 0,
          raw_data: {
            filename: tdcFile.name,
            size: tdcFile.size,
            type: tdcFile.type,
            content_base64: fileBase64,
          },
          uploaded_at: new Date().toISOString(),
          uploaded_by: userData?.user?.id ?? null,
        })
        .select("uploaded_at, uploaded_by")
        .single();

      if (error) throw error;

      setTdcLastImport(data as { uploaded_at: string; uploaded_by: string | null });
      setTdcFile(null);
      toast.success("TDC annulleringer importeret");
    } catch (error: any) {
      console.error("Fejl ved upload af TDC annulleringer", error);
      toast.error(error?.message ?? "Kunne ikke uploade filen");
    } finally {
      setTdcUploadLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Indstillinger</h1>
          <p className="text-muted-foreground">API-integrationer og Adversus sync</p>
        </div>

        {/* API Integrations Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API-integrationer
                </CardTitle>
                <CardDescription>
                  Administrer API-forbindelser og synkroniseringsfrekvens
                </CardDescription>
              </div>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tilføj API
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tilføj ny API-integration</DialogTitle>
                    <DialogDescription>
                      Opret en ny API-integration med navn og synkroniseringsfrekvens
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Navn</Label>
                      <Input
                        placeholder="f.eks. Min API"
                        value={newIntegration.name}
                        onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type (teknisk identifikator)</Label>
                      <Input
                        placeholder="f.eks. my-api"
                        value={newIntegration.type}
                        onChange={(e) => setNewIntegration({ ...newIntegration, type: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Synkroniseringsfrekvens</Label>
                      <Select
                        value={newIntegration.sync_frequency_minutes}
                        onValueChange={(value) => setNewIntegration({ ...newIntegration, sync_frequency_minutes: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Annuller</Button>
                    </DialogClose>
                    <Button onClick={handleAddIntegration}>Tilføj</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingIntegrations ? (
              <p className="text-sm text-muted-foreground">Indlæser...</p>
            ) : integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen integrationer fundet</p>
            ) : (
              integrations.map((integration) => (
                <Card key={integration.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    {editingId === integration.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="flex-1"
                          />
                          <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(integration.id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={editForm.sync_frequency_minutes}
                            onValueChange={(value) => setEditForm({ ...editForm, sync_frequency_minutes: value })}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {frequencyOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
                        >
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{integration.name}</h3>
                            <Badge variant="outline" className="text-xs font-mono">
                              {integration.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {integration.enabled_sources.length} datakilde(r)
                            </span>
                          </div>
                          {expandedId === integration.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        
                        {/* Expanded Section */}
                        {expandedId === integration.id && (
                          <div className="mt-4 space-y-4">
                            {/* Info and Actions Row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatFrequency(integration.sync_frequency_minutes)}
                                </div>
                                {integration.last_sync_at && (
                                  <span>
                                    Sidst synkroniseret: {new Date(integration.last_sync_at).toLocaleString("da-DK")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="120"
                                    className="w-16 h-8 text-center"
                                    value={syncDays}
                                    onChange={(e) => setSyncDays(Math.min(120, Math.max(1, parseInt(e.target.value) || 30)))}
                                  />
                                  <span className="text-sm text-muted-foreground">dage</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => {
                                    if (integration.type === 'adversus') {
                                      syncSalesToDb();
                                    } else {
                                      toast.info(`Sync for ${integration.name} er ikke implementeret endnu`);
                                    }
                                  }}
                                  disabled={loading === "sync"}
                                >
                                  <RefreshCw className={`h-4 w-4 ${loading === "sync" ? "animate-spin" : ""}`} />
                                  Hent data
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => handleStartEdit(integration)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="text-destructive" 
                                  onClick={() => handleDeleteIntegration(integration.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {availableDataSources[integration.type] && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Tilgængelige datakilder</Label>
                                <div className="grid gap-2">
                                  {availableDataSources[integration.type].map((source) => (
                                    <div
                                      key={source.key}
                                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          id={`${integration.id}-${source.key}`}
                                          checked={integration.enabled_sources.includes(source.key)}
                                          onCheckedChange={() => handleToggleSource(integration.id, source.key, integration.enabled_sources)}
                                        />
                                        <div>
                                          <label 
                                            htmlFor={`${integration.id}-${source.key}`}
                                            className="text-sm font-medium cursor-pointer"
                                          >
                                            {source.label}
                                          </label>
                                          <p className="text-xs text-muted-foreground">{source.description}</p>
                                        </div>
                                      </div>
                                      {integration.enabled_sources.includes(source.key) && (
                                        <Badge variant="default" className="text-xs">
                                          Aktiv
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {!availableDataSources[integration.type] && (
                              <p className="text-sm text-muted-foreground">
                                Ingen foruddefinerede datakilder for denne API-type. Du kan tilføje dem manuelt.
                              </p>
                            )}
                            
                            {/* Secrets Section */}
                            {integration.secrets.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">API-nøgler</Label>
                                <div className="grid gap-2">
                                  {integration.secrets.map((secret) => (
                                    <div
                                      key={secret}
                                      className="flex items-center justify-between p-2 rounded bg-background/50 border text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        <span>{secretLabels[secret] || secret}</span>
                                      </div>
                                      <span className="font-mono text-xs text-muted-foreground">{secret}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

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

          <Card className="md:col-span-2 border-dashed border-secondary/60 bg-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Excel-datakilde: TDC annulleringer ("tdc ann")
                </span>
                {tdcLastImport && (
                  <span className="text-xs text-muted-foreground">
                    Seneste import:{" "}
                    {new Date(tdcLastImport.uploaded_at).toLocaleString("da-DK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Upload den nyeste Excel-fil <code>tdc ann</code>. Den erstatter den tidligere import og bruges til
                TDC-annulleringer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tdcExcel">Excel-fil (.xlsx)</Label>
                <Input
                  id="tdcExcel"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setTdcFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button onClick={handleTdcUpload} disabled={!tdcFile || tdcUploadLoading} className="w-full">
                {tdcUploadLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Upload & gem som nyeste TDC-ann fil
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
