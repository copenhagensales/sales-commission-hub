import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Clock, Trash2, Info, Ban } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface Campaign {
  id: string;
  name: string;
  client_name: string;
}

interface RetentionPolicy {
  id: string;
  client_campaign_id: string;
  retention_days: number | null;
  is_active: boolean;
  cleanup_mode: string;
  no_data_held: boolean;
}

interface DataRetentionPolicy {
  id: string;
  data_type: string;
  display_name: string;
  retention_days: number | null;
  is_active: boolean;
  cleanup_mode: string;
}

export default function RetentionPolicies() {
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["retention-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id, name, clients(name)")
        .order("name");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        client_name: c.clients?.name || "Ukendt",
      })) as Campaign[];
    },
  });

  const { data: policies, isLoading: loadingPolicies } = useQuery({
    queryKey: ["retention-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_retention_policies")
        .select("*");
      if (error) throw error;
      return (data || []) as RetentionPolicy[];
    },
  });

  const { data: dataRetentionPolicies, isLoading: loadingDataPolicies } = useQuery({
    queryKey: ["data-retention-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_retention_policies")
        .select("*");
      if (error) throw error;
      return (data || []) as DataRetentionPolicy[];
    },
  });

  const dataUpsertMutation = useMutation({
    mutationFn: async (params: {
      data_type: string;
      retention_days?: number | null;
      is_active?: boolean;
      cleanup_mode?: string;
    }) => {
      const { data, error } = await supabase
        .from("data_retention_policies")
        .upsert(
          {
            data_type: params.data_type,
            display_name: dataRetentionPolicies?.find(p => p.data_type === params.data_type)?.display_name || params.data_type,
            ...(params.retention_days !== undefined && { retention_days: params.retention_days }),
            ...(params.is_active !== undefined && { is_active: params.is_active }),
            ...(params.cleanup_mode !== undefined && { cleanup_mode: params.cleanup_mode }),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "data_type" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-retention-policies"] });
    },
    onError: (err: any) => {
      toast.error("Kunne ikke gemme: " + err.message);
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      client_campaign_id: string;
      retention_days?: number | null;
      is_active?: boolean;
      cleanup_mode?: string;
      no_data_held?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("campaign_retention_policies")
        .upsert(
          {
            client_campaign_id: params.client_campaign_id,
            ...(params.retention_days !== undefined && { retention_days: params.retention_days }),
            ...(params.is_active !== undefined && { is_active: params.is_active }),
            ...(params.cleanup_mode !== undefined && { cleanup_mode: params.cleanup_mode }),
            ...(params.no_data_held !== undefined && { no_data_held: params.no_data_held }),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_campaign_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-policies"] });
    },
    onError: (err: any) => {
      toast.error("Kunne ikke gemme: " + err.message);
    },
  });

  const getPolicy = (campaignId: string) =>
    policies?.find((p) => p.client_campaign_id === campaignId);

  const handleRetentionDaysChange = (campaignId: string, value: string) => {
    const days = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(days as number)) return;
    upsertMutation.mutate({ client_campaign_id: campaignId, retention_days: days });
  };

  const handleActiveToggle = (campaignId: string, active: boolean) => {
    const policy = getPolicy(campaignId);
    if (active && (!policy || !policy.retention_days)) {
      toast.error("Angiv først antal retention-dage før aktivering.");
      return;
    }
    upsertMutation.mutate({ client_campaign_id: campaignId, is_active: active });
  };

  const handleCleanupModeChange = (campaignId: string, mode: string) => {
    upsertMutation.mutate({ client_campaign_id: campaignId, cleanup_mode: mode });
  };

  const handleNoDataHeldToggle = (campaignId: string, noData: boolean) => {
    upsertMutation.mutate({ client_campaign_id: campaignId, no_data_held: noData });
  };

  const handleDataRetentionDaysChange = (dataType: string, value: string) => {
    const days = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(days as number)) return;
    dataUpsertMutation.mutate({ data_type: dataType, retention_days: days });
  };

  const handleDataActiveToggle = (dataType: string, active: boolean) => {
    const policy = dataRetentionPolicies?.find(p => p.data_type === dataType);
    if (active && (!policy || !policy.retention_days)) {
      toast.error("Angiv først antal retention-dage før aktivering.");
      return;
    }
    dataUpsertMutation.mutate({ data_type: dataType, is_active: active });
  };

  const isLoading = loadingCampaigns || loadingPolicies;
  const activeCount = (policies?.filter((p) => p.is_active).length || 0) + (dataRetentionPolicies?.filter((p) => p.is_active).length || 0);

  const cleanupModeTooltip = (mode: string) => {
    if (mode === "delete_all") return "Hele salgsrækken slettes inkl. tilknyttede poster.";
    return "Kundedata anonymiseres: telefon → null, firma → 'Anonymiseret', raw_payload → null. Salgsdata bevares.";
  };

  const dataTypeTooltips: Record<string, string> = {
    customer_inquiries: "Kundehenvendelser slettes permanent efter udløb.",
    candidates: "Kandidatdata anonymiseres eller slettes efter udløb.",
    inactive_employees: "Deaktiverede medarbejdere slettes fra master data efter udløb.",
    integration_logs: "Integrationslogfiler med potentielle persondata slettes.",
    login_events: "Login-historik (email, IP, user agent) slettes.",
    password_reset_tokens: "Udløbne password reset tokens slettes.",
    communication_logs: "Rekrutteringskommunikation (SMS/email) slettes.",
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Sletningspolitikker</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Konfigurer retention-perioder og rensningstype per kampagne
          </p>
        </div>

        {/* Warning banner */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Automatisk sletning er deaktiveret systemwide
              </p>
              <p className="text-sm text-muted-foreground">
                Denne side forbereder politikker til fremtidig aktivering. Selv hvis du sætter en politik til "Aktiv" her, vil cleanup-jobbet ikke køre før det eksplicit aktiveres i koden. Ingen data slettes endnu.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data preservation info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Hvad sker der ved rensning?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="font-medium text-green-700">✓ Bevares altid</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Salgstidspunkt, omsætning, provision</li>
                      <li>• Produkt, antal, kampagne</li>
                      <li>• Sælger (navn + email)</li>
                      <li>• Valideringsstatus, kilde</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-red-700">✗ Anonymiseres / slettes</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>Anonymisér:</strong> customer_phone → null, customer_company → "Anonymiseret", raw_payload → null</li>
                      <li>• <strong>Slet alt:</strong> Hele salgsrækken fjernes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="flex gap-4">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {campaigns?.length || 0} kampagner
          </Badge>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${activeCount > 0 ? "bg-green-500/10 text-green-700 border-green-500/30" : ""}`}>
            {activeCount} aktive politikker
          </Badge>
        </div>

        {/* Campaign table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kampagneoversigt</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Indlæser kampagner…</p>
            ) : !campaigns?.length ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Ingen kampagner fundet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-3 pr-4 font-medium text-muted-foreground">Klient</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground">Kampagne</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground w-24">Ingen data</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground w-32">Retention (dage)</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground w-48">Rensningstype</th>
                      <th className="py-3 font-medium text-muted-foreground w-20">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => {
                      const policy = getPolicy(campaign.id);
                      const noData = policy?.no_data_held || false;
                      return (
                        <tr key={campaign.id} className={`border-b last:border-0 hover:bg-muted/30 ${noData ? "opacity-60" : ""}`}>
                          <td className="py-3 pr-4 text-foreground">{campaign.client_name}</td>
                          <td className="py-3 pr-4 text-foreground">
                            <span className="flex items-center gap-1.5">
                              {campaign.name}
                              {noData && (
                                <Badge variant="outline" className="text-xs ml-1">
                                  <Ban className="h-3 w-3 mr-1" /> Ingen data
                                </Badge>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">{cleanupModeTooltip(policy?.cleanup_mode || "anonymize_customer")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <Switch
                              checked={noData}
                              onCheckedChange={(v) => handleNoDataHeldToggle(campaign.id, v)}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <Input
                              type="number"
                              min={1}
                              placeholder="—"
                              className="w-24 h-8 text-sm"
                              value={policy?.retention_days ?? ""}
                              onChange={(e) => handleRetentionDaysChange(campaign.id, e.target.value)}
                              disabled={noData}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <Select
                              value={policy?.cleanup_mode || "anonymize_customer"}
                              onValueChange={(v) => handleCleanupModeChange(campaign.id, v)}
                              disabled={noData}
                            >
                              <SelectTrigger className="w-44 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="anonymize_customer">
                                  <span className="flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5" /> Anonymisér kundedata
                                  </span>
                                </SelectItem>
                                <SelectItem value="delete_all">
                                  <span className="flex items-center gap-2">
                                    <Trash2 className="h-3.5 w-3.5" /> Slet alt
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3">
                            <Switch
                              checked={policy?.is_active || false}
                              onCheckedChange={(v) => handleActiveToggle(campaign.id, v)}
                              disabled={noData}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Øvrige datatyper */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Øvrige datatyper</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDataPolicies ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Indlæser…</p>
            ) : !dataRetentionPolicies?.length ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Ingen datatyper konfigureret.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-3 pr-4 font-medium text-muted-foreground">Datatype</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground w-32">Retention (dage)</th>
                      <th className="py-3 pr-4 font-medium text-muted-foreground w-48">Rensningstype</th>
                      <th className="py-3 font-medium text-muted-foreground w-20">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataRetentionPolicies.map((policy) => (
                      <tr key={policy.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-4 text-foreground">
                          <span className="flex items-center gap-1.5">
                            {policy.display_name}
                            {dataTypeTooltips[policy.data_type] && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">{dataTypeTooltips[policy.data_type]}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Input
                            type="number"
                            min={1}
                            placeholder="—"
                            className="w-24 h-8 text-sm"
                            value={policy.retention_days ?? ""}
                            onChange={(e) => handleDataRetentionDaysChange(policy.data_type, e.target.value)}
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">
                            <Trash2 className="h-3 w-3 mr-1" /> Slet alt
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Switch
                            checked={policy.is_active}
                            onCheckedChange={(v) => handleDataActiveToggle(policy.data_type, v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sletningshistorik */}
        <CleanupHistory />
      </div>
    </MainLayout>
  );
}

function CleanupHistory() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["gdpr-cleanup-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gdpr_cleanup_log")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const actionLabels: Record<string, string> = {
    gdpr_data_export: "Dataudtræk (Art. 15)",
    gdpr_data_deletion: "Datasletning (Art. 17)",
    gdpr_data_cleanup: "Automatisk rensning",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Sletningshistorik
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Indlæser…</p>
        ) : !logs?.length ? (
          <div className="text-center py-8">
            <Shield className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Ingen kørsler endnu</p>
            <p className="text-muted-foreground text-xs mt-1">
              Historik vises her når GDPR-funktioner kører
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Tidspunkt</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Handling</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Berørte poster</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Kilde</th>
                  <th className="py-3 font-medium text-muted-foreground">Detaljer</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 text-foreground whitespace-nowrap">
                      {new Date(log.run_at).toLocaleString("da-DK", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-foreground">{log.records_affected}</td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{log.triggered_by || "—"}</td>
                    <td className="py-3">
                      {log.details ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <pre className="text-xs whitespace-pre-wrap">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
