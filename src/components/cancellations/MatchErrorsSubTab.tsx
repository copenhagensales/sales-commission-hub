import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface UnmatchedRow {
  [key: string]: unknown;
}

interface FlatUnmatchedRow {
  importId: string;
  fileName: string;
  uploadDate: string;
  uploadType: string;
  rowData: Record<string, unknown>;
}

interface MatchErrorsSubTabProps {
  clientId: string;
}

export function MatchErrorsSubTab({ clientId }: MatchErrorsSubTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  type SortKey = "date" | "file";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["match-errors", clientId],
    queryFn: async () => {
      // Get imports that have unmatched_rows, optionally filtered by client
      let query = supabase
        .from("cancellation_imports")
        .select("id, file_name, created_at, upload_type, unmatched_rows")
        .not("unmatched_rows", "is", null)
        .order("created_at", { ascending: false });

      // Filter by client: get config_ids for this client
      if (clientId) {
        const { data: configs } = await supabase
          .from("cancellation_upload_configs")
          .select("id")
          .eq("client_id", clientId);
        const configIds = (configs || []).map(c => c.id);
        if (configIds.length > 0) {
          query = query.in("config_id", configIds);
        } else {
          return [];
        }
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
            fileName: imp.file_name || "Ukendt fil",
            uploadDate: imp.created_at || "",
            uploadType: imp.upload_type || "cancellation",
            rowData: row as Record<string, unknown>,
          });
        }
      }
      return flat;
    },
  });

  // Collect all unique keys across all row data
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) {
      Object.keys(r.rowData).forEach(k => {
        if (k !== "_product_rows") keys.add(k);
      });
    }
    return [...keys];
  }, [rows]);

  // Filter and sort
  const processed = useMemo(() => {
    let result = [...rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const vals = [r.fileName, ...Object.values(r.rowData).map(v => String(v ?? ""))].join(" ").toLowerCase();
        return vals.includes(q);
      });
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.uploadDate.localeCompare(b.uploadDate);
      else if (sortKey === "file") cmp = a.fileName.localeCompare(b.fileName);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [rows, searchQuery, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

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

  // Pick display columns (max 6 most common keys)
  const displayKeys = allKeys.slice(0, 6);

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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("file")}>
                <span className="flex items-center">Fil <SortIcon column="file" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                <span className="flex items-center">Upload dato <SortIcon column="date" /></span>
              </TableHead>
              <TableHead>Type</TableHead>
              {displayKeys.map(key => (
                <TableHead key={key}>{key}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((row, idx) => (
              <TableRow key={`${row.importId}-${idx}`}>
                <TableCell className="text-xs max-w-[200px] truncate">{row.fileName}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {row.uploadDate ? format(new Date(row.uploadDate), "dd/MM/yyyy HH:mm") : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={row.uploadType === "cancellation" ? "destructive" : "secondary"}>
                    {row.uploadType === "cancellation" ? "Annullering" : "Kurvrettelse"}
                  </Badge>
                </TableCell>
                {displayKeys.map(key => (
                  <TableCell key={key} className="text-xs">
                    {row.rowData[key] != null ? String(row.rowData[key]) : "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
