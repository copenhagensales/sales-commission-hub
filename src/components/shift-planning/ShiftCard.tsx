import { useState } from "react";
import { format } from "date-fns";
import { Clock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shift, useUpdateShift, useDeleteShift } from "@/hooks/useShiftPlanning";
import { cn } from "@/lib/utils";

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
  showEmployee?: boolean;
}

export function ShiftCard({ shift, compact = false, showEmployee = false }: ShiftCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    start_time: shift.start_time,
    end_time: shift.end_time,
    break_minutes: shift.break_minutes?.toString() || "0",
    status: shift.status,
    note: shift.note || "",
  });

  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const statusColors = {
    planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const statusLabels = {
    planned: "Planlagt",
    completed: "Afsluttet",
    cancelled: "Aflyst",
  };

  const handleUpdate = () => {
    updateShift.mutate({
      id: shift.id,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      break_minutes: parseInt(editForm.break_minutes) || 0,
      status: editForm.status as "planned" | "completed" | "cancelled",
      note: editForm.note || null,
    }, {
      onSuccess: () => setEditDialogOpen(false)
    });
  };

  const handleDelete = () => {
    deleteShift.mutate(shift.id, {
      onSuccess: () => setDeleteDialogOpen(false)
    });
  };

  if (compact) {
    return (
      <>
        <div
          className={cn(
            "text-xs p-1 rounded mb-1 cursor-pointer hover:opacity-80",
            statusColors[shift.status]
          )}
          onClick={(e) => {
            e.stopPropagation();
            setEditDialogOpen(true);
          }}
        >
          <p className="font-medium">
            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
          </p>
          {shift.planned_hours && (
            <p className="text-[10px] opacity-75">{shift.planned_hours.toFixed(1)}t</p>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Rediger vagt</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {showEmployee && shift.employee && (
                <div>
                  <p className="text-sm font-medium">{shift.employee.first_name} {shift.employee.last_name}</p>
                  <p className="text-xs text-muted-foreground">{shift.employee.department}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Starttid</Label>
                  <Input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sluttid</Label>
                  <Input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pause (minutter)</Label>
                <Input
                  type="number"
                  value={editForm.break_minutes}
                  onChange={(e) => setEditForm({ ...editForm, break_minutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planlagt</SelectItem>
                    <SelectItem value="completed">Afsluttet</SelectItem>
                    <SelectItem value="cancelled">Aflyst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button
                variant="destructive"
                onClick={() => {
                  setEditDialogOpen(false);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Slet
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annuller
                </Button>
                <Button onClick={handleUpdate} disabled={updateShift.isPending}>
                  {updateShift.isPending ? "Gemmer..." : "Gem"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Slet vagt</DialogTitle>
              <DialogDescription>
                Er du sikker på, at du vil slette denne vagt? Denne handling kan ikke fortrydes.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Annuller
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteShift.isPending}>
                {deleteShift.isPending ? "Sletter..." : "Slet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full card view
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
          </span>
        </div>
        <Badge className={statusColors[shift.status]}>
          {statusLabels[shift.status]}
        </Badge>
      </div>
      {showEmployee && shift.employee && (
        <p className="text-sm">{shift.employee.first_name} {shift.employee.last_name}</p>
      )}
      {shift.planned_hours && (
        <p className="text-sm text-muted-foreground">{shift.planned_hours.toFixed(1)} timer</p>
      )}
      {shift.note && (
        <p className="text-xs text-muted-foreground">{shift.note}</p>
      )}
    </div>
  );
}
