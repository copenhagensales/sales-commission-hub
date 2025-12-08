import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TimeStamp {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  effective_clock_in: string | null;
  effective_clock_out: string | null;
  effective_hours: number | null;
  break_minutes: number | null;
  note: string | null;
}

interface EditTimeStampDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeStamp: TimeStamp | null;
  employeeId: string;
  employeeName: string;
  date: Date;
}

export function EditTimeStampDialog({
  open,
  onOpenChange,
  timeStamp,
  employeeId,
  employeeName,
  date,
}: EditTimeStampDialogProps) {
  const queryClient = useQueryClient();
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (timeStamp) {
      setClockIn(format(new Date(timeStamp.clock_in), "HH:mm"));
      setClockOut(timeStamp.clock_out ? format(new Date(timeStamp.clock_out), "HH:mm") : "");
      setNote(timeStamp.note || "");
    } else {
      setClockIn("");
      setClockOut("");
      setNote("");
    }
  }, [timeStamp, open]);

  const updateTimeStamp = useMutation({
    mutationFn: async (data: { clockIn: string; clockOut: string; note: string }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      // Use timezone offset to ensure correct local time is stored
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;
      
      const clockInTime = `${dateStr}T${data.clockIn}:00${tz}`;
      const clockOutTime = data.clockOut ? `${dateStr}T${data.clockOut}:00${tz}` : null;

      // Calculate effective hours if both times are set
      let effectiveHours: number | null = null;
      if (clockOutTime) {
        const diffMs = new Date(clockOutTime).getTime() - new Date(clockInTime).getTime();
        effectiveHours = Math.max(0, diffMs / (1000 * 60 * 60) - 1); // Minus 1 hour break
      }

      const { error } = await supabase
        .from("time_stamps")
        .update({
          clock_in: clockInTime,
          clock_out: clockOutTime,
          effective_clock_in: clockInTime,
          effective_clock_out: clockOutTime,
          effective_hours: effectiveHours,
          note: data.note || null,
          edited_at: new Date().toISOString(),
        })
        .eq("id", timeStamp!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-stamps-week"] });
      queryClient.invalidateQueries({ queryKey: ["time-stamps-range"] });
      toast.success("Tidsstempel opdateret");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke opdatere: " + error.message);
    },
  });

  const createTimeStamp = useMutation({
    mutationFn: async (data: { clockIn: string; clockOut: string; note: string }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      // Use timezone offset to ensure correct local time is stored
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;
      
      const clockInTime = `${dateStr}T${data.clockIn}:00${tz}`;
      const clockOutTime = data.clockOut ? `${dateStr}T${data.clockOut}:00${tz}` : null;

      let effectiveHours: number | null = null;
      if (clockOutTime) {
        const diffMs = new Date(clockOutTime).getTime() - new Date(clockInTime).getTime();
        effectiveHours = Math.max(0, diffMs / (1000 * 60 * 60) - 1);
      }

      const { error } = await supabase
        .from("time_stamps")
        .insert({
          employee_id: employeeId,
          clock_in: clockInTime,
          clock_out: clockOutTime,
          effective_clock_in: clockInTime,
          effective_clock_out: clockOutTime,
          effective_hours: effectiveHours,
          note: data.note || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-stamps-week"] });
      queryClient.invalidateQueries({ queryKey: ["time-stamps-range"] });
      toast.success("Tidsstempel oprettet");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke oprette: " + error.message);
    },
  });

  const handleSave = () => {
    if (!clockIn) {
      toast.error("Indtast stempeltidspunkt");
      return;
    }
    if (timeStamp) {
      updateTimeStamp.mutate({ clockIn, clockOut, note });
    } else {
      createTimeStamp.mutate({ clockIn, clockOut, note });
    }
  };

  const isLoading = updateTimeStamp.isPending || createTimeStamp.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {timeStamp ? "Rediger tidsstempel" : "Opret tidsstempel"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{employeeName}</span>
            <span className="mx-2">•</span>
            {format(date, "EEEE d. MMMM yyyy", { locale: da })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clockIn">Stemplet ind</Label>
              <Input
                id="clockIn"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                placeholder="08:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clockOut">Stemplet ud</Label>
              <Input
                id="clockOut"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                placeholder="16:00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (valgfri)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="f.eks. Glemt at stemple ind"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-1.5" />
            {isLoading ? "Gemmer..." : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
