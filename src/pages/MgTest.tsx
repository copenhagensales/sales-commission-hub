import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface AdversusProductMapping {
  id: string;
  adversus_external_id: string | null;
  adversus_product_title: string | null;
  product_id: string | null;
}

interface Product {
  id: string;
  name: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
}

interface EditEntry {
  provision?: string;
  cpo?: string;
}

type EditValues = Record<string, EditEntry>;

export default function MgTest() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<EditValues>({});

  const { data: adversusMappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["mg-adversus-product-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_product_mappings")
        .select("id, adversus_external_id, adversus_product_title, product_id")
        .order("adversus_product_title", { ascending: true });

      if (error) throw error;
      return data as AdversusProductMapping[];
    },
  });

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["mg-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk");

      if (error) throw error;
      return data as Product[];
    },
  });

  const upsertProductValues = useMutation({
    mutationFn: async (params: {
      mappingId: string;
      productId: string | null;
      provision: number;
      cpo: number;
      title: string | null;
    }) => {
      const { mappingId, productId, provision, cpo, title } = params;

      if (productId) {
        const { error } = await supabase
          .from("products")
          .update({
            commission_dkk: provision,
            revenue_dkk: cpo,
          })
          .eq("id", productId);

        if (error) throw error;
        return { productId };
      }

      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert({
          name: title || "Adversus produkt",
          commission_dkk: provision,
          revenue_dkk: cpo,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const { error: mappingError } = await supabase
        .from("adversus_product_mappings")
        .update({ product_id: newProduct.id })
        .eq("id", mappingId);

      if (mappingError) throw mappingError;

      return { productId: newProduct.id as string };
    },
    onSuccess: () => {
      toast.success("CPO og provision gemt");
      queryClient.invalidateQueries({ queryKey: ["mg-adversus-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["mg-products"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kunne ikke gemme værdier");
    },
  });

  const getProductForMapping = (mapping: AdversusProductMapping) => {
    if (!mapping.product_id || !products) return undefined;
    return products.find((p) => p.id === mapping.product_id);
  };

  const handleChange = (
    mappingId: string,
    field: keyof EditEntry,
    value: string,
  ) => {
    setEditValues((prev) => ({
      ...prev,
      [mappingId]: {
        provision: field === "provision" ? value : prev[mappingId]?.provision ?? "",
        cpo: field === "cpo" ? value : prev[mappingId]?.cpo ?? "",
      },
    }));
  };

  const handleSave = (mapping: AdversusProductMapping) => {
    const current: EditEntry = editValues[mapping.id] || {};
    const product = getProductForMapping(mapping);

    const provisionRaw = current.provision ?? (product?.commission_dkk?.toString() ?? "0");
    const cpoRaw = current.cpo ?? (product?.revenue_dkk?.toString() ?? "0");

    const provision = parseFloat(provisionRaw.replace(",", ".")) || 0;
    const cpo = parseFloat(cpoRaw.replace(",", ".")) || 0;

    upsertProductValues.mutate({
      mappingId: mapping.id,
      productId: mapping.product_id,
      provision,
      cpo,
      title: mapping.adversus_product_title,
    });
  };

  const isLoading = loadingMappings || loadingProducts;

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">MG test – Adversus produktmapping</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Her ser du alle produkter, vi har modtaget via Adversus-webhook. Udfyld CPO og provision for
            hvert produkt, så de kan bruges i kommissionsberegninger.
          </p>
        </header>

        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Produkter fra Adversus-webhook</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Listen er baseret på alle produkter, der er modtaget via webhook URL&apos;en.
                </p>
              </div>
              <Badge variant="outline">
                {adversusMappings?.length ?? 0} produkter fundet
              </Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Henter produkter…</span>
                </div>
              ) : !adversusMappings || adversusMappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Der er endnu ikke modtaget nogen produkter via webhook. Når de første leads kommer ind, vil
                  de dukke op her.
                </p>
              ) : (
                <div className="rounded-md border">
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
                      {adversusMappings.map((mapping) => {
                        const product = getProductForMapping(mapping);
                        const current = editValues[mapping.id];

                        return (
                          <TableRow key={mapping.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {mapping.adversus_product_title || "(ingen titel)"}
                                </span>
                                {product && (
                                  <span className="text-xs text-muted-foreground">
                                    Internt produkt: {product.name}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono text-muted-foreground">
                                {mapping.adversus_external_id || "(mangler)"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-9"
                                value={
                                  current?.provision ??
                                  (product?.commission_dkk !== null && product?.commission_dkk !== undefined
                                    ? String(product.commission_dkk)
                                    : "")
                                }
                                onChange={(e) =>
                                  handleChange(mapping.id, "provision", e.target.value)
                                }
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
                                  (product?.revenue_dkk !== null && product?.revenue_dkk !== undefined
                                    ? String(product.revenue_dkk)
                                    : "")
                                }
                                onChange={(e) => handleChange(mapping.id, "cpo", e.target.value)}
                                placeholder="0,00"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleSave(mapping)}
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
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
