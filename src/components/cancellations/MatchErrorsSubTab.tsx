import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertTriangle, Check, ChevronsUpDown, Trash2, SearchCheck, X, SendHorizonal } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { LocateSaleDialog } from "./LocateSaleDialog";
import { CLIENT_IDS } from "@/utils/clientIds";

interface UnmatchedRow {
  [key: string]: unknown;
}

interface FlatUnmatchedRow {
  importId: string;
  uploadType: string;
  rowData: Record<string, unknown>;
}

interface MatchErrorsSubTabProps {
  clientId: string;
}

const SELLER_FIELD_CANDIDATES = ["operator", "agent", "sælger", "agent_email", "seller", "agent_name", "employee name", "employee_name"];

/** Create a stable unique key for a row based on importId + rowData hash */
function rowKey(row: FlatUnmatchedRow): string {
  // Use a simple deterministic string from importId + sorted JSON of rowData
  const dataStr = JSON.stringify(
    Object.entries(row.rowData)
      .filter(([k]) => k !== "_product_rows")
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return `${row.importId}::${dataStr}`;
}

function parseFlexibleDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split("T")[0];
  }
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) {
      const d = new Date(`${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
  }
  return null;
}

export function MatchErrorsSubTab({ clientId }: MatchErrorsSubTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localAssignments, setLocalAssignments] = useState<Record<string, string>>({});
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [locateDialogRow, setLocateDialogRow] = useState<{ row: FlatUnmatchedRow; key: string } | null>(null);
  const [ignorePendingKey, setIgnorePendingKey] = useState<string | null>(null);
  const [localManualMatches, setLocalManualMatches] = useState<Map<string, { saleId: string; row: FlatUnmatchedRow; saleItemTitle?: string }>>(new Map());
  const queryClient = useQueryClient();

  // Fetch unmatched rows
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["match-errors", clientId],
    queryFn: async () => {
      let query = supabase
        .from("cancellation_imports")
        .select("id, file_name, created_at, upload_type, unmatched_rows")
        .not("unmatched_rows", "is", null)
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const flat: FlatUnmatchedRow[] = [];
      for (const imp of data || []) {
        const unmatchedArr = imp.unmatched_rows as UnmatchedRow[] | null;
        if (!Array.isArray(unmatchedArr)) continue;
        for (const row of unmatchedArr) {
          flat.push({
            importId: imp.id,
            uploadType: imp.upload_type || "cancellation",
            rowData: row as Record<string, unknown>,
          });
        }
      }
      return flat;
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing seller mappings
  const { data: existingMappings = [] } = useQuery({
    queryKey: ["cancellation-seller-mappings", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("cancellation_seller_mappings")
        .select("excel_seller_name, employee_id")
        .eq("client_id", clientId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch upload config for date_column
  const { data: uploadConfig } = useQuery({
    queryKey: ["cancellation-upload-config", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("cancellation_upload_configs")
        .select("date_column, seller_column")
        .eq("client_id", clientId)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch client campaigns for scoping sales search
  const { data: campaignIds = [] } = useQuery({
    queryKey: ["client-campaign-ids", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []).map(c => c.id);
    },
    enabled: !!clientId,
  });

  const mappingsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of existingMappings) {
      map.set(m.excel_seller_name?.toLowerCase() ?? "", m.employee_id);
    }
    return map;
  }, [existingMappings]);

  const upsertMapping = useMutation({
    mutationFn: async ({ row, rKey, employeeId }: { row: FlatUnmatchedRow; rKey: string; employeeId: string }) => {
      // 1. Save global mapping for future uploads
      const sellerValue = sellerField ? String(row.rowData[sellerField] ?? "") : "";
      if (sellerValue) {
        await supabase
          .from("cancellation_seller_mappings")
          .upsert(
            { excel_seller_name: sellerValue, employee_id: employeeId, client_id: clientId },
            { onConflict: "client_id,excel_seller_name" }
          );
      }

      // 2. Get employee work_email and name
      const emp = employees.find(e => e.id === employeeId);
      const workEmail = emp?.work_email;
      const empFullName = emp ? `${emp.first_name} ${emp.last_name}`.trim().toLowerCase() : "";
      if (!workEmail && !empFullName) return { matched: 0 };

      // 3. Find date column
      const dateCol = uploadConfig?.date_column;
      if (!dateCol || campaignIds.length === 0) return { matched: 0 };

      // 4. Re-match ONLY this specific row
      const dateValue = parseFlexibleDate(row.rowData[dateCol]);
      if (!dateValue) return { matched: 0 };

      let sales: { id: string }[] | null = null;

      if (workEmail) {
        const { data } = await supabase
          .from("sales")
          .select("id")
          .eq("agent_email", workEmail.toLowerCase())
          .gte("sale_datetime", `${dateValue}T00:00:00`)
          .lte("sale_datetime", `${dateValue}T23:59:59`)
          .in("client_campaign_id", campaignIds)
          .limit(1);
        sales = data;
      }

      if ((!sales || sales.length === 0) && empFullName) {
        const { data } = await supabase
          .from("sales")
          .select("id")
          .ilike("agent_name", empFullName)
          .gte("sale_datetime", `${dateValue}T00:00:00`)
          .lte("sale_datetime", `${dateValue}T23:59:59`)
          .in("client_campaign_id", campaignIds)
          .limit(1);
        sales = data;
      }

      if (!sales || sales.length === 0) return { matched: 0 };

      // When uploadType is "both", classify as "cancellation" for match-error re-matches
      const resolvedUploadType = row.uploadType === "both" ? "cancellation" : row.uploadType;

      // Fetch target_product_name only for Eesy TM
      let targetProductName: string | null = null;
      if (clientId === CLIENT_IDS["Eesy TM"]) {
        const { data: matchedSaleItems } = await supabase
          .from("sale_items")
          .select("adversus_product_title")
          .eq("sale_id", sales[0].id)
          .limit(1);
        targetProductName = matchedSaleItems?.[0]?.adversus_product_title || null;
      }

      const { error: queueError } = await supabase
        .from("cancellation_queue")
        .insert([{
          import_id: row.importId,
          sale_id: sales[0].id,
          upload_type: resolvedUploadType,
          status: "pending",
          uploaded_data: row.rowData as unknown as Json,
          client_id: clientId,
          target_product_name: targetProductName,
        }]);
      if (queueError) {
        console.error("Failed to insert into cancellation_queue:", queueError);
        return { matched: 0 };
      }

      const { data: importData } = await supabase
        .from("cancellation_imports")
        .select("unmatched_rows")
        .eq("id", row.importId)
        .single();

      if (importData?.unmatched_rows && Array.isArray(importData.unmatched_rows)) {
        const updatedRows = (importData.unmatched_rows as Record<string, unknown>[]).filter(
          (ur) => JSON.stringify(ur) !== JSON.stringify(row.rowData)
        );
        await supabase
          .from("cancellation_imports")
          .update({
            unmatched_rows: (updatedRows.length > 0 ? updatedRows : null) as Json,
            rows_matched: (importData.unmatched_rows.length - updatedRows.length),
          })
          .eq("id", row.importId);
      }

      return { matched: 1 };
    },
    onSuccess: (result) => {
      if (result && result.matched > 0) {
        toast({ title: "Rækken matchet og sendt til godkendelseskøen" });
      } else {
        toast({ title: "Sælger-mapping gemt – ingen salg fundet for denne række" });
      }
      queryClient.invalidateQueries({ queryKey: ["cancellation-seller-mappings", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count", clientId] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: () => {
      toast({ title: "Fejl ved gemning af mapping", variant: "destructive" });
    },
  });

  const ignoreAllMutation = useMutation({
    mutationFn: async () => {
      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const row of processed) {
        const existing = grouped.get(row.importId) || [];
        existing.push(row.rowData);
        grouped.set(row.importId, existing);
      }
      for (const [importId, rowsToRemove] of grouped) {
        const { data: importData } = await supabase
          .from("cancellation_imports")
          .select("unmatched_rows")
          .eq("id", importId)
          .single();
        if (!importData?.unmatched_rows || !Array.isArray(importData.unmatched_rows)) continue;
        const removeSet = new Set(rowsToRemove.map(r => JSON.stringify(r)));
        const updated = (importData.unmatched_rows as Record<string, unknown>[]).filter(
          ur => !removeSet.has(JSON.stringify(ur))
        );
        await supabase
          .from("cancellation_imports")
          .update({ unmatched_rows: (updated.length > 0 ? updated : null) as unknown as Json })
          .eq("id", importId);
      }
    },
    onSuccess: () => {
      toast({ title: "Alle fejlede rækker er blevet ignoreret og fjernet" });
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
    },
    onError: () => {
      toast({ title: "Fejl ved ignorering af rækker", variant: "destructive" });
    },
  });

  const ignoreRowMutation = useMutation({
    mutationFn: async (row: FlatUnmatchedRow) => {
      const { data: importData } = await supabase
        .from("cancellation_imports")
        .select("unmatched_rows")
        .eq("id", row.importId)
        .single();
      if (!importData?.unmatched_rows || !Array.isArray(importData.unmatched_rows)) return;
      const rowJson = JSON.stringify(row.rowData);
      const updated = (importData.unmatched_rows as Record<string, unknown>[]).filter(
        ur => JSON.stringify(ur) !== rowJson
      );
      await supabase
        .from("cancellation_imports")
        .update({ unmatched_rows: (updated.length > 0 ? updated : null) as unknown as Json })
        .eq("id", row.importId);
    },
    onSuccess: () => {
      toast({ title: "Rækken er blevet ignoreret" });
      setIgnorePendingKey(null);
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
    },
    onError: () => {
      toast({ title: "Fejl ved ignorering", variant: "destructive" });
      setIgnorePendingKey(null);
    },
  });

  // Handle local match from LocateSaleDialog
  const handleLocalMatch = useCallback((saleId: string, matchedRow: FlatUnmatchedRow, saleItemTitle?: string) => {
    const rk = rowKey(matchedRow);
    setLocalManualMatches(prev => {
      const next = new Map(prev);
      next.set(rk, { saleId, row: matchedRow, saleItemTitle });
      return next;
    });
  }, []);

  // Remove a local match
  const handleRemoveLocalMatch = useCallback((rk: string) => {
    setLocalManualMatches(prev => {
      const next = new Map(prev);
      next.delete(rk);
      return next;
    });
  }, []);

  // Confirm all local manual matches → persist to DB
  const confirmManualMatchesMutation = useMutation({
    mutationFn: async () => {
      const entries = [...localManualMatches.values()];
      if (entries.length === 0) return;

      // Resolve target_product_name for Eesy TM
      const isEesyTm = clientId === CLIENT_IDS["Eesy TM"];
      const saleItemMap = new Map<string, string>();
      if (isEesyTm) {
        // Use saleItemTitle from local match if available
        for (const entry of entries) {
          if (entry.saleItemTitle) {
            const rk = rowKey(entry.row);
            saleItemMap.set(rk, entry.saleItemTitle);
          }
        }
        // Fallback: fetch from DB for entries without saleItemTitle
        const missingEntries = entries.filter(e => !e.saleItemTitle);
        if (missingEntries.length > 0) {
          const saleIds = missingEntries.map(e => e.saleId);
          const { data: saleItemsData } = await supabase
            .from("sale_items")
            .select("sale_id, adversus_product_title")
            .in("sale_id", saleIds);
          for (const si of (saleItemsData || [])) {
            const matchingEntry = missingEntries.find(e => e.saleId === si.sale_id);
            if (matchingEntry) {
              const rk = rowKey(matchingEntry.row);
              if (!saleItemMap.has(rk)) {
                saleItemMap.set(rk, si.adversus_product_title || "");
              }
            }
          }
        }
      }

      // Batch insert into cancellation_queue
      const inserts = entries.map(({ saleId, row: r }) => {
        const rk = rowKey(r);
        return {
          import_id: r.importId,
          sale_id: saleId,
          upload_type: r.uploadType === "both" ? "cancellation" : r.uploadType,
          status: "pending",
          uploaded_data: r.rowData as unknown as Json,
          client_id: clientId,
          target_product_name: isEesyTm ? (saleItemMap.get(rk) || null) : null,
        };
      });

      const { error: queueError } = await supabase
        .from("cancellation_queue")
        .insert(inserts);
      if (queueError) throw queueError;

      // Group by importId and remove from unmatched_rows
      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const { row: r } of entries) {
        const existing = grouped.get(r.importId) || [];
        existing.push(r.rowData);
        grouped.set(r.importId, existing);
      }

      for (const [importId, rowsToRemove] of grouped) {
        const { data: importData } = await supabase
          .from("cancellation_imports")
          .select("unmatched_rows")
          .eq("id", importId)
          .single();

        if (importData?.unmatched_rows && Array.isArray(importData.unmatched_rows)) {
          const removeSet = new Set(rowsToRemove.map(r => JSON.stringify(r)));
          const updated = (importData.unmatched_rows as Record<string, unknown>[]).filter(
            ur => !removeSet.has(JSON.stringify(ur))
          );
          await supabase
            .from("cancellation_imports")
            .update({ unmatched_rows: (updated.length > 0 ? updated : null) as unknown as Json })
            .eq("id", importId);
        }
      }
    },
    onSuccess: () => {
      toast({ title: `${localManualMatches.size} manuelle matches sendt til godkendelseskøen` });
      setLocalManualMatches(new Map());
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["used-sale-ids", clientId] });
    },
    onError: () => {
      toast({ title: "Fejl ved bekræftelse af manuelle matches", variant: "destructive" });
    },
  });

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) {
      Object.keys(r.rowData).forEach(k => {
        if (k !== "_product_rows") keys.add(k);
      });
    }
    return [...keys];
  }, [rows]);

  const sellerField = useMemo(() => {
    if (uploadConfig?.seller_column) return uploadConfig.seller_column;
    return allKeys.find(k => SELLER_FIELD_CANDIDATES.includes(k.toLowerCase()));
  }, [allKeys, uploadConfig]);

  const processed = useMemo(() => {
    let result = [...rows];
    // Filter out rows that have been locally matched
    if (localManualMatches.size > 0) {
      result = result.filter(r => !localManualMatches.has(rowKey(r)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const vals = Object.values(r.rowData).map(v => String(v ?? "")).join(" ").toLowerCase();
        return vals.includes(q);
      });
    }
    return result;
  }, [rows, searchQuery, localManualMatches]);

  // Helper to resolve employee for a given row
  const getAssignedEmployeeId = useCallback((rk: string, row: FlatUnmatchedRow): string => {
    const localValue = localAssignments[rk];
    if (localValue) return localValue;
    const sellerValue = sellerField ? String(row.rowData[sellerField] ?? "") : "";
    return mappingsByName.get(sellerValue.toLowerCase()) ?? "";
  }, [localAssignments, sellerField, mappingsByName]);

  // Bulk re-match mutation for Eesy TM — must be before early returns to avoid hook order issues
  const isEesyTmClient = clientId === CLIENT_IDS["Eesy TM"];

  const bulkRematchMutation = useMutation({
    mutationFn: async () => {
      if (!uploadConfig?.date_column || !sellerField || campaignIds.length === 0) {
        throw new Error("Mangler konfiguration for re-match");
      }

      const dateCol = uploadConfig.date_column;
      let matched = 0;

      for (const row of rows) {
        const rk = rowKey(row);
        // Skip rows already locally matched
        if (localManualMatches.has(rk)) continue;

        const excelSeller = String(row.rowData[sellerField] ?? "").trim();
        const dateValue = parseFlexibleDate(row.rowData[dateCol]);
        if (!dateValue || !excelSeller) continue;

        // Resolve employee from seller mappings or employee list
        let employeeId = mappingsByName.get(excelSeller.toLowerCase());
        let workEmail: string | undefined;
        let empFullName = "";

        if (employeeId) {
          const emp = employees.find(e => e.id === employeeId);
          workEmail = emp?.work_email;
          empFullName = emp ? `${emp.first_name} ${emp.last_name}`.trim().toLowerCase() : "";
        } else {
          // Try full name match against employees
          const emp = employees.find(e => {
            const full = `${e.first_name} ${e.last_name}`.trim().toLowerCase();
            return full === excelSeller.toLowerCase();
          });
          if (emp) {
            employeeId = emp.id;
            workEmail = emp.work_email;
            empFullName = `${emp.first_name} ${emp.last_name}`.trim().toLowerCase();
          } else {
            // Try first name match
            const emp2 = employees.find(e => e.first_name?.toLowerCase() === excelSeller.toLowerCase());
            if (emp2) {
              employeeId = emp2.id;
              workEmail = emp2.work_email;
              empFullName = `${emp2.first_name} ${emp2.last_name}`.trim().toLowerCase();
            }
          }
        }

        if (!workEmail && !empFullName) continue;

        // Search for sales
        let sales: { id: string }[] | null = null;

        if (workEmail) {
          const { data } = await supabase
            .from("sales")
            .select("id")
            .eq("agent_email", workEmail.toLowerCase())
            .gte("sale_datetime", `${dateValue}T00:00:00`)
            .lte("sale_datetime", `${dateValue}T23:59:59`)
            .in("client_campaign_id", campaignIds)
            .limit(1);
          sales = data;
        }

        if ((!sales || sales.length === 0) && empFullName) {
          const { data } = await supabase
            .from("sales")
            .select("id")
            .ilike("agent_name", empFullName)
            .gte("sale_datetime", `${dateValue}T00:00:00`)
            .lte("sale_datetime", `${dateValue}T23:59:59`)
            .in("client_campaign_id", campaignIds)
            .limit(1);
          sales = data;
        }

        if (!sales || sales.length === 0) continue;

        // Get target product name
        let targetProductName: string | null = null;
        const { data: matchedSaleItems } = await supabase
          .from("sale_items")
          .select("adversus_product_title")
          .eq("sale_id", sales[0].id)
          .limit(1);
        targetProductName = matchedSaleItems?.[0]?.adversus_product_title || null;

        const resolvedUploadType = row.uploadType === "both" ? "cancellation" : row.uploadType;

        const { error: queueError } = await supabase
          .from("cancellation_queue")
          .insert([{
            import_id: row.importId,
            sale_id: sales[0].id,
            upload_type: resolvedUploadType,
            status: "pending",
            uploaded_data: row.rowData as unknown as Json,
            client_id: clientId,
            target_product_name: targetProductName,
          }]);

        if (queueError) {
          console.error("Bulk re-match insert error:", queueError);
          continue;
        }

        // Remove from unmatched_rows
        const { data: importData } = await supabase
          .from("cancellation_imports")
          .select("unmatched_rows")
          .eq("id", row.importId)
          .single();

        if (importData?.unmatched_rows && Array.isArray(importData.unmatched_rows)) {
          const updatedRows = (importData.unmatched_rows as Record<string, unknown>[]).filter(
            (ur) => JSON.stringify(ur) !== JSON.stringify(row.rowData)
          );
          await supabase
            .from("cancellation_imports")
            .update({
              unmatched_rows: (updatedRows.length > 0 ? updatedRows : null) as Json,
            })
            .eq("id", row.importId);
        }

        matched++;
      }

      return { matched, total: rows.length };
    },
    onSuccess: (result) => {
      if (result) {
        toast({ title: `${result.matched} af ${result.total} rækker matchet og sendt til godkendelseskøen` });
      }
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors-count", clientId] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["used-sale-ids", clientId] });
    },
    onError: () => {
      toast({ title: "Fejl ved re-match", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-50" />
        Ingen fejl i match fundet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg i fejlede rækker..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isEesyTmClient && rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkRematchMutation.mutate()}
            disabled={bulkRematchMutation.isPending}
          >
            {bulkRematchMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <SearchCheck className="h-4 w-4 mr-1.5" />
            )}
            Re-match alle
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        {processed.length} rækker kunne ikke matches til salg i systemet
      </div>

      <div className="rounded-md border max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="whitespace-nowrap">Handlinger</TableHead>
              {sellerField && <TableHead className="whitespace-nowrap">Tildel sælger</TableHead>}
              {allKeys.map(key => (
                <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((row) => {
              const rk = rowKey(row);
              const currentMapping = getAssignedEmployeeId(rk, row);

              return (
                <TableRow key={rk}>
                  <TableCell>
                    <Badge variant={row.uploadType === "cancellation" ? "destructive" : "secondary"}>
                      {row.uploadType === "cancellation" ? "Annullering" : "Kurvrettelse"}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setLocateDialogRow({ row, key: rk })}
                      >
                        <SearchCheck className="h-3 w-3 mr-1" /> Lokaliser salg
                      </Button>
                      {ignorePendingKey === rk ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={ignoreRowMutation.isPending}
                            onClick={() => ignoreRowMutation.mutate(row)}
                          >
                            Bekræft?
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setIgnorePendingKey(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setIgnorePendingKey(rk)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Ignorer
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  {sellerField && (
                    <TableCell className="min-w-[220px]">
                      <Popover
                        open={openPopoverKey === rk}
                        onOpenChange={(open) => setOpenPopoverKey(open ? rk : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="h-8 w-full justify-between text-xs font-normal"
                          >
                            <span className="truncate">
                              {currentMapping
                                ? (() => {
                                    const emp = employees.find(e => e.id === currentMapping);
                                    return emp ? `${emp.first_name} ${emp.last_name}` : "Vælg medarbejder...";
                                  })()
                                : "Vælg medarbejder..."}
                            </span>
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Søg medarbejder..." className="h-9 text-xs" />
                            <CommandList>
                              <CommandEmpty>Ingen medarbejder fundet.</CommandEmpty>
                              <CommandGroup>
                                {employees.map(emp => (
                                  <CommandItem
                                    key={emp.id}
                                    value={`${emp.first_name} ${emp.last_name}`}
                                    onSelect={() => {
                                      setLocalAssignments(prev => ({ ...prev, [rk]: emp.id }));
                                      upsertMapping.mutate({ row, rKey: rk, employeeId: emp.id });
                                      setOpenPopoverKey(null);
                                    }}
                                    className="text-xs"
                                  >
                                    <Check className={cn("mr-2 h-3 w-3", currentMapping === emp.id ? "opacity-100" : "opacity-0")} />
                                    {emp.first_name} {emp.last_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  )}
                  {allKeys.map(key => (
                    <TableCell key={key} className="text-xs whitespace-nowrap">
                      {row.rowData[key] != null ? String(row.rowData[key]) : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pending manual matches section */}
      {localManualMatches.size > 0 && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {localManualMatches.size} manuelle matches afventer bekræftelse
            </p>
            <Button
              size="sm"
              onClick={() => confirmManualMatchesMutation.mutate()}
              disabled={confirmManualMatchesMutation.isPending}
            >
              {confirmManualMatchesMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4 mr-1" />
              )}
              Send til godkendelse
            </Button>
          </div>
          <div className="space-y-1">
            {[...localManualMatches.entries()].map(([rk, { saleId, row: matchedRow, saleItemTitle }]) => (
              <div key={rk} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
                  Salg: {saleId.slice(0, 8)}…
                </Badge>
                {saleItemTitle && (
                  <Badge variant="secondary" className="text-xs">
                    {saleItemTitle}
                  </Badge>
                )}
                <span className="text-muted-foreground truncate max-w-[300px]">
                  {Object.entries(matchedRow.rowData)
                    .filter(([k]) => k !== "_product_rows")
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v ?? "-"}`)
                    .join(" | ")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveLocalMatch(rk)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={ignoreAllMutation.isPending || processed.length === 0}>
              <Trash2 className="h-4 w-4 mr-1" /> Ignorer alle
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bekræft ignorering</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil ignorere alle fejlede rækker? De vil blive fjernet permanent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction onClick={() => ignoreAllMutation.mutate()}>Ignorer alle</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {locateDialogRow && (
        <LocateSaleDialog
          open={!!locateDialogRow}
          onOpenChange={(open) => { if (!open) setLocateDialogRow(null); }}
          row={locateDialogRow.row}
          clientId={clientId}
          campaignIds={campaignIds}
          assignedEmployeeId={
            getAssignedEmployeeId(locateDialogRow.key, locateDialogRow.row) || undefined
          }
          assignedEmployeeName={
            (() => {
              const empId = getAssignedEmployeeId(locateDialogRow.key, locateDialogRow.row);
              if (!empId) return undefined;
              const emp = employees.find(e => e.id === empId);
              return emp ? `${emp.first_name} ${emp.last_name}` : undefined;
            })()
          }
          onMatch={handleLocalMatch}
        />
      )}
    </div>
  );
}
