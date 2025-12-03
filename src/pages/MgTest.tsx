import { useMemo, useState } from "react";
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
}

interface EditEntry {
  provision?: string;
  cpo?: string;
}

type EditValues = Record<string, EditEntry>;

export default function MgTest() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<EditValues>({});

  // Hent alle produkter direkte fra webhook-data (sale_items)
  const {
    data: saleItems,
    isLoading: loadingSaleItems,
    isError,
  } = useQuery<WebhookSaleItem[]>({
    queryKey: ["mg-webhook-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, adversus_external_id, adversus_product_title, product_id, products(id, name, commission_dkk, revenue_dkk)"
        )
        .not("adversus_product_title", "is", null);

      if (error) throw error;
      return data as WebhookSaleItem[];
    },
  });

  const aggregatedProducts: AggregatedProduct[] = useMemo(() => {
    const map = new Map<string, AggregatedProduct>();

    saleItems?.forEach((item) => {
      const key = item.adversus_external_id || item.adversus_product_title || item.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
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
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aTitle = a.adversus_product_title || "";
      const bTitle = b.adversus_product_title || "";
      return aTitle.localeCompare(bTitle, "da");
    });
  }, [saleItems]);

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
    const cpoRaw =
      current.cpo ?? (row.product?.revenue_dkk != null ? String(row.product.revenue_dkk) : "0");

    const provision = parseFloat(provisionRaw.replace(",", ".")) || 0;
    const cpo = parseFloat(cpoRaw.replace(",", ".")) || 0;

    upsertProductValues.mutate({ row, provision, cpo });
  };

  const isLoading = loadingSaleItems;

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">MG test – Adversus produktmapping</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Her ser du alle produkter, vi har modtaget via Adversus-webhook (baseret på salg). Udfyld CPO og
            provision for hvert produkt, så de kan bruges i kommissionsberegninger.
          </p>
        </header>

        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Produkter fra Adversus-webhook (fra salg)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Alle unikke produktnavne er hentet fra webhook-salg under fanen "Salg".
                </p>
              </div>
              <Badge variant="outline">
                {aggregatedProducts.length} produkter fundet
              </Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Henter produkter…</span>
                </div>
              ) : isError ? (
                <p className="text-sm text-destructive">
                  Der opstod en fejl ved hentning af produkter. Prøv at genindlæse siden.
                </p>
              ) : aggregatedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Der er endnu ikke modtaget nogen produkter via webhook. Når de første leads kommer ind, vil
                  de dukke op her.
                </p>
              ) : (
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
                      {aggregatedProducts.map((row) => {
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
                                  (row.product?.revenue_dkk !== null && row.product?.revenue_dkk !== undefined
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
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
