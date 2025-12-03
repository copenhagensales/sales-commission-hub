import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface WebhookSaleItem {
  id: string;
  adversus_external_id: string | null;
  adversus_product_title: string | null;
  product_id: string | null;
  products: {
    id: string;
    name: string;
    commission_dkk: number | null;
    revenue_dkk: number | null;
    client_campaign_id: string | null;
  } | null;
  sales: {
    client_campaign_id: string | null;
  } | null;
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
  } | null;
  campaignId: string | null;
  campaignLabel: string;
}

interface EditEntry {
  provision?: string;
  cpo?: string;
}

type EditValues = Record<string, EditEntry>;

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string | null;
  client_campaign_id: string | null;
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

export default function MgTest() {
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

  // Hent alle kunder (kundenavne)
  const { data: clients, isLoading: loadingClients } = useQuery<ClientRow[]>({
    queryKey: ["mg-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as ClientRow[];
    },
  });

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

  // Hent alle produkter direkte fra webhook-data (sale_items) inkl. kampagne-id
  const {
    data: saleItems,
    isLoading: loadingSaleItems,
    isError: isSaleItemsError,
  } = useQuery<WebhookSaleItem[]>({
    queryKey: ["mg-webhook-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, adversus_external_id, adversus_product_title, product_id, products(id, name, commission_dkk, revenue_dkk, client_campaign_id), sales(client_campaign_id)"
        )
        .not("adversus_product_title", "is", null);

      if (error) throw error;
      return data as WebhookSaleItem[];
    },
  });

  const aggregatedProducts: AggregatedProduct[] = useMemo(() => {
    const map = new Map<string, AggregatedProduct>();

    saleItems?.forEach((item) => {
      const productCampaignId = item.products?.client_campaign_id ?? null;
      const saleCampaignId = item.sales?.client_campaign_id ?? null;
      const campaignId = productCampaignId ?? saleCampaignId ?? null;

      const campaign = campaignId ? clientCampaigns?.find((c) => c.id === campaignId) || null : null;
      let clientId = campaign?.client_id ?? null;
      let clientName = clientId
        ? clients?.find((client) => client.id === clientId)?.name ?? "Ukendt kunde"
        : null;

      // Midlertidig hjælp: hvis der ikke er fundet kunde, forsøg at udlede kundenavn fra produktnavnet
      if (!clientId) {
        const parsedClient = parseClientFromTitle(item.adversus_product_title, clients);
        if (parsedClient) {
          clientId = parsedClient.id;
          clientName = parsedClient.name ?? "Ukendt kunde";
        }
      }

      const productKey = item.adversus_external_id || item.adversus_product_title || item.id;
      const fullKey = `${clientId ?? "no-client"}::${productKey}`;

      if (!map.has(fullKey)) {
        map.set(fullKey, {
          key: fullKey,
          adversus_external_id: item.adversus_external_id,
          adversus_product_title: item.adversus_product_title,
          product: item.products
            ? {
                id: item.products.id,
                name: item.products.name,
                commission_dkk: item.products.commission_dkk,
                revenue_dkk: item.products.revenue_dkk,
                client_campaign_id: item.products.client_campaign_id,
              }
            : null,
          campaignId: clientId,
          campaignLabel: clientName ?? "Ingen kunde valgt",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const campA = a.campaignLabel;
      const campB = b.campaignLabel;
      if (campA !== campB) return campA.localeCompare(campB, "da");
      const titleA = a.adversus_product_title || "";
      const titleB = b.adversus_product_title || "";
      return titleA.localeCompare(titleB, "da");
    });
  }, [saleItems, clientCampaigns, clients]);

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

      // 2) Opret/opdatér mapping baseret på adversus_external_id
      if (row.adversus_external_id) {
        const { error: mappingError } = await supabase
          .from("adversus_product_mappings")
          .upsert(
            {
              adversus_external_id: row.adversus_external_id,
              adversus_product_title: row.adversus_product_title,
              product_id: productId,
            },
            { onConflict: "adversus_external_id" }
          );

        if (mappingError) throw mappingError;
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
      queryClient.invalidateQueries({ queryKey: ["mg-webhook-products"] });
      queryClient.invalidateQueries({ queryKey: ["adversus-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme værdier");
    },
  });

  const handleChange = (key: string, field: keyof EditEntry, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [key]: {
        provision: field === "provision" ? value : prev[key]?.provision ?? "",
        cpo: field === "cpo" ? value : prev[key]?.cpo ?? "",
      },
    }));
  };

  const handleSave = (row: AggregatedProduct) => {
    const current: EditEntry = editValues[row.key] || {};

    const provisionRaw =
      current.provision ?? (row.product?.commission_dkk != null ? String(row.product.commission_dkk) : "0");
    const cpoRaw = current.cpo ?? (row.product?.revenue_dkk != null ? String(row.product.revenue_dkk) : "0");

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
  };

  // Kampagne-mapping (Adversus campaignId -> intern client_campaign)
  const { data: campaignMappings, isLoading: loadingCampaignMappings } = useQuery<CampaignMapping[]>({
    queryKey: ["mg-campaign-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id, adversus_campaign_name, client_campaign_id")
        .order("adversus_campaign_name", { ascending: true });

      if (error) throw error;
      return data as CampaignMapping[];
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

    // Fordel kampagner i grupper efter gemt kunde-tilknytning
    campaignMappings?.forEach((mapping) => {
      const existingClientId =
        clientCampaigns?.find((c) => c.id === mapping.client_campaign_id)?.client_id ?? null;
      const groupKey = existingClientId ?? "unmapped";
      const existing = groups.get(groupKey);

      if (existing) {
        existing.rows.push(mapping);
      } else {
        groups.set(groupKey, {
          clientId: existingClientId,
          clientLabel: existingClientId ? "Ukendt kunde" : "Manglende mapping",
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
    mutationFn: async ({ mappingId, clientId }: { mappingId: string; clientId: string | null }) => {
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

      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .update({ client_campaign_id: clientCampaignId })
        .eq("id", mappingId)
        .select("id, client_campaign_id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Kunne ikke gemme kampagnemapping (mangler rettigheder?)");
      }
    },
    onSuccess: (_data, variables) => {
      toast.success("Kampagnemapping gemt");
      setCampaignSelections((prev) => {
        const next = { ...prev };
        delete next[variables.mappingId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme kampagnemapping");
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
      queryClient.invalidateQueries({ queryKey: ["mg-webhook-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme kunde på produkt");
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
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Kundenavn må ikke være tomt");

      const { error } = await supabase
        .from("clients")
        .update({ name: trimmed })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kundenavn opdateret");
      setEditingClientId(null);
      setEditingClientName("");
      queryClient.invalidateQueries({ queryKey: ["mg-clients"] });
      queryClient.invalidateQueries({ queryKey: ["mg-client-campaigns"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke opdatere kunde");
    },
  });

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

  const isLoadingProductsTab = loadingSaleItems || loadingClientCampaigns || loadingClients;
  const isLoadingCampaignTab = loadingCampaignMappings || loadingClientCampaigns;
  const isLoadingCustomersTab = loadingClients;

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">MG test – Adversus mapping</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Her kan du mappe både produkter og kampagner fra Adversus til dine interne produkter og
            kundekampagner, samt vedligeholde listen over kundenavne.
          </p>
        </header>

        <Tabs defaultValue="product" className="space-y-4">
          <TabsList>
            <TabsTrigger value="product">Mapping produkt</TabsTrigger>
            <TabsTrigger value="customer">Mapping kunde / kampagne</TabsTrigger>
            <TabsTrigger value="customers">Kundenavne</TabsTrigger>
          </TabsList>

          {/* Mapping produkt */}
          <TabsContent value="product" className="space-y-4">
            {isLoadingProductsTab ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Henter produkter…</span>
                </CardContent>
              </Card>
            ) : isSaleItemsError ? (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-destructive">
                    Der opstod en fejl ved hentning af produkter. Prøv at genindlæse siden.
                  </p>
                </CardContent>
              </Card>
            ) : productsByCampaign.length === 0 ? (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground">
                    Der er endnu ikke modtaget nogen produkter via webhook. Når de første leads kommer ind, vil
                    de dukke op her.
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
                          {group.campaignLabel === "Manglende mapping"
                            ? "Produkter uden valgt kunde. Vælg kunde og gem for at flytte produktet til den rette kundegruppe."
                            : `${group.rows.length} unikke produkter til denne kunde.`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {group.rows.length} {group.rows.length === 1 ? "produkt" : "produkter"}
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
                          aria-label={isOpen ? "Fold gruppe sammen" : "Fold gruppe ud"}
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
                                <TableHead className="w-[28%]">Adversus produktnavn</TableHead>
                                <TableHead className="w-[18%]">External ID</TableHead>
                                <TableHead className="w-[22%]">Kunde</TableHead>
                                <TableHead className="w-[14%]">Provision (DKK)</TableHead>
                                <TableHead className="w-[14%]">CPO / omsætning (DKK)</TableHead>
                                <TableHead className="w-[14%] text-right">Handling</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.rows.map((row) => {
                                const current = editValues[row.key];
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
                                  <TableRow key={row.key}>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {row.adversus_product_title || "(ingen titel)"}
                                        </span>
                                        {row.product && (
                                          <span className="text-xs text-muted-foreground">
                                            Internt produkt: {row.product.name}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-xs font-mono text-muted-foreground">
                                        {row.adversus_external_id || "(mangler)"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-2 max-w-xs">
                                        <Select
                                          value={selectedClientId ?? undefined}
                                          onValueChange={(value) => {
                                            if (productId) {
                                              setProductClientSelections((prev) => ({
                                                ...prev,
                                                [productId]: value,
                                              }));
                                            }
                                            setProductClientDrafts((prev) => ({
                                              ...prev,
                                              [row.key]: value,
                                            }));
                                          }}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Vælg kunde" />
                                          </SelectTrigger>
                                          <SelectContent className="bg-background border z-50 max-h-72">
                                            {clients?.map((client) => (
                                              <SelectItem key={client.id} value={client.id} className="text-sm">
                                                {client.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {row.product ? (
                                          <div className="flex justify-end">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                productId &&
                                                updateProductClient.mutate({
                                                  productId,
                                                  clientId: selectedClientId,
                                                })
                                              }
                                              disabled={
                                                !productId ||
                                                updateProductClient.isPending ||
                                                selectedClientId === existingClientId
                                              }
                                            >
                                              Gem kunde
                                            </Button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            Gem provision / CPO først for at oprette produktet
                                          </span>
                                        )}
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
                                            : "")
                                        }
                                        onChange={(e) => handleChange(row.key, "provision", e.target.value)}
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
                                            : "")
                                        }
                                        onChange={(e) => handleChange(row.key, "cpo", e.target.value)}
                                        placeholder="0,00"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSave(row)}
                                        disabled={upsertProductValues.isPending}
                                      >
                                        {upsertProductValues.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Save className="h-4 w-4 mr-2" />
                                        )}
                                        Gem
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
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
                  <CardTitle>Mapping kunde / kampagne</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Her mapper du Adversus campaignId til dine interne kundekampagner.
                  </p>
                </div>
                <Badge variant="outline">{campaignMappings?.length ?? 0} kampagner</Badge>
              </CardHeader>
              <CardContent>
                {isLoadingCampaignTab ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Henter kampagner…</span>
                  </div>
                ) : !campaignMappings || campaignMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Der er endnu ikke registreret nogen Adversus-kampagner. Når de første webhooks kommer ind,
                    oprettes de automatisk her.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[30%]">Adversus kampagnenavn</TableHead>
                          <TableHead className="w-[20%]">Adversus campaignId</TableHead>
                          <TableHead className="w-[50%]">Intern kunde / kampagne</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaignMappings.map((mapping) => {
                          const existingClientId =
                            clientCampaigns?.find((c) => c.id === mapping.client_campaign_id)?.client_id ?? null;
                          const selectedClientId =
                            campaignSelections[mapping.id] !== undefined
                              ? campaignSelections[mapping.id]
                              : existingClientId;

                          return (
                            <TableRow key={mapping.id}>
                              <TableCell>
                                <span className="font-medium">
                                  {mapping.adversus_campaign_name || "(ingen navn)"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {mapping.adversus_campaign_id}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-2 max-w-xl">
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
                                      <SelectValue placeholder="Vælg kunde" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border z-50 max-h-72">
                                      {clients?.map((client) => (
                                        <SelectItem key={client.id} value={client.id} className="text-sm">
                                          {client.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        updateCampaignMapping.mutate({
                                          mappingId: mapping.id,
                                          clientId: selectedClientId,
                                        })
                                      }
                                      disabled={updateCampaignMapping.isPending || selectedClientId === existingClientId}
                                    >
                                      Gem
                                    </Button>
                                  </div>
                                </div>
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

          {/* Kundenavne */}
          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Kundenavne</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Vedligehold listen over jeres kundenavne. Disse navne bruges bl.a. i dropdownen "Intern kunde /
                  kampagne".
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
                          <TableHead>Kundenavn</TableHead>
                          <TableHead className="w-[200px] text-right">Handling</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((client) => {
                          const isEditing = editingClientId === client.id;
                          return (
                            <TableRow key={client.id}>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={editingClientName}
                                    onChange={(e) => setEditingClientName(e.target.value)}
                                    autoFocus
                                  />
                                ) : (
                                  <span className="font-medium">{client.name}</span>
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
        </Tabs>
      </div>
    </MainLayout>
  );
}
