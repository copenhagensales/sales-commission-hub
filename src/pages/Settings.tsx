import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, RefreshCw, Send, Database, Download, Upload, Key, CheckCircle2, Plus, Pencil, Trash2, Clock, Save, X, ChevronDown, ChevronUp, History, Eye } from "lucide-react";
import { CustomerIntegrations } from "@/components/settings/CustomerIntegrations";
import { DialerIntegrationsCard } from "@/components/settings/DialerIntegrationsCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

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

interface WebhookEndpoint {
  id: string;
  name: string;
  type: string;
  endpoint_path: string;
  is_active: boolean;
  description: string | null;
  last_received_at: string | null;
  total_requests: number;
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
  const [syncDays, setSyncDays] = useState(30);
  const [results, setResults] = useState<any>(null);
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

  // Webhook Endpoints state
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editWebhookForm, setEditWebhookForm] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [addWebhookDialogOpen, setAddWebhookDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: "", type: "", endpoint_path: "", description: "" });
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);

  // Webhook events state
  const [webhookEvents, setWebhookEvents] = useState<Record<string, any[]>>({});
  const [loadingWebhookEvents, setLoadingWebhookEvents] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  useEffect(() => {
    fetchIntegrations();
    fetchWebhooks();
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

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching webhooks:", error);
    } else {
      setWebhooks((data || []) as WebhookEndpoint[]);
    }
    setLoadingWebhooks(false);
  };

  const handleAddWebhook = async () => {
    if (!newWebhook.name.trim() || !newWebhook.type.trim() || !newWebhook.endpoint_path.trim()) {
      toast.error("Navn, type og endpoint er påkrævet");
      return;
    }

    const { error } = await supabase.from("webhook_endpoints").insert({
      name: newWebhook.name,
      type: newWebhook.type,
      endpoint_path: newWebhook.endpoint_path,
      description: newWebhook.description || null,
    });

    if (error) {
      console.error("Error adding webhook:", error);
      toast.error("Kunne ikke tilføje webhook");
    } else {
      toast.success("Webhook tilføjet");
      setAddWebhookDialogOpen(false);
      setNewWebhook({ name: "", type: "", endpoint_path: "", description: "" });
      fetchWebhooks();
    }
  };

  const handleStartEditWebhook = (webhook: WebhookEndpoint) => {
    setEditingWebhookId(webhook.id);
    setEditWebhookForm({
      name: webhook.name,
      description: webhook.description || "",
    });
  };

  const handleSaveEditWebhook = async (id: string) => {
    const { error } = await supabase.from("webhook_endpoints").update({
      name: editWebhookForm.name,
      description: editWebhookForm.description || null,
    }).eq("id", id);

    if (error) {
      console.error("Error updating webhook:", error);
      toast.error("Kunne ikke opdatere webhook");
    } else {
      toast.success("Webhook opdateret");
      setEditingWebhookId(null);
      fetchWebhooks();
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne webhook?")) return;

    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);

    if (error) {
      console.error("Error deleting webhook:", error);
      toast.error("Kunne ikke slette webhook");
    } else {
      toast.success("Webhook slettet");
      fetchWebhooks();
    }
  };

  const handleToggleWebhookActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from("webhook_endpoints")
      .update({ is_active: !currentState })
      .eq("id", id);

    if (error) {
      console.error("Error toggling webhook:", error);
      toast.error("Kunne ikke opdatere webhook");
    } else {
      setWebhooks(prev => prev.map(w => 
        w.id === id ? { ...w, is_active: !currentState } : w
      ));
      toast.success(!currentState ? "Webhook aktiveret" : "Webhook deaktiveret");
    }
  };

  const fetchWebhookEvents = async (webhookType: string) => {
    setLoadingWebhookEvents(webhookType);
    try {
      if (webhookType === 'adversus') {
        const { data, error } = await supabase
          .from("adversus_events")
          .select("*")
          .order("received_at", { ascending: false })
          .limit(25);
        
        if (error) throw error;
        setWebhookEvents(prev => ({ ...prev, [webhookType]: data || [] }));
      } else if (webhookType === 'economic') {
        const { data, error } = await supabase
          .from("economic_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25);
        
        if (error) throw error;
        setWebhookEvents(prev => ({ ...prev, [webhookType]: data || [] }));
      } else {
        setWebhookEvents(prev => ({ ...prev, [webhookType]: [] }));
      }
      toast.success("Webhook-data hentet");
    } catch (error: any) {
      console.error("Error fetching webhook events:", error);
      toast.error("Kunne ikke hente webhook-data");
    } finally {
      setLoadingWebhookEvents(null);
    }
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
    const integration = integrations.find(i => i.id === id);
    const frequencyMinutes = editForm.sync_frequency_minutes === "null" ? null : parseInt(editForm.sync_frequency_minutes);
    
    const { error } = await supabase.from("api_integrations").update({
      name: editForm.name,
      sync_frequency_minutes: frequencyMinutes,
    }).eq("id", id);

    if (error) {
      console.error("Error updating integration:", error);
      toast.error("Kunne ikke opdatere integration");
      return;
    }

    // Update the cron job schedule
    if (integration) {
      try {
        const { error: cronError } = await supabase.functions.invoke("update-cron-schedule", {
          body: {
            integration_type: integration.type,
            frequency_minutes: frequencyMinutes,
            is_active: integration.is_active,
          },
        });
        
        if (cronError) {
          console.error("Error updating cron schedule:", cronError);
          toast.warning("Integration opdateret, men cron-job kunne ikke opdateres");
        } else {
          toast.success("Integration og automatisk synkronisering opdateret");
        }
      } catch (cronErr) {
        console.error("Error calling cron update:", cronErr);
        toast.warning("Integration opdateret, men cron-job kunne ikke opdateres");
      }
    }

    setEditingId(null);
    fetchIntegrations();
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

  const handleToggleIntegrationActive = async (integration: ApiIntegration) => {
    const newActiveState = !integration.is_active;
    
    const { error } = await supabase
      .from("api_integrations")
      .update({ is_active: newActiveState })
      .eq("id", integration.id);

    if (error) {
      console.error("Error toggling integration:", error);
      toast.error("Kunne ikke opdatere integration");
      return;
    }

    // Update cron job based on new active state
    try {
      const { error: cronError } = await supabase.functions.invoke("update-cron-schedule", {
        body: {
          integration_type: integration.type,
          frequency_minutes: integration.sync_frequency_minutes,
          is_active: newActiveState,
        },
      });
      
      if (cronError) {
        console.error("Error updating cron schedule:", cronError);
        toast.warning("Status opdateret, men cron-job kunne ikke opdateres");
      } else {
        toast.success(newActiveState ? "Integration og automatisk synkronisering aktiveret" : "Integration og automatisk synkronisering deaktiveret");
      }
    } catch (cronErr) {
      console.error("Error calling cron update:", cronErr);
      toast.warning("Status opdateret, men cron-job kunne ikke opdateres");
    }

    setIntegrations(prev => prev.map(i => 
      i.id === integration.id ? { ...i, is_active: newActiveState } : i
    ));
  };

  const formatFrequency = (minutes: number | null) => {
    if (minutes === null) return "Manuel";
    const option = frequencyOptions.find(o => o.value === minutes.toString());
    return option?.label || `${minutes} min`;
  };

  const syncSalesToDb = async () => {
    setLoading("sync");
    try {
      // Usamos la nueva función adversus-sync-v2
      // Primero sincronizamos campañas y usuarios para asegurar integridad referencial
      await supabase.functions.invoke("adversus-sync-v2", { body: { action: "sync-campaigns" } });
      await supabase.functions.invoke("adversus-sync-v2", { body: { action: "sync-users" } });
      
      // Luego sincronizamos las ventas
      const { data, error } = await supabase.functions.invoke("adversus-sync-v2", {
        body: { action: "sync-sales", days: syncDays },
      });
      
      if (error) throw error;
      
      // Si la sincronización básica termina, disparamos el backfill de OPP en segundo plano
      // Esto no bloquea la UI
      supabase.functions.invoke("backfill-opp");

      setResults({ type: "sync", data });
      toast.success(data.message || "Sincronización completada exitosamente");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "La sincronización falló");
    } finally {
      setLoading(null);
    }
  };

  const backfillOpp = async () => {
    setLoading("backfill-opp");
    try {
      const { data, error } = await supabase.functions.invoke("backfill-opp");
      if (error) throw error;
      setResults({ type: "backfill-opp", data });
      if (data.remaining > 0) {
        toast.success(`Opdaterede ${data.successful} OPP-numre. ${data.remaining} mangler stadig.`);
      } else {
        toast.success(`Alle OPP-numre er nu hentet!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Backfill af OPP fejlede");
    } finally {
      setLoading(null);
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

        {/* Dialer Integrations (Multi-tenant Adversus/Enreach) */}
        <DialerIntegrationsCard />

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
                            <Switch
                              checked={integration.is_active}
                              onCheckedChange={() => handleToggleIntegrationActive(integration)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <h3 className="font-semibold">{integration.name}</h3>
                            <Badge variant={integration.is_active ? "default" : "secondary"} className="text-xs">
                              {integration.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
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

        {/* Webhooks Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Webhooks
                </CardTitle>
                <CardDescription>
                  Administrer indgående webhooks fra eksterne systemer
                </CardDescription>
              </div>
              <Dialog open={addWebhookDialogOpen} onOpenChange={setAddWebhookDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tilføj Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tilføj ny webhook</DialogTitle>
                    <DialogDescription>
                      Opret et nyt webhook-endpoint til at modtage data fra eksterne systemer
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Navn</Label>
                      <Input
                        placeholder="f.eks. Min Webhook"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type (teknisk identifikator)</Label>
                      <Input
                        placeholder="f.eks. adversus"
                        value={newWebhook.type}
                        onChange={(e) => setNewWebhook({ ...newWebhook, type: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Endpoint sti</Label>
                      <Input
                        placeholder="f.eks. adversus-webhook"
                        value={newWebhook.endpoint_path}
                        onChange={(e) => setNewWebhook({ ...newWebhook, endpoint_path: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Beskrivelse (valgfri)</Label>
                      <Input
                        placeholder="f.eks. Modtager salgsdata"
                        value={newWebhook.description}
                        onChange={(e) => setNewWebhook({ ...newWebhook, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Annuller</Button>
                    </DialogClose>
                    <Button onClick={handleAddWebhook}>Tilføj</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingWebhooks ? (
              <p className="text-sm text-muted-foreground">Indlæser...</p>
            ) : webhooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen webhooks fundet</p>
            ) : (
              webhooks.map((webhook) => (
                <Card key={webhook.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    {editingWebhookId === webhook.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Input
                            value={editWebhookForm.name}
                            onChange={(e) => setEditWebhookForm({ ...editWebhookForm, name: e.target.value })}
                            className="flex-1"
                            placeholder="Navn"
                          />
                          <Button size="icon" variant="ghost" onClick={() => handleSaveEditWebhook(webhook.id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingWebhookId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={editWebhookForm.description}
                          onChange={(e) => setEditWebhookForm({ ...editWebhookForm, description: e.target.value })}
                          placeholder="Beskrivelse"
                        />
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedWebhookId(expandedWebhookId === webhook.id ? null : webhook.id)}
                        >
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{webhook.name}</h3>
                            <Badge variant="outline" className="text-xs font-mono">
                              {webhook.type}
                            </Badge>
                            <Badge variant={webhook.is_active ? "default" : "secondary"} className="text-xs">
                              {webhook.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                          </div>
                          {expandedWebhookId === webhook.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        
                        {/* Expanded Section */}
                        {expandedWebhookId === webhook.id && (
                          <div className="mt-4 space-y-4">
                            {/* Description */}
                            {webhook.description && (
                              <p className="text-sm text-muted-foreground">{webhook.description}</p>
                            )}
                            
                            {/* Webhook URL */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Webhook URL</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 bg-background/50 p-3 rounded text-sm break-all border">
                                  https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/{webhook.endpoint_path}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(`https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/${webhook.endpoint_path}`);
                                    toast.success("Kopieret!");
                                  }}
                                >
                                  Kopier
                                </Button>
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Anmodninger: {webhook.total_requests}</span>
                              {webhook.last_received_at && (
                                <span>
                                  Sidst modtaget: {new Date(webhook.last_received_at).toLocaleString("da-DK")}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchWebhookEvents(webhook.type);
                                }}
                                disabled={loadingWebhookEvents === webhook.type}
                              >
                                <History className={`h-4 w-4 ${loadingWebhookEvents === webhook.type ? "animate-spin" : ""}`} />
                                Hent historik
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWebhookActive(webhook.id, webhook.is_active);
                                }}
                              >
                                {webhook.is_active ? "Deaktiver" : "Aktiver"}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditWebhook(webhook);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="text-destructive" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWebhook(webhook.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Webhook Events History */}
                            {webhookEvents[webhook.type] && webhookEvents[webhook.type].length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Seneste modtagne data ({webhookEvents[webhook.type].length})</Label>
                                <div className="max-h-64 overflow-y-auto space-y-2">
                                  {webhookEvents[webhook.type].map((event: any) => (
                                    <div
                                      key={event.id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border text-sm cursor-pointer hover:bg-background/70"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEvent(event);
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-xs">
                                          {event.event_type || 'event'}
                                        </Badge>
                                        <span className="text-muted-foreground">
                                          ID: {event.external_id || event.id.slice(0, 8)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(event.received_at || event.created_at).toLocaleString("da-DK")}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={event.processed ? "default" : "secondary"} className="text-xs">
                                          {event.processed ? "Behandlet" : "Afventer"}
                                        </Badge>
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {webhookEvents[webhook.type] && webhookEvents[webhook.type].length === 0 && (
                              <p className="text-sm text-muted-foreground">Ingen webhook-data fundet for denne type.</p>
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

        {/* Event Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Webhook Event Detaljer
              </DialogTitle>
              <DialogDescription>
                {selectedEvent && (
                  <span>
                    ID: {selectedEvent.external_id || selectedEvent.id} • 
                    Modtaget: {new Date(selectedEvent.received_at || selectedEvent.created_at).toLocaleString("da-DK")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {selectedEvent && (
                <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-[50vh]">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Luk</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Other Data Sources Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Andre datakilder
                </CardTitle>
                <CardDescription>
                  Administrer filbaserede datakilder og manuelle imports
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TDC Annulleringer */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === "tdc-ann" ? null : "tdc-ann")}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">TDC annulleringer</h3>
                    <Badge variant="outline" className="text-xs font-mono">
                      excel
                    </Badge>
                    {tdcLastImport && (
                      <Badge variant="default" className="text-xs">
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  {expandedId === "tdc-ann" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
                
                {expandedId === "tdc-ann" && (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload den nyeste Excel-fil <code className="bg-background/50 px-1 rounded">tdc ann</code>. Den erstatter den tidligere import og bruges til TDC-annulleringer i lønkørsel.
                    </p>
                    
                    {tdcLastImport && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          Seneste import: {new Date(tdcLastImport.uploaded_at).toLocaleString("da-DK", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}
                    
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
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Customer CRM Integrations */}
        <CustomerIntegrations />

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
