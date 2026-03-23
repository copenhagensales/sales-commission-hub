import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
}

export function SetPlannedDepartureDialog({ open, onOpenChange, employeeId, employeeName, currentEndDate }: Props) {
  const [date, setDate] = useState<Date | undefined>(currentEndDate ? new Date(currentEndDate) : undefined);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("employee_master_data")
      .update({ employment_end_date: date ? format(date, "yyyy-MM-dd") : null } as any)
      .eq("id", employeeId);

    if (error) {
      toast.error("Kunne ikke gemme slutdato");
    } else {
      toast.success(date ? `Slutdato sat til ${format(date, "d. MMM yyyy", { locale: da })}` : "Slutdato fjernet");
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
          <DialogTitle>Planlagt afgang</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sæt en slutdato for <strong>{employeeName}</strong>. Forecastet vil kun tælle vagter frem til denne dato.
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
        <div className="flex gap-2 justify-end">
          {currentEndDate && (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Fjern dato
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !date}>
            {saving ? "Gemmer..." : "Gem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
