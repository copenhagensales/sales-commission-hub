import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PersonnelSalary {
  id: string;
  employee_id: string;
  salary_type: string;
  monthly_salary: number;
  percentage_rate: number | null;
  minimum_salary: number | null;
  is_active: boolean;
  notes: string | null;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string | null;
  } | null;
}

interface EditPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salary: PersonnelSalary | null;
}

export function EditPersonnelDialog({
  open,
  onOpenChange,
  salary,
}: EditPersonnelDialogProps) {
  const [percentageRate, setPercentageRate] = useState("");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (salary) {
      setPercentageRate(salary.percentage_rate?.toString() || "0");
      setMinimumSalary(salary.minimum_salary?.toString() || "0");
      setMonthlySalary(salary.monthly_salary?.toString() || "0");
      setNotes(salary.notes || "");
    }
  }, [salary]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!salary) throw new Error("Ingen løndata");

      const { error } = await supabase
        .from("personnel_salaries")
        .update({
          percentage_rate: parseFloat(percentageRate) || 0,
          minimum_salary: parseFloat(minimumSalary) || 0,
          monthly_salary: parseFloat(monthlySalary) || 0,
          notes: notes || null,
        })
        .eq("id", salary.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-salaries"] });
      toast({ title: "Lønoplysninger opdateret" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fejl ved opdatering",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    },
  });

  if (!salary) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Rediger løn: {salary.employee?.first_name} {salary.employee?.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="percentage-rate">Procentsats (%)</Label>
            <Input
              id="percentage-rate"
              type="number"
              step="0.1"
              placeholder="0"
              value={percentageRate}
              onChange={(e) => setPercentageRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimum-salary">Minimumsløn (DKK)</Label>
            <Input
              id="minimum-salary"
              type="number"
              placeholder="0"
              value={minimumSalary}
              onChange={(e) => setMinimumSalary(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-salary">Månedsløn (DKK)</Label>
            <Input
              id="monthly-salary"
              type="number"
              placeholder="0"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter (valgfrit)</Label>
            <Input
              id="notes"
              placeholder="Evt. noter..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
