import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Eye, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

interface IntegrationLog {
  id: string;
  integration_type: string;
  integration_id: string | null;
  integration_name: string | null;
  status: "success" | "error" | "warning";
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export function IntegrationLogs() {
  const [selectedLog, setSelectedLog] = useState<IntegrationLog | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["integration-logs", typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (typeFilter !== "all") {
        query = query.eq("integration_type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as IntegrationLog[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "dialer":
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Dialer</Badge>;
      case "crm":
        return <Badge variant="outline" className="text-purple-600 border-purple-300">CRM</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const errorCount = logs?.filter(l => l.status === "error").length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              System Logs
              {errorCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {errorCount} fejl
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Se status og fejlmeddelelser fra integrationer</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="dialer">Dialer</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Indlæser logs...</div>
        ) : logs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Ingen logs fundet</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tidspunkt</TableHead>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Integration</TableHead>
                  <TableHead>Besked</TableHead>
                  <TableHead className="w-[80px] text-right">Detaljer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow 
                    key={log.id} 
                    className={log.status === "error" ? "bg-red-50/50 dark:bg-red-950/20" : undefined}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: da })}
                    </TableCell>
                    <TableCell>{getTypeBadge(log.integration_type)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {log.integration_name || "-"}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">
                      {log.message}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Log Detaljer
              {selectedLog && getStatusBadge(selectedLog.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.integration_name || "Integration"} - {selectedLog?.created_at && new Date(selectedLog.created_at).toLocaleString("da-DK")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Besked</p>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{selectedLog?.message}</p>
            </div>
            {selectedLog?.details && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Detaljer (JSON)</p>
                <ScrollArea className="h-[300px]">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}