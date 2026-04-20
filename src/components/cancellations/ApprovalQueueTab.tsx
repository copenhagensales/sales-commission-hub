import { useState, useMemo } from "react";
import { useAgentNameResolver } from "@/hooks/useAgentNameResolver";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2, Clock, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { da } from "date-fns/locale";

import { MatchErrorsSubTab } from "@/components/cancellations/MatchErrorsSubTab";
import { CLIENT_IDS } from "@/utils/clientIds";
import { fetchByIds } from "@/utils/supabasePagination";
import { FileSpreadsheet, AlertTriangle } from "lucide-react";
import { groupConditionsByProduct, findMatchingProductId } from "@/utils/productConditionMatcher";

const TDC_ERHVERV_CLIENT_ID = CLIENT_IDS["TDC Erhverv"];
const EESY_FM_CLIENT_ID = CLIENT_IDS["Eesy FM"];
const PAGE_SIZE = 50;

interface DiffField {
  label: string;
  systemValue: string;
  uploadedValue: string;
  isDifferent: boolean;
  isExpected?: boolean;
}

interface ColumnMapping {
  product_columns: string[];
  revenue_column: string | null;
  commission_column: string | null;
  product_match_mode: string;
  date_column: string | null;
  phone_excluded_products: string[];
}

interface SaleItem {
  product_name: string;
  quantity: number;
  mapped_commission: number;
  mapped_revenue: number;
}

interface PreviewField {
  label: string;
  value: string;
}

function stripPercentSuffix(name: string): string {
  return name.replace(/\s+(0|50|100)%?\s*$/i, "").trim();
}

function normalizeProductName(name: string, mode: string): string {
  const lower = name.toLowerCase().trim();
  if (mode === "strip_percent_suffix") return stripPercentSuffix(lower);
  return lower;
}

function isIrrelevantValue(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return true;
  const s = String(val).trim().toLowerCase();
  return s === "total" || s === "0" || s === "";
}

function parseExcelDate(val: unknown, handleSerialDates = false): Date | null {
  if (!val) return null;

  // Excel serial dates (days since 1900-01-01) — only for TDC Erhverv
  if (handleSerialDates) {
    const num = typeof val === "number" ? val
      : (typeof val === "string" && /^\d{4,6}$/.test(val.trim()) ? Number(val) : null);
    if (num && num > 1 && num < 200000) {
      const epoch = new Date(Date.UTC(1900, 0, 1));
      const d = new Date(epoch.getTime() + (num - 2) * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const s = String(val).trim();
  // dd/MM/yyyy or dd-MM-yyyy
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // yyyy-MM-dd
  const ymd = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Try native parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function computeDiff(
  uploadedData: Record<string, unknown> | null,
  saleItems: SaleItem[],
  mapping: ColumnMapping | null,
  saleDate?: string,
  targetProductName?: string | null,
  isTdcErhverv = false,
): DiffField[] {
  if (!uploadedData || Object.keys(uploadedData).length === 0) return [];
  if (!mapping) return [];

  const diffs: DiffField[] = [];

  // Date comparison
  if (mapping.date_column) {
    const excelRaw = uploadedData[mapping.date_column];
    const excelDate = parseExcelDate(excelRaw, isTdcErhverv);
    if (excelDate && saleDate) {
      const sysDate = new Date(saleDate);
      const excelStr = format(excelDate, "dd/MM/yyyy");
      const sysStr = format(sysDate, "dd/MM/yyyy");
      diffs.push({
        label: "Dato",
        systemValue: sysStr,
        uploadedValue: excelStr,
        isDifferent: excelStr !== sysStr,
      });
    } else if (excelRaw && !saleDate) {
      diffs.push({ label: "Dato", systemValue: "-", uploadedValue: String(excelRaw), isDifferent: true });
    }
  }
  const systemRevenue = saleItems.reduce((sum, si) => sum + (si.mapped_revenue || 0), 0);
  const systemCommission = saleItems.reduce((sum, si) => sum + (si.mapped_commission || 0), 0);

  if (mapping.revenue_column) {
    const val = uploadedData[mapping.revenue_column];
    if (!isIrrelevantValue(val)) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal)) {
        const isDiff = Math.abs(uploadedVal - systemRevenue) > 1;
        diffs.push({
          label: `Omsætning (${mapping.revenue_column})`,
          systemValue: `${systemRevenue.toFixed(0)} kr`,
          uploadedValue: `${uploadedVal.toFixed(0)} kr`,
          isDifferent: isDiff,
        });
      }
    }
  }

  if (mapping.commission_column) {
    const val = uploadedData[mapping.commission_column];
    if (!isIrrelevantValue(val)) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal)) {
        const isDiff = Math.abs(uploadedVal - systemCommission) > 1;
        diffs.push({
          label: `Provision (${mapping.commission_column})`,
          systemValue: `${systemCommission.toFixed(0)} kr`,
          uploadedValue: `${uploadedVal.toFixed(0)} kr`,
          isDifferent: isDiff,
        });
      }
    }
  }

  if (mapping.product_columns && mapping.product_columns.length > 0) {
    const matchMode = mapping.product_match_mode || "exact";
    const systemProducts = saleItems.map((si) => si.product_name).filter(Boolean);

    for (const colName of mapping.product_columns) {
      const val = uploadedData[colName];
      if (isIrrelevantValue(val)) continue;

      const uploadedQty = Number(val);
      if (!isNaN(uploadedQty) && uploadedQty !== 0) {
        const normalizedCol = normalizeProductName(colName, matchMode);
        const matchedItem = saleItems.find(
          (si) => normalizeProductName(si.product_name, matchMode) === normalizedCol
        );
        const systemQty = matchedItem?.quantity || 0;
        const isDiff = Math.abs(uploadedQty - systemQty) > 0.01;
        diffs.push({ label: colName, systemValue: `${systemQty}`, uploadedValue: `${uploadedQty}`, isDifferent: isDiff });
      } else {
        const rawUploadedProduct = String(val).trim();
        const comparisonUploadedProduct = String(targetProductName || rawUploadedProduct).trim();
        const normalizedUploaded = normalizeProductName(comparisonUploadedProduct, matchMode);
        const matchesAny = systemProducts.some((sp) => normalizeProductName(sp, matchMode) === normalizedUploaded);
        diffs.push({
          label: colName,
          systemValue: systemProducts.join(", ") || "-",
          uploadedValue: rawUploadedProduct,
          isDifferent: !matchesAny && systemProducts.length > 0,
        });
      }
    }
  }

  return diffs;
}

function summarizeSaleItems(saleItems: SaleItem[]): SaleItem[] {
  const map = new Map<string, SaleItem>();

  for (const item of saleItems) {
    const key = item.product_name || "Ukendt";
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity || 1;
      existing.mapped_commission += item.mapped_commission || 0;
      existing.mapped_revenue += item.mapped_revenue || 0;
    } else {
      map.set(key, {
        product_name: key,
        quantity: item.quantity || 1,
        mapped_commission: item.mapped_commission || 0,
        mapped_revenue: item.mapped_revenue || 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity || a.product_name.localeCompare(b.product_name));
}

function getDiffTone(diff: DiffField) {
  if (diff.isExpected) {
    return {
      container: "bg-muted/60 border-border",
      text: "text-foreground",
      icon: "ℹ",
    };
  }

  if (diff.isDifferent) {
    return {
      container: "bg-destructive/10 border-destructive/20",
      text: "text-destructive",
      icon: "✗",
    };
  }

  return {
    container: "bg-secondary/40 border-border",
    text: "text-foreground",
    icon: "✓",
  };
}

interface TdcUploadedStructured {
  products: { name: string; quantity: number }[];
  cpoTotal: string;
  ttTrin: string;
  kampagnePris: string;
}

function buildTdcUploadedStructured(
  uploadedData: Record<string, unknown> | null,
): TdcUploadedStructured | null {
  if (!uploadedData) return null;
  const products: { name: string; quantity: number }[] = [];
  const productRows = uploadedData._product_rows as Record<string, unknown>[] | undefined;
  if (productRows && productRows.length > 0) {
    for (const r of productRows) {
      const name = String(r["Produkt"] || r["produkt"] || "").trim();
      if (!name) continue;
      const qty = Number(r["Antal"] || r["antal"] || 1);
      products.push({ name, quantity: qty });
    }
  }
  const cpoTotal = uploadedData["CPO Total"] != null ? String(uploadedData["CPO Total"]).trim() : "";
  const ttTrin = uploadedData["TT trin"] != null ? String(uploadedData["TT trin"]).trim() : "";

  // Læs Kampagne pris fra første sub-row (case-insensitive); top-level fallback
  let kampagnePris = "";
  if (productRows && productRows.length > 0) {
    const first = productRows[0];
    const key = Object.keys(first).find((k) => k.toLowerCase() === "kampagne pris");
    if (key) kampagnePris = String(first[key] ?? "").trim();
  }
  if (!kampagnePris && uploadedData["Kampagne pris"] != null) {
    kampagnePris = String(uploadedData["Kampagne pris"]).trim();
  }
  // Vis kun hvis et produkt er 5G Fri
  const has5gFri = products.some((p) => /5G\s*FRI/i.test(p.name));
  if (!has5gFri) kampagnePris = "";

  return products.length > 0 || cpoTotal || ttTrin || kampagnePris ? { products, cpoTotal, ttTrin, kampagnePris } : null;
}

function buildUploadedPreview(
  uploadedData: Record<string, unknown> | null,
  mapping: ColumnMapping | null,
  clientId?: string,
): PreviewField[] {
  if (!uploadedData || Object.keys(uploadedData).length === 0) return [];

  // TDC Erhverv: hide extra fields (structured rendering handles the rest)
  const hiddenFields = clientId === TDC_ERHVERV_CLIENT_ID
    ? new Set(["TT", "TT mandat", "tt", "tt mandat", "OPP-nr.", "Produkt: Total", "Lukkedato", "Provision", "provision", "CPO Total", "TT trin", "Kampagne pris"])
    : new Set<string>();

  const fields: PreviewField[] = [];
  const seen = new Set<string>();

  const addField = (label: string, value: unknown) => {
    if (hiddenFields.has(label)) return;
    const rendered = value == null ? "" : String(value).trim();
    if (!rendered || seen.has(label)) return;
    fields.push({ label, value: rendered });
    seen.add(label);
  };

  // For TDC Erhverv, skip product rows here (rendered separately)
  if (clientId !== TDC_ERHVERV_CLIENT_ID) {
    const productRows = uploadedData._product_rows as Record<string, unknown>[] | undefined;
    if (productRows && productRows.length > 0) {
      const productLabels = productRows
        .map(r => {
          const name = String(r["Produkt"] || r["produkt"] || "").trim();
          if (!name) return "";
          return name;
        })
        .filter(Boolean);
      if (productLabels.length > 0) {
        addField("Produkter", productLabels.join(", "));
      }
    }
  }

  mapping?.product_columns?.forEach((column) => {
    const value = uploadedData[column];
    if (!isIrrelevantValue(value)) addField(column, value);
  });

  if (mapping?.revenue_column && !isIrrelevantValue(uploadedData[mapping.revenue_column])) {
    addField(mapping.revenue_column, uploadedData[mapping.revenue_column]);
  }

  if (clientId !== TDC_ERHVERV_CLIENT_ID && mapping?.commission_column && !isIrrelevantValue(uploadedData[mapping.commission_column])) {
    addField(mapping.commission_column, uploadedData[mapping.commission_column]);
  }

  const prioritizedFallback = Object.entries(uploadedData)
    .filter(([key, value]) => key !== "_product_rows" && value !== null && value !== undefined && String(value).trim() !== "")
    .sort(([a], [b]) => {
      const score = (key: string) => {
        const lower = key.toLowerCase();
        if (lower.includes("produkt")) return 0;
        if (lower.includes("opp")) return 1;
        if (lower.includes("cpo") || lower === "tt" || lower.includes("oms") || lower.includes("prov")) return 2;
        return 3;
      };
      return score(a) - score(b);
    });

  for (const [label, value] of prioritizedFallback) {
    if (fields.length >= 10) break;
    addField(label, value);
  }

  return fields;
}

interface OppGroupRow {
  oppGroup: string;
  agents: string[];
  saleCount: number;
  saleItems: SaleItem[];
  uploadedData: Record<string, unknown> | null;
  mapping: ColumnMapping | null;
  diffs: DiffField[];
  hasDifferences: boolean;
  queueItemIds: string[];
  saleIds: string[];
  uploadType: string;
  status: string;
  fileName: string;
  createdAt: string;
}

interface FlatQueueRow {
  id: string;
  sale_id: string;
  upload_type: string;
  target_product_name?: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  import_id: string;
  opp_group: string | null;
  client_id: string | null;
  saleDate: string;
  agentName: string;
  phone: string;
  company: string;
  oppNumber: string;
  currentValidationStatus: string;
  fileName: string;
  saleItems: SaleItem[];
  uploadedData: Record<string, unknown> | null;
  mapping: ColumnMapping | null;
  diffs: DiffField[];
  hasDifferences: boolean;
  isPhoneExcluded: boolean;
}

interface ApprovalQueueTabProps {
  clientId: string;
}

export function ApprovalQueueTab({ clientId }: ApprovalQueueTabProps) {
  const { resolve } = useAgentNameResolver();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [subTab, setSubTab] = useState<"cancellation" | "basket_difference" | "match_errors">("cancellation");
  const [searchQuery, setSearchQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [productOverrides, setProductOverrides] = useState<Record<string, string>>({});
  type QueueSortKey = "date" | "agent" | "opp" | "type";
  type QueueSortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<QueueSortKey>("date");
  const [sortDir, setSortDir] = useState<QueueSortDir>("desc");

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-for-approval", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products-for-dropdown", clientId],
    queryFn: async () => {
      if (clientId === EESY_FM_CLIENT_ID) {
        // Scope products to Eesy FM's campaigns
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);
        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map(c => c.id);
          const { data, error } = await supabase
            .from("products")
            .select("id, name, client_campaign_id")
            .in("client_campaign_id", campaignIds)
            .order("name");
          if (error) throw error;
          // Deduplicate by name, keep first ID per unique name
          const seen = new Map<string, { id: string; name: string }>();
          for (const p of data || []) {
            if (!seen.has(p.name)) seen.set(p.name, { id: p.id, name: p.name });
          }
          return Array.from(seen.values());
        }
      }
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ["cancellation-queue", statusFilter, clientId],
    queryFn: async () => {
      // Pagineret fetch - hent alle rækker i batches
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        let batchQuery = supabase
          .from("cancellation_queue")
          .select("id, sale_id, upload_type, target_product_name, status, reviewed_at, created_at, import_id, uploaded_data, opp_group, client_id")
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);

        if (statusFilter !== "all") {
          batchQuery = batchQuery.eq("status", statusFilter);
        }
        if (clientId) {
          batchQuery = batchQuery.eq("client_id", clientId);
        }

        const { data: batch, error } = await batchQuery;
        if (error) throw error;
        if (!batch || batch.length === 0) break;
        allData.push(...batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }

      const data = allData;
      if (!data || data.length === 0) return { oppGroups: [], flatItems: [] };

      const saleIds = [...new Set(data.map((d) => d.sale_id))];
      const importIds = [...new Set(data.map((d) => d.import_id))];

      const [salesData, importsResult, saleItemsData] = await Promise.all([
        saleIds.length > 0
          ? fetchByIds<any>("sales", "id", saleIds, "id, sale_datetime, customer_phone, customer_company, agent_name, validation_status")
          : [],
        importIds.length > 0
          ? supabase.from("cancellation_imports").select("id, file_name, uploaded_by, config_id").in("id", importIds)
          : { data: [] as any[], error: null },
        saleIds.length > 0
          ? fetchByIds<any>("sale_items", "sale_id", saleIds, "sale_id, quantity, mapped_commission, mapped_revenue, adversus_product_title, product_id")
          : [],
      ]);

      const importsData = (importsResult as any)?.data || importsResult || [];

      const configIds = [...new Set((importsData as any[]).map((i: any) => i.config_id).filter(Boolean))];
      const productIds = [...new Set((saleItemsData as any[]).map((si: any) => si.product_id).filter(Boolean))];

      const [configsResult, productsResult] = await Promise.all([
        configIds.length > 0
          ? supabase.from("cancellation_upload_configs").select("id, product_columns, revenue_column, commission_column, product_match_mode, date_column, phone_excluded_products").in("id", configIds) as any
          : { data: [] },
        productIds.length > 0
          ? fetchByIds<any>("products", "id", productIds, "id, name")
          : [],
      ]);

      const configsMap = new Map<string, ColumnMapping>();
      for (const cfg of (configsResult?.data || [])) {
        const phoneExcluded: string[] = Array.isArray(cfg.phone_excluded_products)
          ? (cfg.phone_excluded_products as any[]).map((p: any) => String(p).toLowerCase().trim())
          : [];
        configsMap.set(cfg.id, {
          product_columns: cfg.product_columns || [],
          revenue_column: cfg.revenue_column,
          commission_column: cfg.commission_column,
          product_match_mode: cfg.product_match_mode || "exact",
          date_column: cfg.date_column || null,
          phone_excluded_products: phoneExcluded,
        });
      }

      const productsMap = new Map<string, string>(
        (productsResult as any[]).map((p: any) => [p.id, p.name])
      );

      const salesMap = new Map((salesData as any[]).map((s: any) => [s.id, s]));
      const importsMap = new Map((importsData as any[]).map((i: any) => [i.id, i]));

      const saleItemsBySale = new Map<string, SaleItem[]>();
      for (const si of saleItemsData as any[]) {
        const items = saleItemsBySale.get(si.sale_id) || [];
        items.push({
          product_name: productsMap.get(si.product_id) || si.adversus_product_title || "Ukendt",
          quantity: si.quantity || 1,
          mapped_commission: si.mapped_commission || 0,
          mapped_revenue: si.mapped_revenue || 0,
        });
        saleItemsBySale.set(si.sale_id, items);
      }

      const flatItems: FlatQueueRow[] = data.map((item) => {
        const sale = salesMap.get(item.sale_id);
        const imp = importsMap.get(item.import_id);
        let saleItems = saleItemsBySale.get(item.sale_id) || [];
        const uploaded = (item.uploaded_data || null) as Record<string, unknown> | null;
        const configId = imp?.config_id;
        const mapping = configId ? configsMap.get(configId) || null : null;
        const saleDateVal = sale?.sale_datetime || "";
        const targetProductName = item.target_product_name || null;

        // For Eesy TM: filter to only the targeted product for cancellation
        if (clientId === CLIENT_IDS["Eesy TM"] && targetProductName) {
          const filtered = saleItems.filter(si =>
            si.product_name.toLowerCase().trim() === targetProductName.toLowerCase().trim()
          );
          if (filtered.length > 0) saleItems = [filtered[0]]; // Kun 1 pr. annullering
        }

        // Check if the matched product is phone_excluded (check both target and real product)
        const phoneExcludedList = mapping?.phone_excluded_products || [];
        const targetProduct = (targetProductName || "").toLowerCase().trim();
        const saleRealProduct = (saleItems[0]?.product_name || "").toLowerCase().trim();
        const isPhoneExcluded = phoneExcludedList.length > 0
          ? phoneExcludedList.some(ep =>
              (targetProduct && (targetProduct.includes(ep) || ep.includes(targetProduct))) ||
              (saleRealProduct && (saleRealProduct.includes(ep) || ep.includes(saleRealProduct)))
            )
          : false;

        const diffs = computeDiff(uploaded, saleItems, mapping, saleDateVal, targetProductName, item.client_id === TDC_ERHVERV_CLIENT_ID);
        if (isPhoneExcluded || item.upload_type === "basket_difference") {
          for (const d of diffs) {
            if (d.isDifferent && mapping?.product_columns?.some(pc => d.label === pc)) {
              d.isExpected = true;
            }
          }
        }

        return {
          ...item,
          opp_group: item.opp_group || null,
          client_id: item.client_id || null,
          saleDate: saleDateVal,
          agentName: sale?.agent_name || "Ukendt",
          phone: sale?.customer_phone || "",
          company: sale?.customer_company || "",
          oppNumber: item.opp_group || "",
          currentValidationStatus: sale?.validation_status || "",
          fileName: imp?.file_name || "",
          saleItems,
          uploadedData: uploaded,
          mapping,
          diffs,
          hasDifferences: diffs.length > 0,
          isPhoneExcluded,
        };
      });

      const tdcItems = flatItems.filter((i) => i.client_id === TDC_ERHVERV_CLIENT_ID && i.opp_group);
      const nonTdcItems = flatItems.filter((i) => !(i.client_id === TDC_ERHVERV_CLIENT_ID && i.opp_group));

      const oppGroupsMap = new Map<string, FlatQueueRow[]>();
      for (const item of tdcItems) {
        const key = item.opp_group!;
        const arr = oppGroupsMap.get(key) || [];
        arr.push(item);
        oppGroupsMap.set(key, arr);
      }

      const oppGroups: OppGroupRow[] = [];
      for (const [oppGroup, items] of oppGroupsMap.entries()) {
        const aggregatedItems: SaleItem[] = [];
        for (const item of items) {
          aggregatedItems.push(...item.saleItems);
        }

        const agents = [...new Set(items.map((i) => i.agentName))];
        const uploaded = items[0]?.uploadedData || null;
        const imp = importsMap.get(items[0]?.import_id);
        const configId = imp?.config_id;
        const mapping = configId ? configsMap.get(configId) || null : null;
        const earliestDate = items.reduce((earliest, i) => {
          if (!i.saleDate) return earliest;
          if (!earliest) return i.saleDate;
          return i.saleDate < earliest ? i.saleDate : earliest;
        }, "" as string);
        const groupTargetProducts = [...new Set(items.map((i) => i.target_product_name).filter(Boolean))];
        const groupTargetProductName = groupTargetProducts.length === 1 ? groupTargetProducts[0] : null;
        const diffs = computeDiff(uploaded, aggregatedItems, mapping, earliestDate, groupTargetProductName, true);
        const isPhoneExcludedGroup = items.some((i) => i.isPhoneExcluded);
        if (isPhoneExcludedGroup || items[0]?.upload_type === "basket_difference") {
          for (const d of diffs) {
            if (d.isDifferent && mapping?.product_columns?.some((pc) => d.label === pc)) {
              d.isExpected = true;
            }
          }
        }

        oppGroups.push({
          oppGroup,
          agents,
          saleCount: items.length,
          saleItems: aggregatedItems,
          uploadedData: uploaded,
          mapping,
          diffs,
          hasDifferences: diffs.length > 0,
          queueItemIds: items.map((i) => i.id),
          saleIds: items.map((i) => i.sale_id),
          uploadType: (items[0]?.upload_type === "both" ? "cancellation" : items[0]?.upload_type) || "cancellation",
          status: items[0]?.status || "pending",
          fileName: items[0]?.fileName || "",
          createdAt: items[0]?.created_at || "",
        });
      }

      return { oppGroups, flatItems: nonTdcItems };
    },
  });

  const oppGroups = queryResult?.oppGroups || [];
  const flatItems = queryResult?.flatItems || [];

  // Duplicate detection: for Eesy TM use sale_id (multiple abos per customer_phone),
  // for other clients use phone
  const isEesyTm = clientId === CLIENT_IDS["Eesy TM"];

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of flatItems) {
      if (item.isPhoneExcluded) continue;
      const key = isEesyTm
        ? `${(item.sale_id || "").trim()}|${(item.target_product_name || "").trim()}|${(item.phone || "").trim()}`
        : (item.phone || "").trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [k, count] of counts) {
      if (count > 1) dupes.add(k);
    }
    return dupes;
  }, [flatItems, isEesyTm]);

  const duplicateCount = useMemo(() => {
    return flatItems.filter(i => {
      if (i.isPhoneExcluded) return false;
      const key = isEesyTm ? `${(i.sale_id || "").trim()}|${(i.target_product_name || "").trim()}|${(i.phone || "").trim()}` : (i.phone || "").trim();
      return duplicateKeys.has(key);
    }).length;
  }, [flatItems, duplicateKeys, isEesyTm]);

  const approveMutation = useMutation({
    mutationFn: async ({ queueItemIds, saleIds, uploadType, overrideProductName, overrideProductId }: { queueItemIds: string[]; saleIds: string[]; uploadType: string; overrideProductName?: string; overrideProductId?: string }) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");
      const newStatus = uploadType === "cancellation" ? "cancelled" : "basket_changed";

      const queueItems = await fetchByIds<any>("cancellation_queue", "id", queueItemIds, "id, sale_id, target_product_name, uploaded_data, client_id");

      // For items without target_product_name, try to resolve from uploaded_data via cancellation_product_mappings
      const PRODUCT_KEYS = ["Subscription Name", "Product", "Produkt", "Abonnement", "Product Name", "Produktnavn"];
      const resolvedQueueItems = [...queueItems];

      const itemsNeedingResolution = resolvedQueueItems.filter((qi: any) => !qi.target_product_name && qi.uploaded_data);
      if (itemsNeedingResolution.length > 0) {
        const cId = itemsNeedingResolution[0]?.client_id || clientId;

        // 1. Try condition-based matching first
        const { data: conditionRows } = await supabase
          .from("cancellation_product_conditions")
          .select("product_id, column_name, operator, values")
          .eq("client_id", cId);

        let conditionResolved = 0;
        if (conditionRows && conditionRows.length > 0) {
          const grouped = groupConditionsByProduct(conditionRows);
          // Get product names for condition product IDs
          const condProductIds = [...new Set(conditionRows.map(r => r.product_id))];
          const condProducts = await fetchByIds<any>("products", "id", condProductIds, "id, name");
          const condProductNames = new Map<string, string>(condProducts.map((p: any) => [p.id, p.name]));

          for (const qi of itemsNeedingResolution) {
            const ud = qi.uploaded_data as Record<string, unknown>;
            // For TDC Erhverv: evaluate against each _product_rows sub-row
            const productRows = ud._product_rows;
            let matchedPid: string | null = null;
            if (Array.isArray(productRows) && productRows.length > 0) {
              for (const subRow of productRows) {
                if (subRow && typeof subRow === "object") {
                  matchedPid = findMatchingProductId(grouped, subRow as Record<string, unknown>);
                  if (matchedPid) break;
                }
              }
            } else {
              matchedPid = findMatchingProductId(grouped, ud);
            }
            if (matchedPid) {
              const pName = condProductNames.get(matchedPid);
              if (pName) {
                qi.target_product_name = pName;
                conditionResolved++;
              }
            }
          }
        }

        // 2. Fallback: legacy cancellation_product_mappings for remaining items
        const stillUnresolved = itemsNeedingResolution.filter((qi: any) => !qi.target_product_name);
        if (stillUnresolved.length > 0) {
          const { data: productMappings } = await supabase
            .from("cancellation_product_mappings")
            .select("excel_product_name, product_id")
            .eq("client_id", cId);

          if (productMappings && productMappings.length > 0) {
            const mappedProductIds = [...new Set(productMappings.map(m => m.product_id))];
            const mappedProducts = await fetchByIds<any>("products", "id", mappedProductIds, "id, name");
            const mappedProductNames = new Map<string, string>(mappedProducts.map((p: any) => [p.id, p.name]));

            const excelToProductName = new Map<string, string>();
            for (const pm of productMappings) {
              const productName = mappedProductNames.get(pm.product_id);
              if (productName) excelToProductName.set(pm.excel_product_name.toLowerCase().trim(), productName);
            }

            for (const qi of stillUnresolved) {
              const ud = qi.uploaded_data as Record<string, unknown>;
              let excelName: string | null = null;
              for (const key of PRODUCT_KEYS) {
                const val = ud[key];
                if (val && typeof val === "string" && val.trim()) { excelName = val.trim(); break; }
              }
              if (!excelName) {
                for (const [k, v] of Object.entries(ud)) {
                  const lower = k.toLowerCase();
                  if ((lower.includes("subscription") || lower.includes("product") || lower.includes("produkt")) && v && typeof v === "string" && v.trim()) {
                    excelName = v.trim(); break;
                  }
                }
              }
              if (excelName) {
                const resolvedName = excelToProductName.get(excelName.toLowerCase().trim());
                if (resolvedName) qi.target_product_name = resolvedName;
              }
            }
          }
        }
      }

      const productLevelItems = resolvedQueueItems.filter((qi: any) => qi.target_product_name);
      const wholeSaleItems = resolvedQueueItems.filter((qi: any) => !qi.target_product_name);

      // Handle basket_difference with product override: update sale_item product instead of cancelling
      if (uploadType === "basket_difference" && (overrideProductId || overrideProductName)) {
        const overrideSaleIds = [...new Set(resolvedQueueItems.map((qi: any) => qi.sale_id))];
        const productQuery = overrideProductId
          ? supabase.from("products").select("id, name, commission_dkk, revenue_dkk").eq("id", overrideProductId).single()
          : supabase.from("products").select("id, name, commission_dkk, revenue_dkk").eq("name", overrideProductName!).maybeSingle();
        const [overrideSaleItems, overrideProduct] = await Promise.all([
          fetchByIds<any>("sale_items", "sale_id", overrideSaleIds, "id, sale_id, product_id, adversus_product_title, mapped_commission, mapped_revenue"),
          productQuery,
        ]);
        
      if (overrideProduct.data) {
          const newProduct = overrideProduct.data;
          const saleItemIds = (overrideSaleItems as any[]).map((si: any) => si.id);

          if (saleItemIds.length > 0) {
            // 1. Snapshot current values for audit trail
            const logEntries = (overrideSaleItems as any[]).map((si: any) => ({
              sale_item_id: si.id,
              sale_id: si.sale_id,
              cancellation_queue_id: resolvedQueueItems[0]?.id || null,
              old_product_id: si.product_id,
              new_product_id: newProduct.id,
              old_product_name: si.adversus_product_title || null,
              new_product_name: newProduct.name,
              old_commission: si.mapped_commission ?? null,
              old_revenue: si.mapped_revenue ?? null,
              changed_by: currentEmployee.id,
              change_reason: "basket_difference_approval",
            }));
            await supabase.from("product_change_log").insert(logEntries as any);

            // 2. Update product on sale_items (price will be set by rematch)
            await supabase.from("sale_items").update({
              product_id: newProduct.id,
              adversus_product_title: newProduct.name,
            } as any).in("id", saleItemIds);

            // 3. Trigger campaign-aware repricing via edge function
            await supabase.functions.invoke("rematch-pricing-rules", {
              body: { sale_ids: overrideSaleIds },
            });

            // 4. Read back new prices and update the log
            const { data: updatedItems } = await supabase
              .from("sale_items")
              .select("id, mapped_commission, mapped_revenue")
              .in("id", saleItemIds);
            if (updatedItems) {
              for (const ui of updatedItems) {
                await supabase.from("product_change_log").update({
                  new_commission: (ui as any).mapped_commission,
                  new_revenue: (ui as any).mapped_revenue,
                } as any).eq("sale_item_id", ui.id).is("rolled_back_at", null).order("created_at", { ascending: false }).limit(1);
              }
            }
          }
        }

        // Mark queue items as approved
        const { error: approveError } = await supabase.from("cancellation_queue").update({
          status: "approved",
          reviewed_by: currentEmployee.id,
          reviewed_at: new Date().toISOString(),
        }).in("id", queueItemIds);
        if (approveError) throw approveError;

        return { count: queueItemIds.length };
      }

      if (productLevelItems.length > 0) {
        const productSaleIds = [...new Set(productLevelItems.map((qi: any) => qi.sale_id))];
        
        const [allSaleItems, allProducts] = await Promise.all([
          fetchByIds<any>("sale_items", "sale_id", productSaleIds, "id, sale_id, product_id, adversus_product_title, is_cancelled"),
          (async () => {
            const saleItemsForProducts = await fetchByIds<any>("sale_items", "sale_id", productSaleIds, "product_id");
            const pIds = [...new Set(saleItemsForProducts.map((si: any) => si.product_id).filter(Boolean))];
            return pIds.length > 0 ? fetchByIds<any>("products", "id", pIds, "id, name") : [];
          })(),
        ]);

        const productNamesMap = new Map<string, string>(allProducts.map((p: any) => [p.id, p.name]));

        const saleItemsBySaleId = new Map<string, any[]>();
        for (const si of allSaleItems) {
          const arr = saleItemsBySaleId.get(si.sale_id) || [];
          arr.push(si);
          saleItemsBySaleId.set(si.sale_id, arr);
        }

        const itemsToCancel: string[] = [];
        const salesToCheckAllCancelled: string[] = [];

        for (const qi of productLevelItems) {
          const saleItems = saleItemsBySaleId.get(qi.sale_id) || [];
          const targetName = qi.target_product_name.toLowerCase().trim();
          const matchingItem = saleItems.find((si: any) => {
            const name = (productNamesMap.get(si.product_id) || si.adversus_product_title || "").toLowerCase().trim();
            return name === targetName;
          });
          if (matchingItem) {
            itemsToCancel.push(matchingItem.id);
          }
          salesToCheckAllCancelled.push(qi.sale_id);
        }

        if (itemsToCancel.length > 0) {
          await supabase.from("sale_items").update({ is_cancelled: true } as any).in("id", itemsToCancel);
        }

        const uniqueSalesToCheck = [...new Set(salesToCheckAllCancelled)];
        const updatedSaleItems = await fetchByIds<any>("sale_items", "sale_id", uniqueSalesToCheck, "id, sale_id, is_cancelled");
        
        const saleItemsAfterUpdate = new Map<string, any[]>();
        for (const si of updatedSaleItems) {
          const arr = saleItemsAfterUpdate.get(si.sale_id) || [];
          arr.push(si);
          saleItemsAfterUpdate.set(si.sale_id, arr);
        }

        const fullyCanelledSaleIds = uniqueSalesToCheck.filter(saleId => {
          const items = saleItemsAfterUpdate.get(saleId) || [];
          return items.length > 0 && items.every((si: any) => si.is_cancelled === true);
        });

        if (fullyCanelledSaleIds.length > 0) {
          await supabase.from("sales").update({ validation_status: "cancelled" }).in("id", fullyCanelledSaleIds);
        }
      }

      const wholeSaleIds: string[] = Array.from(new Set<string>(wholeSaleItems.map((qi: any) => String(qi.sale_id))));
      if (wholeSaleIds.length > 0) {
        const { error } = await supabase.from("sales").update({ validation_status: newStatus } as any).in("id", wholeSaleIds);
        if (error) throw error;
      }

      const { error: approveError } = await supabase.from("cancellation_queue").update({
        status: "approved",
        reviewed_by: currentEmployee.id,
        reviewed_at: new Date().toISOString(),
      }).in("id", queueItemIds);
      if (approveError) throw approveError;

      return { count: queueItemIds.length };
    },
    onSuccess: ({ count }) => {
      toast({ title: "Godkendt", description: `${count} items er godkendt.` });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["approved-queue"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");
      const { error } = await supabase.from("cancellation_queue").update({
        status: "rejected",
        reviewed_by: currentEmployee.id,
        reviewed_at: new Date().toISOString(),
      }).in("id", itemIds);
      if (error) throw error;
      return { count: itemIds.length };
    },
    onSuccess: ({ count }) => {
      toast({ title: "Afvist", description: `${count} items er afvist.` });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const filteredOppGroups = onlyDifferences ? oppGroups.filter((g) => g.hasDifferences) : oppGroups;
  let filteredFlatItems = onlyDifferences ? flatItems.filter((i) => i.hasDifferences) : flatItems;
  if (onlyDuplicates) {
    filteredFlatItems = filteredFlatItems.filter(i => {
      const key = isEesyTm ? `${(i.sale_id || "").trim()}|${(i.target_product_name || "").trim()}` : (i.phone || "").trim();
      return duplicateKeys.has(key);
    });
  }

  const resolveUploadType = (t: string | null | undefined) => t === "both" ? "cancellation" : t;
  const subOppGroups = useMemo(() => filteredOppGroups.filter((g) => resolveUploadType(g.uploadType) === subTab), [filteredOppGroups, subTab]);
  const subFlatItems = useMemo(() => filteredFlatItems.filter((i) => resolveUploadType(i.upload_type) === subTab), [filteredFlatItems, subTab]);

  const allSellers = useMemo(() => {
    const names = new Set<string>();
    filteredOppGroups.forEach(g => g.agents.forEach(a => names.add(a)));
    filteredFlatItems.forEach(i => names.add(i.agentName));
    return [...names].sort();
  }, [filteredOppGroups, filteredFlatItems]);

  const filterAndSort = <T extends { agentName?: string; agents?: string[]; oppNumber?: string; oppGroup?: string; phone?: string; company?: string; saleDate?: string; createdAt?: string; fileName?: string }>(
    items: T[],
    getAgent: (item: T) => string,
    getSearchStr: (item: T) => string,
    getDateStr: (item: T) => string,
  ): T[] => {
    let result = [...items];

    if (sellerFilter !== "all") {
      result = result.filter(item => {
        const agent = getAgent(item);
        return agent === sellerFilter || (item as any).agents?.includes(sellerFilter);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => getSearchStr(item).toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = (getDateStr(a)).localeCompare(getDateStr(b));
          break;
        case "agent":
          cmp = getAgent(a).localeCompare(getAgent(b));
          break;
        case "opp":
          cmp = ((a as any).oppNumber || (a as any).oppGroup || "").localeCompare((b as any).oppNumber || (b as any).oppGroup || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  };

  const processedOppGroups = useMemo(() =>
    filterAndSort(
      subOppGroups,
      g => g.agents.join(", "),
      g => [g.oppGroup, ...g.agents, g.fileName].join(" "),
      g => g.createdAt,
    ),
    [subOppGroups, sellerFilter, searchQuery, sortKey, sortDir]);

  const processedFlatItems = useMemo(() =>
    filterAndSort(
      subFlatItems,
      i => i.agentName,
      i => [i.agentName, i.oppNumber, i.phone, i.company, i.fileName].join(" "),
      i => i.saleDate,
    ),
    [subFlatItems, sellerFilter, searchQuery, sortKey, sortDir]);

  const cancellationCount = useMemo(() =>
    filteredOppGroups.filter((g) => resolveUploadType(g.uploadType) === "cancellation").length +
    filteredFlatItems.filter((i) => resolveUploadType(i.upload_type) === "cancellation").length,
    [filteredOppGroups, filteredFlatItems]);
  const basketCount = useMemo(() =>
    filteredOppGroups.filter((g) => resolveUploadType(g.uploadType) === "basket_difference").length +
    filteredFlatItems.filter((i) => resolveUploadType(i.upload_type) === "basket_difference").length,
    [filteredOppGroups, filteredFlatItems]);
  const correctMatchCount = useMemo(() =>
    filteredOppGroups.filter((g) => resolveUploadType(g.uploadType) === "correct_match").length +
    filteredFlatItems.filter((i) => resolveUploadType(i.upload_type) === "correct_match").length,
    [filteredOppGroups, filteredFlatItems]);

  const { data: activeImport } = useQuery({
    queryKey: ["active-import-info", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: imports } = await supabase
        .from("cancellation_imports")
        .select("id, file_name, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!imports?.length) return null;
      const { data: pendingItems } = await supabase
        .from("cancellation_queue")
        .select("import_id")
        .in("import_id", imports.map(d => d.id))
        .eq("status", "pending");
      if (!pendingItems?.length) return null;
      const pendingImportId = pendingItems[0].import_id;
      const pendingCount = pendingItems.filter(p => p.import_id === pendingImportId).length;
      const imp = imports.find(d => d.id === pendingImportId);
      return imp ? { ...imp, pendingCount } : null;
    },
  });

  const { data: matchErrorsCount = 0 } = useQuery({
    queryKey: ["match-errors-count", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: imports } = await supabase
        .from("cancellation_imports")
        .select("unmatched_rows")
        .eq("client_id", clientId)
        .not("unmatched_rows", "is", null);
      if (!imports?.length) return 0;
      return imports.reduce((sum, imp) => {
        const rows = imp.unmatched_rows as unknown[];
        return sum + (Array.isArray(rows) ? rows.length : 0);
      }, 0);
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const pendingOppGroups = processedOppGroups.filter((g) => g.status === "pending");
  const pendingFlatItems = processedFlatItems.filter((i) => i.status === "pending");
  const totalPending = pendingOppGroups.length + pendingFlatItems.length;
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleSort = (key: QueueSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const QueueSortIcon = ({ column }: { column: QueueSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleApproveAllPending = () => {
    for (const g of pendingOppGroups) {
      approveMutation.mutate({ queueItemIds: g.queueItemIds, saleIds: g.saleIds, uploadType: g.uploadType });
    }
    for (const item of pendingFlatItems) {
      approveMutation.mutate({ queueItemIds: [item.id], saleIds: [item.sale_id], uploadType: item.upload_type });
    }
  };

  const handleRejectAllPending = () => {
    const allIds = [
      ...pendingOppGroups.flatMap((g) => g.queueItemIds),
      ...pendingFlatItems.map((i) => i.id),
    ];
    if (allIds.length > 0) rejectMutation.mutate(allIds);
  };

  const totalItems = processedOppGroups.length + processedFlatItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useMemo(() => {
    setCurrentPage(1);
  }, [statusFilter, onlyDifferences, onlyDuplicates, subTab, searchQuery, sellerFilter]);

  const paginatedOppGroups = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    if (start >= processedOppGroups.length) return [];
    return processedOppGroups.slice(start, Math.min(end, processedOppGroups.length));
  }, [processedOppGroups, safeCurrentPage]);

  const paginatedFlatItems = useMemo(() => {
    const oppCount = processedOppGroups.length;
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const flatStart = Math.max(0, start - oppCount);
    const flatEnd = Math.max(0, end - oppCount);
    if (flatStart >= processedFlatItems.length) return [];
    return processedFlatItems.slice(flatStart, Math.min(flatEnd, processedFlatItems.length));
  }, [processedFlatItems, processedOppGroups.length, safeCurrentPage]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">
          Side {safeCurrentPage} af {totalPages} ({totalItems} rækker)
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Forrige
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
          >
            Næste
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (processedOppGroups.length === 0 && processedFlatItems.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          {searchQuery || sellerFilter !== "all"
            ? "Ingen resultater matcher din søgning/filter."
            : onlyDifferences ? "Ingen salg med forskelle fundet." : `Ingen ${statusFilter === "pending" ? "ventende" : ""} items i køen.`}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {paginatedOppGroups.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">TDC Erhverv – OPP-grupperet</h3>
            <div className="rounded-md border max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort("opp")}>
                       <span className="flex items-center">OPP <QueueSortIcon column="opp" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort("agent")}>
                       <span className="flex items-center">Sælgere <QueueSortIcon column="agent" /></span>
                     </TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>System (aggregeret)</TableHead>
                     <TableHead>Uploadet data</TableHead>
                     <TableHead>Forskelle</TableHead>
                     <TableHead>Status</TableHead>
                     {statusFilter === "pending" && <TableHead>Handlinger</TableHead>}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOppGroups.map((g) => {
                    const summarizedItems = summarizeSaleItems(g.saleItems);
                    const uploadedPreview = buildUploadedPreview(g.uploadedData, g.mapping, clientId);
                    return (
                      <TableRow key={g.oppGroup}>
                        <TableCell className="font-mono text-xs">{g.oppGroup}</TableCell>
                        <TableCell className="text-xs align-top">
                          {g.agents.map(a => resolve(a)).join(", ")}
                          <div className="text-muted-foreground">({g.saleCount} salg)</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={g.uploadType === "cancellation" ? "destructive" : g.uploadType === "correct_match" ? "default" : "secondary"}>
                            {g.uploadType === "cancellation" ? "Annullering" : g.uploadType === "correct_match" ? "Korrekt match" : "Kurv diff."}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs min-w-[300px] align-top">
                          {summarizedItems.length > 0 ? (
                            <div className="space-y-2">
                              <div className="font-medium">Produkter solgt</div>
                              <div className="flex flex-wrap gap-1.5">
                                {summarizedItems.map((si, idx) => (
                                  <Badge key={`${si.product_name}-${idx}`} variant="outline" className="whitespace-normal break-words text-left h-auto py-1">
                                    {si.product_name} ×{si.quantity}
                                  </Badge>
                                ))}
                              </div>
                              <div className="text-muted-foreground">
                                Oms: {summarizedItems.reduce((s, si) => s + si.mapped_revenue, 0).toFixed(0)} kr
                                {" | "}
                                Provi: {summarizedItems.reduce((s, si) => s + si.mapped_commission, 0).toFixed(0)} kr
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Ingen produkter</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs min-w-[260px] align-top">
                          {(() => {
                            if (clientId === TDC_ERHVERV_CLIENT_ID) {
                              const structured = buildTdcUploadedStructured(g.uploadedData);
                              if (structured) {
                                return (
                                  <div className="space-y-2">
                                    {structured.products.length > 0 && (
                                      <>
                                        <div className="font-medium">Produkter</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {structured.products.map((p, idx) => (
                                            <Badge key={`${p.name}-${idx}`} variant="outline" className="whitespace-normal break-words text-left h-auto py-1">
                                              {p.name} ×{p.quantity}
                                            </Badge>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                    <div className="text-muted-foreground border-t pt-1 mt-1 flex gap-3 text-xs">
                                      {structured.cpoTotal && <span>CPO Total: {structured.cpoTotal} kr</span>}
                                      {structured.ttTrin !== "" && <span>TT trin: {structured.ttTrin}</span>}
                                      {structured.kampagnePris !== "" && <span>Kampagne pris: {structured.kampagnePris}</span>}
                                    </div>
                                  </div>
                                );
                              }
                            }
                            return uploadedPreview.length > 0 ? (
                              <div className="space-y-1 max-h-32 overflow-auto">
                                {uploadedPreview.map((field) => (
                                  <div key={field.label} className="leading-relaxed break-words">
                                    <span className="text-muted-foreground">{field.label}:</span> {field.value}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs min-w-[220px] align-top">
                          {g.diffs.length > 0 ? (
                            <div className="space-y-1">
                              {g.diffs.map((d, idx) => {
                                const tone = getDiffTone(d);
                                return (
                                  <div key={idx} className={`p-1 rounded border ${tone.container}`}>
                                    <div className={`font-medium ${tone.text}`}>
                                      {tone.icon} {d.label}
                                    </div>
                                    <div>System: <span className="font-mono">{d.systemValue}</span></div>
                                    <div>Upload: <span className="font-mono">{d.uploadedValue}</span></div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <Badge variant="outline">✓ Match</Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={g.status === "approved" ? "default" : g.status === "rejected" ? "destructive" : "secondary"}>
                            {g.status === "pending" ? "Ventende" : g.status === "approved" ? "Godkendt" : "Afvist"}
                          </Badge>
                        </TableCell>
                        {statusFilter === "pending" && (
                          <TableCell className="align-top">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => approveMutation.mutate({ queueItemIds: g.queueItemIds, saleIds: g.saleIds, uploadType: g.uploadType })} disabled={isPending}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => rejectMutation.mutate(g.queueItemIds)} disabled={isPending}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {paginatedFlatItems.length > 0 && (
          <div>
            {paginatedOppGroups.length > 0 && (
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Andre kunder – per salg</h3>
            )}
            <div className="rounded-md border max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                       <span className="flex items-center">Salgsdato <QueueSortIcon column="date" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort("agent")}>
                       <span className="flex items-center">Sælger <QueueSortIcon column="agent" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort("opp")}>
                       <span className="flex items-center">OPP <QueueSortIcon column="opp" /></span>
                     </TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>System data</TableHead>
                     <TableHead>Uploadet data</TableHead>
                     <TableHead>Forskelle</TableHead>
                     <TableHead>Status</TableHead>
                     {statusFilter === "pending" && <TableHead>Handlinger</TableHead>}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFlatItems.map((item) => {
                    const summarizedItems = summarizeSaleItems(item.saleItems);
                    const uploadedPreview = buildUploadedPreview(item.uploadedData, item.mapping, clientId);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.saleDate ? format(new Date(item.saleDate), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                        <TableCell>{resolve(item.agentName)}</TableCell>
                        <TableCell>{item.oppNumber || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={item.upload_type === "cancellation" ? "destructive" : item.upload_type === "correct_match" ? "default" : "secondary"}>
                              {item.upload_type === "cancellation" ? "Annullering" : item.upload_type === "correct_match" ? "Korrekt match" : "Kurv diff."}
                            </Badge>
                            {(() => {
                              const dupeKey = isEesyTm ? `${(item.sale_id || "").trim()}|${(item.target_product_name || "").trim()}` : (item.phone || "").trim();
                              return !item.isPhoneExcluded && duplicateKeys.has(dupeKey) && dupeKey && (
                                <Badge className="bg-orange-500/15 text-orange-700 border-orange-300">Dublet</Badge>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs min-w-[280px] align-top">
                          {summarizedItems.length > 0 ? (
                            <div className="space-y-2">
                              <div className="font-medium">Produkter solgt</div>
                              <div className="flex flex-wrap gap-1.5">
                                {summarizedItems.map((si, idx) => (
                                  <Badge key={`${si.product_name}-${idx}`} variant="outline" className="whitespace-normal break-words text-left h-auto py-1">
                                    {si.product_name} ×{si.quantity}
                                  </Badge>
                                ))}
                              </div>
                              <div className="text-muted-foreground">
                                Oms: {summarizedItems.reduce((s, si) => s + si.mapped_revenue, 0).toFixed(0)} kr
                                {" | "}
                                Provi: {summarizedItems.reduce((s, si) => s + si.mapped_commission, 0).toFixed(0)} kr
                              </div>
                              {item.upload_type === "basket_difference" && item.status === "pending" && clientProducts.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <div className="font-medium text-muted-foreground mb-1">Ret produkt til:</div>
                                  <Select
                                    value={productOverrides[item.id] || (clientId === EESY_FM_CLIENT_ID ? (clientProducts.find(p => p.name === (summarizedItems[0]?.product_name))?.id || "") : (summarizedItems[0]?.product_name || ""))}
                                    onValueChange={(val) => setProductOverrides(prev => ({ ...prev, [item.id]: val }))}
                                  >
                                    <SelectTrigger className="w-full h-8 text-xs">
                                      <SelectValue placeholder="Vælg produkt" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        if (clientId === EESY_FM_CLIENT_ID) {
                                          // Show all campaign-scoped products by ID (already deduplicated)
                                          return clientProducts.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                          ));
                                        }
                                        const filtered = clientProducts.filter(p => p.name === item.target_product_name);
                                        const productsToShow = filtered.length > 0 ? filtered : clientProducts;
                                        return productsToShow.map((p) => (
                                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                        ));
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Ingen produkter</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs min-w-[260px] align-top">
                          {uploadedPreview.length > 0 ? (
                            <div className="space-y-1 max-h-32 overflow-auto">
                              {uploadedPreview.map((field) => (
                                <div key={field.label} className="leading-relaxed break-words">
                                  <span className="text-muted-foreground">{field.label}:</span> {field.value}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs min-w-[220px] align-top">
                          {item.diffs.length > 0 ? (
                            <div className="space-y-1">
                              {item.diffs.map((d, idx) => {
                                const tone = getDiffTone(d);
                                return (
                                  <div key={idx} className={`p-1 rounded border ${tone.container}`}>
                                    <div className={`font-medium ${tone.text}`}>
                                      {tone.icon} {d.label}
                                    </div>
                                    <div>System: <span className="font-mono">{d.systemValue}</span></div>
                                    <div>Upload: <span className="font-mono">{d.uploadedValue}</span></div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Ingen forskelle</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "approved" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>
                            {item.status === "pending" ? "Ventende" : item.status === "approved" ? "Godkendt" : "Afvist"}
                          </Badge>
                        </TableCell>
                        {statusFilter === "pending" && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => approveMutation.mutate({ queueItemIds: [item.id], saleIds: [item.sale_id], uploadType: item.upload_type, ...(clientId === EESY_FM_CLIENT_ID ? { overrideProductId: productOverrides[item.id] } : { overrideProductName: productOverrides[item.id] }) })} disabled={isPending}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => rejectMutation.mutate([item.id])} disabled={isPending}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {renderPagination()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {activeImport && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Igangværende upload</p>
              <p className="text-xs text-muted-foreground truncate">{activeImport.file_name}</p>
              <p className="text-xs text-muted-foreground">
                Uploadet {format(new Date(activeImport.created_at), "dd/MM/yyyy HH:mm", { locale: da })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {activeImport.pendingCount} rækker afventer
              </Badge>
              {matchErrorsCount > 0 && (
                <Badge variant="outline" className="border-orange-400 text-orange-600 bg-orange-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {matchErrorsCount} fejl i match
                </Badge>
              )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Nulstil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Nulstil upload?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Er du sikker på at du vil nulstille dette upload? Alle ventende rækker og fejl i match vil blive fjernet. Allerede godkendte ændringer bevares.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        const importId = activeImport.id;
                        const { error: deleteError } = await supabase
                          .from("cancellation_queue")
                          .delete()
                          .eq("import_id", importId)
                          .eq("status", "pending");
                        if (deleteError) throw deleteError;

                        const { error: updateError } = await supabase
                          .from("cancellation_imports")
                          .update({ unmatched_rows: null })
                          .eq("id", importId);
                        if (updateError) throw updateError;

                        toast({
                          title: "Upload nulstillet",
                          description: "Alle ventende rækker og fejl i match er fjernet. Du kan nu uploade en ny fil.",
                        });
                        queryClient.invalidateQueries({ queryKey: ["active-import-info"] });
                        queryClient.invalidateQueries({ queryKey: ["active-import-block"] });
                        queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
                        queryClient.invalidateQueries({ queryKey: ["match-errors"] });
                        queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
                      } catch (err: any) {
                        toast({ title: "Fejl", description: err.message, variant: "destructive" });
                      }
                    }}
                  >
                    Ja, nulstil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Slet
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Slet upload og rul alt tilbage?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dette vil slette uploaden "{activeImport.file_name}" og rulle alle ændringer tilbage – inkl. godkendte annulleringer og kurvrettelser. Salg vil blive gendannet til deres oprindelige status.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.rpc("rollback_cancellation_import", {
                          p_import_id: activeImport.id,
                        });
                        if (error) throw error;
                        const result = data as any;
                        toast({
                          title: "Upload slettet og rullet tilbage",
                          description: `${result?.reversed_approved || 0} godkendte blev rullet tilbage, ${result?.removed_pending || 0} afventende fjernet.`,
                        });
                        queryClient.invalidateQueries({ queryKey: ["active-import-info"] });
                        queryClient.invalidateQueries({ queryKey: ["active-import-block"] });
                        queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
                        queryClient.invalidateQueries({ queryKey: ["match-errors"] });
                      } catch (err: any) {
                        toast({ title: "Fejl", description: err.message, variant: "destructive" });
                      }
                    }}
                  >
                    Ja, slet og rul tilbage
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Godkendelseskø
              </CardTitle>
              <CardDescription>
                Gennemse og godkend/afvis uploadede annulleringer og kurv-rettelser.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-dupes"
                  checked={onlyDuplicates}
                  onCheckedChange={(checked) => setOnlyDuplicates(!!checked)}
                />
                <label htmlFor="only-dupes" className="text-sm cursor-pointer">
                  Kun dubletter {duplicateCount > 0 && `(${duplicateCount})`}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-diff"
                  checked={onlyDifferences}
                  onCheckedChange={(checked) => setOnlyDifferences(!!checked)}
                />
                <label htmlFor="only-diff" className="text-sm cursor-pointer">Kun forskelle</label>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ventende</SelectItem>
                    <SelectItem value="approved">Godkendte</SelectItem>
                    <SelectItem value="rejected">Afviste</SelectItem>
                    <SelectItem value="all">Alle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle sælgere" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle sælgere</SelectItem>
                    {allSellers.map(name => (
                      <SelectItem key={name} value={name}>{resolve(name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="relative max-w-sm mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg i alle felter..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "cancellation" | "basket_difference" | "match_errors")}>
              <TabsList>
                <TabsTrigger value="cancellation">
                  Annulleringer {cancellationCount > 0 && `(${cancellationCount})`}
                </TabsTrigger>
                <TabsTrigger value="basket_difference">
                  Kurv-rettelser {basketCount > 0 && `(${basketCount})`}
                </TabsTrigger>
                <TabsTrigger value="match_errors">
                  Fejl i match {matchErrorsCount > 0 && `(${matchErrorsCount})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cancellation" className="mt-4">
                {renderTable()}
                {statusFilter === "pending" && totalPending > 0 && (
                  <div className="flex justify-end mt-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="default" disabled={isPending}>
                          <Check className="h-4 w-4 mr-1" /> Godkend alle
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Bekræft godkendelse</AlertDialogTitle>
                          <AlertDialogDescription>
                            Er du sikker på at du vil godkende alle ventende rækker?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuller</AlertDialogCancel>
                          <AlertDialogAction onClick={handleApproveAllPending}>Godkend alle</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="basket_difference" className="mt-4">
                {renderTable()}
                {statusFilter === "pending" && totalPending > 0 && (
                  <div className="flex justify-end mt-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="default" disabled={isPending}>
                          <Check className="h-4 w-4 mr-1" /> Godkend alle
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Bekræft godkendelse</AlertDialogTitle>
                          <AlertDialogDescription>
                            Er du sikker på at du vil godkende alle ventende rækker?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuller</AlertDialogCancel>
                          <AlertDialogAction onClick={handleApproveAllPending}>Godkend alle</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </TabsContent>


              <TabsContent value="match_errors" className="mt-4">
                <MatchErrorsSubTab clientId={clientId} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
