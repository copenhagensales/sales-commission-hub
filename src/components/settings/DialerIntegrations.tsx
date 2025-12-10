import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, Play, Loader2, Plus, Pencil, Trash2, Terminal, Webhook, Copy, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DialerIntegration {
  id: string;
  name: string;
  provider: string;
  api_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency_minutes: number | null;
}

interface FormData {
  name: string;
  provider: string;
  username: string;
  password: string;
  api_url: string;
}

const ADVERSUS_WEBHOOK_EVENTS = [
  { value: "lead_saved", label: "Lead Saved" },
  { value: "call_ended", label: "Call Ended" },
  { value: "callAnswered", label: "Call Answered" },
  { value: "leadClosedSuccess", label: "Lead Closed Success" },
  { value: "leadClosedAutomaticRedial", label: "Lead Closed Automatic Redial" },
  { value: "leadClosedPrivateRedial", label: "Lead Closed Private Redial" },
  { value: "leadClosedNotInterested", label: "Lead Closed Not Interested" },
  { value: "leadClosedInvalid", label: "Lead Closed Invalid" },
  { value: "leadClosedUnqualified", label: "Lead Closed Unqualified" },
  { value: "leadClosedSystem", label: "Lead Closed System" },
  { value: "leads_deactivated", label: "Leads Deactivated" },
  { value: "leads_inserted", label: "Leads Inserted" },
  { value: "mail_activity", label: "Mail Activity" },
  { value: "sms_sent", label: "SMS Sent" },
  { value: "sms_received", label: "SMS Received" },
  { value: "appointment_added", label: "Appointment Added" },
  { value: "appointment_updated", label: "Appointment Updated" },
  { value: "note_added", label: "Note Added" },
];

export function DialerIntegrations() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    provider: "adversus",
    username: "",
    password: "",
    api_url: "",
  });

  // Per-integration sync days state
  const [syncDays, setSyncDays] = useState<Record<string, string>>({});

  // Manual function execution state
  const [manualFunction, setManualFunction] = useState("backfill-opp");
  const [manualDays, setManualDays] = useState("30");
  const [manualLimit, setManualLimit] = useState("100");
  const [isExecuting, setIsExecuting] = useState(false);

  // Webhook creation state
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookIntegrationId, setWebhookIntegrationId] = useState<string | null>(null);
  const [webhookIntegrationName, setWebhookIntegrationName] = useState<string>("");
  const [selectedWebhookEvent, setSelectedWebhookEvent] = useState("leadClosedSuccess");
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Fetch Dialer Integrations from new table
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["dialer-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, api_url, is_active, last_sync_at, sync_frequency_minutes")
        .order("name");

      if (error) throw error;
      return data as DialerIntegration[];
    },
  });

  // Save integration (create or update)
  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { id?: string }) => {
      const { data: result, error } = await supabase.functions.invoke("scheduler-manager", {
        body: {
          action: "save_dialer",
          integration_id: data.id,
          name: data.name,
          provider: data.provider,
          api_url: data.api_url || null,
          credentials: {
            username: data.username,
            password: data.password,
            api_url: data.api_url || null,
          },
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success(editingId ? "Integration opdateret" : "Integration oprettet");
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fejl: ${error.message}`);
    },
  });

  // Delete integration
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dialer_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Integration slettet");
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    },
    onError: (error) => {
      toast.error(`Fejl ved sletning: ${error.message}`);
    },
  });

  // Trigger Sync
  const syncMutation = useMutation({
    mutationFn: async ({ integrationId, provider, days }: { integrationId: string; provider: string; days: number }) => {
      setSyncingId(integrationId);
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: provider,
          integration_id: integrationId,
          action: "sync",
          days,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Synkronisering gennemført", {
        description: `Resultat: ${JSON.stringify(data.results?.length || 0)} poster behandlet`,
      });
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    },
    onError: (error) => {
      toast.error(`Synkronisering fejlede: ${error.message}`);
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", provider: "adversus", username: "", password: "", api_url: "" });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  // Execute manual function
  const executeManualFunction = async () => {
    setIsExecuting(true);
    try {
      toast.info(`Ejecutando ${manualFunction}...`);
      
      const body: Record<string, unknown> = {};
      
      // Build body based on function
      if (manualFunction === "backfill-opp") {
        body.limit = parseInt(manualLimit) || 100;
      } else if (manualFunction === "integration-engine") {
        body.source = "adversus";
        body.action = "repair-history";
        body.days = parseInt(manualDays) || 30;
      } else if (manualFunction === "sync-adversus") {
        body.days = parseInt(manualDays) || 7;
      }

      const { data, error } = await supabase.functions.invoke(manualFunction, { body });

      if (error) throw error;

      toast.success(`${manualFunction} ejecutado`, {
        description: JSON.stringify(data).slice(0, 200),
      });
      
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Create webhook in Adversus
  const createWebhook = async () => {
    if (!webhookIntegrationId) return;
    
    setIsCreatingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("adversus-create-webhook", {
        body: {
          integration_id: webhookIntegrationId,
          event: selectedWebhookEvent,
        },
      });

      if (error) throw error;

      toast.success("Webhook oprettet i Adversus", {
        description: `Event: ${selectedWebhookEvent}`,
      });
      setWebhookDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved oprettelse af webhook: ${errorMessage}`);
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const getWebhookUrl = (integrationId: string) => {
    const projectId = "jwlimmeijpfmaksvmuru";
    return `https://${projectId}.supabase.co/functions/v1/dialer-webhook?dialer_id=${integrationId}`;
  };

  const copyWebhookUrl = (integrationId: string) => {
    const url = getWebhookUrl(integrationId);
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success("Webhook URL kopieret");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingId || undefined });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Dialer Integrationer
            </CardTitle>
            <CardDescription>Administrer forbindelser til dialers som Adversus og Enreach.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tilføj
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Rediger" : "Tilføj"} Dialer Integration</DialogTitle>
                  <DialogDescription>
                    Indtast legitimationsoplysninger for din dialer-konto.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Navn</Label>
                    <Input
                      id="name"
                      placeholder="f.eks. Adversus CPH Team"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adversus">Adversus</SelectItem>
                        <SelectItem value="enreach">Enreach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api_url">API Base URL (Valgfri)</Label>
                    <Input
                      id="api_url"
                      placeholder="f.eks. https://wshero01.herobase.com/api"
                      value={formData.api_url}
                      onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Kun nødvendig for Enreach/HeroBase. Lad stå tom for standard Adversus.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Brugernavn / API Key</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={editingId ? "(uændret hvis tom)" : ""}
                      required={!editingId}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Adgangskode / API Secret</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "(uændret hvis tom)" : ""}
                      required={!editingId}
                    />
                    {editingId && (
                      <p className="text-xs text-muted-foreground">Lad felterne være tomme for at beholde eksisterende credentials.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuller
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {editingId ? "Opdater" : "Opret"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Indlæser integrationer...</div>
        ) : !integrations || integrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Ingen dialer integrationer konfigureret. Klik "Tilføj" for at oprette en.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Auto-sync</TableHead>
                <TableHead>Sidst synkroniseret</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">{integration.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="outline" className="capitalize w-fit">
                        {integration.provider}
                      </Badge>
                      {integration.api_url && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {integration.api_url}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(integration.sync_frequency_minutes || "0")}
                        onValueChange={async (value) => {
                          const freq = parseInt(value);
                          try {
                            // Update database
                            await supabase
                              .from("dialer_integrations")
                              .update({ 
                                sync_frequency_minutes: freq || null,
                                is_active: freq > 0
                              })
                              .eq("id", integration.id);
                            
                            // Update cron job
                            await supabase.functions.invoke("update-cron-schedule", {
                              body: {
                                integration_type: "dialer",
                                integration_id: integration.id,
                                provider: integration.provider,
                                frequency_minutes: freq,
                                is_active: freq > 0,
                              },
                            });
                            
                            toast.success(freq > 0 ? `Auto-sync sat til hver ${freq} min` : "Auto-sync deaktiveret");
                            queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
                          } catch (err) {
                            toast.error("Fejl ved opdatering af sync-frekvens");
                          }
                        }}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue placeholder="Vælg..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Deaktiveret</SelectItem>
                          <SelectItem value="15">Hver 15 min</SelectItem>
                          <SelectItem value="30">Hver 30 min</SelectItem>
                          <SelectItem value="60">Hver time</SelectItem>
                          <SelectItem value="120">Hver 2. time</SelectItem>
                          <SelectItem value="360">Hver 6. time</SelectItem>
                          <SelectItem value="720">Hver 12. time</SelectItem>
                          <SelectItem value="1440">Dagligt</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={integration.is_active && integration.sync_frequency_minutes ? "default" : "secondary"} className="text-xs">
                        {integration.is_active && integration.sync_frequency_minutes ? "Aktiv" : "Manuel"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {integration.last_sync_at ? (
                      <span className="text-sm">{new Date(integration.last_sync_at).toLocaleString("da-DK")}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Aldrig</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        className="w-16 h-8 text-xs"
                        placeholder="7"
                        min="1"
                        max="365"
                        value={syncDays[integration.id] || ""}
                        onChange={(e) => setSyncDays((prev) => ({ ...prev, [integration.id]: e.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground">d</span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncingId === integration.id}
                        onClick={() => syncMutation.mutate({ 
                          integrationId: integration.id, 
                          provider: integration.provider,
                          days: parseInt(syncDays[integration.id]) || 7
                        })}
                      >
                        {syncingId === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      {integration.provider === 'adversus' && (
                        <Button
                          variant="outline"
                          size="sm"
                          title="Opret Webhook"
                          onClick={() => {
                            setWebhookIntegrationId(integration.id);
                            setWebhookIntegrationName(integration.name);
                            setWebhookDialogOpen(true);
                          }}
                        >
                          <Webhook className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Kopier Webhook URL"
                        onClick={() => copyWebhookUrl(integration.id)}
                      >
                        {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(integration.id);
                          setFormData({
                            name: integration.name,
                            provider: integration.provider,
                            username: "",
                            password: "",
                            api_url: integration.api_url || "",
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(integration.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Webhook Creation Dialog */}
        <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Opret Webhook i Adversus
              </DialogTitle>
              <DialogDescription>
                Opret en webhook i Adversus for "{webhookIntegrationName}" der sender events til dit system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Webhook URL (automatisk)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookIntegrationId ? getWebhookUrl(webhookIntegrationId) : ""}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => webhookIntegrationId && copyWebhookUrl(webhookIntegrationId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Denne URL bruges automatisk - den inkluderer dialer_id parameteren.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={selectedWebhookEvent} onValueChange={setSelectedWebhookEvent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADVERSUS_WEBHOOK_EVENTS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vælg hvilken type event webhook'en skal triggere på.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={createWebhook} disabled={isCreatingWebhook}>
                {isCreatingWebhook && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Opret Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator className="my-6" />

        {/* Manual Function Execution Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Ejecutar Función Manual</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Ejecuta funciones edge específicas con parámetros personalizados.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Función</Label>
              <Select value={manualFunction} onValueChange={setManualFunction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backfill-opp">backfill-opp</SelectItem>
                  <SelectItem value="integration-engine">integration-engine (repair)</SelectItem>
                  <SelectItem value="sync-adversus">sync-adversus</SelectItem>
                  <SelectItem value="cleanup-inactive-employees">cleanup-inactive-employees</SelectItem>
                  <SelectItem value="send-contract-reminders">send-contract-reminders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(manualFunction === "integration-engine" || manualFunction === "sync-adversus") && (
              <div className="space-y-2">
                <Label>Días (days)</Label>
                <Input
                  type="number"
                  value={manualDays}
                  onChange={(e) => setManualDays(e.target.value)}
                  placeholder="30"
                  min="1"
                  max="365"
                />
              </div>
            )}

            {manualFunction === "backfill-opp" && (
              <div className="space-y-2">
                <Label>Límite (limit)</Label>
                <Input
                  type="number"
                  value={manualLimit}
                  onChange={(e) => setManualLimit(e.target.value)}
                  placeholder="100"
                  min="1"
                  max="1000"
                />
              </div>
            )}

            <Button
              onClick={executeManualFunction}
              disabled={isExecuting}
              className="h-10"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Ejecutar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
