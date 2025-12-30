import { useState, useMemo } from "react";
import { useIntegrationDebugLogs, DebugLogItem } from "@/hooks/useIntegrationDebugLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Bug
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function IntegrationDebugTab() {
  const { data: debugLogs, isLoading, refetch } = useIntegrationDebugLogs();
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "registered" | "skipped">("all");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Get the selected log data
  const currentLog = useMemo(() => {
    if (!selectedLog || !debugLogs) return null;
    return debugLogs.find(log => `${log.provider}-${log.sync_type}` === selectedLog);
  }, [selectedLog, debugLogs]);

  // Filter items based on search and status filter
  const filteredItems = useMemo(() => {
    if (!currentLog) return [];
    
    let items: DebugLogItem[] = [];
    
    if (filterStatus === "all") {
      items = currentLog.raw_items || [];
    } else if (filterStatus === "registered") {
      items = currentLog.registered_items || [];
    } else {
      items = currentLog.skipped_items || [];
    }

    if (!searchTerm) return items;

    const term = searchTerm.toLowerCase();
    return items.filter(item => {
      const jsonStr = JSON.stringify(item.raw).toLowerCase();
      return jsonStr.includes(term);
    });
  }, [currentLog, filterStatus, searchTerm]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getFieldValue = (item: DebugLogItem, fields: string[]): string => {
    for (const field of fields) {
      const value = item.raw[field];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
      // Also check lowercase
      const lowerField = field.toLowerCase();
      for (const key of Object.keys(item.raw)) {
        if (key.toLowerCase() === lowerField && item.raw[key] !== undefined) {
          return String(item.raw[key]);
        }
      }
    }
    return "-";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Integration Debug Logs</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Provider/Type Selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedLog || ""} onValueChange={setSelectedLog}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Select sync log..." />
          </SelectTrigger>
          <SelectContent>
            {debugLogs?.map(log => (
              <SelectItem 
                key={`${log.provider}-${log.sync_type}`} 
                value={`${log.provider}-${log.sync_type}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{log.provider}</span>
                  <Badge variant="outline" className="text-xs">{log.sync_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ({log.stats?.registered || 0}/{log.stats?.total || 0})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentLog && (
          <div className="text-sm text-muted-foreground">
            Last sync: {format(new Date(currentLog.sync_started_at), "dd/MM HH:mm:ss")}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {currentLog && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total Raw</div>
            <div className="text-xl font-bold">{currentLog.stats?.total || 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Registered</div>
            <div className="text-xl font-bold text-green-600">{currentLog.stats?.registered || 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Skipped</div>
            <div className="text-xl font-bold text-orange-600">{currentLog.stats?.skipped || 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Skip Reasons</div>
            <div className="text-sm">
              {Object.entries(currentLog.stats?.skipReasons || {}).slice(0, 2).map(([reason, count]) => (
                <div key={reason} className="truncate text-xs">
                  {reason}: {count}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      {currentLog && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in raw data (email, phone, closure, etc.)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="registered">Registered Only</SelectItem>
              <SelectItem value="skipped">Skipped Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Items Table */}
      {currentLog && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              Raw Data ({filteredItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Closure</TableHead>
                    <TableHead className="text-xs">Skip Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.slice(0, 200).map((item, index) => (
                    <>
                      <TableRow 
                        key={index}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          item.registered ? "bg-green-50/50 dark:bg-green-950/20" : ""
                        )}
                        onClick={() => toggleExpand(index)}
                      >
                        <TableCell className="py-2">
                          {expandedItems.has(index) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {item.registered ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              REG
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              SKIP
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {getFieldValue(item, ["uniqueId", "UniqueId", "id", "Id"]).slice(0, 12)}...
                        </TableCell>
                        <TableCell className="text-xs">
                          {getFieldValue(item, ["agentEmail", "email", "Email", "userEmail"])}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge 
                            variant={getFieldValue(item, ["closure", "Closure"]) === "Success" ? "default" : "outline"}
                            className="text-xs"
                          >
                            {getFieldValue(item, ["closure", "Closure"])}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-orange-600">
                          {item.skipReason || "-"}
                        </TableCell>
                      </TableRow>
                      {expandedItems.has(index) && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <ScrollArea className="max-h-[300px]">
                              <pre className="text-xs p-4 overflow-x-auto">
                                {JSON.stringify(item.raw, null, 2)}
                              </pre>
                            </ScrollArea>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
              {filteredItems.length > 200 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Showing first 200 of {filteredItems.length} items
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!currentLog && debugLogs && debugLogs.length === 0 && (
        <Card className="p-8 text-center">
          <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No Debug Logs Yet</h3>
          <p className="text-sm text-muted-foreground">
            Debug logs will appear here after the next integration sync runs.
          </p>
        </Card>
      )}

      {!selectedLog && debugLogs && debugLogs.length > 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Select a Sync Log</h3>
          <p className="text-sm text-muted-foreground">
            Choose a provider and sync type above to view raw data and filter results.
          </p>
        </Card>
      )}
    </div>
  );
}
