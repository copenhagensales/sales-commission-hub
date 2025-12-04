import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { Car } from "lucide-react";
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

interface Vehicle {
  id: string;
  name: string;
  license_plate: string;
}

interface Booking {
  id: string;
  location?: { name: string };
  start_date: string;
  end_date: string;
}

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  weekNumber: number;
  year: number;
  weekStart: Date;
  vehicles: Vehicle[];
  onAddAssignments: (assignments: { vehicleId: string; dates: string[] }) => void;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function AddVehicleDialog({
  open,
  onOpenChange,
  booking,
  weekNumber,
  year,
  weekStart,
  vehicles,
  onAddAssignments,
}: AddVehicleDialogProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedVehicle(null);
      setSelectedDays(new Set());
    }
  }, [open]);

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

  const totalAssignments = selectedVehicle ? selectedDays.size : 0;

  const handleSubmit = () => {
    if (!selectedVehicle || selectedDays.size === 0) return;

    onAddAssignments({
      vehicleId: selectedVehicle,
      dates: Array.from(selectedDays).map(dayIndex => 
        format(addDays(weekStart, dayIndex), "yyyy-MM-dd")
      ),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Tilføj bil til booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-medium">{booking?.location?.name}</p>
            <p className="text-sm text-muted-foreground">Uge {weekNumber}, {year}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Vælg bil</p>
            <Select
              value={selectedVehicle || ""}
              onValueChange={setSelectedVehicle}
            >
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue placeholder="Vælg en bil" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id} className="text-popover-foreground">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      <span>{vehicle.name}</span>
                      <span className="text-muted-foreground text-xs">({vehicle.license_plate})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Vælg hvilke dage bilen skal bruges:</p>
            <div className="space-y-1">
              {DAY_NAMES.map((dayName, index) => {
                const inRange = isDayInBookingRange(index);
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      inRange ? "hover:bg-muted/50 cursor-pointer" : "opacity-50"
                    } ${selectedDays.has(index) ? "border-blue-500 bg-blue-50" : ""}`}
                    onClick={() => inRange && toggleDay(index)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDays.has(index)}
                        disabled={!inRange}
                        onCheckedChange={() => inRange && toggleDay(index)}
                      />
                      <span className={selectedDays.has(index) ? "text-blue-800" : ""}>{dayName}</span>
                    </div>
                    <span className={`text-sm ${selectedDays.has(index) ? "text-blue-600" : "text-muted-foreground"}`}>
                      {getDateForDay(index)}
                    </span>
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              Tilføj bil til {totalAssignments} dag{totalAssignments !== 1 ? "e" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
