import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PostponeDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date) => void;
}

export function PostponeDateDialog({ open, onOpenChange, onConfirm }: PostponeDateDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
      setSelectedDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Vælg opfølgningsdato</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date()}
            locale={da}
            className={cn("p-3 pointer-events-auto")}
          />
        </div>
        {selectedDate && (
          <p className="text-sm text-muted-foreground text-center">
            Opfølgning: <span className="font-medium text-foreground">{format(selectedDate, "d. MMMM yyyy", { locale: da })}</span>
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button onClick={handleConfirm} disabled={!selectedDate}>Bekræft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
