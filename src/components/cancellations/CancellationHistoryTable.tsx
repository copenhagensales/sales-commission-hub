import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface CancellationImport {
  id: string;
  created_at: string;
  file_name: string;
  file_size_bytes: number | null;
  status: string;
  rows_processed: number | null;
  rows_matched: number | null;
  error_message: string | null;
  default_deduction_date: string | null;
  uploaded_by: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  hasApprovedItems?: boolean;
}

interface CancellationHistoryTableProps {
  clientId: string;
}

export function CancellationHistoryTable({ clientId }: CancellationHistoryTableProps) {
  const queryClient = useQueryClient();

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["cancellation-imports-history", clientId],
    enabled: !!clientId,
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
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Check which imports have pending queue items (still active)
      const importIds = data.map((d: any) => d.id);
      let pendingSet = new Set<string>();
      let approvedSet = new Set<string>();
      if (importIds.length > 0) {
        const [pendingResult, approvedResult] = await Promise.all([
          supabase
            .from("cancellation_queue")
            .select("import_id")
            .in("import_id", importIds)
            .eq("status", "pending"),
          supabase
            .from("cancellation_queue")
            .select("import_id")
            .in("import_id", importIds)
            .eq("status", "approved"),
        ]);
        if (pendingResult.data) {
          pendingSet = new Set(pendingResult.data.map((a) => a.import_id));
        }
        if (approvedResult.data) {
          approvedSet = new Set(approvedResult.data.map((a) => a.import_id));
        }
      }

      // Only show imports that have NO pending queue items (completed or no queue items)
      return (data as unknown as CancellationImport[])
        .filter((imp) => !pendingSet.has(imp.id))
        .map((imp) => ({
          ...imp,
          hasApprovedItems: approvedSet.has(imp.id),
        }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (importId: string) => {
      // First delete all non-approved queue items for this import
      const { error: queueError } = await supabase
        .from("cancellation_queue")
        .delete()
        .eq("import_id", importId);
      if (queueError) throw queueError;

      // Then delete the import itself
      const { error: importError } = await supabase
        .from("cancellation_imports")
        .delete()
        .eq("id", importId);
      if (importError) throw importError;
    },
    onSuccess: () => {
      toast({ title: "Slettet", description: "Upload og tilhørende kø-elementer er slettet." });
      queryClient.invalidateQueries({ queryKey: ["cancellation-imports-history"] });
      queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
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

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Vælg en kunde for at se tidligere uploads
        </CardContent>
      </Card>
    );
  }

  if (imports.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen uploads fundet for denne kunde
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Afsluttede uploads
        </CardTitle>
        <CardDescription>
          Uploads hvor alle rækker er behandlet
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
                  <TableHead className="w-[80px]">Handling</TableHead>
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
                    <TableCell>
                      {imp.hasApprovedItems ? (
                        <span className="text-xs text-muted-foreground">Godkendt</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Slet "${imp.file_name}" og alle tilhørende kø-elementer?`)) {
                              deleteMutation.mutate(imp.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
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
