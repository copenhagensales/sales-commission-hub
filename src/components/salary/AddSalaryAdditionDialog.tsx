import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const COLUMN_OPTIONS: { value: string; label: string }[] = [
  { value: "commission", label: "Provision" },
  { value: "cancellations", label: "Annulleringer" },
  { value: "vacationPay", label: "Feriepenge" },
  { value: "diet", label: "Diet" },
  { value: "sickDays", label: "Sygdom" },
  { value: "dailyBonus", label: "Dagsbonus" },
  { value: "startupBonus", label: "Opstartsbonus" },
  { value: "referralBonus", label: "Henvisning" },
];

interface Employee {
  id: string;
  name: string;
}

interface AddSalaryAdditionDialogProps {
  employees: Employee[];
  periodStart: Date;
  periodEnd: Date;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Generate salary periods (15th to 14th) around a reference date */
function generatePeriodOptions(referencePeriodStart: Date): { start: Date; end: Date; label: string }[] {
  const periods: { start: Date; end: Date; label: string }[] = [];
  
  // Generate 3 months back and 2 months forward from the reference
  for (let offset = -3; offset <= 2; offset++) {
    const refYear = referencePeriodStart.getFullYear();
    const refMonth = referencePeriodStart.getMonth();
    
    const startMonth = refMonth + offset;
    const start = new Date(refYear, startMonth, 15);
    const end = new Date(refYear, startMonth + 1, 14);
    
    const label = `${format(start, "d. MMM", { locale: da })} - ${format(end, "d. MMM yyyy", { locale: da })}`;
    periods.push({ start, end, label });
  }
  
  return periods;
}

export function AddSalaryAdditionDialog({
  employees,
  periodStart,
  periodEnd,
}: AddSalaryAdditionDialogProps) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [columnKey, setColumnKey] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<string>("");
  const queryClient = useQueryClient();

  const periodOptions = useMemo(() => generatePeriodOptions(periodStart), [periodStart]);

  // Find the index of the current period to use as default
  const currentPeriodIdx = useMemo(() => {
    const refStr = toLocalDateString(periodStart);
    const idx = periodOptions.findIndex(p => toLocalDateString(p.start) === refStr);
    return idx >= 0 ? String(idx) : "0";
  }, [periodOptions, periodStart]);

  const activePeriodIdx = selectedPeriodIdx || currentPeriodIdx;
  const activePeriod = periodOptions[parseInt(activePeriodIdx)] || { start: periodStart, end: periodEnd };

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("salary_additions") as any).insert({
        employee_id: employeeId,
        column_key: columnKey,
        amount: parseFloat(amount),
        period_start: toLocalDateString(activePeriod.start),
        period_end: toLocalDateString(activePeriod.end),
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Løntilføjelse gemt");
      queryClient.invalidateQueries({ queryKey: ["salary-additions"] });
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Kunne ikke gemme løntilføjelse");
    },
  });

  const resetForm = () => {
    setEmployeeId("");
    setColumnKey("");
    setAmount("");
    setNote("");
    setEmployeeSearch("");
    setSelectedPeriodIdx("");
  };

  const canSubmit =
    employeeId && columnKey && amount && !isNaN(parseFloat(amount));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Løntilføjelse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj løntilføjelse</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Medarbejder</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg medarbejder" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Søg..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                {filteredEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kolonne</Label>
            <Select value={columnKey} onValueChange={setColumnKey}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kolonne" />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lønperiode</Label>
            <Select value={activePeriodIdx} onValueChange={setSelectedPeriodIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg lønperiode" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Beløb (brug minus for fradrag)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="fx 500 eller -200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Note (valgfri)</Label>
            <Input
              placeholder="Beskrivelse..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Gemmer..." : "Gem tilføjelse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
