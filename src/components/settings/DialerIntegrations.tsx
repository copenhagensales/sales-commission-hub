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
import { Phone, Play, Loader2, Plus, Pencil, Trash2, Terminal, Webhook, Copy, Check, List, ExternalLink, MoreVertical, PhoneCall, Eye, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { BatchMigrationDialog } from "./BatchMigrationDialog";

// Data filter rule
interface DataFilterRule {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'notEquals' | 'notContains';
  value: string;
}

// Filter group - combines multiple rules with AND/OR logic
interface DataFilterGroup {
  logic: 'AND' | 'OR';
  rules: DataFilterRule[];
}

// Conditional extraction rule
interface ConditionalExtractionRule {
  conditionKey: string;           // Key to check in data object
  conditionValue?: string;        // Optional: specific value to match
  extractionType: 'specific_fields' | 'regex' | 'static_value' | 'composite';
  targetKeys?: string[];          // For specific_fields
  regexPattern?: string;          // For regex extraction
  staticProductName?: string;     // For static_value
  staticProductPrice?: number;    // For static_value
  productNameTemplate?: string;   // For composite extraction
}

interface ProductExtractionConfig {
  strategy: 'standard_closure' | 'data_keys_regex' | 'specific_fields' | 'conditional';
  regexPattern?: string;
  targetKeys?: string[];
  defaultName?: string;
  validationKey?: string;
  conditionalRules?: ConditionalExtractionRule[];
  dataFilters?: DataFilterRule[];
  dataFilterGroups?: DataFilterGroup[];
  dataFilterGroupsLogic?: 'AND' | 'OR';
}

interface DialerIntegrationConfig {
  productExtraction?: ProductExtractionConfig;
}

interface DialerIntegration {
  id: string;
  name: string;
  provider: string;
  api_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency_minutes: number | null;
  config: DialerIntegrationConfig | null;
}

interface FormData {
  name: string;
  provider: string;
  username: string;
  password: string;
  api_url: string;
  org_code: string;
  // Product extraction config
  productExtractionStrategy: 'standard_closure' | 'data_keys_regex' | 'specific_fields' | 'conditional';
  productRegexPattern: string;
  productTargetKeys: string;
  productDefaultName: string;
  productValidationKey: string;
  conditionalRules: ConditionalExtractionRule[];
  dataFilters: DataFilterRule[];
  dataFilterGroups: DataFilterGroup[];
  dataFilterGroupsLogic: 'AND' | 'OR';
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

// HeroBase (Enreach Outbound) has a programmatic API for webhooks at /hooks
// The webhook payload structure is different from Enreach Contact Center webhooks

export function DialerIntegrations() {
  const { t } = useTranslation();
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
    org_code: "",
    productExtractionStrategy: "standard_closure",
    productRegexPattern: "",
    productTargetKeys: "",
    productDefaultName: "",
    productValidationKey: "",
    conditionalRules: [],
    dataFilters: [],
    dataFilterGroups: [],
    dataFilterGroupsLogic: 'AND',
  });

  // Per-integration sync days state
  const [syncDays, setSyncDays] = useState<Record<string, string>>({});

  // Manual function execution state
  const [manualFunction, setManualFunction] = useState("backfill-opp");
  const [manualDays, setManualDays] = useState("30");
  const [manualLimit, setManualLimit] = useState("100");
  const [isExecuting, setIsExecuting] = useState(false);

  // Webhook creation state (Adversus)
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookIntegrationId, setWebhookIntegrationId] = useState<string | null>(null);
  const [webhookIntegrationName, setWebhookIntegrationName] = useState<string>("");
  const [selectedWebhookEvent, setSelectedWebhookEvent] = useState("leadClosedSuccess");
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Enreach webhook state (programmatic like Adversus)
  const [enreachWebhookDialogOpen, setEnreachWebhookDialogOpen] = useState(false);
  const [enreachWebhookIntegrationId, setEnreachWebhookIntegrationId] = useState<string | null>(null);
  const [enreachWebhookIntegrationName, setEnreachWebhookIntegrationName] = useState<string>("");
  const [enreachWebhookDescription, setEnreachWebhookDescription] = useState("");
  const [enreachWebhookCampaignCode, setEnreachWebhookCampaignCode] = useState("");
  const [enreachCampaigns, setEnreachCampaigns] = useState<Array<{ code: string; name: string }>>([]);
  const [isLoadingEnreachCampaigns, setIsLoadingEnreachCampaigns] = useState(false);
  const [isCreatingEnreachWebhook, setIsCreatingEnreachWebhook] = useState(false);
  
  // Enreach webhook management state
  const [manageEnreachWebhooksDialogOpen, setManageEnreachWebhooksDialogOpen] = useState(false);
  const [manageEnreachWebhooksIntegrationId, setManageEnreachWebhooksIntegrationId] = useState<string | null>(null);
  const [manageEnreachWebhooksIntegrationName, setManageEnreachWebhooksIntegrationName] = useState<string>("");
  const [enreachWebhooksList, setEnreachWebhooksList] = useState<Array<{ id: string; urlTemplate?: string; name?: string; campaignCode?: string; leadStatus?: string; isActive?: boolean }>>([]);
  const [isLoadingEnreachWebhooks, setIsLoadingEnreachWebhooks] = useState(false);
  const [isDeletingEnreachWebhookId, setIsDeletingEnreachWebhookId] = useState<string | null>(null);
  
  // Webhook example state
  const [webhookExampleDialogOpen, setWebhookExampleDialogOpen] = useState(false);
  const [webhookExampleData, setWebhookExampleData] = useState<unknown>(null);
  const [webhookExampleMessage, setWebhookExampleMessage] = useState<string | null>(null);
  const [isLoadingWebhookExample, setIsLoadingWebhookExample] = useState(false);
  const [webhookExampleId, setWebhookExampleId] = useState<string | null>(null);

  // Webhook management state (Adversus)
  const [manageWebhooksDialogOpen, setManageWebhooksDialogOpen] = useState(false);
  const [manageWebhooksIntegrationId, setManageWebhooksIntegrationId] = useState<string | null>(null);
  const [manageWebhooksIntegrationName, setManageWebhooksIntegrationName] = useState<string>("");
  const [webhooksList, setWebhooksList] = useState<Array<{ id: number; url: string; event: string; authKey?: string }>>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);
  const [isDeletingWebhookId, setIsDeletingWebhookId] = useState<number | null>(null);

  // Fetch calls state
  const [fetchingCallsId, setFetchingCallsId] = useState<string | null>(null);
  const [callsDays, setCallsDays] = useState<Record<string, string>>({});

  // Delete sales state
  const [deleteSalesDialogOpen, setDeleteSalesDialogOpen] = useState(false);
  const [deleteSalesIntegration, setDeleteSalesIntegration] = useState<DialerIntegration | null>(null);
  const [deleteSalesStep, setDeleteSalesStep] = useState<1 | 2 | 3>(1);
  const [deleteSalesConfirmCheck1, setDeleteSalesConfirmCheck1] = useState(false);
  const [deleteSalesConfirmCheck2, setDeleteSalesConfirmCheck2] = useState(false);
  const [deleteSalesConfirmCheck3, setDeleteSalesConfirmCheck3] = useState(false);
  const [deleteSalesConfirmText, setDeleteSalesConfirmText] = useState("");
  const [isDeletingSales, setIsDeletingSales] = useState(false);
  const [deletedSalesCount, setDeletedSalesCount] = useState<number | null>(null);

  // Fetch Dialer Integrations from new table
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["dialer-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, api_url, config, is_active, last_sync_at, sync_frequency_minutes")
        .order("name");

      if (error) throw error;
      return data as DialerIntegration[];
    },
  });

  // Fetch dialer calls grouped by agent
  const { data: callsByAgent, isLoading: isLoadingCalls, refetch: refetchCalls } = useQuery({
    queryKey: ["dialer-calls-by-agent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_calls")
        .select(`
          id,
          external_id,
          dialer_name,
          integration_type,
          start_time,
          end_time,
          duration_seconds,
          total_duration_seconds,
          status,
          agent_external_id,
          agent_id,
          campaign_external_id,
          agents (id, name, email)
        `)
        .order("start_time", { ascending: false })
        .limit(500);

      if (error) throw error;
      
      // Group by agent
      const grouped: Record<string, { agent: { id: string; name: string; email: string } | null; calls: typeof data }> = {};
      
      data?.forEach((call) => {
        const agentKey = call.agent_id || call.agent_external_id || "unknown";
        if (!grouped[agentKey]) {
          grouped[agentKey] = {
            agent: call.agents as { id: string; name: string; email: string } | null,
            calls: []
          };
        }
        grouped[agentKey].calls.push(call);
      });
      
      return grouped;
    },
  });

  // Save integration (create or update)
  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { id?: string }) => {
      // For Enreach, org_code is the same as username
      const orgCode = data.provider === 'enreach' ? data.username : (data.org_code || null);
      
      // Build product extraction config
      const productExtraction: ProductExtractionConfig = {
        strategy: data.productExtractionStrategy,
      };
      if (data.productExtractionStrategy === 'data_keys_regex' && data.productRegexPattern) {
        productExtraction.regexPattern = data.productRegexPattern;
      }
      if (data.productExtractionStrategy === 'specific_fields' && data.productTargetKeys) {
        productExtraction.targetKeys = data.productTargetKeys.split(',').map(k => k.trim()).filter(Boolean);
      }
      if (data.productExtractionStrategy === 'conditional' && data.conditionalRules.length > 0) {
        productExtraction.conditionalRules = data.conditionalRules;
      }
      if (data.productDefaultName) {
        productExtraction.defaultName = data.productDefaultName;
      }
      if (data.productValidationKey) {
        productExtraction.validationKey = data.productValidationKey;
      }
      if (data.dataFilters && data.dataFilters.length > 0) {
        productExtraction.dataFilters = data.dataFilters;
      }
      if (data.dataFilterGroups && data.dataFilterGroups.length > 0) {
        productExtraction.dataFilterGroups = data.dataFilterGroups;
        productExtraction.dataFilterGroupsLogic = data.dataFilterGroupsLogic;
      }
      
      const config: DialerIntegrationConfig = {
        productExtraction,
      };
      
      const { data: result, error } = await supabase.functions.invoke("scheduler-manager", {
        body: {
          action: "save_dialer",
          integration_id: data.id,
          name: data.name,
          provider: data.provider,
          api_url: data.api_url || null,
          config,
          credentials: {
            username: data.username,
            password: data.password,
            api_url: data.api_url || null,
            org_code: orgCode,
          },
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success(editingId ? t("dialerIntegrations.integrationUpdated") : t("dialerIntegrations.integrationCreated"));
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
      resetForm();
    },
    onError: (error) => {
      toast.error(`${t("dialerIntegrations.error")}: ${error.message}`);
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
      toast.success(t("dialerIntegrations.integrationDeleted"));
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    },
    onError: (error) => {
      toast.error(`${t("dialerIntegrations.deleteError")}: ${error.message}`);
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

  // Fetch Calls
  const fetchCallsMutation = useMutation({
    mutationFn: async ({ integrationId, provider, days }: { integrationId: string; provider: string; days: number }) => {
      setFetchingCallsId(integrationId);
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: provider,
          integration_id: integrationId,
          actions: ["calls"],
          days,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Calls hentet", {
        description: `Resultat: ${data.calls?.created || 0} oprettet, ${data.calls?.updated || 0} opdateret`,
      });
      queryClient.invalidateQueries({ queryKey: ["dialer-calls-by-agent"] });
    },
    onError: (error) => {
      toast.error(`Fejl ved hentning af calls: ${error.message}`);
    },
    onSettled: () => {
      setFetchingCallsId(null);
    },
  });

  const resetForm = () => {
    setFormData({ 
      name: "", 
      provider: "adversus", 
      username: "", 
      password: "", 
      api_url: "", 
      org_code: "",
      productExtractionStrategy: "standard_closure",
      productRegexPattern: "",
      productTargetKeys: "",
      productDefaultName: "",
      productValidationKey: "",
      conditionalRules: [],
      dataFilters: [],
      dataFilterGroups: [],
      dataFilterGroupsLogic: 'AND',
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  // Open delete sales dialog
  const openDeleteSalesDialog = (integration: DialerIntegration) => {
    setDeleteSalesIntegration(integration);
    setDeleteSalesStep(1);
    setDeleteSalesConfirmCheck1(false);
    setDeleteSalesConfirmCheck2(false);
    setDeleteSalesConfirmCheck3(false);
    setDeleteSalesConfirmText("");
    setDeletedSalesCount(null);
    setDeleteSalesDialogOpen(true);
  };

  // Execute delete sales
  const executeDeleteSales = async () => {
    if (!deleteSalesIntegration) return;
    
    setIsDeletingSales(true);
    try {
      // Delete sales from this integration
      const { data, error } = await supabase
        .from("sales")
        .delete()
        .eq("source", deleteSalesIntegration.name)
        .select("id");
      
      if (error) throw error;
      
      const count = data?.length || 0;
      setDeletedSalesCount(count);
      setDeleteSalesStep(3);
      
      toast.success(`${count} salg slettet fra ${deleteSalesIntegration.name}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved sletning: ${errorMessage}`);
    } finally {
      setIsDeletingSales(false);
    }
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

  // Load webhooks from Adversus
  const loadWebhooks = async (integrationId: string) => {
    setIsLoadingWebhooks(true);
    try {
      const { data, error } = await supabase.functions.invoke("adversus-manage-webhooks", {
        body: {
          integration_id: integrationId,
          action: "list",
        },
      });

      if (error) throw error;
      
      // Adversus API returns { webhooks: [...] }, our function wraps it as { success, webhooks: adversusResponse }
      const webhooksArray = data?.webhooks?.webhooks || data?.webhooks || [];
      setWebhooksList(Array.isArray(webhooksArray) ? webhooksArray : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved hentning af webhooks: ${errorMessage}`);
      setWebhooksList([]);
    } finally {
      setIsLoadingWebhooks(false);
    }
  };

  // Delete webhook from Adversus
  const deleteWebhook = async (webhookId: number) => {
    if (!manageWebhooksIntegrationId) return;
    
    setIsDeletingWebhookId(webhookId);
    try {
      const { data, error } = await supabase.functions.invoke("adversus-manage-webhooks", {
        body: {
          integration_id: manageWebhooksIntegrationId,
          action: "delete",
          webhook_id: webhookId,
        },
      });

      if (error) throw error;

      toast.success("Webhook slettet");
      // Refresh the list
      loadWebhooks(manageWebhooksIntegrationId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved sletning af webhook: ${errorMessage}`);
    } finally {
      setIsDeletingWebhookId(null);
    }
  };

  // Open manage webhooks dialog
  const openManageWebhooksDialog = (integrationId: string, integrationName: string) => {
    setManageWebhooksIntegrationId(integrationId);
    setManageWebhooksIntegrationName(integrationName);
    setManageWebhooksDialogOpen(true);
    loadWebhooks(integrationId);
  };

  // Load webhooks from Enreach/HeroBase
  const loadEnreachWebhooks = async (integrationId: string) => {
    setIsLoadingEnreachWebhooks(true);
    try {
      const { data, error } = await supabase.functions.invoke("enreach-manage-webhooks", {
        body: {
          integration_id: integrationId,
          action: "list",
        },
      });

      if (error) throw error;
      
      const webhooksArray = data?.webhooks || [];
      setEnreachWebhooksList(Array.isArray(webhooksArray) ? webhooksArray : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved hentning af webhooks: ${errorMessage}`);
      setEnreachWebhooksList([]);
    } finally {
      setIsLoadingEnreachWebhooks(false);
    }
  };

  // Fetch campaigns from HeroBase for dropdown
  const loadEnreachCampaigns = async (integrationId: string) => {
    setIsLoadingEnreachCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("enreach-manage-webhooks", {
        body: {
          integration_id: integrationId,
          action: "campaigns",
        },
      });

      if (error) throw error;

      // Map campaigns to code/name pairs
      const campaigns = data?.campaigns || [];
      setEnreachCampaigns(campaigns.map((c: { code?: string; name?: string; Code?: string; Name?: string }) => ({
        code: c.code || c.Code || '',
        name: c.name || c.Name || c.code || c.Code || 'Unknown',
      })));
    } catch (err: unknown) {
      console.error("Failed to load campaigns:", err);
      toast.error("Kunne ikke hente kampagner fra HeroBase");
      setEnreachCampaigns([]);
    } finally {
      setIsLoadingEnreachCampaigns(false);
    }
  };

  // Create webhook in Enreach/HeroBase
  const createEnreachWebhook = async () => {
    if (!enreachWebhookIntegrationId) return;
    
    setIsCreatingEnreachWebhook(true);
    try {
      const webhookUrl = getWebhookUrl(enreachWebhookIntegrationId);
      
      const { data, error } = await supabase.functions.invoke("enreach-manage-webhooks", {
        body: {
          integration_id: enreachWebhookIntegrationId,
          action: "create",
          webhook_config: {
            url: webhookUrl,
            description: enreachWebhookDescription || `CPH Sales webhook - ${enreachWebhookIntegrationName}`,
            campaignCode: enreachWebhookCampaignCode,
          },
        },
      });

      if (error) throw error;

      toast.success("Webhook oprettet i HeroBase", {
        description: `Webhook ID: ${data?.webhook?.id || 'Ukendt'}`,
      });
      setEnreachWebhookDialogOpen(false);
      setEnreachWebhookDescription("");
      setEnreachWebhookCampaignCode("");
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved oprettelse af webhook: ${errorMessage}`);
    } finally {
      setIsCreatingEnreachWebhook(false);
    }
  };

  // Delete webhook from Enreach/HeroBase
  const deleteEnreachWebhook = async (webhookId: string) => {
    if (!manageEnreachWebhooksIntegrationId) return;
    
    setIsDeletingEnreachWebhookId(webhookId);
    try {
      const { data, error } = await supabase.functions.invoke("enreach-manage-webhooks", {
        body: {
          integration_id: manageEnreachWebhooksIntegrationId,
          action: "delete",
          webhook_id: webhookId,
        },
      });

      if (error) throw error;

      toast.success("Webhook slettet");
      // Refresh the list
      loadEnreachWebhooks(manageEnreachWebhooksIntegrationId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved sletning af webhook: ${errorMessage}`);
    } finally {
      setIsDeletingEnreachWebhookId(null);
    }
  };

  // Fetch webhook example from HeroBase
  const fetchWebhookExample = async (webhookId: string) => {
    if (!manageEnreachWebhooksIntegrationId) return;
    
    setIsLoadingWebhookExample(true);
    setWebhookExampleId(webhookId);
    try {
      const { data, error } = await supabase.functions.invoke("enreach-manage-webhooks", {
        body: {
          integration_id: manageEnreachWebhooksIntegrationId,
          action: "example",
          webhook_id: webhookId,
        },
      });

      if (error) throw error;

      setWebhookExampleData(data?.example);
      setWebhookExampleMessage(data?.message || null);
      setWebhookExampleDialogOpen(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukendt fejl";
      toast.error(`Fejl ved hentning af eksempel: ${errorMessage}`);
    } finally {
      setIsLoadingWebhookExample(false);
      setWebhookExampleId(null);
    }
  };

  // Open manage Enreach webhooks dialog
  const openManageEnreachWebhooksDialog = (integrationId: string, integrationName: string) => {
    setManageEnreachWebhooksIntegrationId(integrationId);
    setManageEnreachWebhooksIntegrationName(integrationName);
    setManageEnreachWebhooksDialogOpen(true);
    loadEnreachWebhooks(integrationId);
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
              {t("dialerIntegrations.title")}
            </CardTitle>
            <CardDescription>{t("dialerIntegrations.description")}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("dialerIntegrations.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? t("dialerIntegrations.editIntegration") : t("dialerIntegrations.addIntegration")}</DialogTitle>
                  <DialogDescription>
                    {editingId ? t("dialerIntegrations.editDescription") : t("dialerIntegrations.addDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t("dialerIntegrations.name")}</Label>
                    <Input
                      id="name"
                      placeholder={t("dialerIntegrations.namePlaceholder")}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="provider">{t("dialerIntegrations.provider")}</Label>
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
                    <Label htmlFor="api_url">{t("dialerIntegrations.apiUrl")}</Label>
                    <Input
                      id="api_url"
                      placeholder={t("dialerIntegrations.apiUrlPlaceholder")}
                      value={formData.api_url}
                      onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("dialerIntegrations.apiUrlHelp")}
                    </p>
                  </div>
                  {formData.provider === 'enreach' && (
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      {t("dialerIntegrations.orgCodeHelp")}
                    </p>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="username">{t("dialerIntegrations.username")}</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={editingId ? t("dialerIntegrations.unchanged") : ""}
                      required={!editingId}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">{t("dialerIntegrations.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? t("dialerIntegrations.unchanged") : ""}
                      required={!editingId}
                    />
                    {editingId && (
                      <p className="text-xs text-muted-foreground">{t("dialerIntegrations.keepCredentials")}</p>
                    )}
                  </div>
                  
                  {/* Product Extraction Configuration - Only for Enreach */}
                  {formData.provider === 'enreach' && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">{t("dialerIntegrations.productExtraction")}</Label>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="productExtractionStrategy">{t("dialerIntegrations.strategy")}</Label>
                          <Select
                            value={formData.productExtractionStrategy}
                            onValueChange={(value: 'standard_closure' | 'data_keys_regex' | 'specific_fields' | 'conditional') => 
                              setFormData({ ...formData, productExtractionStrategy: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard_closure">{t("dialerIntegrations.strategyStandard")}</SelectItem>
                              <SelectItem value="data_keys_regex">{t("dialerIntegrations.strategyRegex")}</SelectItem>
                              <SelectItem value="specific_fields">{t("dialerIntegrations.strategyFields")}</SelectItem>
                              <SelectItem value="conditional">Conditional Rules</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {formData.productExtractionStrategy === 'data_keys_regex' && (
                          <div className="grid gap-2">
                            <Label htmlFor="productRegexPattern">{t("dialerIntegrations.regexPattern")}</Label>
                            <Input
                              id="productRegexPattern"
                              placeholder="^(.*?)\s*-\s*(\d+(?:[.,]\d+)?)\s*kr\."
                              value={formData.productRegexPattern}
                              onChange={(e) => setFormData({ ...formData, productRegexPattern: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("dialerIntegrations.regexHelp")}
                            </p>
                          </div>
                        )}
                        
                        {formData.productExtractionStrategy === 'specific_fields' && (
                          <div className="grid gap-2">
                            <Label htmlFor="productTargetKeys">{t("dialerIntegrations.targetKeys")}</Label>
                            <Input
                              id="productTargetKeys"
                              placeholder={t("dialerIntegrations.targetKeysPlaceholder")}
                              value={formData.productTargetKeys}
                              onChange={(e) => setFormData({ ...formData, productTargetKeys: e.target.value })}
                            />
                          </div>
                        )}
                        
                        {/* Conditional Rules UI */}
                        {formData.productExtractionStrategy === 'conditional' && (
                          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Extraction Rules</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    conditionalRules: [
                                      ...formData.conditionalRules,
                                      {
                                        conditionKey: "",
                                        conditionValue: "",
                                        extractionType: "specific_fields",
                                        targetKeys: [],
                                      }
                                    ]
                                  });
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" /> Add Rule
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Rules are evaluated in order. All matching rules extract products.
                            </p>
                            
                            {formData.conditionalRules.map((rule, index) => (
                              <div key={index} className="border rounded-md p-3 space-y-2 bg-background">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Rule {index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        conditionalRules: formData.conditionalRules.filter((_, i) => i !== index)
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                
                                {/* Condition */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Condition Key</Label>
                                    <Input
                                      placeholder="e.g., Antal abonnementer"
                                      value={rule.conditionKey}
                                      onChange={(e) => {
                                        const updated = [...formData.conditionalRules];
                                        updated[index] = { ...rule, conditionKey: e.target.value };
                                        setFormData({ ...formData, conditionalRules: updated });
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Condition Value (optional)</Label>
                                    <Input
                                      placeholder="e.g., 1 (leave empty for any)"
                                      value={rule.conditionValue || ""}
                                      onChange={(e) => {
                                        const updated = [...formData.conditionalRules];
                                        updated[index] = { ...rule, conditionValue: e.target.value || undefined };
                                        setFormData({ ...formData, conditionalRules: updated });
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Extraction Type */}
                                <div>
                                  <Label className="text-xs">Extraction Type</Label>
                                  <Select
                                    value={rule.extractionType}
                                    onValueChange={(value: 'specific_fields' | 'regex' | 'static_value' | 'composite') => {
                                      const updated = [...formData.conditionalRules];
                                      updated[index] = { ...rule, extractionType: value };
                                      setFormData({ ...formData, conditionalRules: updated });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="specific_fields">Extract from Fields</SelectItem>
                                      <SelectItem value="regex">Regex Pattern</SelectItem>
                                      <SelectItem value="static_value">Static Product Name</SelectItem>
                                      <SelectItem value="composite">Composite (Template)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Type-specific config */}
                                {rule.extractionType === 'specific_fields' && (
                                  <div>
                                    <Label className="text-xs">Target Keys (comma-separated)</Label>
                                    <Input
                                      placeholder="e.g., Abonnement1, Abonnement2, Abonnement3"
                                      value={rule.targetKeys?.join(", ") || ""}
                                      onChange={(e) => {
                                        const updated = [...formData.conditionalRules];
                                        updated[index] = { 
                                          ...rule, 
                                          targetKeys: e.target.value.split(",").map(k => k.trim()).filter(Boolean) 
                                        };
                                        setFormData({ ...formData, conditionalRules: updated });
                                      }}
                                    />
                                  </div>
                                )}
                                
                                {rule.extractionType === 'regex' && (
                                  <div>
                                    <Label className="text-xs">Regex Pattern</Label>
                                    <Input
                                      placeholder="e.g., ^(.*?)\s*-\s*(\d+)"
                                      value={rule.regexPattern || ""}
                                      onChange={(e) => {
                                        const updated = [...formData.conditionalRules];
                                        updated[index] = { ...rule, regexPattern: e.target.value };
                                        setFormData({ ...formData, conditionalRules: updated });
                                      }}
                                    />
                                  </div>
                                )}
                                
                                {rule.extractionType === 'static_value' && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Product Name</Label>
                                      <Input
                                        placeholder="e.g., 5GI Subscription"
                                        value={rule.staticProductName || ""}
                                        onChange={(e) => {
                                          const updated = [...formData.conditionalRules];
                                          updated[index] = { ...rule, staticProductName: e.target.value };
                                          setFormData({ ...formData, conditionalRules: updated });
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Price (optional)</Label>
                                      <Input
                                        type="number"
                                        placeholder="0"
                                        value={rule.staticProductPrice || ""}
                                        onChange={(e) => {
                                          const updated = [...formData.conditionalRules];
                                          updated[index] = { ...rule, staticProductPrice: parseFloat(e.target.value) || undefined };
                                          setFormData({ ...formData, conditionalRules: updated });
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {rule.extractionType === 'composite' && (
                                  <div>
                                    <Label className="text-xs">Product Name Template</Label>
                                    <Input
                                      placeholder="e.g., {{A-kasse type}} - {{Dækningssum}}"
                                      value={rule.productNameTemplate || ""}
                                      onChange={(e) => {
                                        const updated = [...formData.conditionalRules];
                                        updated[index] = { ...rule, productNameTemplate: e.target.value };
                                        setFormData({ ...formData, conditionalRules: updated });
                                      }}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Use {"{{key}}"} to insert values from data or campaign (e.g. {"{{campaign.code}}"}).
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {formData.conditionalRules.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No rules defined. Click "Add Rule" to create extraction rules.
                              </p>
                            )}
                          </div>
                        )}
                        
                        <div className="grid gap-2">
                          <Label htmlFor="productDefaultName">{t("dialerIntegrations.defaultName")}</Label>
                          <Input
                            id="productDefaultName"
                            placeholder={t("dialerIntegrations.defaultNamePlaceholder")}
                            value={formData.productDefaultName}
                            onChange={(e) => setFormData({ ...formData, productDefaultName: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Fallback product name if no rules match or extraction fails.
                          </p>
                        </div>
                        
                        {/* Advanced Filter Groups Section */}
                        <Separator className="my-4" />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-medium">Filter Groups (AND/OR)</Label>
                              <p className="text-xs text-muted-foreground">
                                Create filter groups with AND/OR logic. Groups are combined with the logic below.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={formData.dataFilterGroupsLogic}
                                onValueChange={(value: 'AND' | 'OR') => {
                                  setFormData({ ...formData, dataFilterGroupsLogic: value });
                                }}
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    dataFilterGroups: [
                                      ...formData.dataFilterGroups,
                                      { logic: 'AND', rules: [{ field: "", operator: "contains", value: "" }] }
                                    ]
                                  });
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" /> Add Group
                              </Button>
                            </div>
                          </div>
                          
                          {formData.dataFilterGroups.map((group, groupIndex) => (
                            <div key={groupIndex} className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">Group {groupIndex + 1}</Badge>
                                  <Select
                                    value={group.logic}
                                    onValueChange={(value: 'AND' | 'OR') => {
                                      const updated = [...formData.dataFilterGroups];
                                      updated[groupIndex] = { ...group, logic: value };
                                      setFormData({ ...formData, dataFilterGroups: updated });
                                    }}
                                  >
                                    <SelectTrigger className="w-20 h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="AND">AND</SelectItem>
                                      <SelectItem value="OR">OR</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <span className="text-xs text-muted-foreground">between rules in this group</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...formData.dataFilterGroups];
                                      updated[groupIndex] = {
                                        ...group,
                                        rules: [...group.rules, { field: "", operator: "contains", value: "" }]
                                      };
                                      setFormData({ ...formData, dataFilterGroups: updated });
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Rule
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        dataFilterGroups: formData.dataFilterGroups.filter((_, i) => i !== groupIndex)
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              
                              {group.rules.map((rule, ruleIndex) => (
                                <div key={ruleIndex} className="border rounded-md p-3 space-y-2 bg-background">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {ruleIndex > 0 && <Badge variant="outline" className="mr-2">{group.logic}</Badge>}
                                      Rule {ruleIndex + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={group.rules.length <= 1}
                                      onClick={() => {
                                        const updatedGroups = [...formData.dataFilterGroups];
                                        updatedGroups[groupIndex] = {
                                          ...group,
                                          rules: group.rules.filter((_, i) => i !== ruleIndex)
                                        };
                                        setFormData({ ...formData, dataFilterGroups: updatedGroups });
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <Label className="text-xs">Field</Label>
                                      <Input
                                        placeholder="e.g., lastModifiedByUser.orgCode"
                                        className="h-8 text-sm"
                                        value={rule.field}
                                        onChange={(e) => {
                                          const updatedGroups = [...formData.dataFilterGroups];
                                          updatedGroups[groupIndex].rules[ruleIndex] = { ...rule, field: e.target.value };
                                          setFormData({ ...formData, dataFilterGroups: updatedGroups });
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Operator</Label>
                                      <Select
                                        value={rule.operator}
                                        onValueChange={(value: DataFilterRule['operator']) => {
                                          const updatedGroups = [...formData.dataFilterGroups];
                                          updatedGroups[groupIndex].rules[ruleIndex] = { ...rule, operator: value };
                                          setFormData({ ...formData, dataFilterGroups: updatedGroups });
                                        }}
                                      >
                                        <SelectTrigger className="h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="equals">Equals</SelectItem>
                                          <SelectItem value="notEquals">Not Equals</SelectItem>
                                          <SelectItem value="contains">Contains</SelectItem>
                                          <SelectItem value="notContains">Not Contains</SelectItem>
                                          <SelectItem value="startsWith">Starts With</SelectItem>
                                          <SelectItem value="endsWith">Ends With</SelectItem>
                                          <SelectItem value="regex">Regex</SelectItem>
                                          <SelectItem value="isEmpty">Is Empty</SelectItem>
                                          <SelectItem value="isNotEmpty">Is Not Empty</SelectItem>
                                          <SelectItem value="notExists">Not Exists</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Value</Label>
                                      <Input
                                        placeholder="e.g., @copenhagensales.dk"
                                        className="h-8 text-sm"
                                        value={rule.value}
                                        onChange={(e) => {
                                          const updatedGroups = [...formData.dataFilterGroups];
                                          updatedGroups[groupIndex].rules[ruleIndex] = { ...rule, value: e.target.value };
                                          setFormData({ ...formData, dataFilterGroups: updatedGroups });
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              {groupIndex < formData.dataFilterGroups.length - 1 && (
                                <div className="flex justify-center py-1">
                                  <Badge variant="default" className="text-xs">{formData.dataFilterGroupsLogic}</Badge>
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {formData.dataFilterGroups.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-md">
                              No filter groups. Click "Add Group" to create combined filters with AND/OR logic.
                            </p>
                          )}
                          
                          {formData.dataFilterGroups.length > 0 && (
                            <div className="p-3 bg-muted/50 rounded-md">
                              <p className="text-xs text-muted-foreground">
                                <strong>Logic:</strong> {formData.dataFilterGroups.map((g, i) => 
                                  `(${g.rules.map((_, ri) => `R${ri + 1}`).join(` ${g.logic} `)})`
                                ).join(` ${formData.dataFilterGroupsLogic} `)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Legacy Simple Filters Section - kept for backward compatibility */}
                        {formData.dataFilters.length > 0 && (
                          <>
                            <Separator className="my-4" />
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">Legacy Filters (AND only)</Label>
                                  <p className="text-xs text-muted-foreground">
                                    These filters use AND logic only. Consider migrating to Filter Groups above.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      dataFilters: [
                                        ...formData.dataFilters,
                                        { field: "", operator: "contains", value: "" }
                                      ]
                                    });
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add Filter
                                </Button>
                              </div>
                              
                              {formData.dataFilters.map((filter, index) => (
                                <div key={index} className="border rounded-md p-3 space-y-2 bg-background opacity-80">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Filter {index + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          dataFilters: formData.dataFilters.filter((_, i) => i !== index)
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <Label className="text-xs">Field (dot notation)</Label>
                                      <Input
                                        placeholder="e.g., lastModifiedByUser.orgCode"
                                        value={filter.field}
                                        onChange={(e) => {
                                          const updated = [...formData.dataFilters];
                                          updated[index] = { ...filter, field: e.target.value };
                                          setFormData({ ...formData, dataFilters: updated });
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Operator</Label>
                                      <Select
                                        value={filter.operator}
                                        onValueChange={(value: DataFilterRule['operator']) => {
                                          const updated = [...formData.dataFilters];
                                          updated[index] = { ...filter, operator: value };
                                          setFormData({ ...formData, dataFilters: updated });
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="equals">Equals</SelectItem>
                                          <SelectItem value="notEquals">Not Equals</SelectItem>
                                          <SelectItem value="contains">Contains</SelectItem>
                                          <SelectItem value="notContains">Not Contains</SelectItem>
                                          <SelectItem value="startsWith">Starts With</SelectItem>
                                          <SelectItem value="endsWith">Ends With</SelectItem>
                                          <SelectItem value="regex">Regex</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Value</Label>
                                      <Input
                                        placeholder="e.g., @copenhagensales.dk"
                                        value={filter.value}
                                        onChange={(e) => {
                                          const updated = [...formData.dataFilters];
                                          updated[index] = { ...filter, value: e.target.value };
                                          setFormData({ ...formData, dataFilters: updated });
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("dialerIntegrations.cancel")}
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {editingId ? t("dialerIntegrations.update") : t("dialerIntegrations.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="integrations">{t("dialerIntegrations.integrationsTab")}</TabsTrigger>
            <TabsTrigger value="calls" className="flex items-center gap-1">
              <PhoneCall className="h-4 w-4" />
              {t("dialerIntegrations.callsTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrations">
            {isLoading ? (
              <div className="text-center py-8">{t("dialerIntegrations.loadingIntegrations")}</div>
            ) : !integrations || integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("dialerIntegrations.noIntegrations")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dialerIntegrations.tableHeaderName")}</TableHead>
                    <TableHead>{t("dialerIntegrations.tableHeaderProvider")}</TableHead>
                    <TableHead>{t("dialerIntegrations.tableHeaderAutoSync")}</TableHead>
                    <TableHead>{t("dialerIntegrations.tableHeaderLastSync")}</TableHead>
                    <TableHead className="text-right">{t("dialerIntegrations.tableHeaderActions")}</TableHead>
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
                                await supabase
                                  .from("dialer_integrations")
                                  .update({ 
                                    sync_frequency_minutes: freq || null,
                                    is_active: freq > 0
                                  })
                                  .eq("id", integration.id);
                                
                                await supabase.functions.invoke("update-cron-schedule", {
                                  body: {
                                    integration_type: "dialer",
                                    integration_id: integration.id,
                                    provider: integration.provider,
                                    frequency_minutes: freq,
                                    is_active: freq > 0,
                                  },
                                });
                                
                                toast.success(freq > 0 ? t("dialerIntegrations.autoSyncSet", { minutes: freq }) : t("dialerIntegrations.autoSyncDisabled"));
                                queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
                              } catch (err) {
                                toast.error(t("dialerIntegrations.syncFrequencyError"));
                              }
                            }}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">{t("dialerIntegrations.disabled")}</SelectItem>
                              <SelectItem value="15">{t("dialerIntegrations.every15min")}</SelectItem>
                              <SelectItem value="30">{t("dialerIntegrations.every30min")}</SelectItem>
                              <SelectItem value="60">{t("dialerIntegrations.everyHour")}</SelectItem>
                              <SelectItem value="120">{t("dialerIntegrations.every2hours")}</SelectItem>
                              <SelectItem value="360">{t("dialerIntegrations.every6hours")}</SelectItem>
                              <SelectItem value="720">{t("dialerIntegrations.every12hours")}</SelectItem>
                              <SelectItem value="1440">{t("dialerIntegrations.daily")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Badge variant={integration.is_active && integration.sync_frequency_minutes ? "default" : "secondary"} className="text-xs">
                            {integration.is_active && integration.sync_frequency_minutes ? t("dialerIntegrations.active") : t("dialerIntegrations.manual")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {integration.last_sync_at ? (
                          <span className="text-sm">{new Date(integration.last_sync_at).toLocaleString("da-DK")}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("dialerIntegrations.never")}</span>
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
                          <BatchMigrationDialog
                            integrationId={integration.id}
                            integrationName={integration.name}
                            provider={integration.provider}
                          />
                          {integration.provider === 'adversus' && (
                            <>
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
                              <Button
                                variant="outline"
                                size="sm"
                                title="Administrer Webhooks"
                                onClick={() => openManageWebhooksDialog(integration.id, integration.name)}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {integration.provider === 'enreach' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Opret Webhook"
                                onClick={() => {
                                  setEnreachWebhookIntegrationId(integration.id);
                                  setEnreachWebhookIntegrationName(integration.name);
                                  setEnreachWebhookDescription("");
                                  setEnreachWebhookCampaignCode("");
                                  setEnreachCampaigns([]);
                                  loadEnreachCampaigns(integration.id);
                                  setEnreachWebhookDialogOpen(true);
                                }}
                              >
                                <Webhook className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Administrer Webhooks"
                                onClick={() => openManageEnreachWebhooksDialog(integration.id, integration.name)}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </>
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
                              const extractionConfig = integration.config?.productExtraction;
                              setFormData({
                                name: integration.name,
                                provider: integration.provider,
                                username: "",
                                password: "",
                                api_url: integration.api_url || "",
                                org_code: "",
                                productExtractionStrategy: extractionConfig?.strategy || "standard_closure",
                                productRegexPattern: extractionConfig?.regexPattern || "",
                                productTargetKeys: extractionConfig?.targetKeys?.join(", ") || "",
                                productDefaultName: extractionConfig?.defaultName || "",
                                productValidationKey: extractionConfig?.validationKey || "",
                                conditionalRules: extractionConfig?.conditionalRules || [],
                                dataFilters: extractionConfig?.dataFilters || [],
                                dataFilterGroups: extractionConfig?.dataFilterGroups || [],
                                dataFilterGroupsLogic: extractionConfig?.dataFilterGroupsLogic || 'AND',
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={fetchingCallsId === integration.id}
                                onClick={() => fetchCallsMutation.mutate({
                                  integrationId: integration.id,
                                  provider: integration.provider,
                                  days: parseInt(callsDays[integration.id]) || 7
                                })}
                              >
                                {fetchingCallsId === integration.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <PhoneCall className="h-4 w-4 mr-2" />
                                )}
                                Hent Calls
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteSalesDialog(integration)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('dialerIntegrations.deleteAllSales')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="calls">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Calls grupperet efter agent. Brug 3-prikker menuen på en integration for at hente calls.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCalls()}
                  disabled={isLoadingCalls}
                >
                  {isLoadingCalls ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opdater"}
                </Button>
              </div>
              
              {isLoadingCalls ? (
                <div className="text-center py-8">Indlæser calls...</div>
              ) : !callsByAgent || Object.keys(callsByAgent).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen calls fundet. Hent calls fra en integration via 3-prikker menuen.
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(callsByAgent).map(([agentKey, { agent, calls }]) => (
                    <div key={agentKey} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-medium">
                            {agent?.name || agentKey}
                          </Badge>
                          {agent?.email && (
                            <span className="text-xs text-muted-foreground">{agent.email}</span>
                          )}
                        </div>
                        <Badge>{calls.length} calls</Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Start</TableHead>
                            <TableHead>Varighed</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Dialer</TableHead>
                            <TableHead>Campaign</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {calls.slice(0, 10).map((call) => (
                            <TableRow key={call.id}>
                              <TableCell className="text-sm">
                                {new Date(call.start_time).toLocaleString("da-DK")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={call.status === 'completed' ? 'default' : 'outline'}>
                                  {call.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{call.dialer_name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {call.campaign_external_id}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {calls.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          ...og {calls.length - 10} flere calls
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

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

        {/* Webhook Management Dialog */}
        <Dialog open={manageWebhooksDialogOpen} onOpenChange={setManageWebhooksDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Webhooks i Adversus - {manageWebhooksIntegrationName}
              </DialogTitle>
              <DialogDescription>
                Se og administrer alle webhooks konfigureret i din Adversus konto.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {isLoadingWebhooks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Indlæser webhooks...</span>
                </div>
              ) : webhooksList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen webhooks fundet i Adversus.
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead className="max-w-[200px]">URL</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooksList.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-mono text-sm">{webhook.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{webhook.event}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="flex items-center gap-1">
                              <span className="truncate text-xs font-mono">{webhook.url}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(webhook.url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteWebhook(webhook.id)}
                              disabled={isDeletingWebhookId === webhook.id}
                            >
                              {isDeletingWebhookId === webhook.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
            
            <DialogFooter className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => manageWebhooksIntegrationId && loadWebhooks(manageWebhooksIntegrationId)}
                disabled={isLoadingWebhooks}
              >
                {isLoadingWebhooks ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Genindlæs
              </Button>
              <Button variant="outline" onClick={() => setManageWebhooksDialogOpen(false)}>
                Luk
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enreach Webhook Creation Dialog */}
        <Dialog open={enreachWebhookDialogOpen} onOpenChange={setEnreachWebhookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Opret Webhook i HeroBase
              </DialogTitle>
              <DialogDescription>
                Opret en webhook i HeroBase for "{enreachWebhookIntegrationName}" der sender events til dit system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Webhook URL (automatisk)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={enreachWebhookIntegrationId ? getWebhookUrl(enreachWebhookIntegrationId) : ""}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => enreachWebhookIntegrationId && copyWebhookUrl(enreachWebhookIntegrationId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Denne URL bruges automatisk - den inkluderer dialer_id parameteren.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Kampagne (påkrævet)</Label>
                {isLoadingEnreachCampaigns ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Henter kampagner...
                  </div>
                ) : enreachCampaigns.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Ingen kampagner fundet. Tjek credentials og prøv igen.
                  </div>
                ) : (
                  <Select value={enreachWebhookCampaignCode} onValueChange={setEnreachWebhookCampaignCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg kampagne" />
                    </SelectTrigger>
                    <SelectContent>
                      {enreachCampaigns
                        .filter((campaign) => campaign.code && campaign.code.trim() !== "")
                        .map((campaign) => (
                          <SelectItem key={campaign.code} value={campaign.code}>
                            {campaign.name} ({campaign.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Beskrivelse (valgfrit)</Label>
                <Input
                  value={enreachWebhookDescription}
                  onChange={(e) => setEnreachWebhookDescription(e.target.value)}
                  placeholder="f.eks. CPH Sales salgswebhook"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEnreachWebhookDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={createEnreachWebhook} disabled={isCreatingEnreachWebhook || !enreachWebhookCampaignCode}>
                {isCreatingEnreachWebhook && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Opret Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enreach Webhook Management Dialog */}
        <Dialog open={manageEnreachWebhooksDialogOpen} onOpenChange={setManageEnreachWebhooksDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Webhooks i HeroBase - {manageEnreachWebhooksIntegrationName}
              </DialogTitle>
              <DialogDescription>
                Se og administrer alle webhooks konfigureret i din HeroBase konto.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {isLoadingEnreachWebhooks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Indlæser webhooks...</span>
                </div>
              ) : enreachWebhooksList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen webhooks fundet i HeroBase.
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Kampagne</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktiv</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enreachWebhooksList.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-medium text-sm">
                            {webhook.name || webhook.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {webhook.campaignCode || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {webhook.leadStatus || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={webhook.isActive ? "default" : "secondary"}>
                              {webhook.isActive ? "Aktiv" : "Inaktiv"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchWebhookExample(webhook.id)}
                              disabled={isLoadingWebhookExample && webhookExampleId === webhook.id}
                              title="Ver ejemplo de payload"
                            >
                              {isLoadingWebhookExample && webhookExampleId === webhook.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteEnreachWebhook(webhook.id)}
                              disabled={isDeletingEnreachWebhookId === webhook.id}
                            >
                              {isDeletingEnreachWebhookId === webhook.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
            
            <DialogFooter className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => manageEnreachWebhooksIntegrationId && loadEnreachWebhooks(manageEnreachWebhooksIntegrationId)}
                disabled={isLoadingEnreachWebhooks}
              >
                {isLoadingEnreachWebhooks ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Genindlæs
              </Button>
              <Button variant="outline" onClick={() => setManageEnreachWebhooksDialogOpen(false)}>
                Luk
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Webhook Example Dialog */}
        <Dialog open={webhookExampleDialogOpen} onOpenChange={setWebhookExampleDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Webhook Payload Eksempel
              </DialogTitle>
              <DialogDescription>
                Dette er et eksempel på de data, som webhook'en vil sende.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {webhookExampleMessage && !webhookExampleData ? (
                <div className="text-center py-8 text-muted-foreground bg-muted rounded-md p-4">
                  <p>{webhookExampleMessage}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                    {webhookExampleData 
                      ? JSON.stringify(webhookExampleData, null, 2) 
                      : "Ingen data"}
                  </pre>
                </ScrollArea>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(webhookExampleData, null, 2));
                  toast.success("Kopieret til udklipsholder");
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Kopier
              </Button>
              <Button variant="outline" onClick={() => setWebhookExampleDialogOpen(false)}>
                Luk
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

      {/* Delete Sales Confirmation Dialog */}
      <AlertDialog open={deleteSalesDialogOpen} onOpenChange={(open) => {
        if (!open && !isDeletingSales) {
          setDeleteSalesDialogOpen(false);
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {deleteSalesStep === 3 ? t('dialerIntegrations.deleteSalesComplete') : t('dialerIntegrations.deleteSalesTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {deleteSalesStep === 1 && (
                  <>
                    <p className="text-destructive font-medium">
                      {t('dialerIntegrations.deleteSalesWarning', { name: deleteSalesIntegration?.name })}
                    </p>
                    <p>
                      {t('dialerIntegrations.deleteSalesCannotUndo')}
                    </p>
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="confirm1"
                          checked={deleteSalesConfirmCheck1}
                          onCheckedChange={(checked) => setDeleteSalesConfirmCheck1(checked === true)}
                        />
                        <label htmlFor="confirm1" className="text-sm leading-tight cursor-pointer">
                          {t('dialerIntegrations.deleteSalesConfirm1')}
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="confirm2"
                          checked={deleteSalesConfirmCheck2}
                          onCheckedChange={(checked) => setDeleteSalesConfirmCheck2(checked === true)}
                        />
                        <label htmlFor="confirm2" className="text-sm leading-tight cursor-pointer">
                          {t('dialerIntegrations.deleteSalesConfirm2')}
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="confirm3"
                          checked={deleteSalesConfirmCheck3}
                          onCheckedChange={(checked) => setDeleteSalesConfirmCheck3(checked === true)}
                        />
                        <label htmlFor="confirm3" className="text-sm leading-tight cursor-pointer">
                          {t('dialerIntegrations.deleteSalesConfirm3')}
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {deleteSalesStep === 2 && (
                  <>
                    <p className="text-destructive font-medium">
                      {t('dialerIntegrations.deleteSalesStep2Title')}
                    </p>
                    <p>
                      {t('dialerIntegrations.deleteSalesStep2Desc', { name: deleteSalesIntegration?.name })}
                    </p>
                    <Input
                      value={deleteSalesConfirmText}
                      onChange={(e) => setDeleteSalesConfirmText(e.target.value)}
                      placeholder={deleteSalesIntegration?.name || ""}
                      className="font-mono"
                    />
                    {deleteSalesConfirmText && deleteSalesConfirmText !== deleteSalesIntegration?.name && (
                      <p className="text-destructive text-xs">
                        {t('dialerIntegrations.deleteSalesTextMismatch', { name: deleteSalesIntegration?.name })}
                      </p>
                    )}
                  </>
                )}

                {deleteSalesStep === 3 && (
                  <>
                    <p className="text-green-600 font-medium">
                      {t('dialerIntegrations.deleteSalesComplete')}!
                    </p>
                    <p>
                      {t('dialerIntegrations.deleteSalesSuccess', { count: deletedSalesCount, name: deleteSalesIntegration?.name })}
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteSalesStep === 1 && (
              <>
                <AlertDialogCancel disabled={isDeletingSales}>{t('dialerIntegrations.cancel')}</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={!deleteSalesConfirmCheck1 || !deleteSalesConfirmCheck2 || !deleteSalesConfirmCheck3}
                  onClick={() => setDeleteSalesStep(2)}
                >
                  {t('dialerIntegrations.continue')}
                </Button>
              </>
            )}

            {deleteSalesStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setDeleteSalesStep(1)} disabled={isDeletingSales}>
                  {t('dialerIntegrations.back')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteSalesConfirmText !== deleteSalesIntegration?.name || isDeletingSales}
                  onClick={executeDeleteSales}
                >
                  {isDeletingSales ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('dialerIntegrations.deleteSalesDeleting')}
                    </>
                  ) : (
                    t('dialerIntegrations.deleteSalesButton')
                  )}
                </Button>
              </>
            )}

            {deleteSalesStep === 3 && (
              <AlertDialogAction onClick={() => setDeleteSalesDialogOpen(false)}>
                {t('dialerIntegrations.close')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
