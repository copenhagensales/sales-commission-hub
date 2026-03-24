import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

export function MatchErrorsSubTab({ clientId }: MatchErrorsSubTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

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

  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

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

  const mappingsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of existingMappings) {
      map.set(m.excel_seller_name?.toLowerCase() ?? "", m.employee_id);
    }
    return map;
  }, [existingMappings]);

  const upsertMapping = useMutation({
    mutationFn: async ({ excelName, employeeId }: { excelName: string; employeeId: string }) => {
      const { error } = await supabase
        .from("cancellation_seller_mappings")
        .upsert(
          { excel_seller_name: excelName, employee_id: employeeId, client_id: clientId },
          { onConflict: "client_id,excel_seller_name" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sælger-mapping gemt" });
      queryClient.invalidateQueries({ queryKey: ["cancellation-seller-mappings", clientId] });
    },
    onError: () => {
      toast({ title: "Fejl ved gemning af mapping", variant: "destructive" });
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
    return allKeys.find(k => SELLER_FIELD_CANDIDATES.includes(k.toLowerCase()));
  }, [allKeys]);

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
              const sellerValue = sellerField ? String(row.rowData[sellerField] ?? "") : "";
              const currentMapping = mappingsByName.get(sellerValue.toLowerCase());

              return (
                <TableRow key={`${row.importId}-${idx}`}>
                  <TableCell>
                    <Badge variant={row.uploadType === "cancellation" ? "destructive" : "secondary"}>
                      {row.uploadType === "cancellation" ? "Annullering" : "Kurvrettelse"}
                    </Badge>
                  </TableCell>
                  {sellerField && (
                    <TableCell className="min-w-[200px]">
                      <Select
                        value={currentMapping ?? ""}
                        onValueChange={(val) => {
                          if (sellerValue) {
                            upsertMapping.mutate({ excelName: sellerValue, employeeId: val });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Vælg medarbejder..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
    </div>
  );
}
