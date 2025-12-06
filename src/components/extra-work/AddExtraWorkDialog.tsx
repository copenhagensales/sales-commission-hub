import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateExtraWork } from "@/hooks/useExtraWork";
import { format } from "date-fns";

interface AddExtraWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId?: string;
  defaultDate?: string;
  defaultFromTime?: string;
}

const REASON_OPTIONS = [
  { value: "ekstra_opgave", label: "Ekstra opgave" },
  { value: "vikardaekning", label: "Vikardækning" },
  { value: "kundeopgave", label: "Kundeopgave" },
  { value: "andet", label: "Andet" },
];

export function AddExtraWorkDialog({
  open,
  onOpenChange,
  shiftId,
  defaultDate,
  defaultFromTime,
}: AddExtraWorkDialogProps) {
  const [date, setDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [fromTime, setFromTime] = useState(defaultFromTime || "17:00");
  const [toTime, setToTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  
  const createMutation = useCreateExtraWork();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalReason = reason === "andet" 
      ? customReason 
      : REASON_OPTIONS.find(r => r.value === reason)?.label || reason;

    await createMutation.mutateAsync({
      shift_id: shiftId,
      date,
      from_time: fromTime,
      to_time: toTime,
      reason: finalReason,
    });

    onOpenChange(false);
    // Reset form
    setDate(defaultDate || format(new Date(), "yyyy-MM-dd"));
    setFromTime(defaultFromTime || "17:00");
    setToTime("18:00");
    setReason("");
    setCustomReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj ekstra arbejde</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Dato *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromTime">Fra kl. *</Label>
              <Input
                id="fromTime"
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toTime">Til kl. *</Label>
              <Input
                id="toTime"
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Årsag</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg årsag (valgfrit)" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "andet" && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Beskriv årsag</Label>
              <Input
                id="customReason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Skriv årsag..."
                maxLength={200}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
