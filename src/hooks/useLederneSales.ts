import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ManualChannel {
  key: string;
  label: string;
}

export interface ManualProduct {
  id: string;
  name: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
}

export interface ManualSale {
  id: string;
  sale_datetime: string;
  customer_phone: string;
  validation_status: string | null;
  raw_payload: { product_name?: string; channel_key?: string } | null;
  channel_key: string | null;
  sale_items: Array<{
    display_name: string | null;
    mapped_commission: number | null;
    mapped_revenue: number | null;
  }>;
}

async function callFn<T>(
  action: string,
  method: "GET" | "POST",
  opts?: { channel?: string; body?: unknown },
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const params = new URLSearchParams({ action });
  if (opts?.channel) params.set("channel", opts.channel);
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-sales?${params.toString()}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Fejl (${res.status})`);
  return json as T;
}

export function useManualChannels() {
  return useQuery({
    queryKey: ["manual-sales-channels"],
    queryFn: () => callFn<{ channels: ManualChannel[] }>("channels", "GET").then((r) => r.channels),
    staleTime: 5 * 60_000,
  });
}

export function useManualProducts(channelKey: string | undefined) {
  return useQuery({
    queryKey: ["manual-sales-products", channelKey],
    enabled: !!channelKey,
    queryFn: () =>
      callFn<{ products: ManualProduct[] }>("products", "GET", { channel: channelKey! }).then(
        (r) => r.products,
      ),
    staleTime: 60_000,
  });
}

export function useMyManualSales() {
  return useQuery({
    queryKey: ["manual-sales-mine"],
    queryFn: () => callFn<{ sales: ManualSale[] }>("list", "GET").then((r) => r.sales),
    staleTime: 30_000,
  });
}

export function useCreateManualSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      channel_key: string;
      product_id: string;
      customer_phone: string;
      sale_datetime?: string;
    }) =>
      callFn<{ ok: true; sale_id: string }>("create", "POST", {
        channel: input.channel_key,
        body: {
          product_id: input.product_id,
          customer_phone: input.customer_phone,
          sale_datetime: input.sale_datetime,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-sales-mine"] });
      qc.invalidateQueries({ queryKey: ["lederne-sales-mine"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sales-aggregates"] });
    },
  });
}

export function useDeleteManualSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sale_id: string) =>
      callFn<{ ok: true }>("delete", "POST", { body: { sale_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-sales-mine"] });
      qc.invalidateQueries({ queryKey: ["lederne-sales-mine"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sales-aggregates"] });
    },
  });
}

// Backwards-compatible aliases (previous API)
export type LederneProduct = ManualProduct;
export type LederneSale = ManualSale;
export const useLederneProducts = () => useManualProducts("lederne");
export const useMyLederneSales = useMyManualSales;
export const useDeleteLederneSale = useDeleteManualSale;
export function useCreateLederneSale() {
  const create = useCreateManualSale();
  return {
    ...create,
    mutateAsync: (input: { product_id: string; customer_phone: string; sale_datetime?: string }) =>
      create.mutateAsync({ channel_key: "lederne", ...input }),
  };
}
