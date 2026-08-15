import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import {
  normalizePhone,
  useEesyFmPowerBiImports,
  useEesyFmPowerBiRows,
  SHEET_LABELS,
  type PowerBiRow,
} from "./useEesyFmPowerBiImports";

const EESY_FM_CLIENT_ID = "9a92ea4c-6404-4b58-be08-065e7552d552";

export interface EesyFmStorkSale {
  id: string;
  saleDatetime: string;
  sellerId: string;
  sellerName: string;
  phone: string | null;
  phoneNormalized: string | null;
  productName: string | null;
}

export interface DeviationRow {
  id: string;
  saleDatetime: string;
  sellerId: string;
  sellerName: string;
  phone: string | null;
  storkProduct: string | null;
  powerBiProduct: string | null;
  powerBiCampaign: string | null;
  powerBiOperator: string | null;
  sheetLabel: string | null;
  deviation: string;
}

/** Alle Eesy FM-salg i Stork i perioden (read-only). */
export function useEesyFmStorkSales(from?: Date, to?: Date, enabled = true) {
  const fromIso = from ? from.toISOString() : undefined;
  const toIso = to ? to.toISOString() : undefined;

  return useQuery({
    queryKey: ["eesy-fm-stork-sales", fromIso, toIso],
    enabled,
    queryFn: async (): Promise<EesyFmStorkSale[]> => {
      const rows = await fetchAllRows<{
        id: string;
        sale_datetime: string;
        customer_phone: string | null;
        raw_payload: any;
      }>(
        "sales",
        "id, sale_datetime, customer_phone, raw_payload",
        (query) => {
          let q = query
            .eq("source", "fieldmarketing")
            .eq("raw_payload->>fm_client_id", EESY_FM_CLIENT_ID);
          if (fromIso) q = q.gte("sale_datetime", fromIso);
          if (toIso) q = q.lte("sale_datetime", toIso);
          return q;
        },
        { orderBy: "sale_datetime", ascending: false },
      );

      const sellerIds = Array.from(
        new Set(rows.map((r) => r.raw_payload?.fm_seller_id).filter(Boolean) as string[]),
      );

      const names = new Map<string, string>();
      if (sellerIds.length > 0) {
        const { data, error } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name")
          .in("id", sellerIds);
        if (error) throw error;
        for (const e of data || []) {
          names.set(
            e.id,
            [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || "Ukendt",
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
          sellerName: names.get(sellerId) || "Ukendt",
          phone: row.customer_phone,
          phoneNormalized: normalizePhone(row.customer_phone),
          productName: payload.fm_product_name || null,
        };
      });
    },
  });
}

function sameProduct(a: string | null, b: string | null): boolean {
  const norm = (v: string | null) =>
    (v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Sammenholder Stork-salg med de uploadede PowerBI-ark på normaliseret mobilnummer.
 * - "missing": salg i Stork hvor nummeret ikke findes i arkene
 * - "deviations": nummer findes i begge, men produktet er forskelligt
 */
export function useEesyFmDeviations(
  mode: "deviations" | "missing",
  from?: Date,
  to?: Date,
  enabled = true,
) {
  const { data: imports, isLoading: loadingImports } = useEesyFmPowerBiImports();
  const { data: powerBiRows, isLoading: loadingRows } = useEesyFmPowerBiRows(imports);

  // Uden valgt periode begrænses Stork-opslaget til de uploadede arks periode,
  // så vi ikke henter hele FM-historikken.
  const importPeriod = useMemo(() => {
    const froms = (imports || []).map((i) => i.periodFrom).filter(Boolean) as string[];
    const tos = (imports || []).map((i) => i.periodTo).filter(Boolean) as string[];
    if (froms.length === 0 || tos.length === 0) return null;
    const start = new Date(`${froms.sort()[0]}T00:00:00`);
    const end = new Date(`${tos.sort().slice(-1)[0]}T23:59:59`);
    return { start, end };
  }, [imports]);

  const effFrom = from ?? importPeriod?.start;
  const effTo = to ?? importPeriod?.end;

  const { data: storkSales, isLoading: loadingSales } = useEesyFmStorkSales(
    effFrom,
    effTo,
    enabled && (!!effFrom || (imports || []).length === 0),
  );

  const rows = useMemo<DeviationRow[]>(() => {
    if (!storkSales) return [];

    const byPhone = new Map<string, PowerBiRow[]>();
    for (const row of powerBiRows || []) {
      if (!row.phoneNormalized) continue;
      const list = byPhone.get(row.phoneNormalized) || [];
      list.push(row);
      byPhone.set(row.phoneNormalized, list);
    }

    const result: DeviationRow[] = [];

    for (const sale of storkSales) {
      const matches = sale.phoneNormalized ? byPhone.get(sale.phoneNormalized) : undefined;

      if (mode === "missing") {
        if (!matches || matches.length === 0) {
          result.push({
            id: sale.id,
            saleDatetime: sale.saleDatetime,
            sellerId: sale.sellerId,
            sellerName: sale.sellerName,
            phone: sale.phone,
            storkProduct: sale.productName,
            powerBiProduct: null,
            powerBiCampaign: null,
            powerBiOperator: null,
            sheetLabel: null,
            deviation: "Mangler i PowerBI",
          });
        }
        continue;
      }

      if (!matches || matches.length === 0) continue;
      const anyEqual = matches.some((m) => sameProduct(m.subscriptionName, sale.productName));
      if (anyEqual) continue;

      const match = matches[0];
      result.push({
        id: `${sale.id}-${match.id}`,
        saleDatetime: sale.saleDatetime,
        sellerId: sale.sellerId,
        sellerName: sale.sellerName,
        phone: sale.phone,
        storkProduct: sale.productName,
        powerBiProduct: match.subscriptionName,
        powerBiCampaign: match.campaignName,
        powerBiOperator: match.operator,
        sheetLabel: SHEET_LABELS[match.sheetType],
        deviation: "Produkt",
      });
    }

    return result;
  }, [storkSales, powerBiRows, mode]);

  return {
    rows,
    isLoading: loadingImports || loadingRows || loadingSales,
    hasImports: (imports || []).length > 0,
  };
}
