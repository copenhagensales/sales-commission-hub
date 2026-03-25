import { useState, useMemo } from "react";
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
import { Search, Loader2, AlertTriangle, Check, ChevronsUpDown, Trash2, SearchCheck, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { LocateSaleDialog } from "./LocateSaleDialog";

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

function parseFlexibleDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  // Try ISO format first
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split("T")[0];
  }
  // Try DD-MM-YYYY or DD/MM/YYYY
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
  const [localAssignments, setLocalAssignments] = useState<Record<number, string>>({});
  const [openPopoverIdx, setOpenPopoverIdx] = useState<number | null>(null);
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
    mutationFn: async ({ row, rowIndex, employeeId }: { row: FlatUnmatchedRow; rowIndex: number; employeeId: string }) => {
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

      // Try matching by agent_email first, then by agent_name for FM sales
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

      // Fallback: match by agent_name (FM sales often use name, not email)
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

      // Insert into cancellation_queue
      const { error: queueError } = await supabase
        .from("cancellation_queue")
        .insert([{
          import_id: row.importId,
          sale_id: sales[0].id,
          upload_type: row.uploadType,
          status: "pending",
          uploaded_data: row.rowData as unknown as Json,
          client_id: clientId,
        }]);
      if (queueError) {
        console.error("Failed to insert into cancellation_queue:", queueError);
        return { matched: 0 };
      }

      // Remove this row from unmatched_rows in cancellation_imports
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
        toast({ title: "Sælger-mapping gemt — ingen salg fundet for denne række" });
      }
      queryClient.invalidateQueries({ queryKey: ["cancellation-seller-mappings", clientId] });
      queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
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
    },
    onError: () => {
      toast({ title: "Fejl ved ignorering af rækker", variant: "destructive" });
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const vals = Object.values(r.rowData).map(v => String(v ?? "")).join(" ").toLowerCase();
        return vals.includes(q);
      });
    }
    return result;
  }, [rows, searchQuery]);

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
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søg i fejlede rækker..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        {processed.length} rækker kunne ikke matches til salg i systemet
      </div>

      <div className="rounded-md border max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              {sellerField && <TableHead className="whitespace-nowrap">Tildel sælger</TableHead>}
              {allKeys.map(key => (
                <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((row, idx) => {
              const localValue = localAssignments[idx];
              const sellerValue = sellerField ? String(row.rowData[sellerField] ?? "") : "";
              const currentMapping = localValue ?? mappingsByName.get(sellerValue.toLowerCase()) ?? "";

              return (
                <TableRow key={`${row.importId}-${idx}`}>
                  <TableCell>
                    <Badge variant={row.uploadType === "cancellation" ? "destructive" : "secondary"}>
                      {row.uploadType === "cancellation" ? "Annullering" : "Kurvrettelse"}
                    </Badge>
                  </TableCell>
                  {sellerField && (
                    <TableCell className="min-w-[220px]">
                      <Popover
                        open={openPopoverIdx === idx}
                        onOpenChange={(open) => setOpenPopoverIdx(open ? idx : null)}
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
                                      setLocalAssignments(prev => ({ ...prev, [idx]: emp.id }));
                                      upsertMapping.mutate({ row, rowIndex: idx, employeeId: emp.id });
                                      setOpenPopoverIdx(null);
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
    </div>
  );
}
