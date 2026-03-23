import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  currentEndDate?: string | null;
  currentExpectedMonthlyShifts?: number | null;
}

export function SetPlannedDepartureDialog({ open, onOpenChange, employeeId, employeeName, currentEndDate, currentExpectedMonthlyShifts }: Props) {
  const [date, setDate] = useState<Date | undefined>(currentEndDate ? new Date(currentEndDate) : undefined);
  const [expectedShifts, setExpectedShifts] = useState<string>(currentExpectedMonthlyShifts?.toString() || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    const updates: Record<string, any> = {
      employment_end_date: date ? format(date, "yyyy-MM-dd") : null,
      expected_monthly_shifts: expectedShifts ? parseInt(expectedShifts, 10) : null,
    };

    const { error } = await supabase
      .from("employee_master_data")
      .update(updates as any)
      .eq("id", employeeId);

    if (error) {
      toast.error("Kunne ikke gemme ændringer");
    } else {
      toast.success("Ændringer gemt");
      queryClient.invalidateQueries({ queryKey: ["client-forecast"] });
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setDate(undefined);
    setSaving(true);
    const { error } = await supabase
      .from("employee_master_data")
      .update({ employment_end_date: null } as any)
      .eq("id", employeeId);

    if (error) {
      toast.error("Kunne ikke fjerne slutdato");
    } else {
      toast.success("Slutdato fjernet");
      queryClient.invalidateQueries({ queryKey: ["client-forecast"] });
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Indstillinger for {employeeName}</DialogTitle>
        </DialogHeader>

        {/* Planned departure */}
        <div className="space-y-2">
          <Label>Planlagt afgang</Label>
          <p className="text-xs text-muted-foreground">
            Forecastet tæller kun vagter frem til denne dato.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "d. MMMM yyyy", { locale: da }) : "Vælg slutdato"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Expected monthly shifts */}
        <div className="space-y-2">
          <Label>Forventede vagter/måned</Label>
          <p className="text-xs text-muted-foreground">
            Til tilkaldemedarbejdere uden fast vagtplan. Lad tom for automatisk beregning fra historik.
          </p>
          <Input
            type="number"
            min="0"
            max="31"
            placeholder="Auto (fra historik)"
            value={expectedShifts}
            onChange={(e) => setExpectedShifts(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          {currentEndDate && (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Fjern dato
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Gemmer..." : "Gem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
