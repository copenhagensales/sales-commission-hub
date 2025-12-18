import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useVagtEmployees, type VagtEmployee } from "@/hooks/useVagtEmployee";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Search, Plus, Trash2, Upload, ImageIcon, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ClientSalesOverviewContent from "@/pages/ClientSalesOverview";
import { ProductCampaignOverrides } from "@/components/mg-test/ProductCampaignOverrides";

interface InspectorField {
  fieldId: string;
  label: string;
  sampleValue: string;
}

// Type for data returned from the RPC function
interface AggregatedProductRpc {
  adversus_external_id: string | null;
  adversus_product_title: string | null;
  product_id: string | null;
  product_name: string | null;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  product_client_campaign_id: string | null;
  counts_as_sale: boolean;
  client_id: string | null;
  client_name: string | null;
  sale_source: string | null;
}

interface AggregatedProduct {
  key: string;
  adversus_external_id: string | null;
  adversus_product_title: string | null;
  product: {
    id: string;
    name: string;
    commission_dkk: number | null;
    revenue_dkk: number | null;
    client_campaign_id: string | null;
    counts_as_sale: boolean;
  } | null;
  campaignId: string | null;
  campaignLabel: string;
  isManual?: boolean;
  sale_source?: string | null;
}

interface EditEntry {
  provision?: string;
  cpo?: string;
}

type EditValues = Record<string, EditEntry>;

interface ReferenceExtractionConfig {
  type: "field_id" | "json_path" | "regex" | "static";
  value: string;
}

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string | null;
  client_campaign_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reference_extraction_config: ReferenceExtractionConfig | any | null;
  source?: string | null;
}

interface ClientCampaignRow {
  id: string;
  name: string;
  client_id: string;
  clients: {
    id: string;
    name: string | null;
  } | null;
}

interface ClientRow {
  id: string;
  name: string;
  logo_url: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  email: string;
  is_active: boolean | null;
}

interface MasterEmployeeRow {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  phone: string | null;
  is_active: boolean | null;
}

interface EmployeeIdentityRow {
  id: string;
  master_employee_id: string;
  source: string;
  source_employee_id: string;
  source_email: string | null;
  source_name: string | null;
}

interface EmailMatchSuggestion {
  email: string;
  agent: AgentRow;
  vagtEmployee: VagtEmployee;
}

const parseClientFromTitle = (title: string | null, clientList?: ClientRow[]): ClientRow | null => {
  if (!title || !clientList || clientList.length === 0) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;

  const separators = [" - ", " – ", "|"];
  let candidate = trimmed;

  for (const sep of separators) {
    const idx = trimmed.lastIndexOf(sep);
    if (idx !== -1) {
      candidate = trimmed.slice(idx + sep.length).trim();
      break;
    }
  }

  if (!candidate) return null;
  const lowerCandidate = candidate.toLowerCase();

  return (
    clientList.find((client) => client.name && client.name.trim().toLowerCase() === lowerCandidate) || null
  );
};

// Parse client from source (e.g., "Eesy" -> "Eesy TM")
const parseClientFromSource = (source: string | null, clientList?: ClientRow[]): ClientRow | null => {
  if (!source || !clientList || clientList.length === 0) return null;
  const lowerSource = source.toLowerCase().trim();
  
  // Specifik mapping for kendte sources til kunder
  const sourceToClientMap: Record<string, string> = {
    'eesy': 'Eesy TM',
  };
  
  const targetClientName = sourceToClientMap[lowerSource];
  if (targetClientName) {
    return clientList.find((client) => 
      client.name && client.name.toLowerCase() === targetClientName.toLowerCase()
    ) || null;
  }
  
  // Fallback: find client where name contains the source
  return (
    clientList.find((client) => 
      client.name && client.name.toLowerCase().includes(lowerSource)
    ) || null
  );
};

export default function MgTest() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<EditValues>({});
  const [newClientName, setNewClientName] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientName, setEditingClientName] = useState("");
  const [campaignSelections, setCampaignSelections] = useState<Record<string, string | null>>({});
  const [productClientSelections, setProductClientSelections] = useState<Record<string, string | null>>({});
  const [productClientDrafts, setProductClientDrafts] = useState<Record<string, string | null>>({});
  const [openProductGroups, setOpenProductGroups] = useState<Record<string, boolean>>({});
  const [openCampaignGroups, setOpenCampaignGroups] = useState<Record<string, boolean>>({});
  const [campaignFieldIdDrafts, setCampaignFieldIdDrafts] = useState<Record<string, string>>({});
  
  // Performance: limit visible items per section
  const ITEMS_PER_SECTION = 3;
  const [expandedProductSections, setExpandedProductSections] = useState<Record<string, boolean>>({});
  const [productOverridesEnabled, setProductOverridesEnabled] = useState<Record<string, boolean>>({});
  const [expandedCampaignSections, setExpandedCampaignSections] = useState<Record<string, boolean>>({});

  // Field Inspector state
  const [inspectingCampaign, setInspectingCampaign] = useState<CampaignMapping | null>(null);
  const [inspectorFields, setInspectorFields] = useState<InspectorField[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);

  // Retroactive update dialog state
  const [retroactiveDialog, setRetroactiveDialog] = useState<{
    open: boolean;
    campaignId: string;
    campaignName: string;
  } | null>(null);
  const [retroactiveSyncing, setRetroactiveSyncing] = useState(false);

  // Create product dialog state
  const [createProductDialog, setCreateProductDialog] = useState(false);
  const [showCampaignOverrides, setShowCampaignOverrides] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    name: string;
    clientId: string;
    commission: string;
    revenue: string;
    externalCode: string;
    countsAsSale: boolean;
    campaignOverrides: Array<{ campaignId: string; commission: string; revenue: string }>;
  }>({
    name: "",
    clientId: "",
    commission: "0",
    revenue: "0",
    externalCode: "",
    countsAsSale: true,
    campaignOverrides: [],
  });

  // Create campaign dialog state
  const [createCampaignDialog, setCreateCampaignDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    clientId: "",
    externalId: "",
  });

  // Inspector mutation - fetch sample fields from Adversus
  const inspectCampaignMutation = useMutation({
    mutationFn: async (campaign: CampaignMapping) => {
      const response = await supabase.functions.invoke("integration-engine", {
        body: {
          source: "adversus",
          action: "fetch-sample-fields",
          campaignId: campaign.adversus_campaign_id,
          days: 30,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || "Failed to fetch fields");

      return response.data as { fields: InspectorField[]; saleCount: number; sampleSaleId: string };
    },
    onSuccess: (data, campaign) => {
      setInspectorFields(data.fields);
      setInspectorError(null);
      setInspectingCampaign(campaign);
    },
    onError: (error: Error) => {
      setInspectorError(error.message);
      toast.error(`Kunne ikke hente felter: ${error.message}`);
    },
  });

  const handleInspectCampaign = (campaign: CampaignMapping) => {
    setInspectorLoading(true);
    setInspectorError(null);
    setInspectorFields([]);
    inspectCampaignMutation.mutate(campaign, {
      onSettled: () => setInspectorLoading(false),
    });
  };

  const handleSelectField = (fieldId: string) => {
    if (!inspectingCampaign) return;
    
    // Set the draft value for this campaign
    setCampaignFieldIdDrafts((prev) => ({
      ...prev,
      [inspectingCampaign.id]: fieldId,
    }));
    
    // Close dialog and show toast
    setInspectingCampaign(null);
    toast.success(`Field ID "${fieldId}" valgt`);
  };

  // Hent alle kunder (kundenavne)
  const { data: clients, isLoading: loadingClients } = useQuery<ClientRow[]>({
    queryKey: ["mg-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .order("name");

      if (error) throw error;
      return data as ClientRow[];
    },
  });

  // Hent team_clients for at vise hvilke teams der har kunden tildelt
  const { data: teamClientsMap = [] } = useQuery({
    queryKey: ["team-clients-for-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_clients")
        .select("team_id, client_id, teams!inner(id, name)");
      if (error) throw error;
      return data as { team_id: string; client_id: string; teams: { id: string; name: string } }[];
    },
  });

  // Helper to get teams for a client
  const getTeamsForClient = (clientId: string) => {
    return teamClientsMap
      .filter((tc) => tc.client_id === clientId)
      .map((tc) => tc.teams);
  };

  // Hent alle interne kampagner + kunder
  const { data: clientCampaigns, isLoading: loadingClientCampaigns } = useQuery<ClientCampaignRow[]>({
    queryKey: ["mg-client-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id, name, client_id, clients(id, name)")
        .order("name");

      if (error) throw error;
      return data as ClientCampaignRow[];
    },
  });

  // Hent aggregerede produkter via RPC (server-side aggregation)
  const {
    data: aggregatedProductsRpc,
    isLoading: loadingAggregatedProducts,
    isError: isAggregatedProductsError,
  } = useQuery<AggregatedProductRpc[]>({
    queryKey: ["mg-aggregated-products"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_aggregated_product_types");
      if (error) throw error;
      return (data ?? []) as AggregatedProductRpc[];
    },
  });

  // Hent manuelt oprettede produkter direkte fra products tabellen
  const { data: manualProducts } = useQuery({
    queryKey: ["mg-manual-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          commission_dkk,
          revenue_dkk,
          external_product_code,
          counts_as_sale,
          client_campaign_id,
          client_campaigns!inner(
            id,
            name,
            client_id,
            clients(id, name)
          )
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Hent produkt-IDs der er mappet via adversus_product_mappings (disse må IKKE slettes)
  const { data: mappedProductIds } = useQuery({
    queryKey: ["mg-mapped-product-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_product_mappings")
        .select("product_id")
        .not("product_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.product_id as string));
    },
  });

  // Medarbejderkilder og master-profiler
  const { data: agents, isLoading: loadingAgents } = useQuery<AgentRow[]>({
    queryKey: ["mg-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name, email, is_active");
      if (error) throw error;
      return data as AgentRow[];
    },
  });

  const { data: masterEmployees, isLoading: loadingMasterEmployees } = useQuery<MasterEmployeeRow[]>({
    queryKey: ["master-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_employee")
        .select("id, full_name, primary_email, phone, is_active")
        .order("full_name", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return data as MasterEmployeeRow[];
    },
  });

  const { data: employeeIdentities, isLoading: loadingEmployeeIdentities } = useQuery<EmployeeIdentityRow[]>({
    queryKey: ["employee-identities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_identity")
        .select("id, master_employee_id, source, source_employee_id, source_email, source_name");

      if (error) throw error;
      return data as EmployeeIdentityRow[];
    },
  });

  const {
    data: vagtEmployees,
    isLoading: loadingVagtEmployees,
  } = useVagtEmployees();

  // Transform RPC data to AggregatedProduct format (server already did the aggregation)
  // Track product IDs that are linked to sales OR mapped via adversus_product_mappings
  const linkedProductIds = useMemo(() => {
    const ids = new Set<string>();
    // Add products linked to sale_items
    if (aggregatedProductsRpc) {
      aggregatedProductsRpc.forEach((item) => {
        if (item.product_id) {
          ids.add(item.product_id);
        }
      });
    }
    // Add products from adversus_product_mappings
    if (mappedProductIds) {
      mappedProductIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [aggregatedProductsRpc, mappedProductIds]);

  const aggregatedProducts: AggregatedProduct[] = useMemo(() => {
    const products: AggregatedProduct[] = [];
    const seenKeys = new Set<string>();

    // 1. Add products from RPC (sale_items based)
    if (aggregatedProductsRpc) {
      aggregatedProductsRpc.forEach((item) => {
        let clientId = item.client_id;
        let clientName = item.client_name;
        
        if (!clientId && item.adversus_product_title) {
          const parsedClient = parseClientFromTitle(item.adversus_product_title, clients);
          if (parsedClient) {
            clientId = parsedClient.id;
            clientName = parsedClient.name ?? "Ukendt kunde";
          }
        }
        
        if (!clientId && item.sale_source) {
          const parsedClient = parseClientFromSource(item.sale_source, clients);
          if (parsedClient) {
            clientId = parsedClient.id;
            clientName = parsedClient.name ?? "Ukendt kunde";
          }
        }

        const productKey = `${item.adversus_external_id ?? ""}::${item.adversus_product_title ?? ""}`;
        const fullKey = `${clientId ?? "no-client"}::${productKey}`;

        if (!seenKeys.has(fullKey)) {
          seenKeys.add(fullKey);
          products.push({
            key: fullKey,
            adversus_external_id: item.adversus_external_id,
            adversus_product_title: item.adversus_product_title,
            product: item.product_id
              ? {
                  id: item.product_id,
                  name: item.product_name ?? "",
                  commission_dkk: item.commission_dkk,
                  revenue_dkk: item.revenue_dkk,
                  client_campaign_id: item.product_client_campaign_id,
                  counts_as_sale: item.counts_as_sale ?? true,
                }
              : null,
            campaignId: clientId,
            campaignLabel: clientName ?? "Ingen kunde valgt",
            sale_source: item.sale_source,
          });
        }
      });
    }

    // 2. Add manually created products from products table
    // Only mark as deletable (isManual) if the product is NOT linked to any sales
    if (manualProducts) {
      manualProducts.forEach((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const campaign = p.client_campaigns as any;
        const clientId = campaign?.client_id ?? null;
        const clientName = campaign?.clients?.name ?? "Ingen kunde valgt";

        // Use product name as the key identifier for manual products
        const productKey = `manual::${p.id}`;
        const fullKey = `${clientId ?? "no-client"}::${productKey}`;

        // Only add if not already in the list
        if (!seenKeys.has(fullKey)) {
          seenKeys.add(fullKey);
          // Only mark as manual (deletable) if NOT linked to any sales
          const isLinkedToSales = linkedProductIds.has(p.id);
          products.push({
            key: fullKey,
            adversus_external_id: p.external_product_code,
            adversus_product_title: p.name,
            product: {
              id: p.id,
              name: p.name,
              commission_dkk: p.commission_dkk,
              revenue_dkk: p.revenue_dkk,
              client_campaign_id: p.client_campaign_id,
              counts_as_sale: p.counts_as_sale ?? true,
            },
            campaignId: clientId,
            campaignLabel: clientName,
            isManual: !isLinkedToSales, // Only deletable if NOT linked to sales
          });
        }
      });
    }

    return products.sort((a, b) => {
      const campA = a.campaignLabel;
      const campB = b.campaignLabel;
      if (campA !== campB) return campA.localeCompare(campB, "da");
      const titleA = a.adversus_product_title || "";
      const titleB = b.adversus_product_title || "";
      return titleA.localeCompare(titleB, "da");
    });
  }, [aggregatedProductsRpc, manualProducts, clients, linkedProductIds]);

  const productsByCampaign = useMemo(() => {
    const groups = new Map<
      string,
      { campaignId: string | null; campaignLabel: string; rows: AggregatedProduct[] }
    >();

    // Første gruppe: Manglende mapping (ingen kunde valgt)
    groups.set("unmapped", {
      campaignId: "unmapped",
      campaignLabel: "Manglende mapping",
      rows: [],
    });

    // Én gruppe pr. kendt kunde fra "Kundenavne"-fanen
    clients?.forEach((client) => {
      if (!groups.has(client.id)) {
        groups.set(client.id, {
          campaignId: client.id,
          campaignLabel: client.name,
          rows: [],
        });
      }
    });

    // Fordel produkter i grupper
    aggregatedProducts.forEach((row) => {
      const clientId = row.campaignId; // her bruger vi campaignId som kunde-id
      const groupKey = clientId ?? "unmapped";
      const existing = groups.get(groupKey);

      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(groupKey, {
          campaignId: clientId,
          campaignLabel: clientId ? row.campaignLabel : "Manglende mapping",
          rows: [row],
        });
      }
    });

    const result = Array.from(groups.values());

    // Sortér så "Manglende mapping" altid står først, derefter kunder alfabetisk
    return result.sort((a, b) => {
      const aIsUnmapped = a.campaignLabel === "Manglende mapping";
      const bIsUnmapped = b.campaignLabel === "Manglende mapping";

      if (aIsUnmapped && !bIsUnmapped) return -1;
      if (!aIsUnmapped && bIsUnmapped) return 1;

      return a.campaignLabel.localeCompare(b.campaignLabel, "da");
    });
  }, [aggregatedProducts, clients]);

  const emailSuggestions = useMemo<EmailMatchSuggestion[]>(() => {
    if (!agents || !vagtEmployees || !employeeIdentities) return [];

    const mappedAgentIds = new Set(
      employeeIdentities.filter((i) => i.source === "agent").map((i) => i.source_employee_id)
    );
    const mappedVagtIds = new Set(
      employeeIdentities.filter((i) => i.source === "vagt_employee").map((i) => i.source_employee_id)
    );

    const unmappedAgents = agents.filter((agent) => !mappedAgentIds.has(agent.id) && !!agent.email);
    const unmappedVagtEmployees = vagtEmployees.filter(
      (emp) => !mappedVagtIds.has(emp.id) && !!emp.email
    );

    const employeesByEmail = new Map<string, VagtEmployee>();
    unmappedVagtEmployees.forEach((emp) => {
      if (!emp.email) return;
      const key = emp.email.trim().toLowerCase();
      if (!key) return;
      if (!employeesByEmail.has(key)) {
        employeesByEmail.set(key, emp);
      }
    });

    const suggestions: EmailMatchSuggestion[] = [];

    unmappedAgents.forEach((agent) => {
      if (!agent.email) return;
      const key = agent.email.trim().toLowerCase();
      if (!key) return;
      const match = employeesByEmail.get(key);
      if (match) {
        suggestions.push({ email: key, agent, vagtEmployee: match });
      }
    });

    return suggestions.sort((a, b) => a.agent.name.localeCompare(b.agent.name, "da"));
  }, [agents, vagtEmployees, employeeIdentities]);

  const { unmappedAgentsCount, unmappedEmployeesCount } = useMemo(() => {
    if (!agents || !vagtEmployees || !employeeIdentities) {
      return { unmappedAgentsCount: 0, unmappedEmployeesCount: 0 };
    }

    const mappedAgentIds = new Set(
      employeeIdentities.filter((i) => i.source === "agent").map((i) => i.source_employee_id)
    );
    const mappedVagtIds = new Set(
      employeeIdentities.filter((i) => i.source === "vagt_employee").map((i) => i.source_employee_id)
    );

    const unmappedAgentsCount = agents.filter((agent) => !mappedAgentIds.has(agent.id)).length;
    const unmappedEmployeesCount = vagtEmployees.filter((emp) => !mappedVagtIds.has(emp.id)).length;

    return { unmappedAgentsCount, unmappedEmployeesCount };
  }, [agents, vagtEmployees, employeeIdentities]);

  const mergedProfiles = useMemo(
    () => {
      if (!masterEmployees || !employeeIdentities) return [] as { master: MasterEmployeeRow | null; identity: EmployeeIdentityRow }[];

      const mastersById = new Map(masterEmployees.map((m) => [m.id, m] as const));

      return employeeIdentities.map((identity) => ({
        identity,
        master: mastersById.get(identity.master_employee_id) ?? null,
      }));
    },
    [masterEmployees, employeeIdentities]
  );


  const upsertProductValues = useMutation({
    mutationFn: async (params: {
      row: AggregatedProduct;
      provision: number;
      cpo: number;
      clientId?: string | null;
    }) => {
      const { row, provision, cpo, clientId } = params;
      let productId = row.product?.id ?? null;

      let clientCampaignId: string | null = null;

      if (clientId) {
        const { data: campaigns, error: campaignsError } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);

        if (campaignsError) throw campaignsError;

        if (campaigns && campaigns.length > 0) {
          clientCampaignId = campaigns[0].id as string;
        } else {
          const { data: newCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ client_id: clientId, name: "Standard" })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newCampaign.id as string;
        }
      }

      // 1) Opdater eksisterende produkt eller opret et nyt
      // Hvis samme product_id bruges af flere forskellige adversus_product_title, så "splitter" vi og laver et nyt produkt
      // så redigering af ét produkt ikke ændrer de andre.
      if (productId && row.adversus_product_title) {
        const { data: siblingMappings, error: siblingError } = await supabase
          .from("adversus_product_mappings")
          .select("adversus_product_title")
          .eq("product_id", productId);
        if (siblingError) throw siblingError;

        const isShared = !!siblingMappings?.some(
          (m) => (m.adversus_product_title ?? "") !== (row.adversus_product_title ?? "")
        );

        if (isShared) {
          const insertPayload: {
            name: string;
            commission_dkk: number;
            revenue_dkk: number;
            client_campaign_id?: string | null;
          } = {
            name: row.adversus_product_title || "Adversus produkt",
            commission_dkk: provision,
            revenue_dkk: cpo,
          };

          if (clientCampaignId !== null) {
            insertPayload.client_campaign_id = clientCampaignId;
          }

          const { data: newProduct, error: insertError } = await supabase
            .from("products")
            .insert(insertPayload)
            .select("id")
            .single();

          if (insertError) throw insertError;
          productId = newProduct.id as string;
        }
      }

      if (productId) {
        const updatePayload: {
          commission_dkk: number;
          revenue_dkk: number;
          client_campaign_id?: string | null;
        } = {
          commission_dkk: provision,
          revenue_dkk: cpo,
        };

        if (clientCampaignId !== null) {
          updatePayload.client_campaign_id = clientCampaignId;
        }

        const { error } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", productId);

        if (error) throw error;
      } else {
        const insertPayload: {
          name: string;
          commission_dkk: number;
          revenue_dkk: number;
          client_campaign_id?: string | null;
        } = {
          name: row.adversus_product_title || "Adversus produkt",
          commission_dkk: provision,
          revenue_dkk: cpo,
        };

        if (clientCampaignId !== null) {
          insertPayload.client_campaign_id = clientCampaignId;
        }

        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError) throw insertError;
        productId = newProduct.id as string;
      }

      // 2) Opret/opdatér mapping.
      // Hvis adversus_external_id ikke er unik (samme external_id på flere titler), gemmer vi mappingen title-baseret (external_id = null)
      // for at undgå at to forskellige produkter "kobles" sammen.
      if (row.adversus_product_title) {
        const hasExternalId = !!row.adversus_external_id;
        const externalIdHasCollision = !!(
          hasExternalId &&
          aggregatedProductsRpc?.some(
            (p) =>
              p.adversus_external_id === row.adversus_external_id &&
              (p.adversus_product_title ?? "") !== (row.adversus_product_title ?? "")
          )
        );

        const mappingExternalId = hasExternalId && !externalIdHasCollision ? row.adversus_external_id : null;

        const mappingQuery = supabase
          .from("adversus_product_mappings")
          .select("id")
          .eq("adversus_product_title", row.adversus_product_title);

        const { data: existingMapping } = mappingExternalId
          ? await mappingQuery.eq("adversus_external_id", mappingExternalId).maybeSingle()
          : await mappingQuery.is("adversus_external_id", null).maybeSingle();

        if (existingMapping) {
          const { error: updateError } = await supabase
            .from("adversus_product_mappings")
            .update({ product_id: productId })
            .eq("id", existingMapping.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("adversus_product_mappings").insert({
            adversus_external_id: mappingExternalId,
            adversus_product_title: row.adversus_product_title,
            product_id: productId,
          });
          if (insertError) throw insertError;
        }

        if (externalIdHasCollision) {
          toast.message("Bemærk", {
            description:
              "Denne External ID bruges af flere produkter. Mapping gemmes derfor via produktnavn for at holde dem adskilt.",
          });
        }
      }

      // 3) Opdater alle sale_items med samme adversus_product_title så de peger på dette produkt
      if (productId && row.adversus_product_title) {
        const { error: saleItemsError } = await supabase
          .from("sale_items")
          .update({ product_id: productId })
          .eq("adversus_product_title", row.adversus_product_title);

        if (saleItemsError) throw saleItemsError;
      }

      return { productId };
    },
    onSuccess: (_data, variables) => {
      toast.success("Gemt – produktet er nu tilknyttet kunden");
      setProductClientDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.row.key];
        return next;
      });
      setProductClientSelections((prev) => {
        const next = { ...prev };
        if (variables.row.product?.id) {
          delete next[variables.row.product.id];
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["adversus-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme værdier");
    },
  });

  // Mutation to toggle counts_as_sale (creates product if needed)
  const toggleCountsAsSale = useMutation({
    mutationFn: async ({ 
      productId, 
      countsAsSale, 
      row 
    }: { 
      productId: string | null; 
      countsAsSale: boolean; 
      row: AggregatedProduct;
    }) => {
      if (productId) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update({ counts_as_sale: countsAsSale })
          .eq("id", productId);
        if (error) throw error;
      } else {
        // Create new product with counts_as_sale setting
        const productName = row.adversus_product_title || "Ukendt produkt";
        const { data: newProduct, error: createError } = await supabase
          .from("products")
          .insert({
            name: productName,
            commission_dkk: 0,
            revenue_dkk: 0,
            counts_as_sale: countsAsSale,
          })
          .select("id")
          .single();
        
        if (createError) throw createError;
        
        // Create mapping (same collision handling as above)
        if (row.adversus_product_title && newProduct) {
          const hasExternalId = !!row.adversus_external_id;
          const externalIdHasCollision = !!(
            hasExternalId &&
            aggregatedProductsRpc?.some(
              (p) =>
                p.adversus_external_id === row.adversus_external_id &&
                (p.adversus_product_title ?? "") !== (row.adversus_product_title ?? "")
            )
          );

          const mappingExternalId = hasExternalId && !externalIdHasCollision ? row.adversus_external_id : null;

          const mappingQuery = supabase
            .from("adversus_product_mappings")
            .select("id")
            .eq("adversus_product_title", row.adversus_product_title);

          const { data: existingMapping } = mappingExternalId
            ? await mappingQuery.eq("adversus_external_id", mappingExternalId).maybeSingle()
            : await mappingQuery.is("adversus_external_id", null).maybeSingle();

          if (existingMapping) {
            await supabase
              .from("adversus_product_mappings")
              .update({ product_id: newProduct.id })
              .eq("id", existingMapping.id);
          } else {
            await supabase.from("adversus_product_mappings").insert({
              adversus_external_id: mappingExternalId,
              adversus_product_title: row.adversus_product_title,
              product_id: newProduct.id,
            });
          }
        }
        
        // Link sale_items to this product
        if (newProduct && row.adversus_product_title) {
          await supabase
            .from("sale_items")
            .update({ product_id: newProduct.id })
            .eq("adversus_product_title", row.adversus_product_title);
        }
      }
    },
    onSuccess: () => {
      toast.success("Opdateret");
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["adversus-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke opdatere");
    },
  });

  // Mutation to create a manual product
  const createManualProduct = useMutation({
    mutationFn: async (productData: typeof newProduct) => {
      const commission = parseFloat(productData.commission.replace(",", ".")) || 0;
      const revenue = parseFloat(productData.revenue.replace(",", ".")) || 0;

      // Find or create client_campaign for the selected client
      let clientCampaignId: string | null = null;
      if (productData.clientId) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", productData.clientId);

        if (campaigns && campaigns.length > 0) {
          clientCampaignId = campaigns[0].id;
        } else {
          const { data: newCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ client_id: productData.clientId, name: "Standard" })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newCampaign.id;
        }
      }

      const { data: insertedProduct, error } = await supabase.from("products").insert({
        name: productData.name.trim(),
        client_campaign_id: clientCampaignId,
        commission_dkk: commission,
        revenue_dkk: revenue,
        external_product_code: productData.externalCode.trim() || null,
        counts_as_sale: productData.countsAsSale,
      }).select("id").single();

      if (error) throw error;

      // Insert campaign overrides if any
      if (productData.campaignOverrides.length > 0 && insertedProduct) {
        const overridesToInsert = productData.campaignOverrides
          .filter((o) => o.campaignId && (parseFloat(o.commission.replace(",", ".")) > 0 || parseFloat(o.revenue.replace(",", ".")) > 0))
          .map((o) => ({
            product_id: insertedProduct.id,
            campaign_mapping_id: o.campaignId,
            commission_dkk: parseFloat(o.commission.replace(",", ".")) || 0,
            revenue_dkk: parseFloat(o.revenue.replace(",", ".")) || 0,
          }));

        if (overridesToInsert.length > 0) {
          const { error: overrideError } = await supabase
            .from("product_campaign_overrides")
            .insert(overridesToInsert);

          if (overrideError) throw overrideError;
        }
      }
    },
    onSuccess: () => {
      toast.success("Produkt oprettet");
      setCreateProductDialog(false);
      setShowCampaignOverrides(false);
      setNewProduct({
        name: "",
        clientId: "",
        commission: "0",
        revenue: "0",
        externalCode: "",
        countsAsSale: true,
        campaignOverrides: [],
      });
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-campaign-overrides"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke oprette produkt");
    },
  });

  // Mutation to delete a manual product
  const deleteManualProduct = useMutation({
    mutationFn: async (productId: string) => {
      // Delete the product (will cascade delete related mappings if any)
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produkt slettet");
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-manual-products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-mapped-product-ids"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke slette produkt");
    },
  });

  // Create campaign mutation
  const createManualCampaign = useMutation({
    mutationFn: async (campaignData: typeof newCampaign) => {
      if (!campaignData.name.trim()) {
        throw new Error("Kampagnenavn er påkrævet");
      }

      // First create or get client_campaign
      let clientCampaignId: string | null = null;
      
      if (campaignData.clientId) {
        // Check if client already has a campaign we can use or create new one
        const { data: existingCampaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", campaignData.clientId)
          .eq("name", campaignData.name.trim());

        if (existingCampaigns && existingCampaigns.length > 0) {
          clientCampaignId = existingCampaigns[0].id;
        } else {
          const { data: newClientCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ 
              client_id: campaignData.clientId, 
              name: campaignData.name.trim() 
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newClientCampaign.id;
        }
      }

      // Create adversus_campaign_mapping
      const { error } = await supabase.from("adversus_campaign_mappings").insert({
        adversus_campaign_id: campaignData.externalId.trim() || `manual-${Date.now()}`,
        adversus_campaign_name: campaignData.name.trim(),
        client_campaign_id: clientCampaignId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampagne oprettet");
      setCreateCampaignDialog(false);
      setNewCampaign({
        name: "",
        clientId: "",
        externalId: "",
      });
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke oprette kampagne");
    },
  });

  // Delete manual campaign mutation
  const deleteManualCampaign = useMutation({
    mutationFn: async (mappingId: string) => {
      // Get the mapping to find the client_campaign_id
      const { data: mapping, error: fetchError } = await supabase
        .from("adversus_campaign_mappings")
        .select("client_campaign_id")
        .eq("id", mappingId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the adversus_campaign_mapping
      const { error: deleteError } = await supabase
        .from("adversus_campaign_mappings")
        .delete()
        .eq("id", mappingId);

      if (deleteError) throw deleteError;

      // Also delete the related client_campaign if it exists
      if (mapping?.client_campaign_id) {
        await supabase
          .from("client_campaigns")
          .delete()
          .eq("id", mapping.client_campaign_id);
      }
    },
    onSuccess: () => {
      toast.success("Kampagne slettet");
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke slette kampagne");
    },
  });

  // Debounce refs for auto-save
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const triggerAutoSave = useCallback((row: AggregatedProduct, newValues: EditEntry) => {
    const provisionRaw = newValues.provision ?? (row.product?.commission_dkk != null ? String(row.product.commission_dkk) : "0");
    const cpoRaw = newValues.cpo ?? (row.product?.revenue_dkk != null ? String(row.product.revenue_dkk) : "0");

    const provision = parseFloat(provisionRaw.replace(",", ".")) || 0;
    const cpo = parseFloat(cpoRaw.replace(",", ".")) || 0;

    const productId = row.product?.id ?? null;
    const existingClientCampaignId = row.product?.client_campaign_id ?? null;
    const existingClientId =
      existingClientCampaignId
        ? clientCampaigns?.find((c) => c.id === existingClientCampaignId)?.client_id ?? null
        : null;

    const selectionFromProduct =
      productId && productClientSelections[productId] !== undefined
        ? productClientSelections[productId]
        : null;
    const draftClientId = productClientDrafts[row.key] ?? null;
    const selectedClientId = selectionFromProduct ?? draftClientId ?? existingClientId;

    upsertProductValues.mutate({ row, provision, cpo, clientId: selectedClientId ?? null });
  }, [clientCampaigns, productClientSelections, productClientDrafts, upsertProductValues]);

  const handleChange = (key: string, field: keyof EditEntry, value: string, row: AggregatedProduct) => {
    const newValues: EditEntry = {
      provision: field === "provision" ? value : editValues[key]?.provision ?? "",
      cpo: field === "cpo" ? value : editValues[key]?.cpo ?? "",
    };

    setEditValues((prev) => ({
      ...prev,
      [key]: newValues,
    }));

    // Clear existing timer
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Set new debounced save (1 second delay)
    debounceTimers.current[key] = setTimeout(() => {
      triggerAutoSave(row, newValues);
    }, 1000);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Kampagne-mapping (Adversus campaignId -> intern client_campaign)
  const { data: campaignMappings, isLoading: loadingCampaignMappings } = useQuery<CampaignMapping[]>({
    queryKey: ["mg-campaign-mappings"],
    queryFn: async () => {
      // First get all campaign mappings
      const { data: mappings, error } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id, adversus_campaign_name, client_campaign_id, reference_extraction_config")
        .order("adversus_campaign_name", { ascending: true });

      if (error) throw error;

      // Then get distinct source for each campaign from sales
      const { data: sources, error: sourcesError } = await supabase
        .from("sales")
        .select("dialer_campaign_id, source")
        .not("source", "is", null)
        .not("dialer_campaign_id", "is", null);

      if (sourcesError) throw sourcesError;

      // Create a map of campaign_id -> source (use first found source for each campaign)
      const sourceMap = new Map<string, string>();
      sources?.forEach((s) => {
        if (s.dialer_campaign_id && s.source && !sourceMap.has(s.dialer_campaign_id)) {
          sourceMap.set(s.dialer_campaign_id, s.source);
        }
      });

      // Merge source info into campaign mappings
      return (mappings || []).map((m) => ({
        ...m,
        source: sourceMap.get(m.adversus_campaign_id) || null,
      })) as CampaignMapping[];
    },
  });

  const campaignsByClient = useMemo(() => {
    const groups = new Map<
      string,
      { clientId: string | null; clientLabel: string; rows: CampaignMapping[] }
    >();

    // Første gruppe: Manglende mapping (ingen kunde valgt)
    groups.set("unmapped", {
      clientId: null,
      clientLabel: "Manglende mapping",
      rows: [],
    });

    // Én gruppe pr. kendt kunde fra "Kundenavne"-fanen
    clients?.forEach((client) => {
      if (!groups.has(client.id)) {
        groups.set(client.id, {
          clientId: client.id,
          clientLabel: client.name,
          rows: [],
        });
      }
    });

    // Fordel kampagner i grupper efter gemt kunde-tilknytning eller udledt kundenavn
    campaignMappings?.forEach((mapping) => {
      const existingClientId =
        clientCampaigns?.find((c) => c.id === mapping.client_campaign_id)?.client_id ?? null;

      let clientId = existingClientId;

      // Hvis der ikke er gemt kunde, forsøg at udlede kunden fra kampagnenavnet
      if (!clientId) {
        const parsedClient = parseClientFromTitle(mapping.adversus_campaign_name, clients);
        if (parsedClient) {
          clientId = parsedClient.id;
        }
      }

      const groupKey = clientId ?? "unmapped";
      const existing = groups.get(groupKey);

      if (existing) {
        existing.rows.push(mapping);
      } else {
        groups.set(groupKey, {
          clientId,
          clientLabel: clientId
            ? clients?.find((c) => c.id === clientId)?.name ?? "Ukendt kunde"
            : "Manglende mapping",
          rows: [mapping],
        });
      }
    });

    const result = Array.from(groups.values());

    // Sortér så "Manglende mapping" altid står først, derefter kunder alfabetisk
    return result.sort((a, b) => {
      const aIsUnmapped = a.clientLabel === "Manglende mapping";
      const bIsUnmapped = b.clientLabel === "Manglende mapping";

      if (aIsUnmapped && !bIsUnmapped) return -1;
      if (!aIsUnmapped && bIsUnmapped) return 1;

      return a.clientLabel.localeCompare(b.clientLabel, "da");
    });
  }, [campaignMappings, clientCampaigns, clients]);

  const updateCampaignMapping = useMutation({
    mutationFn: async ({ mappingId, clientId, fieldId, adversusCampaignId, adversusCampaignName }: { 
      mappingId: string; 
      clientId: string | null; 
      fieldId?: string;
      adversusCampaignId?: string;
      adversusCampaignName?: string;
    }) => {
      let clientCampaignId: string | null = null;

      if (clientId) {
        // Find eksisterende kampagne for kunden eller opret en standard-kampagne
        const { data: campaigns, error: campaignsError } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);

        if (campaignsError) throw campaignsError;

        if (campaigns && campaigns.length > 0) {
          clientCampaignId = campaigns[0].id as string;
        } else {
          const { data: newCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ client_id: clientId, name: "Standard" })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newCampaign.id as string;
        }
      }

      // Build reference_extraction_config as JSONB
      const referenceConfig = fieldId && fieldId.trim() 
        ? { type: "field_id" as const, value: fieldId.trim() }
        : null;

      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .update({ 
          client_campaign_id: clientCampaignId,
          reference_extraction_config: referenceConfig 
        })
        .eq("id", mappingId)
        .select("id, client_campaign_id, reference_extraction_config")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Kunne ikke gemme kampagnemapping (mangler rettigheder?)");
      }

      // Return info needed for retroactive dialog
      return { fieldId, adversusCampaignId, adversusCampaignName };
    },
    onSuccess: (result, variables) => {
      toast.success("Kampagnemapping gemt");
      setCampaignSelections((prev) => {
        const next = { ...prev };
        delete next[variables.mappingId];
        return next;
      });
      setCampaignFieldIdDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.mappingId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });

      // If a field ID was saved, prompt for retroactive update
      if (result?.fieldId && result.fieldId.trim() && result.adversusCampaignId) {
        setRetroactiveDialog({
          open: true,
          campaignId: result.adversusCampaignId,
          campaignName: result.adversusCampaignName || result.adversusCampaignId,
        });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme kampagnemapping");
    },
  });

  // Retroactive sync mutation
  const retroactiveSyncMutation = useMutation({
    mutationFn: async ({ campaignId, days }: { campaignId: string; days: number }) => {
      const response = await supabase.functions.invoke("integration-engine", {
        body: {
          source: "adversus",
          action: "sync",
          campaignId,
          days,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || "Sync failed");

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Retroaktiv opdatering gennemført: ${data.created || 0} oprettet, ${data.updated || 0} opdateret`);
      setRetroactiveDialog(null);
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
    },
    onError: (error: Error) => {
      toast.error(`Fejl under retroaktiv opdatering: ${error.message}`);
    },
  });

  const handleRetroactiveSync = async (sync: boolean) => {
    if (!retroactiveDialog) return;
    
    if (sync) {
      setRetroactiveSyncing(true);
      retroactiveSyncMutation.mutate(
        { campaignId: retroactiveDialog.campaignId, days: 30 },
        { onSettled: () => setRetroactiveSyncing(false) }
      );
    } else {
      setRetroactiveDialog(null);
    }
  };

  const autoAssignCampaigns = useMutation({
    mutationFn: async () => {
      if (!campaignMappings || !clients) return { updated: 0 };

      const updates: { mappingId: string; clientId: string }[] = [];

      for (const mapping of campaignMappings) {
        const existingClientId =
          clientCampaigns?.find((c) => c.id === mapping.client_campaign_id)?.client_id ?? null;

        if (existingClientId) continue;

        const parsedClient = parseClientFromTitle(mapping.adversus_campaign_name, clients);
        if (parsedClient) {
          updates.push({ mappingId: mapping.id, clientId: parsedClient.id });
        }
      }

      for (const { mappingId, clientId } of updates) {
        let clientCampaignId: string | null = null;

        const { data: campaigns, error: campaignsError } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);

        if (campaignsError) throw campaignsError;

        if (campaigns && campaigns.length > 0) {
          clientCampaignId = campaigns[0].id as string;
        } else {
          const { data: newCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ client_id: clientId, name: "Standard" })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newCampaign.id as string;
        }

        const { error } = await supabase
          .from("adversus_campaign_mappings")
          .update({ client_campaign_id: clientCampaignId })
          .eq("id", mappingId);

        if (error) throw error;
      }

      return { updated: updates.length };
    },
    onSuccess: ({ updated }) => {
      if (updated === 0) {
        toast.success("Ingen kampagner kunne fordeles automatisk ud fra kundenavn.");
      } else {
        toast.success(`Fordelte ${updated} kampagner automatisk ud fra kundenavn.`);
      }
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke auto-fordele kampagner");
    },
  });

  const backfillSalesCampaigns = useMutation({
    mutationFn: async () => {
      // 1) Hent alle kampagnemappings med tilknyttet intern kampagne
      const { data: mappings, error: mappingsError } = await supabase
        .from("adversus_campaign_mappings")
        .select("adversus_campaign_id, client_campaign_id")
        .not("client_campaign_id", "is", null);

      if (mappingsError) throw mappingsError;

      const mappingByCampaignId = new Map<string, string>();
      (mappings || []).forEach((m: any) => {
        if (m.client_campaign_id) {
          mappingByCampaignId.set(m.adversus_campaign_id, m.client_campaign_id as string);
        }
      });

      if (mappingByCampaignId.size === 0) {
        return { updated: 0 };
      }

      // 2) Hent alle salg uden kampagne, men med adversus_event_id
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, adversus_event_id, client_campaign_id, adversus_events(payload)")
        .is("client_campaign_id", null)
        .not("adversus_event_id", "is", null)
        .limit(500);

      if (salesError) throw salesError;
      if (!sales || sales.length === 0) {
        return { updated: 0 };
      }

      let updated = 0;

      for (const sale of sales as any[]) {
        const event = sale.adversus_events as any;
        const adversusPayload = event?.payload as any;
        const adversusCampaignId = adversusPayload?.payload?.campaign?.id as string | undefined;

        if (!adversusCampaignId) continue;

        const clientCampaignId = mappingByCampaignId.get(adversusCampaignId);
        if (!clientCampaignId) continue;

        const { error: updateError } = await supabase
          .from("sales")
          .update({ client_campaign_id: clientCampaignId })
          .eq("id", sale.id);

        if (updateError) throw updateError;
        updated += 1;
      }

      return { updated };
    },
    onSuccess: ({ updated }) => {
      if (updated === 0) {
        toast.success("Ingen salg skulle opdateres. Alt ser allerede rigtigt ud.");
      } else {
        toast.success(`Opdaterede ${updated} salg med korrekt kunde/kampagne.`);
      }
      queryClient.invalidateQueries({ queryKey: ["sales-list"] });
      queryClient.invalidateQueries({ queryKey: ["codan-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tdc-erhverv-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke backfille salg til kampagner");
    },
  });

  const updateProductClient = useMutation({
    mutationFn: async ({ productId, clientId }: { productId: string; clientId: string | null }) => {
      let clientCampaignId: string | null = null;

      if (clientId) {
        const { data: campaigns, error: campaignsError } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);

        if (campaignsError) throw campaignsError;

        if (campaigns && campaigns.length > 0) {
          clientCampaignId = campaigns[0].id as string;
        } else {
          const { data: newCampaign, error: insertError } = await supabase
            .from("client_campaigns")
            .insert({ client_id: clientId, name: "Standard" })
            .select("id")
            .single();

          if (insertError) throw insertError;
          clientCampaignId = newCampaign.id as string;
        }
      }

      const { error } = await supabase
        .from("products")
        .update({ client_campaign_id: clientCampaignId })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Kunde tilknyttet produkt");
      setProductClientSelections((prev) => {
        const next = { ...prev };
        delete next[variables.productId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme kunde på produkt");
    },
  });

  const mergeEmployeeSuggestion = useMutation({
    mutationFn: async ({ agent, vagtEmployee }: { agent: AgentRow; vagtEmployee: VagtEmployee }) => {
      const email = (agent.email || vagtEmployee.email || "").trim() || null;
      const displayName = agent.name || vagtEmployee.full_name;
      const phone = vagtEmployee.phone ?? null;
      const isActive = agent.is_active ?? vagtEmployee.is_active ?? true;

      let masterId: string | null = null;

      if (email) {
        const { data: existing, error: existingError } = await supabase
          .from("master_employee")
          .select("id")
          .eq("primary_email", email)
          .limit(1);

        if (existingError) throw existingError;

        if (existing && existing.length > 0) {
          masterId = (existing[0] as any).id as string;
        }
      }

      if (!masterId) {
        const { data: newMaster, error: insertError } = await supabase
          .from("master_employee")
          .insert({
            full_name: displayName,
            primary_email: email,
            phone,
            is_active: isActive,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        masterId = (newMaster as any).id as string;
      }

      const { error: identityError } = await supabase.from("employee_identity").upsert(
        [
          {
            master_employee_id: masterId,
            source: "agent",
            source_employee_id: agent.id,
            source_email: agent.email,
            source_name: agent.name,
          },
          {
            master_employee_id: masterId,
            source: "vagt_employee",
            source_employee_id: vagtEmployee.id,
            source_email: vagtEmployee.email,
            source_name: vagtEmployee.full_name,
          },
        ],
        { onConflict: "source,source_employee_id" }
      );

      if (identityError) throw identityError;

      // Opdatér eksisterende tabeller forsigtigt, hvis der mangler e-mail
      if (!vagtEmployee.email && agent.email) {
        try {
          await supabase.from("employee").update({ email: agent.email }).eq("id", vagtEmployee.id);
        } catch {
          // Ignorer fejl - mappingen er stadig oprettet
        }
      }

      if (!agent.email && vagtEmployee.email) {
        try {
          await supabase.from("agents").update({ email: vagtEmployee.email }).eq("id", agent.id);
        } catch {
          // Ignorer fejl
        }
      }

      return { masterId };
    },
    onSuccess: () => {
      toast.success("Medarbejdere er nu merged til én master-profil");
      queryClient.invalidateQueries({ queryKey: ["mg-agents"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-employees"] });
      queryClient.invalidateQueries({ queryKey: ["master-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-identities"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke merge medarbejdere");
    },
  });

  // Kunder: tilføj, opdater og slet
  const deleteIdentityMapping = useMutation({
    mutationFn: async ({ identityId, masterId }: { identityId: string; masterId: string }) => {
      const { error } = await supabase.from("employee_identity").delete().eq("id", identityId);
      if (error) throw error;

      const { data: remaining, error: remainingError } = await supabase
        .from("employee_identity")
        .select("id")
        .eq("master_employee_id", masterId)
        .limit(1);

      if (remainingError) throw remainingError;

      if (!remaining || remaining.length === 0) {
        await supabase.from("master_employee").delete().eq("id", masterId);
      }
    },
    onSuccess: () => {
      toast.success("Mapping er fjernet");
      queryClient.invalidateQueries({ queryKey: ["master-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-identities"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke fjerne mapping");
    },
  });

  // Kunder: tilføj, opdater og slet
  const addClientMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Kundenavn må ikke være tomt");

      const { error } = await supabase.from("clients").insert({ name: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kunde tilføjet");
      setNewClientName("");
      queryClient.invalidateQueries({ queryKey: ["mg-clients"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke tilføje kunde");
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, name, logo_url }: { id: string; name: string; logo_url?: string | null }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Kundenavn må ikke være tomt");

      const updateData: { name: string; logo_url?: string | null } = { name: trimmed };
      if (logo_url !== undefined) {
        updateData.logo_url = logo_url;
      }

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kunde opdateret");
      setEditingClientId(null);
      setEditingClientName("");
      queryClient.invalidateQueries({ queryKey: ["mg-clients"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke opdatere kunde");
    },
  });

  // Upload client logo
  const uploadClientLogo = async (clientId: string, file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Kunne ikke uploade logo");
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kunde slettet");
      queryClient.invalidateQueries({ queryKey: ["mg-clients"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke slette kunde (tjek om kunden bruges i kampagner)");
    },
  });

  const isLoadingProductsTab = loadingAggregatedProducts || loadingClientCampaigns || loadingClients;
  const isLoadingCampaignTab = loadingCampaignMappings || loadingClientCampaigns;
  const isLoadingCustomersTab = loadingClients;
  const isLoadingEmployeeTab =
    loadingAgents || loadingMasterEmployees || loadingEmployeeIdentities || loadingVagtEmployees;

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("mgTest.title")}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            {t("mgTest.description")}
          </p>
        </header>

        <Tabs defaultValue="product" className="space-y-4">
          <TabsList>
            <TabsTrigger value="product">{t("mgTest.tabProduct")}</TabsTrigger>
            <TabsTrigger value="customer">{t("mgTest.tabCampaign")}</TabsTrigger>
            <TabsTrigger value="employee-mapping">{t("mgTest.tabEmployee")}</TabsTrigger>
            <TabsTrigger value="customers">{t("mgTest.tabCustomers")}</TabsTrigger>
            <TabsTrigger value="client-sales">Client Sales</TabsTrigger>
          </TabsList>

          {/* Mapping produkt */}
          <TabsContent value="product" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreateProductDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Opret produkt
              </Button>
            </div>
            {isLoadingProductsTab ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t("mgTest.loadingProducts")}</span>
                </CardContent>
              </Card>
            ) : isAggregatedProductsError ? (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-destructive">
                    {t("mgTest.productFetchError")}
                  </p>
                </CardContent>
              </Card>
            ) : productsByCampaign.length === 0 ? (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-destructive">
                    {t("mgTest.productFetchError")}
                  </p>
                </CardContent>
              </Card>
            ) : productsByCampaign.length === 0 ? (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground">
                    {t("mgTest.noProducts")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              productsByCampaign.map((group) => {
                const groupKey = group.campaignId ?? "unmapped";
                const isOpen = openProductGroups[groupKey] ?? true;

                return (
                  <Card key={groupKey} className="border-muted animate-fade-in">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold">{group.campaignLabel}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {group.campaignLabel === t("mgTest.missingMapping")
                            ? t("mgTest.missingMappingDesc")
                            : t("mgTest.productsForCustomer", { count: group.rows.length })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {group.rows.length} {group.rows.length === 1 ? t("mgTest.product") : t("mgTest.products")}
                        </Badge>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="hover-scale"
                          onClick={() =>
                            setOpenProductGroups((prev) => ({
                              ...prev,
                              [groupKey]: !isOpen,
                            }))
                          }
                          aria-label={isOpen ? t("mgTest.collapseGroup") : t("mgTest.expandGroup")}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isOpen ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </Button>
                      </div>
                    </CardHeader>
                    {isOpen && (
                      <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[22%]">{t("mgTest.adversusProductName")}</TableHead>
                                <TableHead className="w-[10%]">{t("mgTest.externalId")}</TableHead>
                                <TableHead className="w-[16%]">{t("mgTest.customer")}</TableHead>
                                <TableHead className="w-[10%]">{t("mgTest.commission")}</TableHead>
                                <TableHead className="w-[10%]">{t("mgTest.cpoRevenue")}</TableHead>
                                <TableHead className="w-[12%] text-center">{t("mgTest.countAsSale")}</TableHead>
                                <TableHead className="w-[12%] text-center">Kamp. provi</TableHead>
                                <TableHead className="w-[8%] text-center"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(expandedProductSections[groupKey] ? group.rows : group.rows.slice(0, ITEMS_PER_SECTION)).map((row) => {
                                const current = editValues[row.key];
                                const productId = row.product?.id ?? null;
                                // Use campaignId which contains client_id from aggregated data
                                const existingClientId = row.campaignId === "unmapped" ? null : row.campaignId;
                                const selectionFromProduct =
                                  productId && productClientSelections[productId] !== undefined
                                    ? productClientSelections[productId]
                                    : null;
                                const draftClientId = productClientDrafts[row.key] ?? null;
                                const parsedClient =
                                  !existingClientId && !selectionFromProduct && !draftClientId
                                    ? parseClientFromTitle(row.adversus_product_title, clients)
                                    : null;
                                const selectedClientId =
                                  selectionFromProduct ??
                                  draftClientId ??
                                  existingClientId ??
                                  (parsedClient ? parsedClient.id : null);

                                return (
                                  <>
                                    <TableRow key={row.key}>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {row.adversus_product_title || t("mgTest.noTitle")}
                                          </span>
                                          {row.product && (
                                            <span className="text-xs text-muted-foreground">
                                              {t("mgTest.internalProduct")}: {row.product.name}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-xs font-mono text-muted-foreground">
                                          {row.adversus_external_id || t("mgTest.missing")}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col gap-2 max-w-xs">
                                          <Select
                                            value={selectedClientId ?? undefined}
                                            onValueChange={(value) => {
                                              const newClientId = value === "unmapped" ? null : value;

                                              if (productId) {
                                                setProductClientSelections((prev) => ({
                                                  ...prev,
                                                  [productId]: newClientId,
                                                }));
                                              }

                                              setProductClientDrafts((prev) => ({
                                                ...prev,
                                                [row.key]: newClientId,
                                              }));

                                              if (productId && newClientId !== selectedClientId) {
                                                updateProductClient.mutate({
                                                  productId,
                                                  clientId: newClientId,
                                                });
                                              }
                                              
                                              // Auto-confirm new products with 0/0 when client is selected
                                              if (!productId && newClientId && newClientId !== "unmapped") {
                                                upsertProductValues.mutate({
                                                  row,
                                                  provision: 0,
                                                  cpo: 0,
                                                  clientId: newClientId,
                                                });
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder={t("mgTest.selectCustomer")} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border z-50 max-h-72">
                                              <SelectItem value="unmapped" className="text-sm text-muted-foreground">
                                                {t("mgTest.missingMapping")}
                                              </SelectItem>
                                              {clients?.map((client) => (
                                                <SelectItem key={client.id} value={client.id} className="text-sm">
                                                  {client.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          className="h-9"
                                          value={
                                            current?.provision ??
                                            (row.product?.commission_dkk !== null &&
                                            row.product?.commission_dkk !== undefined
                                              ? String(row.product.commission_dkk)
                                              : "0")
                                          }
                                          onChange={(e) => handleChange(row.key, "provision", e.target.value, row)}
                                          placeholder="0,00"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          className="h-9"
                                          value={
                                            current?.cpo ??
                                            (row.product?.revenue_dkk !== null &&
                                            row.product?.revenue_dkk !== undefined
                                              ? String(row.product.revenue_dkk)
                                              : "0")
                                          }
                                          onChange={(e) => handleChange(row.key, "cpo", e.target.value, row)}
                                          placeholder="0,00"
                                        />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Checkbox
                                          checked={row.product?.counts_as_sale ?? true}
                                          onCheckedChange={(checked) => {
                                            toggleCountsAsSale.mutate({
                                              productId: row.product?.id ?? null,
                                              countsAsSale: checked === true,
                                              row,
                                            });
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {row.product?.id && (
                                          <Checkbox
                                            checked={productOverridesEnabled[row.product.id] ?? false}
                                            onCheckedChange={(checked) => {
                                              setProductOverridesEnabled(prev => ({
                                                ...prev,
                                                [row.product!.id]: checked === true,
                                              }));
                                            }}
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {row.isManual && row.product?.id && !row.sale_source && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                              if (confirm("Er du sikker på at du vil slette dette produkt?")) {
                                                deleteManualProduct.mutate(row.product!.id);
                                              }
                                            }}
                                            disabled={deleteManualProduct.isPending}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                    {row.product?.id && productOverridesEnabled[row.product.id] && (
                                      <TableRow key={`${row.key}-overrides`} className="hover:bg-transparent">
                                        <TableCell colSpan={8} className="pt-0 pb-2">
                                          <ProductCampaignOverrides
                                            productId={row.product.id}
                                            productName={row.product.name || row.adversus_product_title || "Produkt"}
                                            baseCommission={row.product.commission_dkk ?? 0}
                                            baseRevenue={row.product.revenue_dkk ?? 0}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {group.rows.length > ITEMS_PER_SECTION && !expandedProductSections[groupKey] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setExpandedProductSections(prev => ({ ...prev, [groupKey]: true }))}
                          >
                            {t("mgTest.showMore", { count: group.rows.length - ITEMS_PER_SECTION })}
                          </Button>
                        )}
                        {expandedProductSections[groupKey] && group.rows.length > ITEMS_PER_SECTION && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setExpandedProductSections(prev => ({ ...prev, [groupKey]: false }))}
                          >
                            {t("mgTest.showLess")}
                          </Button>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Mapping kunde / kampagne */}
          <TabsContent value="customer">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{t("mgTest.campaignMappingTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("mgTest.campaignMappingDesc")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover-scale"
                    onClick={() => autoAssignCampaigns.mutate()}
                    disabled={autoAssignCampaigns.isPending || !campaignMappings || campaignMappings.length === 0}
                  >
                    {autoAssignCampaigns.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {t("mgTest.autoAssignCampaigns")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover-scale"
                    onClick={() => backfillSalesCampaigns.mutate()}
                    disabled={backfillSalesCampaigns.isPending}
                  >
                    {backfillSalesCampaigns.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {t("mgTest.backfillSales")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setCreateCampaignDialog(true)}
                    className="hover-scale"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Opret kampagne
                  </Button>
                  <Badge variant="outline">{campaignMappings?.length ?? 0} {t("mgTest.campaigns")}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCampaignTab ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t("mgTest.loadingCampaigns")}</span>
                  </div>
                ) : !campaignMappings || campaignMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("mgTest.noCampaigns")}
                  </p>
                ) : (
                  campaignsByClient.map((group) => {
                    const groupKey = group.clientId ?? "unmapped";
                    const isOpen = openCampaignGroups[groupKey] ?? true;

                    return (
                      <div key={groupKey} className="border-b last:border-b-0 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold">{group.clientLabel}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {group.clientLabel === t("mgTest.missingMapping")
                                ? t("mgTest.campaignMissingDesc")
                                : t("mgTest.campaignsForCustomer", { count: group.rows.length })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {group.rows.length} {group.rows.length === 1 ? t("mgTest.campaign") : t("mgTest.campaigns")}
                            </Badge>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="hover-scale"
                              onClick={() =>
                                setOpenCampaignGroups((prev) => ({
                                  ...prev,
                                  [groupKey]: !isOpen,
                                }))
                              }
                              aria-label={isOpen ? t("mgTest.collapseGroup") : t("mgTest.expandGroup")}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isOpen ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                            </Button>
                          </div>
                        </div>

                        {isOpen && (
                          <>
                          <div className="rounded-md border overflow-x-auto mt-4">
                            <Table>
                              <TableHeader>
                              <TableRow>
                                  <TableHead className="w-[18%]">{t("mgTest.adversusCampaignName")}</TableHead>
                                  <TableHead className="w-[10%]">{t("mgTest.campaignId")}</TableHead>
                                  <TableHead className="w-[8%]">API</TableHead>
                                  <TableHead className="w-[6%]">{t("mgTest.inspect")}</TableHead>
                                  <TableHead className="w-[20%]">{t("mgTest.internalCampaign")}</TableHead>
                                  <TableHead className="w-[15%]">{t("mgTest.oppFieldId")}</TableHead>
                                  <TableHead className="w-[10%]">{t("mgTest.save")}</TableHead>
                                  <TableHead className="w-[8%]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(expandedCampaignSections[groupKey] ? group.rows : group.rows.slice(0, ITEMS_PER_SECTION)).map((mapping) => {
                                  const existingClientId =
                                    clientCampaigns?.find((c) => c.id === mapping.client_campaign_id)?.client_id ??
                                    null;
                                  const selectionFromState =
                                    campaignSelections[mapping.id] !== undefined
                                      ? campaignSelections[mapping.id]
                                      : null;
                                  const parsedClient =
                                    !existingClientId && !selectionFromState
                                      ? parseClientFromTitle(mapping.adversus_campaign_name, clients)
                                      : null;
                                  const selectedClientId =
                                    selectionFromState ?? existingClientId ?? (parsedClient ? parsedClient.id : null);

                                  // Get field ID from draft or existing config
                                  const existingFieldId = mapping.reference_extraction_config?.value ?? "";
                                  const draftFieldId = campaignFieldIdDrafts[mapping.id];
                                  const currentFieldId = draftFieldId !== undefined ? draftFieldId : existingFieldId;
                                  
                                  // Check if anything changed
                                  const hasClientChange = selectedClientId !== existingClientId;
                                  const hasFieldIdChange = draftFieldId !== undefined && draftFieldId !== existingFieldId;
                                  const hasChanges = hasClientChange || hasFieldIdChange;

                                  // Check if this is a manually created campaign
                                  const isManualCampaign = mapping.adversus_campaign_id?.startsWith("manual-");

                                  return (
                                    <TableRow key={mapping.id}>
                                      <TableCell>
                                        <span className="font-medium">
                                          {mapping.adversus_campaign_name || t("mgTest.noName")}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-xs font-mono text-muted-foreground">
                                          {mapping.adversus_campaign_id}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {mapping.source ? (
                                          <Badge variant="outline" className="text-xs">
                                            {mapping.source}
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleInspectCampaign(mapping)}
                                          disabled={inspectorLoading && inspectingCampaign?.id === mapping.id}
                                        >
                                          {inspectorLoading && inspectingCampaign?.id === mapping.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Search className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={selectedClientId ?? undefined}
                                          onValueChange={(value) =>
                                            setCampaignSelections((prev) => ({
                                              ...prev,
                                              [mapping.id]: value,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("mgTest.selectCustomer")} />
                                          </SelectTrigger>
                                          <SelectContent className="bg-background border z-50 max-h-72">
                                            {clients?.map((client) => (
                                              <SelectItem key={client.id} value={client.id} className="text-sm">
                                                {client.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="text"
                                          className="h-9 font-mono text-xs"
                                          placeholder={t("mgTest.fieldIdPlaceholder")}
                                          value={currentFieldId}
                                          onChange={(e) =>
                                            setCampaignFieldIdDrafts((prev) => ({
                                              ...prev,
                                              [mapping.id]: e.target.value,
                                            }))
                                          }
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            updateCampaignMapping.mutate({
                                              mappingId: mapping.id,
                                              clientId: selectedClientId,
                                              fieldId: currentFieldId,
                                              adversusCampaignId: mapping.adversus_campaign_id,
                                              adversusCampaignName: mapping.adversus_campaign_name || undefined,
                                            })
                                          }
                                          disabled={updateCampaignMapping.isPending || !hasChanges}
                                        >
                                          {t("mgTest.save")}
                                        </Button>
                                      </TableCell>
                                      <TableCell>
                                        {isManualCampaign && (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => deleteManualCampaign.mutate(mapping.id)}
                                            disabled={deleteManualCampaign.isPending}
                                          >
                                            {deleteManualCampaign.isPending ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          {group.rows.length > ITEMS_PER_SECTION && !expandedCampaignSections[groupKey] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => setExpandedCampaignSections(prev => ({ ...prev, [groupKey]: true }))}
                            >
                              {t("mgTest.showMore", { count: group.rows.length - ITEMS_PER_SECTION })}
                            </Button>
                          )}
                          {expandedCampaignSections[groupKey] && group.rows.length > ITEMS_PER_SECTION && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => setExpandedCampaignSections(prev => ({ ...prev, [groupKey]: false }))}
                            >
                              {t("mgTest.showLess")}
                            </Button>
                          )}
                        </>
                      )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medarbejder mapping */}
          <TabsContent value="employee-mapping" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("mgTest.employeeMappingTitle")}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("mgTest.employeeMappingDesc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingEmployeeTab ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t("mgTest.loadingEmployees")}</span>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-dashed">
                        <CardHeader className="py-3">
                          <p className="text-xs font-medium text-muted-foreground">{t("mgTest.agentsWithoutMapping")}</p>
                          <p className="text-2xl font-semibold">
                            {unmappedAgentsCount}
                          </p>
                        </CardHeader>
                      </Card>
                      <Card className="border-dashed">
                        <CardHeader className="py-3">
                          <p className="text-xs font-medium text-muted-foreground">{t("mgTest.vagtEmployeesWithoutMapping")}</p>
                          <p className="text-2xl font-semibold">
                            {unmappedEmployeesCount}
                          </p>
                        </CardHeader>
                      </Card>
                      <Card className="border-dashed">
                        <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{t("mgTest.emailSuggestions")}</p>
                            <p className="text-2xl font-semibold">{emailSuggestions.length}</p>
                          </div>
                          <Badge variant="outline">{t("mgTest.autoMatch")}</Badge>
                        </CardHeader>
                      </Card>
                    </div>

                    {emailSuggestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("mgTest.noSuggestions")}
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[24%]">{t("mgTest.email")}</TableHead>
                              <TableHead className="w-[26%]">{t("mgTest.agentCommission")}</TableHead>
                              <TableHead className="w-[26%]">{t("mgTest.vagtEmployee")}</TableHead>
                              <TableHead className="w-[14%]">{t("mgTest.status")}</TableHead>
                              <TableHead className="w-[10%] text-right">{t("mgTest.action")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emailSuggestions.map((s) => (
                              <TableRow key={`${s.agent.id}-${s.vagtEmployee.id}`}>
                                <TableCell>
                                  <span className="font-mono text-xs">{s.email}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{s.agent.name}</span>
                                    <span className="text-xs text-muted-foreground">{t("mgTest.agentId")}: {s.agent.id}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{s.vagtEmployee.full_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {t("mgTest.employeeId")}: {s.vagtEmployee.id}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {t("mgTest.readyToMerge")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      mergeEmployeeSuggestion.mutate({
                                        agent: s.agent,
                                        vagtEmployee: s.vagtEmployee,
                                      })
                                    }
                                    disabled={mergeEmployeeSuggestion.isPending}
                                  >
                                    {mergeEmployeeSuggestion.isPending && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {t("mgTest.merge")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {mergedProfiles.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">{t("mgTest.existingMappings")}</h3>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[26%]">{t("mgTest.masterEmployee")}</TableHead>
                                <TableHead className="w-[18%]">{t("mgTest.masterEmail")}</TableHead>
                                <TableHead className="w-[14%]">{t("mgTest.source")}</TableHead>
                                <TableHead className="w-[26%]">{t("mgTest.sourceName")}</TableHead>
                                <TableHead className="w-[16%]">{t("mgTest.sourceEmail")}</TableHead>
                                <TableHead className="w-[10%] text-right">{t("mgTest.action")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mergedProfiles.map(({ master, identity }) => (
                                <TableRow key={identity.id}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{master?.full_name ?? t("mgTest.unknown")}</span>
                                      <span className="text-xs text-muted-foreground">ID: {identity.master_employee_id}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {master?.primary_email ?? t("mgTest.none")}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs uppercase">
                                      {identity.source}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{identity.source_name ?? t("mgTest.noSourceName")}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {t("mgTest.sourceId")}: {identity.source_employee_id}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {identity.source_email ?? t("mgTest.none")}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        deleteIdentityMapping.mutate({
                                          identityId: identity.id,
                                          masterId: identity.master_employee_id,
                                        })
                                      }
                                      disabled={deleteIdentityMapping.isPending}
                                    >
                                      {t("mgTest.removeMapping")}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kundenavne */}
          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>{t("mgTest.customerNamesTitle")}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("mgTest.customerNamesDesc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  className="flex flex-col md:flex-row gap-3 items-stretch md:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!addClientMutation.isPending) {
                      addClientMutation.mutate(newClientName);
                    }
                  }}
                >
                  <div className="flex-1 space-y-1">
                    <label className="text-sm font-medium">Nyt kundenavn</label>
                    <Input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="F.eks. TDC Erhverv"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="md:w-auto w-full"
                    disabled={addClientMutation.isPending || !newClientName.trim()}
                  >
                    {addClientMutation.isPending ? "Tilføjer…" : "Tilføj kunde"}
                  </Button>
                </form>

                {isLoadingCustomersTab ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Henter kunder…</span>
                  </div>
                ) : !clients || clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Der er endnu ingen kunder. Tilføj den første ovenfor.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Logo</TableHead>
                          <TableHead>Kundenavn</TableHead>
                          <TableHead>Teams</TableHead>
                          <TableHead className="w-[200px] text-right">Handling</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((client) => {
                          const isEditing = editingClientId === client.id;
                          const clientTeams = getTeamsForClient(client.id);
                          return (
                            <TableRow key={client.id}>
                              <TableCell>
                                {client.logo_url ? (
                                  <img
                                    src={client.logo_url}
                                    alt={`${client.name} logo`}
                                    className="h-8 w-8 object-contain rounded"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={editingClientName}
                                      onChange={(e) => setEditingClientName(e.target.value)}
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        <Upload className="h-3.5 w-3.5" />
                                        Upload logo
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const url = await uploadClientLogo(client.id, file);
                                              if (url) {
                                                updateClientMutation.mutate({
                                                  id: client.id,
                                                  name: editingClientName,
                                                  logo_url: url,
                                                });
                                              }
                                            }
                                          }}
                                        />
                                      </label>
                                      {client.logo_url && (
                                        <button
                                          type="button"
                                          className="text-xs text-destructive hover:underline"
                                          onClick={() => {
                                            updateClientMutation.mutate({
                                              id: client.id,
                                              name: editingClientName,
                                              logo_url: null,
                                            });
                                          }}
                                        >
                                          Fjern logo
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="font-medium">{client.name}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {clientTeams.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {clientTeams.slice(0, 3).map((team) => (
                                      <Badge key={team.id} variant="secondary" className="text-xs">
                                        <Users className="h-3 w-3 mr-1" />
                                        {team.name}
                                      </Badge>
                                    ))}
                                    {clientTeams.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{clientTeams.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Ingen teams</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        updateClientMutation.mutate({
                                          id: client.id,
                                          name: editingClientName,
                                        })
                                      }
                                      disabled={updateClientMutation.isPending}
                                    >
                                      Gem
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingClientId(null);
                                        setEditingClientName("");
                                      }}
                                    >
                                      Annuller
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingClientId(client.id);
                                        setEditingClientName(client.name);
                                      }}
                                    >
                                      Rediger
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => deleteClientMutation.mutate(client.id)}
                                      disabled={deleteClientMutation.isPending}
                                    >
                                      Slet
                                    </Button>
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Sales Overview Tab */}
          <TabsContent value="client-sales">
            <ClientSalesOverviewContent />
          </TabsContent>
        </Tabs>
      </div>

      {/* Field Inspector Dialog */}
      <Dialog open={!!inspectingCampaign} onOpenChange={(open) => !open && setInspectingCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Field Inspector
            </DialogTitle>
            <DialogDescription>
              Viser felter fra et sample-salg for kampagne:{" "}
              <span className="font-medium">{inspectingCampaign?.adversus_campaign_name || inspectingCampaign?.adversus_campaign_id}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {inspectorLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Henter felter fra Adversus...</span>
              </div>
            ) : inspectorError ? (
              <div className="py-8 text-center text-destructive">
                <p className="font-medium">Kunne ikke hente felter</p>
                <p className="text-sm text-muted-foreground mt-1">{inspectorError}</p>
              </div>
            ) : inspectorFields.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>Ingen felter fundet i sample-salg.</p>
                <p className="text-sm mt-1">Prøv at vælge en kampagne med nyere salg.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[25%]">Field ID</TableHead>
                      <TableHead className="w-[25%]">Label</TableHead>
                      <TableHead className="w-[50%]">Sample Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspectorFields.map((field) => (
                      <TableRow
                        key={field.fieldId}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleSelectField(field.fieldId)}
                      >
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {field.fieldId}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">{field.label}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                            {field.sampleValue}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="pt-4 border-t text-sm text-muted-foreground">
            Klik på en række for at vælge det Field ID til OPP/Reference-konfigurationen.
          </div>
        </DialogContent>
      </Dialog>

      {/* Retroactive Update Dialog */}
      <Dialog open={retroactiveDialog?.open ?? false} onOpenChange={(open) => !open && setRetroactiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opdater eksisterende salg?</DialogTitle>
            <DialogDescription className="pt-2">
              Du har gemt en ny Field ID mapping for kampagne{" "}
              <span className="font-medium">{retroactiveDialog?.campaignName}</span>.
              <br /><br />
              Vil du opdatere eksisterende salg med denne nye regel? Dette vil gensynkronisere salg fra de sidste 30 dage.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={() => handleRetroactiveSync(true)} 
              disabled={retroactiveSyncing}
              className="w-full"
            >
              {retroactiveSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opdaterer salg...
                </>
              ) : (
                "Ja, opdater sidste 30 dage"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleRetroactiveSync(false)}
              disabled={retroactiveSyncing}
              className="w-full"
            >
              Nej, kun fremtidige
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={createProductDialog} onOpenChange={setCreateProductDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opret nyt produkt</DialogTitle>
            <DialogDescription>
              Opret et produkt manuelt uden at det kommer fra en integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Produktnavn *</Label>
              <Input
                id="product-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Indtast produktnavn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-client">Kunde</Label>
              <Select
                value={newProduct.clientId || undefined}
                onValueChange={(value) => setNewProduct((prev) => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger id="product-client">
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Standard provision/revenue */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Standard provision & omsætning</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="product-commission" className="text-xs text-muted-foreground">Provision (DKK)</Label>
                  <Input
                    id="product-commission"
                    type="text"
                    inputMode="decimal"
                    value={newProduct.commission}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, commission: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="product-revenue" className="text-xs text-muted-foreground">Omsætning (DKK)</Label>
                  <Input
                    id="product-revenue"
                    type="text"
                    inputMode="decimal"
                    value={newProduct.revenue}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, revenue: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Campaign-specific overrides */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="campaign-overrides-toggle"
                  checked={showCampaignOverrides}
                  onCheckedChange={(checked) => {
                    setShowCampaignOverrides(checked === true);
                    if (checked && newProduct.campaignOverrides.length === 0) {
                      setNewProduct((prev) => ({
                        ...prev,
                        campaignOverrides: [{ campaignId: "", commission: "", revenue: "" }],
                      }));
                    }
                    if (!checked) {
                      setNewProduct((prev) => ({
                        ...prev,
                        campaignOverrides: [],
                      }));
                    }
                  }}
                />
                <Label htmlFor="campaign-overrides-toggle" className="text-sm font-medium cursor-pointer">
                  Forskellige provision/omsætning per kampagne
                </Label>
              </div>

              {showCampaignOverrides && (
                <div className="pl-6 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Sæt forskellige provision/omsætning alt efter hvilken kampagne produktet kommer fra.
                  </p>
                  
                  {newProduct.campaignOverrides.map((override, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Kampagne #{index + 1}</Label>
                        {newProduct.campaignOverrides.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() =>
                              setNewProduct((prev) => ({
                                ...prev,
                                campaignOverrides: prev.campaignOverrides.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Select
                        value={override.campaignId || undefined}
                        onValueChange={(value) =>
                          setNewProduct((prev) => ({
                            ...prev,
                            campaignOverrides: prev.campaignOverrides.map((o, i) =>
                              i === index ? { ...o, campaignId: value } : o
                            ),
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Vælg kampagne" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaignMappings?.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id} className="text-xs">
                              {campaign.adversus_campaign_name || campaign.adversus_campaign_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Provision</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={override.commission}
                            onChange={(e) =>
                              setNewProduct((prev) => ({
                                ...prev,
                                campaignOverrides: prev.campaignOverrides.map((o, i) =>
                                  i === index ? { ...o, commission: e.target.value } : o
                                ),
                              }))
                            }
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Omsætning</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={override.revenue}
                            onChange={(e) =>
                              setNewProduct((prev) => ({
                                ...prev,
                                campaignOverrides: prev.campaignOverrides.map((o, i) =>
                                  i === index ? { ...o, revenue: e.target.value } : o
                                ),
                              }))
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setNewProduct((prev) => ({
                        ...prev,
                        campaignOverrides: [
                          ...prev.campaignOverrides,
                          { campaignId: "", commission: "", revenue: "" },
                        ],
                      }))
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Tilføj flere kampagner
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-code">Ekstern produktkode</Label>
              <Input
                id="product-code"
                value={newProduct.externalCode}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, externalCode: e.target.value }))}
                placeholder="Valgfrit"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="product-counts"
                checked={newProduct.countsAsSale}
                onCheckedChange={(checked) =>
                  setNewProduct((prev) => ({ ...prev, countsAsSale: checked === true }))
                }
              />
              <Label htmlFor="product-counts" className="text-sm font-normal">
                Tæl som salg
              </Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateProductDialog(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => createManualProduct.mutate(newProduct)}
              disabled={!newProduct.name.trim() || createManualProduct.isPending}
            >
              {createManualProduct.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opretter...
                </>
              ) : (
                "Opret produkt"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={createCampaignDialog} onOpenChange={setCreateCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret kampagne manuelt</DialogTitle>
            <DialogDescription>
              Opret en ny kampagne der ikke kommer fra en integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Kampagnenavn *</Label>
              <Input
                id="campaign-name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="F.eks. TDC Erhverv Q1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-client">Kunde</Label>
              <Select
                value={newCampaign.clientId || undefined}
                onValueChange={(value) => setNewCampaign((prev) => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger id="campaign-client">
                  <SelectValue placeholder="Vælg kunde (valgfrit)" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-external-id">Ekstern kampagne-ID</Label>
              <Input
                id="campaign-external-id"
                value={newCampaign.externalId}
                onChange={(e) => setNewCampaign((prev) => ({ ...prev, externalId: e.target.value }))}
                placeholder="Valgfrit - genereres automatisk"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateCampaignDialog(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => createManualCampaign.mutate(newCampaign)}
              disabled={!newCampaign.name.trim() || createManualCampaign.isPending}
            >
              {createManualCampaign.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opretter...
                </>
              ) : (
                "Opret kampagne"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
