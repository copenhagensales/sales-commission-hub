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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPENSATION_MODELS,
  COMPENSATION_MODEL_LABELS,
  resolveCompensation,
  type CompensationModel,
} from "@/lib/calculations/dbModel";
import {
  amountFieldLabel,
  compensationModelHelp,
  defaultCompensationModel,
  type PersonnelSalaryRow,
} from "./personnelSalary";

const getSalaryTypeLabel = (type: string | null) => {
  switch (type) {
    case "provision": return "Provision";
    case "fixed": return "Fast løn";
    case "hourly": return "Timeløn";
    default: return "Ikke angivet";
  }
};

interface EditPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salary: PersonnelSalaryRow | null;
}

export function EditPersonnelDialog({
  open,
  onOpenChange,
  salary,
}: EditPersonnelDialogProps) {
  const [compensationModel, setCompensationModel] =
    useState<CompensationModel>("monthly_fixed");
  const [percentageRate, setPercentageRate] = useState("");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch team info where employee is team leader
  const { data: teamData } = useQuery({
    queryKey: ["team-for-leader", salary?.employee_id],
    queryFn: async () => {
      if (!salary?.employee_id) return null;
      
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("team_leader_id", salary.employee_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!salary?.employee_id && salary?.salary_type === "team_leader",
  });

  // Fetch clients for the team
  const { data: clientsData } = useQuery({
    queryKey: ["team-clients", teamData?.id],
    queryFn: async () => {
      if (!teamData?.id) return [];
      
      const { data, error } = await supabase
        .from("team_clients")
        .select("client:clients(id, name)")
        .eq("team_id", teamData.id);

      if (error) throw error;
      return data?.map((tc) => tc.client).filter(Boolean) || [];
    },
    enabled: !!teamData?.id,
  });

  useEffect(() => {
    if (!salary) return;

    const resolved = resolveCompensation(salary);
    const model: CompensationModel =
      salary.compensation_model === "monthly_fixed" ||
      salary.compensation_model === "hourly" ||
      salary.compensation_model === "percentage"
        ? salary.compensation_model
        : resolved.hasBasis
          ? resolved.model
          : defaultCompensationModel(salary.salary_type);

    setCompensationModel(model);
    setPercentageRate(salary.percentage_rate?.toString() || "0");
    setMinimumSalary(salary.minimum_salary?.toString() || "0");
    setAmount(
      model === "hourly"
        ? (salary.hourly_rate ?? 0).toString()
        : (salary.monthly_salary ?? 0).toString()
    );
    setNotes(salary.notes || "");
    setStartDate(salary.start_date ? parseISO(salary.start_date) : undefined);
  }, [salary]);

  const parsedAmount = parseFloat(amount) || 0;
  const parsedPercentage = parseFloat(percentageRate) || 0;
  const parsedMinimum = parseFloat(minimumSalary) || 0;

  const missingAmount =
    (compensationModel === "monthly_fixed" || compensationModel === "hourly") &&
    parsedAmount <= 0;
  const missingPercentage =
    compensationModel === "percentage" && parsedPercentage <= 0 && parsedMinimum <= 0;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!salary) throw new Error("Ingen løndata");
      if (missingAmount) throw new Error("Udfyld beløbet for den valgte lønmodel");
      if (missingPercentage) throw new Error("Udfyld procentsats eller minimumsløn");

      const { error } = await supabase
        .from("personnel_salaries")
        .update({
          compensation_model: compensationModel,
          percentage_rate: compensationModel === "percentage" ? parsedPercentage : 0,
          minimum_salary: compensationModel === "percentage" ? parsedMinimum : 0,
          monthly_salary: compensationModel === "monthly_fixed" ? parsedAmount : 0,
          hourly_rate: compensationModel === "hourly" ? parsedAmount : 0,
          notes: notes || null,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        })
        .eq("id", salary.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-salaries"] });
      queryClient.invalidateQueries({ queryKey: ["assistant-hours-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["staff-hours-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["db-team-structure"] });
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

  const isTeamLeader = salary.salary_type === "team_leader";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Rediger løn: {salary.employee?.first_name} {salary.employee?.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Medarbejderens løntype */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Løntype i stamdata:</span>
              <Badge variant="secondary">
                {getSalaryTypeLabel(salary.employee?.salary_type ?? null)}
              </Badge>
            </div>
          </div>

          {/* Team info for team leaders */}
          {isTeamLeader && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Team:</span>
                <span className="text-sm">
                  {teamData?.name || "Ingen team tildelt"}
                </span>
              </div>
              
              {clientsData && clientsData.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Kunder:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {clientsData.map((client: { id: string; name: string }) => (
                      <Badge key={client.id} variant="secondary" className="text-xs">
                        {client.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="start-date">Startdato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Eksplicit lønmodel — beregningen gætter ikke længere ud fra beløbet */}
          <div className="space-y-2">
            <Label>Lønmodel</Label>
            <RadioGroup
              value={compensationModel}
              onValueChange={(value) => setCompensationModel(value as CompensationModel)}
              className="space-y-1"
            >
              {COMPENSATION_MODELS.map((model) => (
                <div key={model} className="flex items-center gap-2">
                  <RadioGroupItem value={model} id={`edit-model-${model}`} />
                  <Label htmlFor={`edit-model-${model}`} className="font-normal cursor-pointer">
                    {COMPENSATION_MODEL_LABELS[model]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {compensationModelHelp(compensationModel)}
            </p>
          </div>

          {compensationModel === "percentage" ? (
            <>
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
                <Label htmlFor="minimum-salary">Minimumsløn (kr. pr. måned)</Label>
                <Input
                  id="minimum-salary"
                  type="number"
                  placeholder="0"
                  value={minimumSalary}
                  onChange={(e) => setMinimumSalary(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Gulv for lønnen: det højeste af procentberegningen og den prorateret
                  minimumsløn.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amount">{amountFieldLabel(compensationModel)}</Label>
              <Input
                id="amount"
                type="number"
                step={compensationModel === "hourly" ? "0.01" : "1"}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Noter (valgfrit)</Label>
            <Input
              id="notes"
              placeholder="Evt. noter..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {(missingAmount || missingPercentage) && (
            <p className="text-xs text-destructive">
              Uden beløb kan lønnen ikke beregnes — DB vil vise "mangler grundlag".
            </p>
          )}

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
