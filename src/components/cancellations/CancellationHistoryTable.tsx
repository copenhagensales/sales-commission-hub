import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface CancellationImport {
  id: string;
  created_at: string;
  file_name: string;
  file_size_bytes: number | null;
  status: string;
  rows_processed: number | null;
  rows_matched: number | null;
  error_message: string | null;
  uploaded_by: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function CancellationHistoryTable() {
  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["cancellation-imports-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_imports")
        .select(`
          id,
          created_at,
          file_name,
          file_size_bytes,
          status,
          rows_processed,
          rows_matched,
          error_message,
          uploaded_by:employee_master_data!cancellation_imports_uploaded_by_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as unknown as CancellationImport[];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Fuldført</Badge>;
      case "failed":
        return <Badge variant="destructive">Fejlet</Badge>;
      case "pending":
        return <Badge variant="secondary">Afventer</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (imports.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Upload-historik
        </CardTitle>
        <CardDescription>
          Tidligere uploads af annulleringsfiler
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Fil</TableHead>
                  <TableHead>Uploadet af</TableHead>
                  <TableHead>Rækker</TableHead>
                  <TableHead>Matchede</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell>
                      {format(new Date(imp.created_at), "dd/MM/yyyy HH:mm", { locale: da })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">{imp.file_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(imp.file_size_bytes)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {imp.uploaded_by
                        ? `${imp.uploaded_by.first_name || ""} ${imp.uploaded_by.last_name || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell>{imp.rows_processed ?? "-"}</TableCell>
                    <TableCell>{imp.rows_matched ?? "-"}</TableCell>
                    <TableCell>
                      {getStatusBadge(imp.status)}
                      {imp.error_message && (
                        <span className="block text-xs text-destructive mt-1">
                          {imp.error_message}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
