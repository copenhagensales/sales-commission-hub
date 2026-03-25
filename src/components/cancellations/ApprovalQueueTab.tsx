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
import { Check, X, Loader2, Clock, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
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
import { FileSpreadsheet, AlertTriangle } from "lucide-react";

const TDC_ERHVERV_CLIENT_ID = CLIENT_IDS["TDC Erhverv"];

interface DiffField {
  label: string;
  systemValue: string;
  uploadedValue: string;
  isDifferent: boolean;
}

interface ColumnMapping {
  product_columns: string[];
  revenue_column: string | null;
  commission_column: string | null;
  product_match_mode: string;
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

function extractOpp(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object") return "";
  const rp = rawPayload as Record<string, unknown>;
  if (rp["legacy_opp_number"]) return String(rp["legacy_opp_number"]);
  const fields = rp["leadResultFields"] as Record<string, unknown> | undefined;
  if (fields?.["OPP nr"]) return String(fields["OPP nr"]);
  if (fields?.["OPP-nr"]) return String(fields["OPP-nr"]);
  const dataArr = rp["leadResultData"] as Array<{ label?: string; value?: string }> | undefined;
  if (Array.isArray(dataArr)) {
    const found = dataArr.find((d) => d.label === "OPP nr" || d.label === "OPP-nr");
    if (found?.value) return String(found.value);
  }
  return "";
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

function computeDiff(
  uploadedData: Record<string, unknown> | null,
  saleItems: SaleItem[],
  mapping: ColumnMapping | null,
): DiffField[] {
  if (!uploadedData || Object.keys(uploadedData).length === 0) return [];
  if (!mapping) return [];

  const diffs: DiffField[] = [];
  const systemRevenue = saleItems.reduce((sum, si) => sum + (si.mapped_revenue || 0), 0);
  const systemCommission = saleItems.reduce((sum, si) => sum + (si.mapped_commission || 0), 0);

  if (mapping.revenue_column) {
    const val = uploadedData[mapping.revenue_column];
    if (!isIrrelevantValue(val)) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal) && Math.abs(uploadedVal - systemRevenue) > 1) {
        diffs.push({
          label: `Omsætning (${mapping.revenue_column})`,
          systemValue: `${systemRevenue.toFixed(0)} kr`,
          uploadedValue: `${uploadedVal.toFixed(0)} kr`,
          isDifferent: true,
        });
      }
    }
  }

  if (mapping.commission_column) {
    const val = uploadedData[mapping.commission_column];
    if (!isIrrelevantValue(val)) {
      const uploadedVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", "."));
      if (!isNaN(uploadedVal) && Math.abs(uploadedVal - systemCommission) > 1) {
        diffs.push({
          label: `Provision (${mapping.commission_column})`,
          systemValue: `${systemCommission.toFixed(0)} kr`,
          uploadedValue: `${uploadedVal.toFixed(0)} kr`,
          isDifferent: true,
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
        if (Math.abs(uploadedQty - systemQty) > 0.01) {
          diffs.push({ label: colName, systemValue: `${systemQty}`, uploadedValue: `${uploadedQty}`, isDifferent: true });
        }
      } else {
        const uploadedProduct = String(val).trim();
        const normalizedUploaded = normalizeProductName(uploadedProduct, matchMode);
        const matchesAny = systemProducts.some((sp) => normalizeProductName(sp, matchMode) === normalizedUploaded);
        if (!matchesAny && systemProducts.length > 0) {
          diffs.push({ label: colName, systemValue: systemProducts.join(", ") || "-", uploadedValue: uploadedProduct, isDifferent: true });
        }
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

function buildUploadedPreview(
  uploadedData: Record<string, unknown> | null,
  mapping: ColumnMapping | null,
): PreviewField[] {
  if (!uploadedData || Object.keys(uploadedData).length === 0) return [];

  const fields: PreviewField[] = [];
  const seen = new Set<string>();

  const addField = (label: string, value: unknown) => {
    const rendered = value == null ? "" : String(value).trim();
    if (!rendered || seen.has(label)) return;
    fields.push({ label, value: rendered });
    seen.add(label);
  };

  // Show product names from _product_rows if available (TDC multi-row OPPs)
  const productRows = uploadedData._product_rows as Record<string, unknown>[] | undefined;
  if (productRows && productRows.length > 0) {
    const productNames = productRows
      .map(r => String(r["Produkt"] || r["produkt"] || "").trim())
      .filter(Boolean);
    if (productNames.length > 0) {
      addField("Produkter", productNames.join(", "));
    }
  }

  mapping?.product_columns?.forEach((column) => {
    const value = uploadedData[column];
    if (!isIrrelevantValue(value)) addField(column, value);
  });

  if (mapping?.revenue_column && !isIrrelevantValue(uploadedData[mapping.revenue_column])) {
    addField(mapping.revenue_column, uploadedData[mapping.revenue_column]);
  }

  if (mapping?.commission_column && !isIrrelevantValue(uploadedData[mapping.commission_column])) {
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
  const [subTab, setSubTab] = useState<"cancellation" | "basket_difference" | "match_errors">("cancellation");
  const [searchQuery, setSearchQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("all");
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

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ["cancellation-queue", statusFilter, clientId],
    queryFn: async () => {
      let query = supabase
        .from("cancellation_queue")
        .select(`id, sale_id, upload_type, status, reviewed_at, created_at, import_id`)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      const queueIds = data.map((d) => d.id);
      let extendedDataMap = new Map<string, { uploaded_data: Record<string, unknown> | null; opp_group: string | null; client_id: string | null }>();
      if (queueIds.length > 0) {
        const { data: rawData } = await supabase
          .from("cancellation_queue")
          .select("id, uploaded_data, opp_group, client_id")
          .in("id", queueIds) as any;
        if (rawData) {
          for (const r of rawData) {
            extendedDataMap.set(r.id, { uploaded_data: r.uploaded_data, opp_group: r.opp_group, client_id: r.client_id });
          }
        }
      }

      const saleIds = [...new Set(data.map((d) => d.sale_id))];
      const importIds = [...new Set(data.map((d) => d.import_id))];

      const [salesResult, importsResult, saleItemsResult] = await Promise.all([
        saleIds.length > 0
          ? supabase.from("sales").select("id, sale_datetime, customer_phone, customer_company, agent_name, validation_status, raw_payload").in("id", saleIds)
          : { data: [] as any[], error: null },
        importIds.length > 0
          ? supabase.from("cancellation_imports").select("id, file_name, uploaded_by, config_id").in("id", importIds)
          : { data: [] as any[], error: null },
        saleIds.length > 0
          ? supabase.from("sale_items").select("sale_id, quantity, mapped_commission, mapped_revenue, adversus_product_title, product_id").in("sale_id", saleIds)
          : { data: [] as any[], error: null },
      ]);

      const configIds = [...new Set((importsResult.data || []).map((i: any) => i.config_id).filter(Boolean))];
      const configsMap = new Map<string, ColumnMapping>();
      if (configIds.length > 0) {
        const { data: configs } = await supabase
          .from("cancellation_upload_configs")
          .select("id, product_columns, revenue_column, commission_column, product_match_mode")
          .in("id", configIds) as any;
        if (configs) {
          for (const cfg of configs) {
            configsMap.set(cfg.id, {
              product_columns: cfg.product_columns || [],
              revenue_column: cfg.revenue_column,
              commission_column: cfg.commission_column,
              product_match_mode: cfg.product_match_mode || "exact",
            });
          }
        }
      }

      const productIds = [...new Set((saleItemsResult.data || []).map((si) => si.product_id).filter(Boolean))];
      let productsMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
        if (products) productsMap = new Map(products.map((p) => [p.id, p.name]));
      }

      const salesMap = new Map((salesResult.data || []).map((s) => [s.id, s]));
      const importsMap = new Map((importsResult.data || []).map((i: any) => [i.id, i]));

      const saleItemsBySale = new Map<string, SaleItem[]>();
      for (const si of saleItemsResult.data || []) {
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
        const saleItems = saleItemsBySale.get(item.sale_id) || [];
        const ext = extendedDataMap.get(item.id);
        const uploaded = (ext?.uploaded_data || null) as Record<string, unknown> | null;
        const configId = imp?.config_id;
        const mapping = configId ? configsMap.get(configId) || null : null;
        const diffs = computeDiff(uploaded, saleItems, mapping);

        return {
          ...item,
          opp_group: ext?.opp_group || null,
          client_id: ext?.client_id || null,
          saleDate: sale?.sale_datetime || "",
          agentName: sale?.agent_name || "Ukendt",
          phone: sale?.customer_phone || "",
          company: sale?.customer_company || "",
          oppNumber: extractOpp(sale?.raw_payload),
          currentValidationStatus: sale?.validation_status || "",
          fileName: imp?.file_name || "",
          saleItems,
          uploadedData: uploaded,
          mapping,
          diffs,
          hasDifferences: diffs.length > 0,
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
        const diffs = computeDiff(uploaded, aggregatedItems, mapping);

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
          uploadType: items[0]?.upload_type || "cancellation",
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

  const approveMutation = useMutation({
    mutationFn: async ({ queueItemIds, saleIds, uploadType }: { queueItemIds: string[]; saleIds: string[]; uploadType: string }) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");
      const newStatus = uploadType === "cancellation" ? "cancelled" : "basket_changed";

      // Check if any queue items have target_product_name (product-level cancellation)
      const { data: queueItems } = await supabase
        .from("cancellation_queue")
        .select("id, sale_id, target_product_name")
        .in("id", queueItemIds) as any;

      const productLevelItems = (queueItems || []).filter((qi: any) => qi.target_product_name);
      const wholeSaleItems = (queueItems || []).filter((qi: any) => !qi.target_product_name);

      // Handle product-level cancellations
      for (const qi of productLevelItems) {
        // Find matching sale_items by product name and cancel them
        const { data: saleItems } = await supabase
          .from("sale_items")
          .select("id, product_id, adversus_product_title")
          .eq("sale_id", qi.sale_id);

        // Also fetch product names
        const productIds = (saleItems || []).map((si: any) => si.product_id).filter(Boolean);
        let productNamesMap = new Map<string, string>();
        if (productIds.length > 0) {
          const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
          if (products) productNamesMap = new Map(products.map((p: any) => [p.id, p.name]));
        }

        const targetName = qi.target_product_name.toLowerCase().trim();
        const matchingItem = (saleItems || []).find((si: any) => {
          const name = (productNamesMap.get(si.product_id) || si.adversus_product_title || "").toLowerCase().trim();
          return name === targetName;
        });

        if (matchingItem) {
          await supabase.from("sale_items").update({
            is_cancelled: true,
          } as any).eq("id", matchingItem.id);
        }

        // Check if ALL sale_items are now cancelled
        const { data: remainingItems } = await supabase
          .from("sale_items")
          .select("id, is_cancelled")
          .eq("sale_id", qi.sale_id) as any;

        const allCancelled = (remainingItems || []).every((si: any) => si.is_cancelled === true);
        if (allCancelled) {
          await supabase.from("sales").update({ validation_status: "cancelled" }).eq("id", qi.sale_id);
        }
      }

      // Handle whole-sale cancellations (existing logic)
      const wholeSaleIds: string[] = Array.from(new Set<string>(wholeSaleItems.map((qi: any) => String(qi.sale_id))));
      for (const saleId of wholeSaleIds) {
        const { error } = await supabase.from("sales").update({ validation_status: newStatus } as any).eq("id", saleId);
        if (error) throw error;
      }

      // Mark queue items as approved
      for (const id of queueItemIds) {
        const { error } = await supabase.from("cancellation_queue").update({
          status: "approved",
          reviewed_by: currentEmployee.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) throw error;
      }
      return { count: queueItemIds.length };
    },
    onSuccess: ({ count }) => {
      toast({ title: "Godkendt", description: `${count} items er godkendt.` });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!currentEmployee?.id) throw new Error("Ingen medarbejder fundet");
      for (const id of itemIds) {
        const { error } = await supabase.from("cancellation_queue").update({
          status: "rejected",
          reviewed_by: currentEmployee.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) throw error;
      }
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
  const filteredFlatItems = onlyDifferences ? flatItems.filter((i) => i.hasDifferences) : flatItems;

  // Split by sub-tab (upload_type)
  const subOppGroups = useMemo(() => filteredOppGroups.filter((g) => g.uploadType === subTab), [filteredOppGroups, subTab]);
  const subFlatItems = useMemo(() => filteredFlatItems.filter((i) => i.upload_type === subTab), [filteredFlatItems, subTab]);

  // Unique sellers across all items for filter
  const allSellers = useMemo(() => {
    const names = new Set<string>();
    filteredOppGroups.forEach(g => g.agents.forEach(a => names.add(a)));
    filteredFlatItems.forEach(i => names.add(i.agentName));
    return [...names].sort();
  }, [filteredOppGroups, filteredFlatItems]);

  // Apply search + seller filter + sort to sub-tab items
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

  // Counts per sub-tab for labels (use original unfiltered)
  const cancellationCount = useMemo(() =>
    filteredOppGroups.filter((g) => g.uploadType === "cancellation").length +
    filteredFlatItems.filter((i) => i.upload_type === "cancellation").length,
    [filteredOppGroups, filteredFlatItems]);
  const basketCount = useMemo(() =>
    filteredOppGroups.filter((g) => g.uploadType === "basket_difference").length +
    filteredFlatItems.filter((i) => i.upload_type === "basket_difference").length,
    [filteredOppGroups, filteredFlatItems]);

  // Active import query — imports with pending queue items
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


  // Count for "Fejl i match" tab
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
        {processedOppGroups.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">TDC Erhverv — OPP-grupperet</h3>
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
                  {processedOppGroups.map((g) => {
                    const summarizedItems = summarizeSaleItems(g.saleItems);
                    const uploadedPreview = buildUploadedPreview(g.uploadedData, g.mapping);
                    return (
                      <TableRow key={g.oppGroup}>
                        <TableCell className="font-mono text-xs">{g.oppGroup}</TableCell>
                        <TableCell className="text-xs align-top">
                          {g.agents.map(a => resolve(a)).join(", ")}
                          <div className="text-muted-foreground">({g.saleCount} salg)</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={g.uploadType === "cancellation" ? "destructive" : "secondary"}>
                            {g.uploadType === "cancellation" ? "Annullering" : "Kurv diff."}
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
                          {g.diffs.length > 0 ? (
                            <div className="space-y-1">
                              {g.diffs.map((d, idx) => (
                                <div key={idx} className="p-1 rounded bg-destructive/10 border border-destructive/20">
                                  <div className="font-medium text-destructive">{d.label}</div>
                                  <div>System: <span className="font-mono">{d.systemValue}</span></div>
                                  <div>Upload: <span className="font-mono">{d.uploadedValue}</span></div>
                                </div>
                              ))}
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

        {processedFlatItems.length > 0 && (
          <div>
            {processedOppGroups.length > 0 && (
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Andre kunder — per salg</h3>
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
                  {processedFlatItems.map((item) => {
                    const summarizedItems = summarizeSaleItems(item.saleItems);
                    const uploadedPreview = buildUploadedPreview(item.uploadedData, item.mapping);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.saleDate ? format(new Date(item.saleDate), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                        <TableCell>{resolve(item.agentName)}</TableCell>
                        <TableCell>{item.oppNumber || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={item.upload_type === "cancellation" ? "destructive" : "secondary"}>
                            {item.upload_type === "cancellation" ? "Annullering" : "Kurv diff."}
                          </Badge>
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
                              {item.diffs.map((d, idx) => (
                                <div key={idx} className="p-1 rounded bg-destructive/10 border border-destructive/20">
                                  <div className="font-medium text-destructive">{d.label}</div>
                                  <div>System: <span className="font-mono">{d.systemValue}</span></div>
                                  <div>Upload: <span className="font-mono">{d.uploadedValue}</span></div>
                                </div>
                              ))}
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
                              <Button size="sm" variant="ghost" onClick={() => approveMutation.mutate({ queueItemIds: [item.id], saleIds: [item.sale_id], uploadType: item.upload_type })} disabled={isPending}>
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active import card */}
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
            <Badge variant="secondary" className="shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {activeImport.pendingCount} rækker afventer
            </Badge>
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
                    Dette vil slette uploaden "{activeImport.file_name}" og rulle alle ændringer tilbage — inkl. godkendte annulleringer og kurvrettelser. Salg vil blive gendannet til deres oprindelige status.
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
