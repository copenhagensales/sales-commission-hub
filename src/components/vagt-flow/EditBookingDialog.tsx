import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  location?: { name: string };
  clients?: { name: string };
  status: string;
  booked_days?: number[] | null;
  comment?: string | null;
  expected_staff_count?: number | null;
  start_date: string;
  end_date: string;
}

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  weekNumber: number;
  year: number;
  weekStart: Date;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const STATUSES = ["Planlagt", "Bekræftet", "Afsluttet", "Aflyst"] as const;
type BookingStatus = typeof STATUSES[number];

export function EditBookingDialog({
  open,
  onOpenChange,
  booking,
  weekNumber,
  year,
  weekStart,
}: EditBookingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<BookingStatus>("Planlagt");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [comment, setComment] = useState<string>("");
  const [expectedStaffCount, setExpectedStaffCount] = useState<number>(1);

  useEffect(() => {
    if (open && booking) {
      setStatus((booking.status as BookingStatus) || "Planlagt");
      setSelectedDays(new Set(booking.booked_days || []));
      setComment(booking.comment || "");
      setExpectedStaffCount(booking.expected_staff_count || 1);
    }
  }, [open, booking]);

  const updateBookingMutation = useMutation({
    mutationFn: async (data: {
      status: BookingStatus;
      booked_days: number[];
      comment: string | null;
      expected_staff_count: number;
    }) => {
      if (!booking) throw new Error("No booking selected");

      const { error } = await supabase
        .from("booking")
        .update({
          status: data.status,
          booked_days: data.booked_days,
          comment: data.comment || null,
          expected_staff_count: data.expected_staff_count,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings"] });
      toast({ title: "Booking opdateret" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const toggleDay = (dayIndex: number) => {
    const newSet = new Set(selectedDays);
    if (newSet.has(dayIndex)) {
      newSet.delete(dayIndex);
    } else {
      newSet.add(dayIndex);
    }
    setSelectedDays(newSet);
  };

  const getDateForDay = (dayIndex: number) => {
    return format(addDays(weekStart, dayIndex), "d. MMM", { locale: da });
  };

  const handleSubmit = () => {
    updateBookingMutation.mutate({
      status,
      booked_days: Array.from(selectedDays).sort((a, b) => a - b),
      comment: comment.trim() || null,
      expected_staff_count: expectedStaffCount,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-medium">{booking?.location?.name}</p>
            <p className="text-sm text-muted-foreground">
              {booking?.clients?.name} • Uge {weekNumber}, {year}
            </p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expected staff count */}
          <div className="space-y-2">
            <Label>Forventet antal medarbejdere</Label>
            <Select
              value={expectedStaffCount.toString()}
              onValueChange={(v) => setExpectedStaffCount(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "medarbejder" : "medarbejdere"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days selection */}
          <div className="space-y-2">
            <Label>Dage</Label>
            <div className="space-y-1">
              {DAY_NAMES.map((dayName, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                    selectedDays.has(index) ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => toggleDay(index)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedDays.has(index)}
                      onCheckedChange={() => toggleDay(index)}
                    />
                    <span>{dayName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {getDateForDay(index)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label>Kommentar (valgfri)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tilføj en kommentar til denne booking..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedDays.size === 0 || updateBookingMutation.isPending}
          >
            {updateBookingMutation.isPending ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
