import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

const EESY_FM_CLIENT_ID = "9a92ea4c-6404-4b58-be08-065e7552d552";

export interface EesyFmClaimSale {
  id: string;
  saleDatetime: string;
  sellerId: string;
  sellerName: string;
  phone: string | null;
  productName: string | null;
  note: string | null;
  approved: boolean;
  approvedAt: string | null;
  approvedByName: string | null;
}

interface SaleRow {
  id: string;
  sale_datetime: string;
  customer_phone: string | null;
  raw_payload: any;
}


export function useEesyFmClaimSales(from?: Date, to?: Date, enabled = true) {
  const fromIso = from ? from.toISOString() : undefined;
  const toIso = to ? to.toISOString() : undefined;

  return useQuery({
    queryKey: ["eesy-fm-claim-sales", fromIso, toIso],
    queryFn: async (): Promise<EesyFmClaimSale[]> => {
      const rows = await fetchAllRows<SaleRow>(
        "sales",
        "id, sale_datetime, customer_phone, raw_payload",
        (query) => {
          let q = query
            .eq("source", "fieldmarketing")
            .eq("raw_payload->>fm_claim_reimport", "true")
            .eq("raw_payload->>fm_client_id", EESY_FM_CLIENT_ID);
          if (fromIso) q = q.gte("sale_datetime", fromIso);
          if (toIso) q = q.lte("sale_datetime", toIso);
          return q;
        },
        { orderBy: "sale_datetime", ascending: false }
      );

      const sellerIds = Array.from(
        new Set(rows.map((r) => r.raw_payload?.fm_seller_id).filter(Boolean) as string[])
      );

      const sellersMap = new Map<string, string>();
      if (sellerIds.length > 0) {
        const { data: sellers, error } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name")
          .in("id", sellerIds);
        if (error) throw error;
        for (const s of sellers || []) {
          sellersMap.set(
            s.id,
            [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Ukendt"
          );
        }
      }

      return rows.map((row) => {
        const payload = row.raw_payload || {};
        const sellerId: string = payload.fm_seller_id || "";
        return {
          id: row.id,
          saleDatetime: row.sale_datetime,
          sellerId,
          sellerName: sellersMap.get(sellerId) || "Ukendt",
          phone: row.customer_phone,
          productName: payload.fm_product_name || null,
          note: payload.fm_comment || null,
        };
      });
    },
    enabled,
  });
}
