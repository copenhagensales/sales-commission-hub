import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LederneProduct {
  id: string;
  name: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
}

export interface LederneSale {
  id: string;
  sale_datetime: string;
  customer_phone: string;
  validation_status: string | null;
  raw_payload: { product_name?: string } | null;
  sale_items: Array<{
    display_name: string | null;
    mapped_commission: number | null;
    mapped_revenue: number | null;
  }>;
}

async function invoke<T>(action: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("manual-sales", {
    method,
    body,
    // Query param via method-specific path is not supported by invoke; use body flag instead
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// Because supabase.functions.invoke doesn't expose query params easily, we send `action` in body/headers.
// The edge function reads url.searchParams for action — so we call fetch directly.
async function callFn<T>(action: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-sales?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Fejl (${res.status})`);
  return json as T;
}

export function useLederneProducts() {
  return useQuery({
    queryKey: ["lederne-products"],
    queryFn: () => callFn<{ products: LederneProduct[] }>("products", "GET").then((r) => r.products),
    staleTime: 60_000,
  });
}

export function useMyLederneSales() {
  return useQuery({
    queryKey: ["lederne-sales-mine"],
    queryFn: () => callFn<{ sales: LederneSale[] }>("list", "GET").then((r) => r.sales),
    staleTime: 30_000,
  });
}

export function useCreateLederneSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { product_id: string; customer_phone: string; sale_datetime?: string }) =>
      callFn<{ ok: true; sale_id: string }>("create", "POST", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lederne-sales-mine"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sales-aggregates"] });
    },
  });
}
