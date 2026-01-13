import { useState, useEffect } from "react";
import { format, differenceInDays, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { useCreateAbsenceRequest, useDanishHolidays } from "@/hooks/useShiftPlanning";
import { cn } from "@/lib/utils";

interface CreateAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  selectedDate: Date | null;
  defaultType?: "vacation" | "sick";
}

export function CreateAbsenceDialog({
  open,
  onOpenChange,
  employeeId,
  selectedDate,
  defaultType = "vacation"
}: CreateAbsenceDialogProps) {
  const [type, setType] = useState<"vacation" | "sick">(defaultType);
  const [startDate, setStartDate] = useState<Date | undefined>(selectedDate || undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(selectedDate || undefined);
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [comment, setComment] = useState("");
  const [holidayWarning, setHolidayWarning] = useState<string | null>(null);
  const [shortNoticeWarning, setShortNoticeWarning] = useState<string | null>(null);

  const createAbsence = useCreateAbsenceRequest();
  const { data: holidays } = useDanishHolidays();

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  // Check for short notice (less than 5 weeks / 35 days)
  useEffect(() => {
    if (type === "vacation" && startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilStart = differenceInDays(startDate, today);
      
      if (daysUntilStart < 35) {
        setShortNoticeWarning(
          `Ferie skal søges med minimum 5 ugers varsel (35 dage). Du kan ikke søge ferie med så kort varsel. Kontakt din teamleder, som kan godkende ferien manuelt.`
        );
      } else {
        setShortNoticeWarning(null);
      }
    } else {
      setShortNoticeWarning(null);
    }
  }, [type, startDate]);

  // Check for holiday conflicts
  useEffect(() => {
    if (type === "vacation" && startDate && holidays) {
      const today = new Date();
      const daysUntilStart = differenceInDays(startDate, today);
      
      // Check if any selected date is a holiday
      const holidayConflict = holidays.find(h => {
        const holidayDate = new Date(h.date);
        if (!endDate) {
          return holidayDate.getTime() === startDate.getTime();
        }
        return holidayDate >= startDate && holidayDate <= endDate;
      });

      if (holidayConflict && daysUntilStart < 7) {
        setHolidayWarning(
          `${holidayConflict.name} falder i den valgte periode. Du skal ansøge mindst 7 dage i forvejen for at holde fri på en helligdag.`
        );
      } else {
        setHolidayWarning(null);
      }
    } else {
      setHolidayWarning(null);
    }
  }, [type, startDate, endDate, holidays]);

  const handleSubmit = () => {
    if (!startDate || !endDate) return;

    // Block if holiday warning or short notice warning exists
    if (holidayWarning || shortNoticeWarning) return;

    createAbsence.mutate({
      employee_id: employeeId,
      type,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      start_time: isFullDay ? null : startTime,
      end_time: isFullDay ? null : endTime,
      is_full_day: isFullDay,
      comment: comment || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setIsFullDay(true);
    setStartTime("08:00");
    setEndTime("12:00");
    setComment("");
    setHolidayWarning(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Anmod om fravær</DialogTitle>
          <DialogDescription>
            Vælg type og periode for dit fravær
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fra dato</Label>
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
                    {startDate ? format(startDate, "d. MMM", { locale: da }) : "Vælg"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (!endDate || (date && date > endDate)) {
                        setEndDate(date);
                      }
                    }}
                    locale={da}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Til dato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "d. MMM", { locale: da }) : "Vælg"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    locale={da}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Short Notice Warning */}
          {shortNoticeWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{shortNoticeWarning}</AlertDescription>
            </Alert>
          )}

          {/* Holiday Warning */}
          {holidayWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{holidayWarning}</AlertDescription>
            </Alert>
          )}

          {/* Partial Day Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="full-day">Hele dagen</Label>
            <Switch
              id="full-day"
              checked={isFullDay}
              onCheckedChange={setIsFullDay}
            />
          </div>

          {/* Time Selection (if partial day) */}
          {!isFullDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fra kl.</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Til kl.</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Comment */}
          <div className="space-y-2">
            <Label>Kommentar (valgfri)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Evt. bemærkninger..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!startDate || !endDate || !!holidayWarning || !!shortNoticeWarning || createAbsence.isPending}
          >
            {createAbsence.isPending ? "Sender..." : "Send anmodning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
