import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";

type DatasetKey = "sales" | "calls";

interface SyncDateRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  provider: string;
}

export function SyncDateRangeDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  provider,
}: SyncDateRangeDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [datasets, setDatasets] = useState<Record<DatasetKey, boolean>>({ sales: true, calls: true });

  const selectedDatasets = useMemo(
    () => (Object.entries(datasets).filter(([, checked]) => checked).map(([dataset]) => dataset) as DatasetKey[]),
    [datasets],
  );

  const runSync = async () => {
    if (!fromDate || !toDate) {
      toast.error("Vælg både fra- og til-dato");
      return;
    }

    if (fromDate > toDate) {
      toast.error("Fra-dato kan ikke være efter til-dato");
      return;
    }

    if (selectedDatasets.length === 0) {
      toast.error("Vælg mindst ét dataset");
      return;
    }

    setIsRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          action: "safe-backfill",
          integration_id: integrationId,
          from: fromDate,
          to: toDate,
          datasets: selectedDatasets,
          background: true,
        },
      });

      if (error) throw error;

      toast.success(`${integrationName}: Backfill startet`, {
        description: data?.message || `${fromDate} → ${toDate} (${selectedDatasets.join(", ")})`,
      });

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Backfill fejlede: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync bestemte datoer</DialogTitle>
          <DialogDescription>
            Kør budget-aware safe-backfill for {integrationName} ({provider}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fra-dato</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Til-dato</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Datasets</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={datasets.sales} onCheckedChange={(checked) => setDatasets((prev) => ({ ...prev, sales: checked === true }))} />
                Salg
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={datasets.calls} onCheckedChange={(checked) => setDatasets((prev) => ({ ...prev, calls: checked === true }))} />
                Calls
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>Annuller</Button>
          <Button onClick={runSync} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Start sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
