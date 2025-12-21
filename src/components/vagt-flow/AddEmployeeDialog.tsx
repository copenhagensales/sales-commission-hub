import { useState, useEffect, useMemo } from "react";
import { format, addDays, isWithinInterval, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Trash2, AlertTriangle } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  full_name: string;
  team: string | null;
}

interface Booking {
  id: string;
  location?: { name: string };
  clients?: { name: string };
  client_id?: string;
  start_date: string;
  end_date: string;
  booked_days?: number[] | null;
}

interface EmployeeAbsence {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
}

interface ExistingAssignment {
  id: string;
  employee_id: string;
  date: string;
  booking_id: string;
  booking?: {
    location?: { name: string };
  };
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

  // Show all employees passed to this dialog (already filtered by job_title = Fieldmarketing in useVagtEmployees)
  const filteredEmployees = employees;

  // Fetch absences for the week period from absence_request_v2
  const weekEnd = addDays(weekStart, 6);
  const employeeIds = employees?.map(e => e.id) || [];
  
  const { data: absences = [] } = useQuery({
    queryKey: ["employee-absences-week-v2", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), employeeIds],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("id, employee_id, start_date, end_date, type, status")
        .in("employee_id", employeeIds)
        .in("status", ["approved", "pending"])
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .gte("end_date", format(weekStart, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data as EmployeeAbsence[];
    },
    enabled: open && employeeIds.length > 0,
  });

  // Fetch existing booking assignments for the week period (excluding current booking)
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["existing-assignments-week", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), employeeIds, booking?.id],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      
      const weekDates = Array.from({ length: 7 }, (_, i) => 
        format(addDays(weekStart, i), "yyyy-MM-dd")
      );
      
      let query = supabase
        .from("booking_assignment")
        .select("id, employee_id, date, booking_id, booking:booking_id(location:location_id(name))")
        .in("employee_id", employeeIds)
        .in("date", weekDates);
      
      // Exclude current booking's assignments
      if (booking?.id) {
        query = query.neq("booking_id", booking.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ExistingAssignment[];
    },
    enabled: open && employeeIds.length > 0,
  });

  // Create a map of employee absences by day with type info
  const absencesByEmployeeAndDay = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    
    absences.forEach((absence) => {
      const absenceStart = parseISO(absence.start_date);
      const absenceEnd = parseISO(absence.end_date);
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = addDays(weekStart, dayIndex);
        if (isWithinInterval(dayDate, { start: absenceStart, end: absenceEnd })) {
          const key = absence.employee_id;
          if (!map.has(key)) {
            map.set(key, new Map());
          }
          map.get(key)!.set(dayIndex, absence.type);
        }
      }
    });
    
    return map;
  }, [absences, weekStart]);

  // Create a map of existing bookings by employee and day
  const bookingsByEmployeeAndDay = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    
    existingAssignments.forEach((assignment) => {
      const assignmentDate = parseISO(assignment.date);
      const dayIndex = Math.floor((assignmentDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayIndex >= 0 && dayIndex < 7) {
        const key = assignment.employee_id;
        if (!map.has(key)) {
          map.set(key, new Map());
        }
        const locationName = (assignment.booking as any)?.location?.name || "Anden lokation";
        map.get(key)!.set(dayIndex, locationName);
      }
    });
    
    return map;
  }, [existingAssignments, weekStart]);

  // Get employees with absence in the selected days
  const employeesWithAbsence = useMemo(() => {
    const result: { employeeId: string; employeeName: string; days: { dayIndex: number; type: string }[] }[] = [];
    
    selectedEmployees.forEach((empId) => {
      if (!empId) return;
      const absenceDays = absencesByEmployeeAndDay.get(empId);
      if (absenceDays) {
        const overlappingDays = Array.from(selectedDays)
          .filter((d) => absenceDays.has(d))
          .map((d) => ({ dayIndex: d, type: absenceDays.get(d) || "Fravær" }));
        if (overlappingDays.length > 0) {
          const emp = filteredEmployees.find((e) => e.id === empId);
          if (emp) {
            result.push({
              employeeId: empId,
              employeeName: emp.full_name,
              days: overlappingDays,
            });
          }
        }
      }
    });
    
    return result;
  }, [selectedEmployees, selectedDays, absencesByEmployeeAndDay, filteredEmployees]);

  // Get employees already booked on selected days
  const employeesAlreadyBooked = useMemo(() => {
    const result: { employeeId: string; employeeName: string; days: { dayIndex: number; location: string }[] }[] = [];
    
    selectedEmployees.forEach((empId) => {
      if (!empId) return;
      const bookedDays = bookingsByEmployeeAndDay.get(empId);
      if (bookedDays) {
        const overlappingDays = Array.from(selectedDays)
          .filter((d) => bookedDays.has(d))
          .map((d) => ({ dayIndex: d, location: bookedDays.get(d) || "Anden lokation" }));
        if (overlappingDays.length > 0) {
          const emp = filteredEmployees.find((e) => e.id === empId);
          if (emp) {
            result.push({
              employeeId: empId,
              employeeName: emp.full_name,
              days: overlappingDays,
            });
          }
        }
      }
    });
    
    return result;
  }, [selectedEmployees, selectedDays, bookingsByEmployeeAndDay, filteredEmployees]);

  // Check if a specific employee has absence on a specific day
  const hasAbsenceOnDay = (employeeId: string, dayIndex: number) => {
    return absencesByEmployeeAndDay.get(employeeId)?.has(dayIndex) || false;
  };

  // Check if a specific employee is already booked on a specific day
  const isBookedOnDay = (employeeId: string, dayIndex: number) => {
    return bookingsByEmployeeAndDay.get(employeeId)?.has(dayIndex) || false;
  };

  // Get booking location for employee on day
  const getBookingLocationOnDay = (employeeId: string, dayIndex: number) => {
    return bookingsByEmployeeAndDay.get(employeeId)?.get(dayIndex) || null;
  };

  // Get absence type for employee on day
  const getAbsenceTypeOnDay = (employeeId: string, dayIndex: number) => {
    return absencesByEmployeeAndDay.get(employeeId)?.get(dayIndex) || null;
  };

  // Check if any selected employee has absence on a specific day
  const anySelectedHasAbsenceOnDay = (dayIndex: number) => {
    return selectedEmployees.some((empId) => empId && hasAbsenceOnDay(empId, dayIndex));
  };

  // Check if any selected employee is already booked on a specific day
  const anySelectedIsBookedOnDay = (dayIndex: number) => {
    return selectedEmployees.some((empId) => empId && isBookedOnDay(empId, dayIndex));
  };

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
    // Use booked_days if available, otherwise fall back to date range
    if (booking.booked_days && booking.booked_days.length > 0) {
      return booking.booked_days.includes(dayIndex);
    }
    const dayDateStr = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
    // Compare dates as strings to avoid timezone issues
    return dayDateStr >= booking.start_date && dayDateStr <= booking.end_date;
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
            
            {selectedEmployees.map((emp, index) => {
              const hasAbsence = emp && absencesByEmployeeAndDay.has(emp);
              const hasBooking = emp && bookingsByEmployeeAndDay.has(emp);
              const absenceTypes = emp && hasAbsence 
                ? [...new Set(Array.from(absencesByEmployeeAndDay.get(emp)!.values()))]
                : [];
              const bookingLocations = emp && hasBooking
                ? [...new Set(Array.from(bookingsByEmployeeAndDay.get(emp)!.values()))]
                : [];
              const hasWarning = hasAbsence || hasBooking;
              return (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={emp || ""}
                    onValueChange={(value) => updateEmployee(index, value)}
                  >
                    <SelectTrigger className={`flex-1 bg-background text-foreground ${hasAbsence ? "border-red-500 bg-red-50 dark:bg-red-950/20" : hasBooking ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      <SelectValue placeholder={`Medarbejder ${index + 1} (valgfri)`} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {filteredEmployees
                        .filter(e => !selectedEmployees.includes(e.id) || e.id === emp)
                        .map((employee) => {
                          const empAbsences = absencesByEmployeeAndDay.get(employee.id);
                          const empBookings = bookingsByEmployeeAndDay.get(employee.id);
                          const empHasAbsence = !!empAbsences;
                          const empHasBooking = !!empBookings;
                          const empAbsenceTypes = empHasAbsence 
                            ? [...new Set(Array.from(empAbsences.values()))]
                            : [];
                          const empBookingLocations = empHasBooking
                            ? [...new Set(Array.from(empBookings.values()))]
                            : [];
                          return (
                            <SelectItem 
                              key={employee.id} 
                              value={employee.id} 
                              className={`text-popover-foreground ${empHasAbsence ? "text-red-600 bg-red-50 dark:bg-red-950/20" : empHasBooking ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                            >
                              <span className="flex items-center gap-2">
                                {employee.full_name}
                                {empHasAbsence && (
                                  <>
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-500">({empAbsenceTypes.join(", ")})</span>
                                  </>
                                )}
                                {empHasBooking && !empHasAbsence && (
                                  <>
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                    <span className="text-xs text-amber-500">(Booket)</span>
                                  </>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  {hasAbsence && (
                    <span className="text-xs text-red-600 whitespace-nowrap">
                      {absenceTypes.join(", ")}
                    </span>
                  )}
                  {hasBooking && !hasAbsence && (
                    <span className="text-xs text-amber-600 whitespace-nowrap">
                      Booket
                    </span>
                  )}
                  {selectedEmployees.length > 1 && (
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
              );
            })}
            
            {selectedEmployees.length < filteredEmployees.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={addEmployeeSlot}
                className="w-full border-dashed"
              >
                + Tilføj medarbejder
              </Button>
            )}
          </div>

          {/* Warning for employees with absence */}
          {employeesWithAbsence.length > 0 && (
            <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-800 dark:text-red-200">
                    ⚠️ Fravær registreret - følgende medarbejdere kan ikke bookes:
                  </p>
                  <ul className="mt-2 space-y-1 text-red-700 dark:text-red-300">
                    {employeesWithAbsence.map((e) => {
                      const absenceTypes = [...new Set(e.days.map(d => d.type))];
                      const dayNames = e.days.map(d => DAY_NAMES[d.dayIndex]).join(", ");
                      return (
                        <li key={e.employeeId} className="flex flex-col">
                          <span className="font-medium">{e.employeeName}</span>
                          <span className="text-xs">
                            {absenceTypes.join(", ")} - {dayNames}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Warning for employees already booked */}
          {employeesAlreadyBooked.length > 0 && (
            <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    ⚠️ Allerede booket - følgende medarbejdere er booket andetsteds:
                  </p>
                  <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                    {employeesAlreadyBooked.map((e) => {
                      const locations = [...new Set(e.days.map(d => d.location))];
                      const dayNames = e.days.map(d => DAY_NAMES[d.dayIndex]).join(", ");
                      return (
                        <li key={e.employeeId} className="flex flex-col">
                          <span className="font-medium">{e.employeeName}</span>
                          <span className="text-xs">
                            {locations.join(", ")} - {dayNames}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Vælg hvilke dage medarbejderne skal bookes:</p>
            <div className="space-y-1">
              {DAY_NAMES.map((dayName, index) => {
                const inRange = isDayInBookingRange(index);
                const hasAbsenceWarning = anySelectedHasAbsenceOnDay(index);
                const hasBookingWarning = anySelectedIsBookedOnDay(index);
                const hasWarning = hasAbsenceWarning || hasBookingWarning;
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      inRange ? "hover:bg-muted/50 cursor-pointer" : "opacity-50"
                    } ${selectedDays.has(index) ? "border-primary bg-primary/5" : ""} ${
                      hasAbsenceWarning && inRange ? "border-red-500" : hasBookingWarning && inRange ? "border-amber-500" : ""
                    }`}
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
                    <div className="flex items-center gap-2">
                      {hasAbsenceWarning && inRange && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {hasBookingWarning && !hasAbsenceWarning && inRange && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-sm text-muted-foreground">{getDateForDay(index)}</span>
                    </div>
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
