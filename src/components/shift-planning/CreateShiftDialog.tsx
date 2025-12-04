import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useCreateShift } from "@/hooks/useShiftPlanning";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  standard_start_time: string | null;
  weekly_hours: number | null;
}

interface CreateShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  employees: Employee[];
  preselectedEmployeeId?: string;
}

export function CreateShiftDialog({
  open,
  onOpenChange,
  selectedDate,
  employees,
  preselectedEmployeeId
}: CreateShiftDialogProps) {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(selectedDate || undefined);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [note, setNote] = useState("");

  const createShift = useCreateShift();

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (preselectedEmployeeId) {
      setEmployeeId(preselectedEmployeeId);
    }
  }, [preselectedEmployeeId]);

  // Auto-fill times based on employee's standard start time
  useEffect(() => {
    if (employeeId) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee?.standard_start_time) {
        // Parse "8.00-16.30" format
        const [start, end] = employee.standard_start_time.split("-");
        if (start && end) {
          setStartTime(start.replace(".", ":"));
          setEndTime(end.replace(".", ":"));
        }
      }
    }
  }, [employeeId, employees]);

  const handleSubmit = () => {
    if (!employeeId || !date) return;

    createShift.mutate({
      employee_id: employeeId,
      date: format(date, "yyyy-MM-dd"),
      start_time: startTime,
      end_time: endTime,
      break_minutes: parseInt(breakMinutes) || 0,
      status: "planned",
      note: note || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setEmployeeId("");
    setDate(undefined);
    setStartTime("08:00");
    setEndTime("16:00");
    setBreakMinutes("30");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Opret ny vagt</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Medarbejder</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg medarbejder" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.department && `(${emp.department})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={da}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Starttid</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sluttid</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pause (minutter)</Label>
            <Input
              type="number"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              min="0"
              max="120"
            />
          </div>

          <div className="space-y-2">
            <Label>Note (valgfri)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Evt. bemærkninger..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={!employeeId || !date || createShift.isPending}>
            {createShift.isPending ? "Opretter..." : "Opret vagt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
