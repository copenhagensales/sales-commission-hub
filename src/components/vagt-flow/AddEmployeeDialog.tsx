import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Employee {
  id: string;
  full_name: string;
  team: string | null;
}

interface Booking {
  id: string;
  location?: { name: string };
  start_date: string;
  end_date: string;
}

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  weekNumber: number;
  year: number;
  weekStart: Date;
  employees: Employee[];
  onAddAssignments: (assignments: { employeeId: string; dates: string[] }[]) => void;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function AddEmployeeDialog({
  open,
  onOpenChange,
  booking,
  weekNumber,
  year,
  weekStart,
  employees,
  onAddAssignments,
}: AddEmployeeDialogProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<(string | null)[]>([null]);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedEmployees([null]);
      setSelectedDays(new Set());
    }
  }, [open]);

  const addEmployeeSlot = () => {
    setSelectedEmployees([...selectedEmployees, null]);
  };

  const removeEmployeeSlot = (index: number) => {
    setSelectedEmployees(selectedEmployees.filter((_, i) => i !== index));
  };

  const updateEmployee = (index: number, value: string) => {
    const updated = [...selectedEmployees];
    updated[index] = value;
    setSelectedEmployees(updated);
  };

  const toggleDay = (dayIndex: number) => {
    const newSet = new Set(selectedDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedDays(newSet);
  };

  const isDayInBookingRange = (dayIndex: number) => {
    if (!booking) return false;
    const dayDate = addDays(weekStart, dayIndex);
    return dayDate >= new Date(booking.start_date) && dayDate <= new Date(booking.end_date);
  };

  const getDateForDay = (dayIndex: number) => {
    return format(addDays(weekStart, dayIndex), "d. MMM", { locale: da });
  };

  const totalAssignments = selectedEmployees.filter(e => e !== null).length * selectedDays.size;

  const handleSubmit = () => {
    const validEmployees = selectedEmployees.filter((e): e is string => e !== null);
    if (validEmployees.length === 0 || selectedDays.size === 0) return;

    const assignments = validEmployees.map(employeeId => ({
      employeeId,
      dates: Array.from(selectedDays).map(dayIndex => 
        format(addDays(weekStart, dayIndex), "yyyy-MM-dd")
      ),
    }));

    onAddAssignments(assignments);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tilføj medarbejdere til booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-medium">{booking?.location?.name}</p>
            <p className="text-sm text-muted-foreground">Uge {weekNumber}, {year}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Medarbejdere {selectedEmployees.filter(e => e !== null).length > 0 && (
                <span className="font-normal text-muted-foreground">
                  {selectedEmployees.filter(e => e !== null).length} valgt
                </span>
              )}
            </p>
            
            {selectedEmployees.map((emp, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={emp || undefined}
                  onValueChange={(value) => updateEmployee(index, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={`Medarbejder ${index + 1} (valgfri)`} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(e => !selectedEmployees.includes(e.id) || e.id === emp)
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmployeeSlot(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            {selectedEmployees.length < employees.length && (
              <Select
                value=""
                onValueChange={(value) => {
                  if (selectedEmployees[selectedEmployees.length - 1] !== null) {
                    addEmployeeSlot();
                  }
                  updateEmployee(
                    selectedEmployees[selectedEmployees.length - 1] === null 
                      ? selectedEmployees.length - 1 
                      : selectedEmployees.length, 
                    value
                  );
                }}
              >
                <SelectTrigger className="border-dashed">
                  <SelectValue placeholder={`Medarbejder ${selectedEmployees.length + 1} (valgfri)`} />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => !selectedEmployees.includes(e.id))
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Vælg hvilke dage medarbejderne skal bookes:</p>
            <div className="space-y-1">
              {DAY_NAMES.map((dayName, index) => {
                const inRange = isDayInBookingRange(index);
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      inRange ? "hover:bg-muted/50 cursor-pointer" : "opacity-50"
                    } ${selectedDays.has(index) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => inRange && toggleDay(index)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDays.has(index)}
                        disabled={!inRange}
                        onCheckedChange={() => inRange && toggleDay(index)}
                      />
                      <span>{dayName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{getDateForDay(index)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={totalAssignments === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Tilføj {totalAssignments} vagt{totalAssignments !== 1 ? "er" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
