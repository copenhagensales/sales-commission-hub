import { useEffect, useState } from "react";
import { CalendarDays, Info, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  activateEmployee,
  resolveActivationStartDate,
  todayIso,
  type ResolvedActivationDate,
} from "@/lib/employees/activateEmployee";

interface ActivateEmployeeDialogProps {
  employee: { id: string; first_name?: string | null; last_name?: string | null; employment_start_date?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated?: () => void;
}

export function ActivateEmployeeDialog({ employee, open, onOpenChange, onActivated }: ActivateEmployeeDialogProps) {
  const { toast } = useToast();
  const [resolved, setResolved] = useState<ResolvedActivationDate | null>(null);
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    let cancelled = false;
    setLoading(true);
    resolveActivationStartDate(employee.id, employee.employment_start_date)
      .then((r) => {
        if (cancelled) return;
        setResolved(r);
        setStartDate(r.date);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, employee]);

  const handleConfirm = async () => {
    if (!employee || !startDate) return;
    setSaving(true);
    try {
      await activateEmployee({ employeeId: employee.id, startDate });
      toast({ title: "Medarbejder aktiveret" });
      onOpenChange(false);
      onActivated?.();
    } catch (error) {
      toast({
        title: "Fejl",
        description: error instanceof Error ? error.message : "Kunne ikke aktivere medarbejderen",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const name = [employee?.first_name, employee?.last_name].filter(Boolean).join(" ");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Startdato for ansættelsen?</AlertDialogTitle>
          <AlertDialogDescription>
            {name ? `${name} aktiveres med denne startdato.` : "Medarbejderen aktiveres med denne startdato."}{" "}
            Du kan rette datoen, hvis den ikke passer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="activation-start-date" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Startdato
          </Label>
          <Input
            id="activation-start-date"
            type="date"
            value={startDate}
            disabled={loading || saving}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {loading ? (
            <p className="text-xs text-muted-foreground">Henter startdato…</p>
          ) : resolved?.source === "cohort" ? (
            <p className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Datoen kommer fra opstartsholdet
                {resolved.cohortName ? ` «${resolved.cohortName}»` : ""} under Kommende opstarter.
              </span>
            </p>
          ) : resolved?.source === "employee" ? (
            <p className="text-xs text-muted-foreground">
              Datoen kommer fra medarbejderens eksisterende startdato.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ingen opstartshold fundet — datoen er sat til i dag.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Annullér</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={saving || loading || !startDate}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aktiverer…
              </>
            ) : (
              "Aktivér"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
