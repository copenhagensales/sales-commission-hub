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
  note: string | null;
}

export interface DeviationRow {
  id: string;
  saleId: string;
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
  note: string | null;
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
          note: payload.fm_comment || null,
        };
      });
    },
  });
}

/** Normaliserede numre på Eesy FM-salg markeret som Claim/Reimport. */
export function useEesyFmClaimPhones(from?: Date, to?: Date, enabled = true) {
  const fromIso = from ? from.toISOString() : undefined;
  const toIso = to ? to.toISOString() : undefined;

  return useQuery({
    queryKey: ["eesy-fm-claim-phones", fromIso, toIso],
    enabled,
    queryFn: async (): Promise<Set<string>> => {
      const rows = await fetchAllRows<{ customer_phone: string | null }>(
        "sales",
        "customer_phone",
        (query) => {
          let q = query
            .eq("source", "fieldmarketing")
            .eq("raw_payload->>fm_client_id", EESY_FM_CLIENT_ID)
            .eq("raw_payload->>fm_claim_reimport", "true");
          if (fromIso) q = q.gte("sale_datetime", fromIso);
          if (toIso) q = q.lte("sale_datetime", toIso);
          return q;
        },
      );

      const set = new Set<string>();
      for (const row of rows) {
        const normalized = normalizePhone(row.customer_phone);
        if (normalized) set.add(normalized);
      }
      return set;
    },
  });
}

const norm = (v: string | null) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FREE_MONTH_CAMPAIGN = norm("1 måneds gratis abonnement");

function isFiveG(product: string | null): boolean {
  return norm(product) === "5g internet";
}

/** Om produktnavnet er "uden første måned", "med første måned" eller ukendt. */
function firstMonthMode(product: string | null): "without" | "with" | null {
  const n = norm(product);
  if (n.includes(norm("uden første måned"))) return "without";
  if (n.includes(norm("med første måned"))) return "with";
  return null;
}

function isFreeMonthCampaign(campaign: string | null): boolean {
  return norm(campaign) === FREE_MONTH_CAMPAIGN;
}

/** Operator-mapping — eksporteres så Mapping-fanen viser samme sandhed. */
export const OPERATORS_NUUDAY = ["eesy", "Telmore", "Yousee"] as const;

export const OPERATORS_NON_NUUDAY = [
  "3",
  "CBB",
  "Call Me",
  "Companymobile",
  "DUKA (Telenor)",
  "Dstny (TDC)",
  "Evercall",
  "FLEXII",
  "Flexfone",
  "HALLO",
  "Leasy",
  "Lebara",
  "Lycamobile",
  "Mit Tele Mobil",
  "Mtel",
  "Nettalk",
  "Newly Created",
  "Norlys",
  "Oister",
  "Relatel (TDC)",
  "Telenabler",
  "Telenor",
  "UnoTel",
  "Velkommen",
  "greentel",
] as const;

const NUUDAY_OPERATOR_SET = new Set(OPERATORS_NUUDAY.map((o) => norm(o)));

/** Ukendte/tomme operatorer behandles som "ikke Nuuday". */
function isNuudayOperator(operator: string | null): boolean {
  return NUUDAY_OPERATOR_SET.has(norm(operator));
}

/** Om produktnavnet er "(Nuuday)", "(IKKE Nuuday)" eller ukendt. */
function nuudayMode(product: string | null): "nuuday" | "non_nuuday" | null {
  const n = norm(product);
  if (n.includes("ikke nuuday")) return "non_nuuday";
  if (n.includes("nuuday")) return "nuuday";
  return null;
}

/**
 * Operator-regel:
 * - produkt med "(IKKE Nuuday)" må ikke være solgt på en Nuuday-operator
 * - produkt med "(Nuuday)" må ikke være solgt på en ikke-Nuuday-operator
 */
function operatorMatchesProduct(product: string | null, operator: string | null): boolean {
  const mode = nuudayMode(product);
  if (mode === null) return true;
  const nuuday = isNuudayOperator(operator);
  return mode === "nuuday" ? nuuday : !nuuday;
}

/**
 * Kampagne-regel:
 * - "uden første måned" må ikke være solgt med kampagnen "1 måneds gratis abonnement"
 * - enhver anden kampagne kræver at produktet er "uden første måned"
 * Returnerer true når kombinationen er i orden.
 */
function campaignMatchesProduct(product: string | null, campaign: string | null): boolean {
  const mode = firstMonthMode(product);
  if (mode === null) return true; // ingen regel at måle på
  const free = isFreeMonthCampaign(campaign);
  return mode === "without" ? !free : free;
}

const PRODUCT_FLAG_SUBSCRIPTION = norm("Fri tale + 60 GB data (5G) (6 mdr. binding)");

/**
 * Produkt-regel: "Fri tale + 60 GB data (5G) (6 mdr. binding)" må ikke
 * være solgt på en Nuuday-operator.
 */
function productMatchesOperator(
  subscriptionName: string | null,
  operator: string | null,
): boolean {
  if (norm(subscriptionName) !== PRODUCT_FLAG_SUBSCRIPTION) return true;
  return !isNuudayOperator(operator);
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

  const { data: claimPhones, isLoading: loadingClaimPhones } = useEesyFmClaimPhones(
    effFrom,
    effTo,
    enabled && mode === "missing",
  );

  const { rows, okRows } = useMemo<{ rows: DeviationRow[]; okRows: DeviationRow[] }>(() => {
    if (!storkSales) return { rows: [], okRows: [] };
    if (mode === "missing" && loadingClaimPhones) return { rows: [], okRows: [] };

    const byPhone = new Map<string, PowerBiRow[]>();
    for (const row of powerBiRows || []) {
      if (!row.phoneNormalized) continue;
      const list = byPhone.get(row.phoneNormalized) || [];
      list.push(row);
      byPhone.set(row.phoneNormalized, list);
    }

    const result: DeviationRow[] = [];
    const ok: DeviationRow[] = [];

    const toRow = (
      sale: EesyFmStorkSale,
      match: PowerBiRow,
      deviation: string,
    ): DeviationRow => ({
      id: `${sale.id}-${match.id}`,
      saleId: sale.id,
      saleDatetime: sale.saleDatetime,
      sellerId: sale.sellerId,
      sellerName: sale.sellerName,
      phone: sale.phone,
      storkProduct: sale.productName,
      powerBiProduct: match.subscriptionName,
      powerBiCampaign: match.campaignName,
      powerBiOperator: match.operator,
      sheetLabel: SHEET_LABELS[match.sheetType],
      deviation,
      note: sale.note,
    });

    for (const sale of storkSales) {
      const matches = sale.phoneNormalized ? byPhone.get(sale.phoneNormalized) : undefined;

      if (mode === "missing") {
        if (isFiveG(sale.productName)) continue;
        if (sale.phoneNormalized && claimPhones?.has(sale.phoneNormalized)) continue;
        if (!matches || matches.length === 0) {
          result.push({
            id: sale.id,
            saleId: sale.id,
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
            note: sale.note,
          });
        }
        continue;
      }

      if (!matches || matches.length === 0) continue;

      if (isFiveG(sale.productName)) {
        ok.push(toRow(sale, matches[0], ""));
        continue;
      }

      const okMatch = matches.find(
        (m) =>
          campaignMatchesProduct(sale.productName, m.campaignName) &&
          operatorMatchesProduct(sale.productName, m.operator) &&
          productMatchesOperator(m.subscriptionName, m.operator),
      );
      if (okMatch) {
        ok.push(toRow(sale, okMatch, ""));
        continue;
      }

      const first = matches[0];
      const labels: string[] = [];
      if (!campaignMatchesProduct(sale.productName, first.campaignName)) labels.push("Kampagne");
      if (!operatorMatchesProduct(sale.productName, first.operator)) labels.push("Operator");
      if (!productMatchesOperator(first.subscriptionName, first.operator)) labels.push("Produkt");
      result.push(toRow(sale, first, labels.join(" + ") || "Kampagne"));

    }

    return { rows: result, okRows: ok };
  }, [storkSales, powerBiRows, mode, claimPhones, loadingClaimPhones]);

  return {
    rows,
    okRows,
    isLoading: loadingImports || loadingRows || loadingSales || loadingClaimPhones,
    hasImports: (imports || []).length > 0,

  };
}
