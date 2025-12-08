import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, Eye, EyeOff, Database, CheckCircle2, XCircle } from "lucide-react";

interface DialerIntegration {
  id: string;
  name: string;
  type: string;
  secrets: {
    username?: string;
    password?: string;
    api_key?: string;
    base_url?: string;
  };
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency_minutes: number | null;
  created_at: string;
}

const dialerTypes = [
  { value: "adversus", label: "Adversus" },
  { value: "enreach", label: "Enreach" },
];

export function DialerIntegrations() {
  const [integrations, setIntegrations] = useState<DialerIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<DialerIntegration | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    type: "adversus",
    username: "",
    password: "",
    api_key: "",
    base_url: "",
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
      // Filtrar solo integraciones con formato de credenciales multi-tenant (objeto con username/password o api_key)
      const multiTenantIntegrations = (data || []).filter(d => {
        const secrets = d.secrets;
        // Verificar que secrets es un objeto con credenciales reales (no un array de nombres de env vars)
        if (typeof secrets === 'object' && secrets !== null && !Array.isArray(secrets)) {
          return secrets.username || secrets.api_key;
        }
        return false;
      });
      
      setIntegrations(multiTenantIntegrations.map(d => ({
        ...d,
        secrets: d.secrets as DialerIntegration['secrets']
      })) as DialerIntegration[]);
    }
    setLoading(false);
  };

  const handleAddIntegration = async () => {
    if (!newIntegration.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    const secrets: Record<string, string> = {};
    
    if (newIntegration.type === "adversus") {
      if (!newIntegration.username || !newIntegration.password) {
        toast.error("Brugernavn og adgangskode er påkrævet for Adversus");
        return;
      }
      secrets.username = newIntegration.username;
      secrets.password = newIntegration.password;
    } else if (newIntegration.type === "enreach") {
      if (!newIntegration.api_key || !newIntegration.base_url) {
        toast.error("API nøgle og base URL er påkrævet for Enreach");
        return;
      }
      secrets.api_key = newIntegration.api_key;
      secrets.base_url = newIntegration.base_url;
    }

    const { error } = await supabase.from("api_integrations").insert({
      name: newIntegration.name,
      type: newIntegration.type,
      secrets: secrets,
      is_active: true,
      sync_frequency_minutes: 60,
      enabled_sources: ["sales", "users", "campaigns"],
    });

    if (error) {
      console.error("Error adding integration:", error);
      toast.error("Kunne ikke tilføje integration");
    } else {
      toast.success("Integration tilføjet");
      setAddDialogOpen(false);
      setNewIntegration({ name: "", type: "adversus", username: "", password: "", api_key: "", base_url: "" });
      fetchIntegrations();
    }
  };

  const handleEditIntegration = async () => {
    if (!editingIntegration) return;

    const secrets: Record<string, string> = {};
    
    if (editingIntegration.type === "adversus") {
      secrets.username = editingIntegration.secrets.username || "";
      secrets.password = editingIntegration.secrets.password || "";
    } else if (editingIntegration.type === "enreach") {
      secrets.api_key = editingIntegration.secrets.api_key || "";
      secrets.base_url = editingIntegration.secrets.base_url || "";
    }

    const { error } = await supabase
      .from("api_integrations")
      .update({
        name: editingIntegration.name,
        secrets: secrets,
      })
      .eq("id", editingIntegration.id);

    if (error) {
      console.error("Error updating integration:", error);
      toast.error("Kunne ikke opdatere integration");
    } else {
      toast.success("Integration opdateret");
      setEditDialogOpen(false);
      setEditingIntegration(null);
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

  const handleToggleActive = async (integration: DialerIntegration) => {
    const { error } = await supabase
      .from("api_integrations")
      .update({ is_active: !integration.is_active })
      .eq("id", integration.id);

    if (error) {
      console.error("Error toggling integration:", error);
      toast.error("Kunne ikke opdatere integration");
    } else {
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id ? { ...i, is_active: !integration.is_active } : i
      ));
      toast.success(integration.is_active ? "Integration deaktiveret" : "Integration aktiveret");
    }
  };

  const handleSyncNow = async (integration: DialerIntegration) => {
    setSyncing(integration.id);
    try {
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: integration.type,
          actions: ["sales", "users", "campaigns"],
          days: 7,
        },
      });

      if (error) throw error;
      
      const result = data?.results?.find((r: any) => r.name === integration.name);
      if (result?.status === "success") {
        toast.success(`Synkronisering fuldført for ${integration.name}`);
      } else if (result?.status === "error") {
        toast.error(`Fejl: ${result.error}`);
      } else {
        toast.success("Synkronisering startet");
      }
      
      fetchIntegrations();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Synkronisering fejlede");
    } finally {
      setSyncing(null);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getTypeLabel = (type: string) => {
    return dialerTypes.find(t => t.value === type)?.label || type;
  };

  const maskSecret = (secret: string | undefined) => {
    if (!secret) return "••••••••";
    return "••••••••";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Dialer Integrationer (Multi-konto)
            </CardTitle>
            <CardDescription>
              Administrer flere Adversus/Enreach konti med separate legitimationsoplysninger
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tilføj konto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tilføj dialer-konto</DialogTitle>
                <DialogDescription>
                  Tilføj en ny Adversus eller Enreach konto med legitimationsoplysninger
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Navn</Label>
                  <Input
                    placeholder="F.eks. Adversus Team A"
                    value={newIntegration.name}
                    onChange={e => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newIntegration.type}
                    onValueChange={value => setNewIntegration(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dialerTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newIntegration.type === "adversus" && (
                  <>
                    <div className="space-y-2">
                      <Label>Brugernavn</Label>
                      <Input
                        placeholder="API brugernavn"
                        value={newIntegration.username}
                        onChange={e => setNewIntegration(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adgangskode</Label>
                      <Input
                        type="password"
                        placeholder="API adgangskode"
                        value={newIntegration.password}
                        onChange={e => setNewIntegration(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {newIntegration.type === "enreach" && (
                  <>
                    <div className="space-y-2">
                      <Label>API Nøgle</Label>
                      <Input
                        placeholder="API nøgle"
                        value={newIntegration.api_key}
                        onChange={e => setNewIntegration(prev => ({ ...prev, api_key: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        placeholder="https://api.enreach.com"
                        value={newIntegration.base_url}
                        onChange={e => setNewIntegration(prev => ({ ...prev, base_url: e.target.value }))}
                      />
                    </div>
                  </>
                )}
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
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
        ) : integrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Ingen dialer-konti konfigureret endnu. Tilføj din første konto ovenfor.
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map(integration => (
              <div
                key={integration.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{integration.name}</span>
                        <Badge variant={integration.is_active ? "default" : "secondary"}>
                          {getTypeLabel(integration.type)}
                        </Badge>
                        {integration.is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sidst synkroniseret: {integration.last_sync_at 
                          ? new Date(integration.last_sync_at).toLocaleString("da-DK") 
                          : "Aldrig"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.is_active}
                      onCheckedChange={() => handleToggleActive(integration)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncNow(integration)}
                      disabled={!integration.is_active || syncing === integration.id}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${syncing === integration.id ? "animate-spin" : ""}`} />
                      Synk nu
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingIntegration(integration);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteIntegration(integration.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Credentials preview */}
                <div className="bg-muted/50 rounded p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Legitimationsoplysninger:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePasswordVisibility(integration.id)}
                    >
                      {showPasswords[integration.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {integration.type === "adversus" && (
                    <div className="mt-2 space-y-1">
                      <div>
                        <span className="text-muted-foreground">Brugernavn: </span>
                        <span className="font-mono">
                          {showPasswords[integration.id] 
                            ? integration.secrets.username 
                            : maskSecret(integration.secrets.username)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Adgangskode: </span>
                        <span className="font-mono">
                          {showPasswords[integration.id] 
                            ? integration.secrets.password 
                            : maskSecret(integration.secrets.password)}
                        </span>
                      </div>
                    </div>
                  )}
                  {integration.type === "enreach" && (
                    <div className="mt-2 space-y-1">
                      <div>
                        <span className="text-muted-foreground">API Nøgle: </span>
                        <span className="font-mono">
                          {showPasswords[integration.id] 
                            ? integration.secrets.api_key 
                            : maskSecret(integration.secrets.api_key)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Base URL: </span>
                        <span className="font-mono">{integration.secrets.base_url || "Ikke konfigureret"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rediger dialer-konto</DialogTitle>
              <DialogDescription>
                Opdater legitimationsoplysninger for {editingIntegration?.name}
              </DialogDescription>
            </DialogHeader>
            {editingIntegration && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Navn</Label>
                  <Input
                    value={editingIntegration.name}
                    onChange={e => setEditingIntegration(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>

                {editingIntegration.type === "adversus" && (
                  <>
                    <div className="space-y-2">
                      <Label>Brugernavn</Label>
                      <Input
                        value={editingIntegration.secrets.username || ""}
                        onChange={e => setEditingIntegration(prev => prev ? {
                          ...prev,
                          secrets: { ...prev.secrets, username: e.target.value }
                        } : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adgangskode</Label>
                      <Input
                        type="password"
                        value={editingIntegration.secrets.password || ""}
                        onChange={e => setEditingIntegration(prev => prev ? {
                          ...prev,
                          secrets: { ...prev.secrets, password: e.target.value }
                        } : null)}
                      />
                    </div>
                  </>
                )}

                {editingIntegration.type === "enreach" && (
                  <>
                    <div className="space-y-2">
                      <Label>API Nøgle</Label>
                      <Input
                        value={editingIntegration.secrets.api_key || ""}
                        onChange={e => setEditingIntegration(prev => prev ? {
                          ...prev,
                          secrets: { ...prev.secrets, api_key: e.target.value }
                        } : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={editingIntegration.secrets.base_url || ""}
                        onChange={e => setEditingIntegration(prev => prev ? {
                          ...prev,
                          secrets: { ...prev.secrets, base_url: e.target.value }
                        } : null)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuller</Button>
              </DialogClose>
              <Button onClick={handleEditIntegration}>Gem ændringer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
