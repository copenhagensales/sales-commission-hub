import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Database, Settings, Key, Loader2 } from "lucide-react";

interface ClientIntegration {
  id: string;
  crm_type: string;
  api_url: string | null;
  is_active: boolean;
  cron_schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  config: unknown;
}

interface Client {
  id: string;
  name: string;
  integration?: ClientIntegration;
}

const CRM_TYPES = [
  { value: "hubspot", label: "HubSpot" },
  { value: "salesforce", label: "Salesforce" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "generic_api", label: "Generic API" },
  { value: "excel", label: "Excel Upload" },
];

export function CustomerIntegrations() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    crm_type: "generic_api",
    api_url: "",
    credentials_json: "{}",
    config_json: "{}",
    cron_schedule: "0 * * * *",
  });

  // Fetch Clients and their Integrations
  const { data: clientsAndIntegrations, isLoading } = useQuery({
    queryKey: ["clients-integrations"],
    queryFn: async () => {
      const { data: clients } = await supabase.from("clients").select("id, name").order("name");
      const { data: integrations } = await supabase.from("customer_integrations").select("*");

      return (
        clients?.map((client) => ({
          ...client,
          integration: integrations?.find((i) => i.client_id === client.id),
        })) || []
      );
    },
  });

  // Save Configuration
  const saveMutation = useMutation({
    mutationFn: async (clientId: string) => {
      let credentials, config;
      try {
        credentials = JSON.parse(formData.credentials_json);
        config = JSON.parse(formData.config_json);
      } catch {
        throw new Error("Credenciales o Configuración deben ser JSON válido");
      }

      const { error } = await supabase.functions.invoke("scheduler-manager", {
        body: {
          action: "save_config",
          client_id: clientId,
          crm_type: formData.crm_type,
          api_url: formData.api_url,
          credentials: credentials,
          config: config,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Konfiguration gemt");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients-integrations"] });
    },
    onError: (error) => toast.error(`Fejl: ${error.message}`),
  });

  // Toggle Activation
  const toggleMutation = useMutation({
    mutationFn: async ({ clientId, isActive, schedule }: { clientId: string; isActive: boolean; schedule: string | null }) => {
      const action = isActive ? "deactivate" : "activate";
      const { error } = await supabase.functions.invoke("scheduler-manager", {
        body: {
          action: action,
          client_id: clientId,
          schedule: schedule || "0 * * * *",
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync status opdateret");
      queryClient.invalidateQueries({ queryKey: ["clients-integrations"] });
    },
    onError: (error) => toast.error(`Fejl: ${error.message}`),
  });

  const openConfigDialog = (client: Client) => {
    setSelectedClient(client.id);
    if (client.integration) {
      const configObj = typeof client.integration.config === "object" && client.integration.config !== null 
        ? client.integration.config 
        : {};
      setFormData({
        crm_type: client.integration.crm_type,
        api_url: client.integration.api_url || "",
        credentials_json: '{"note": "Krypterede credentials - behold for at beholde"}',
        config_json: JSON.stringify(configObj, null, 2),
        cron_schedule: client.integration.cron_schedule || "0 * * * *",
      });
    } else {
      setFormData({
        crm_type: "generic_api",
        api_url: "",
        credentials_json: '{\n  "api_key": "..."\n}',
        config_json: '{\n  "search_field": "phone"\n}',
        cron_schedule: "0 * * * *",
      });
    }
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Kunde CRM Synkronisering
            </CardTitle>
            <CardDescription>Konfigurer automatisk validering af salg mod kunders CRM systemer.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Indlæser kunder...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Integration</TableHead>
                <TableHead>Sync Status</TableHead>
                <TableHead>Sidst kørt</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsAndIntegrations?.map((item: Client) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.integration ? (
                      <Badge variant="outline" className="capitalize">
                        {item.integration.crm_type.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.integration ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.integration.is_active}
                          onCheckedChange={() =>
                            toggleMutation.mutate({
                              clientId: item.id,
                              isActive: item.integration!.is_active,
                              schedule: item.integration!.cron_schedule,
                            })
                          }
                        />
                        <span className={`text-xs ${item.integration.is_active ? "text-green-600" : "text-muted-foreground"}`}>
                          {item.integration.is_active ? "Aktiv" : "Pauset"}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">Ikke konfigureret</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.integration?.last_run_at ? (
                      <div className="flex flex-col">
                        <span className="text-xs">{new Date(item.integration.last_run_at).toLocaleString("da-DK")}</span>
                        <span className={`text-[10px] ${item.integration.last_status === "success" ? "text-green-600" : "text-red-500"}`}>
                          {item.integration.last_status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openConfigDialog(item)}>
                      <Settings className="h-4 w-4 mr-1" /> Konfigurer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Konfigurer Integration</DialogTitle>
            <DialogDescription>Definer hvordan vi forbinder til kundens CRM.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CRM Type</Label>
                <Select value={formData.crm_type} onValueChange={(val) => setFormData({ ...formData, crm_type: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cron Schedule</Label>
                <Input
                  value={formData.cron_schedule}
                  onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                  placeholder="0 * * * *"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>API URL (Base Endpoint)</Label>
              <Input
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://api.crm.com/v1"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" /> Credentials (JSON)
              </Label>
              <Textarea
                value={formData.credentials_json}
                onChange={(e) => setFormData({ ...formData, credentials_json: e.target.value })}
                className="font-mono text-xs"
                rows={4}
                placeholder='{"api_key": "SECRET_KEY_123"}'
              />
              <p className="text-[10px] text-muted-foreground">Disse credentials bliver krypteret før de gemmes.</p>
            </div>

            <div className="space-y-2">
              <Label>Mapping Konfiguration (JSON)</Label>
              <Textarea
                value={formData.config_json}
                onChange={(e) => setFormData({ ...formData, config_json: e.target.value })}
                className="font-mono text-xs"
                rows={4}
                placeholder='{"search_field": "phone", "status_field": "stage"}'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={() => selectedClient && saveMutation.mutate(selectedClient)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem Konfiguration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
