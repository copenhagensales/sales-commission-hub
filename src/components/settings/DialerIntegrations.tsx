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
import { Phone, Play, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface DialerIntegration {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency_minutes: number | null;
}

interface FormData {
  name: string;
  provider: string;
  username: string;
  password: string;
}

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
  });

  // Fetch Dialer Integrations from new table
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["dialer-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, is_active, last_sync_at, sync_frequency_minutes")
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
          credentials: {
            username: data.username,
            password: data.password,
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
    mutationFn: async ({ integrationId, provider }: { integrationId: string; provider: string }) => {
      setSyncingId(integrationId);
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: provider,
          integration_id: integrationId,
          action: "sync",
          days: 7,
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
    setFormData({ name: "", provider: "adversus", username: "", password: "" });
    setEditingId(null);
    setIsDialogOpen(false);
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
                <TableHead>Status</TableHead>
                <TableHead>Sidst synkroniseret</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">{integration.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {integration.provider}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={integration.is_active ? "default" : "secondary"}>
                      {integration.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {integration.last_sync_at ? (
                      <span className="text-sm">{new Date(integration.last_sync_at).toLocaleString("da-DK")}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Aldrig</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!integration.is_active || syncingId === integration.id}
                      onClick={() => syncMutation.mutate({ integrationId: integration.id, provider: integration.provider })}
                    >
                      {syncingId === integration.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
