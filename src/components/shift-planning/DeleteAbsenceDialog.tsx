import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAbsenceRequest, AbsenceRequest } from "@/hooks/useShiftPlanning";

interface DeleteAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence: AbsenceRequest | null;
}

export function DeleteAbsenceDialog({
  open,
  onOpenChange,
  absence
}: DeleteAbsenceDialogProps) {
  const deleteAbsence = useDeleteAbsenceRequest();

  const handleDelete = () => {
    if (!absence) return;
    
    deleteAbsence.mutate(absence.id, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Ferie";
      case "sick": return "Sygdom";
      case "day_off": return "Fridag";
      case "no_show": return "Udeblivelse";
      default: return type;
    }
  };

  if (!absence) return null;

  const dateRange = absence.start_date === absence.end_date
    ? format(new Date(absence.start_date), "d. MMMM yyyy", { locale: da })
    : `${format(new Date(absence.start_date), "d. MMM", { locale: da })} - ${format(new Date(absence.end_date), "d. MMM yyyy", { locale: da })}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Slet anmodning?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Er du sikker på, at du vil slette denne anmodning?</p>
            <p className="font-medium text-foreground">
              {getTypeLabel(absence.type)}: {dateRange}
            </p>
            {absence.comment && (
              <p className="text-sm italic">"{absence.comment}"</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuller</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteAbsence.isPending}
          >
            {deleteAbsence.isPending ? "Sletter..." : "Slet"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
