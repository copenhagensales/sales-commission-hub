import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AddPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salaryType: "team_leader" | "assistant" | "staff";
  title: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  is_staff_employee: boolean;
  salary_type: "provision" | "fixed" | "hourly" | null;
}

const getSalaryTypeLabel = (type: string | null) => {
  switch (type) {
    case "provision": return "Provision";
    case "fixed": return "Fast løn";
    case "hourly": return "Timeløn";
    default: return "Ikke angivet";
  }
};

const getMonthlySalaryLabel = (salaryType: string | null) => {
  switch (salaryType) {
    case "hourly": return "Timeløn (DKK/time)";
    case "fixed": return "Månedsløn (DKK)";
    case "provision": return "Basisløn (DKK)";
    default: return "Månedsløn (DKK)";
  }
};

export function AddPersonnelDialog({
  open,
  onOpenChange,
  salaryType,
  title,
}: AddPersonnelDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [percentageRate, setPercentageRate] = useState("");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch backoffice/staff employees
  const { data: employees = [] } = useQuery({
    queryKey: ["backoffice-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, is_staff_employee, salary_type")
        .eq("is_active", true)
        .eq("is_staff_employee", true)
        .order("first_name");

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch already added employees for this salary type
  const { data: existingEmployeeIds = [] } = useQuery({
    queryKey: ["existing-personnel-salaries", salaryType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select("employee_id")
        .eq("salary_type", salaryType);

      if (error) throw error;
      return data.map((d) => d.employee_id);
    },
  });

  const availableEmployees = useMemo(() => {
    return employees.filter(
      (emp) =>
        !existingEmployeeIds.includes(emp.id) &&
        (searchQuery === "" ||
          `${emp.first_name} ${emp.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()))
    );
  }, [employees, existingEmployeeIds, searchQuery]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error("Ingen medarbejder valgt");

      const { error } = await supabase.from("personnel_salaries").insert({
        employee_id: selectedEmployee.id,
        salary_type: salaryType,
        monthly_salary: parseFloat(monthlySalary) || 0,
        percentage_rate: parseFloat(percentageRate) || 0,
        minimum_salary: parseFloat(minimumSalary) || 0,
        notes: notes || null,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-salaries"] });
      queryClient.invalidateQueries({ queryKey: ["existing-personnel-salaries"] });
      toast({ title: "Medarbejder tilføjet" });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fejl ved tilføjelse",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSelectedEmployee(null);
    setMonthlySalary("");
    setPercentageRate("");
    setMinimumSalary("");
    setNotes("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee search */}
          <div className="space-y-2">
            <Label>Vælg medarbejder</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg i backoffice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {availableEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {employees.length === 0
                      ? "Ingen backoffice medarbejdere fundet"
                      : "Ingen tilgængelige medarbejdere"}
                  </p>
                ) : (
                  availableEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmployee(emp)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                        "hover:bg-muted",
                        selectedEmployee?.id === emp.id && "bg-primary/10 border border-primary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            {emp.first_name} {emp.last_name}
                          </span>
                          {emp.job_title && (
                            <span className="ml-2 text-muted-foreground">
                              – {emp.job_title}
                            </span>
                          )}
                        </div>
                        {selectedEmployee?.id === emp.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Vis valgt medarbejders løntype */}
          {selectedEmployee && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Løntype:</span>
                <Badge variant="secondary">
                  {getSalaryTypeLabel(selectedEmployee.salary_type)}
                </Badge>
              </div>
            </div>
          )}

          {/* Percentage rate */}
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

          {/* Minimum salary */}
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

          {/* Monthly salary / Hourly rate */}
          <div className="space-y-2">
            <Label htmlFor="monthly-salary">
              {getMonthlySalaryLabel(selectedEmployee?.salary_type ?? null)}
            </Label>
            <Input
              id="monthly-salary"
              type="number"
              step={selectedEmployee?.salary_type === "hourly" ? "0.01" : "1"}
              placeholder="0"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Noter (valgfrit)</Label>
            <Input
              id="notes"
              placeholder="Evt. noter..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedEmployee || addMutation.isPending}
            >
              {addMutation.isPending ? "Tilføjer..." : "Tilføj"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
