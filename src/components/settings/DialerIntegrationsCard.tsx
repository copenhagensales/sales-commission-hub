import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, Eye, EyeOff, Server, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DialerIntegration {
  id: string;
  name: string;
  type: string;
  secrets: Record<string, string>;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency_minutes: number | null;
  created_at: string;
}

const dialerTypes = [
  { value: "adversus", label: "Adversus" },
  { value: "enreach", label: "Enreach" },
];

const frequencyOptions = [
  { value: "15", label: "Hvert 15. minut" },
  { value: "30", label: "Hvert 30. minut" },
  { value: "60", label: "Hver time" },
  { value: "120", label: "Hver 2. time" },
  { value: "360", label: "Hver 6. time" },
  { value: "null", label: "Manuel (ingen automatik)" },
];

export function DialerIntegrationsCard() {
  const [integrations, setIntegrations] = useState<DialerIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<DialerIntegration | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    type: "adversus",
    username: "",
    password: "",
    sync_frequency_minutes: "60",
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_integrations")
      .select("*")
      .in("type", ["adversus", "enreach"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching dialer integrations:", error);
      toast.error("Kunne ikke hente integrationer");
    } else {
      setIntegrations((data || []).map(d => ({
        ...d,
        secrets: typeof d.secrets === 'object' && d.secrets !== null && !Array.isArray(d.secrets) 
          ? d.secrets as Record<string, string>
          : {}
      })) as DialerIntegration[]);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingIntegration(null);
    setForm({
      name: "",
      type: "adversus",
      username: "",
      password: "",
      sync_frequency_minutes: "60",
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEditDialog = (integration: DialerIntegration) => {
    setEditingIntegration(integration);
    setForm({
      name: integration.name,
      type: integration.type,
      username: integration.secrets?.username || "",
      password: integration.secrets?.password || "",
      sync_frequency_minutes: integration.sync_frequency_minutes?.toString() || "null",
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }
    if (!form.username.trim() || !form.password.trim()) {
      toast.error("Brugernavn og adgangskode er påkrævet");
      return;
    }

    const secrets = {
      username: form.username.trim(),
      password: form.password.trim(),
    };

    const frequencyMinutes = form.sync_frequency_minutes === "null" ? null : parseInt(form.sync_frequency_minutes);

    if (editingIntegration) {
      const { error } = await supabase
        .from("api_integrations")
        .update({
          name: form.name.trim(),
          type: form.type,
          secrets,
          sync_frequency_minutes: frequencyMinutes,
        })
        .eq("id", editingIntegration.id);

      if (error) {
        console.error("Error updating integration:", error);
        toast.error("Kunne ikke opdatere integration");
        return;
      }
      toast.success("Integration opdateret");
    } else {
      const { error } = await supabase
        .from("api_integrations")
        .insert({
          name: form.name.trim(),
          type: form.type,
          secrets,
          sync_frequency_minutes: frequencyMinutes,
          enabled_sources: ["sales", "campaigns", "users"],
        });

      if (error) {
        console.error("Error adding integration:", error);
        toast.error("Kunne ikke tilføje integration");
        return;
      }
      toast.success("Integration tilføjet");
    }

    setDialogOpen(false);
    fetchIntegrations();
  };

  const handleDelete = async (id: string) => {
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

  const handleToggleActive = async (integration: DialerIntegration) => {
    const { error } = await supabase
      .from("api_integrations")
      .update({ is_active: !integration.is_active })
      .eq("id", integration.id);

    if (error) {
      console.error("Error toggling integration:", error);
      toast.error("Kunne ikke opdatere integration");
    } else {
      setIntegrations(prev =>
        prev.map(i => (i.id === integration.id ? { ...i, is_active: !i.is_active } : i))
      );
      toast.success(integration.is_active ? "Integration deaktiveret" : "Integration aktiveret");
    }
  };

  const handleSync = async (integration: DialerIntegration) => {
    setSyncing(integration.id);
    try {
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: integration.type,
          actions: ["sales", "campaigns", "users"],
          days: 7,
        },
      });

      if (error) throw error;

      toast.success(`Synkronisering fuldført for ${integration.name}`);
      fetchIntegrations();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Synkronisering fejlede");
    } finally {
      setSyncing(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Aldrig";
    return new Date(dateStr).toLocaleString("da-DK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFrequency = (minutes: number | null) => {
    if (minutes === null) return "Manuel";
    const option = frequencyOptions.find(o => o.value === minutes.toString());
    return option?.label || `${minutes} min`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            Dialer Integrationer (Multi-tenant)
          </CardTitle>
          <CardDescription>
            Administrer flere Adversus eller Enreach konti. Hver konto har sine egne credentials.
          </CardDescription>
        </div>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Tilføj konto
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-sm">Indlæser...</div>
        ) : integrations.length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-lg">
            Ingen dialer-integrationer konfigureret endnu. Klik "Tilføj konto" for at starte.
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map(integration => (
              <div
                key={integration.id}
                className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium truncate">{integration.name}</span>
                    <Badge variant={integration.type === "adversus" ? "default" : "secondary"}>
                      {integration.type}
                    </Badge>
                    {integration.is_active ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Bruger: {integration.secrets?.username || "—"}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatFrequency(integration.sync_frequency_minutes)}
                    </span>
                    <span>Sidst synk: {formatDate(integration.last_sync_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={() => handleToggleActive(integration)}
                    aria-label="Toggle aktiv"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(integration)}
                    disabled={syncing === integration.id || !integration.is_active}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncing === integration.id ? "animate-spin" : ""}`} />
                    Synk
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(integration)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(integration.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingIntegration ? "Rediger integration" : "Tilføj ny dialer-konto"}
              </DialogTitle>
              <DialogDescription>
                Angiv navn og API-credentials for kontoen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn</Label>
                <Input
                  id="name"
                  placeholder="F.eks. Adversus Team A"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dialerTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">API Brugernavn</Label>
                <Input
                  id="username"
                  placeholder="API brugernavn"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">API Adgangskode</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="API adgangskode"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Synkroniseringsfrekvens</Label>
                <Select
                  value={form.sync_frequency_minutes}
                  onValueChange={v => setForm({ ...form, sync_frequency_minutes: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
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
              <Button onClick={handleSave}>
                {editingIntegration ? "Gem ændringer" : "Tilføj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
