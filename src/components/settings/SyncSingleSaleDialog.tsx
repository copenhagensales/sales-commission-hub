import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SyncSingleSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  provider: string;
}

interface SingleSaleResult {
  success?: boolean;
  healed?: number;
  failed?: number;
  skipped?: number;
  logs?: string[];
  message?: string;
}

export function SyncSingleSaleDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  provider,
}: SyncSingleSaleDialogProps) {
  const [externalId, setExternalId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SingleSaleResult | null>(null);

  const runSync = async () => {
    if (!externalId.trim()) {
      toast.error("Indtast et external ID");
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("enrichment-healer", {
        body: {
          integrationId,
          provider,
          saleExternalId: externalId.trim(),
          maxBatch: 1,
        },
      });

      if (error) throw error;

      setResult(data || {});
      toast.success(`${integrationName}: Single-sale sync kørt`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Single-sale sync fejlede: ${message}`);
      setResult({ success: false, message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync enkelt salg</DialogTitle>
          <DialogDescription>
            Hent og heal ét specifikt salg for {integrationName} ({provider}) via external ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>External ID</Label>
            <Input
              placeholder={provider === "adversus" ? "Adversus lead ID" : "Enreach UniqueId"}
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
            />
          </div>

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>Status: {result.success === false ? "Fejl" : "Kørt"}</p>
              <p>Healed: {result.healed || 0}</p>
              <p>Failed: {result.failed || 0}</p>
              <p>Skipped: {result.skipped || 0}</p>
              {result.message ? <p>Besked: {result.message}</p> : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>Luk</Button>
          <Button onClick={runSync} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Hent og sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
