import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Play, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, addDays } from "date-fns";

interface BatchResult {
  batchNumber: number;
  from: string;
  to: string;
  status: "pending" | "running" | "success" | "error";
  salesProcessed?: number;
  error?: string;
  duration?: number;
}

interface BatchMigrationDialogProps {
  integrationId: string;
  integrationName: string;
  provider: string;
}

export function BatchMigrationDialog({ integrationId, integrationName, provider }: BatchMigrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [totalDays, setTotalDays] = useState(90);
  const [batchSizeDays, setBatchSizeDays] = useState(5);
  const [concurrency, setConcurrency] = useState(3);
  const [batches, setBatches] = useState<BatchResult[]>([]);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  // Generate date ranges for batches
  const generateBatches = useCallback(() => {
    const today = new Date();
    const batchList: BatchResult[] = [];
    let currentEnd = today;
    let batchNumber = 1;

    while (subDays(today, totalDays) < currentEnd) {
      const batchStart = subDays(currentEnd, batchSizeDays - 1);
      const effectiveStart = batchStart < subDays(today, totalDays) 
        ? subDays(today, totalDays) 
        : batchStart;

      batchList.push({
        batchNumber,
        from: format(effectiveStart, "yyyy-MM-dd"),
        to: format(currentEnd, "yyyy-MM-dd"),
        status: "pending",
      });

      currentEnd = subDays(effectiveStart, 1);
      batchNumber++;

      if (batchNumber > 100) break; // Safety limit
    }

    return batchList;
  }, [totalDays, batchSizeDays]);

  // Process a single batch
  const processBatch = async (batch: BatchResult): Promise<BatchResult> => {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          integration_id: integrationId,
          source: provider,
          actions: ["sales"],
          from: batch.from,
          to: batch.to,
        },
      });

      if (error) throw error;

      const salesCount = data?.results?.[0]?.data?.sales?.processed || 0;
      
      return {
        ...batch,
        status: "success",
        salesProcessed: salesCount,
        duration: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        ...batch,
        status: "error",
        error: err?.message || "Unknown error",
        duration: Date.now() - startTime,
      };
    }
  };

  // Run batches with controlled concurrency
  const runBatchMigration = async () => {
    const batchList = generateBatches();
    setBatches(batchList);
    setIsRunning(true);
    setCompletedBatches(0);
    setTotalSales(0);

    // Process batches with limited concurrency
    const queue = [...batchList];
    const inProgress = new Map<number, Promise<BatchResult>>();
    let salesAccum = 0;
    let completed = 0;

    const processNext = async () => {
      while (queue.length > 0 && inProgress.size < concurrency) {
        const batch = queue.shift()!;
        
        // Mark as running
        setBatches(prev => prev.map(b => 
          b.batchNumber === batch.batchNumber ? { ...b, status: "running" } : b
        ));

        const promise = processBatch(batch).then(result => {
          // Update batch result
          setBatches(prev => prev.map(b => 
            b.batchNumber === result.batchNumber ? result : b
          ));

          if (result.status === "success") {
            salesAccum += result.salesProcessed || 0;
            setTotalSales(salesAccum);
          }

          completed++;
          setCompletedBatches(completed);
          inProgress.delete(batch.batchNumber);

          return result;
        });

        inProgress.set(batch.batchNumber, promise);
      }

      if (inProgress.size > 0) {
        await Promise.race(inProgress.values());
        await processNext();
      }
    };

    await processNext();
    setIsRunning(false);
  };

  const progressPercent = batches.length > 0 
    ? Math.round((completedBatches / batches.length) * 100) 
    : 0;

  const successCount = batches.filter(b => b.status === "success").length;
  const errorCount = batches.filter(b => b.status === "error").length;

  const getStatusIcon = (status: BatchResult["status"]) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "running": return <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Layers className="h-4 w-4" />
          Batch Sync
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Batch Migration - {integrationName}
          </DialogTitle>
          <DialogDescription>
            Synkroniser historiske data i batches for at undgå hukommelsesgrænser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Configuration */}
          {!isRunning && batches.length === 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Antal dage</Label>
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Math.min(365, Math.max(7, parseInt(e.target.value) || 90)))}
                />
              </div>
              <div className="space-y-2">
                <Label>Batch størrelse (dage)</Label>
                <Select value={batchSizeDays.toString()} onValueChange={(v) => setBatchSizeDays(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 dage</SelectItem>
                    <SelectItem value="5">5 dage</SelectItem>
                    <SelectItem value="7">7 dage</SelectItem>
                    <SelectItem value="10">10 dage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parallelle kald</Label>
                <Select value={concurrency.toString()} onValueChange={(v) => setConcurrency(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (sekventiel)</SelectItem>
                    <SelectItem value="2">2 parallelle</SelectItem>
                    <SelectItem value="3">3 parallelle</SelectItem>
                    <SelectItem value="4">4 parallelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Preview */}
          {!isRunning && batches.length === 0 && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>
                  Dette vil oprette ca. <strong>{Math.ceil(totalDays / batchSizeDays)}</strong> batches 
                  og sende <strong>{concurrency}</strong> parallelle forespørgsler ad gangen
                </span>
              </div>
            </div>
          )}

          {/* Progress Section */}
          {(isRunning || batches.length > 0) && (
            <div className="space-y-4">
              {/* Overall Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Samlet fremskridt</span>
                  <span className="font-medium">{completedBatches} / {batches.length} batches</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{totalSales}</div>
                  <div className="text-xs text-muted-foreground">Salg synkroniseret</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-2xl font-bold text-primary">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Succesfulde batches</div>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="text-2xl font-bold text-destructive">{errorCount}</div>
                  <div className="text-xs text-muted-foreground">Fejlede batches</div>
                </div>
              </div>

              {/* Batch List */}
              <ScrollArea className="h-[250px] rounded-lg border">
                <div className="p-2 space-y-1">
                  {batches.map((batch) => (
                    <div 
                      key={batch.batchNumber}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        batch.status === "running" ? "bg-primary/10" :
                        batch.status === "success" ? "bg-green-500/5" :
                        batch.status === "error" ? "bg-destructive/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(batch.status)}
                        <span className="font-mono text-xs">#{batch.batchNumber}</span>
                        <span className="text-muted-foreground">
                          {batch.from} → {batch.to}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {batch.salesProcessed !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {batch.salesProcessed} salg
                          </Badge>
                        )}
                        {batch.duration && (
                          <span className="text-xs text-muted-foreground">
                            {(batch.duration / 1000).toFixed(1)}s
                          </span>
                        )}
                        {batch.error && (
                          <Badge variant="destructive" className="text-xs">
                            Fejl
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isRunning && batches.length === 0 && (
            <Button onClick={runBatchMigration} className="gap-2">
              <Play className="h-4 w-4" />
              Start Batch Migration
            </Button>
          )}
          {!isRunning && batches.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setBatches([])}>
                Nulstil
              </Button>
              <Button onClick={() => setOpen(false)}>
                Luk
              </Button>
            </>
          )}
          {isRunning && (
            <Button disabled>
              <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin mr-2" />
              Synkroniserer...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
