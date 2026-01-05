import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useUpdateShift, useDeleteShift, Shift } from "@/hooks/useShiftPlanning";

interface EditShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift;
}

export function EditShiftDialog({ open, onOpenChange, shift }: EditShiftDialogProps) {
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

  useEffect(() => {
    if (open && shift) {
      setEditForm({
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_minutes: shift.break_minutes?.toString() || "0",
        status: shift.status,
        note: shift.note || "",
      });
    }
  }, [open, shift]);

  const handleUpdate = () => {
    updateShift.mutate({
      id: shift.id,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      break_minutes: parseInt(editForm.break_minutes) || 0,
      status: editForm.status as "planned" | "completed" | "cancelled",
      note: editForm.note || null,
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  const handleDelete = () => {
    deleteShift.mutate(shift.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        onOpenChange(false);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger vagt</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                onOpenChange(false);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Slet
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
        <DialogContent>
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