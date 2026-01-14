import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Pencil, Trash2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AbsenceRequest } from "@/hooks/useShiftPlanning";
import { EditAbsenceDialog } from "./EditAbsenceDialog";
import { DeleteAbsenceDialog } from "./DeleteAbsenceDialog";

interface PendingAbsencesListProps {
  absences: AbsenceRequest[];
  title?: string;
}

export function PendingAbsencesList({ 
  absences,
  title = "Afventende anmodninger"
}: PendingAbsencesListProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceRequest | null>(null);

  const handleEdit = (absence: AbsenceRequest) => {
    setSelectedAbsence(absence);
    setEditDialogOpen(true);
  };

  const handleDelete = (absence: AbsenceRequest) => {
    setSelectedAbsence(absence);
    setDeleteDialogOpen(true);
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

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "vacation": return "default";
      case "sick": return "destructive";
      case "day_off": return "secondary";
      default: return "outline";
    }
  };

  if (absences.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="text-xs">
              {absences.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {absences.map(absence => (
              <div 
                key={absence.id} 
                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant={getTypeBadgeVariant(absence.type)}
                      className="text-xs"
                    >
                      {getTypeLabel(absence.type)}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                      Afventer
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {format(new Date(absence.start_date), "d. MMM", { locale: da })}
                    {absence.start_date !== absence.end_date && (
                      <span> - {format(new Date(absence.end_date), "d. MMM", { locale: da })}</span>
                    )}
                    {!absence.is_full_day && absence.start_time && absence.end_time && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({absence.start_time.slice(0, 5)} - {absence.end_time.slice(0, 5)})
                      </span>
                    )}
                  </p>
                  {absence.comment && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <span className="truncate">{absence.comment}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEdit(absence)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Redigér</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(absence)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Slet</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EditAbsenceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        absence={selectedAbsence}
      />

      <DeleteAbsenceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        absence={selectedAbsence}
      />
    </>
  );
}
