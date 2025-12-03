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
import { Loader2, Save } from "lucide-react";
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
  clients: {
    name: string | null;
  } | null;
}

interface ClientRow {
  id: string;
  name: string;
}

export default function MgTest() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<EditValues>({});
  const [newClientName, setNewClientName] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientName, setEditingClientName] = useState("");

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
        .select("id, name, clients(name)")
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
          "id, adversus_external_id, adversus_product_title, product_id, products(id, name, commission_dkk, revenue_dkk), sales(client_campaign_id)"
        )
        .not("adversus_product_title", "is", null);

      if (error) throw error;
      return data as WebhookSaleItem[];
    },
  });

  const aggregatedProducts: AggregatedProduct[] = useMemo(() => {
    const map = new Map<string, AggregatedProduct>();

    saleItems?.forEach((item) => {
      const campaignId = item.sales?.client_campaign_id || null;
      const campaign = clientCampaigns?.find((c) => c.id === campaignId) || null;
      const campaignLabel = campaign
        ? `${campaign.clients?.name ?? "Ukendt kunde"} – ${campaign.name}`
        : "Ukendt kampagne";

      const productKey = item.adversus_external_id || item.adversus_product_title || item.id;
      const fullKey = `${campaignId ?? "no-campaign"}::${productKey}`;

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
              }
            : null,
          campaignId,
          campaignLabel,
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
  }, [saleItems, clientCampaigns]);

  const productsByCampaign = useMemo(() => {
    const groups = new Map<string, AggregatedProduct[]>();
    aggregatedProducts.forEach((row) => {
      const list = groups.get(row.campaignLabel) || [];
      list.push(row);
      groups.set(row.campaignLabel, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "da"));
  }, [aggregatedProducts]);

  const upsertProductValues = useMutation({
    mutationFn: async (params: { row: AggregatedProduct; provision: number; cpo: number }) => {
      const { row, provision, cpo } = params;
      let productId = row.product?.id ?? null;

      // 1) Opdater eksisterende produkt eller opret et nyt
      if (productId) {
        const { error } = await supabase
          .from("products")
          .update({ commission_dkk: provision, revenue_dkk: cpo })
          .eq("id", productId);

        if (error) throw error;
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert({
            name: row.adversus_product_title || "Adversus produkt",
            commission_dkk: provision,
            revenue_dkk: cpo,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        productId = newProduct.id as string;
      }

      // 2) Opret/opfdatér mapping baseret på adversus_external_id
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

      return { productId };
    },
    onSuccess: () => {
      toast.success("CPO og provision gemt");
      queryClient.invalidateQueries({ queryKey: ["mg-webhook-products"] });
      queryClient.invalidateQueries({ queryKey: ["adversus-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
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

    upsertProductValues.mutate({ row, provision, cpo });
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

  const updateCampaignMapping = useMutation({
    mutationFn: async ({ mappingId, clientCampaignId }: { mappingId: string; clientCampaignId: string | null }) => {
      const { error } = await supabase
        .from("adversus_campaign_mappings")
        .update({ client_campaign_id: clientCampaignId })
        .eq("id", mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampagnemapping gemt");
      queryClient.invalidateQueries({ queryKey: ["mg-campaign-mappings"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme kampagnemapping");
    },
  });

  // Kunder: tilføj og opdater
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

  const isLoadingProductsTab = loadingSaleItems || loadingClientCampaigns;
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
              productsByCampaign.map(([campaignLabel, rows]) => (
                <Card key={campaignLabel} className="border-muted">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold">{campaignLabel}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rows.length} unikke produkter fra denne kampagne.
                      </p>
                    </div>
                    <Badge variant="outline">{rows.length} produkter</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[30%]">Adversus produktnavn</TableHead>
                            <TableHead className="w-[20%]">External ID</TableHead>
                            <TableHead className="w-[15%]">Provision (DKK)</TableHead>
                            <TableHead className="w-[15%]">CPO / omsætning (DKK)</TableHead>
                            <TableHead className="w-[20%] text-right">Handling</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => {
                            const current = editValues[row.key];

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
                </Card>
              ))
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
                          const selectedCampaign = clientCampaigns?.find(
                            (c) => c.id === mapping.client_campaign_id,
                          );
                          const selectedLabel = selectedCampaign
                            ? `${selectedCampaign.clients?.name ?? "Ukendt kunde"} – ${selectedCampaign.name}`
                            : "Vælg intern kampagne";

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
                                <Select
                                  value={mapping.client_campaign_id ?? undefined}
                                  onValueChange={(value) =>
                                    updateCampaignMapping.mutate({
                                      mappingId: mapping.id,
                                      clientCampaignId: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full max-w-xl">
                                    <SelectValue placeholder="Vælg intern kampagne">
                                      {selectedLabel}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50 max-h-72">
                                    {clientCampaigns?.map((c) => (
                                      <SelectItem key={c.id} value={c.id} className="text-sm">
                                        {c.clients?.name ?? "Ukendt kunde"} – {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                          <TableHead className="w-[160px] text-right">Handling</TableHead>
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
