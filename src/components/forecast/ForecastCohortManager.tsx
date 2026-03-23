import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Plus, Calendar, Users, Trash2, Pencil } from "lucide-react";
import { CreateCohortDialog } from "./CreateCohortDialog";
import { EditForecastCohortDialog } from "./EditForecastCohortDialog";
import type { ClientForecastCohort } from "@/types/forecast";

interface Props {
  cohorts: ClientForecastCohort[];
  onAdd: (cohort: Omit<ClientForecastCohort, 'id' | 'created_at' | 'created_by'>) => void;
  onDelete?: (cohortId: string) => void;
  onEdit?: (id: string, data: { start_date: string; planned_headcount: number; note: string | null }) => void;
}

export function ForecastCohortManager({ cohorts, onAdd, onDelete, onEdit }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<ClientForecastCohort | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Opstartshold
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Tilføj hold
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {cohorts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ingen opstartshold tilføjet endnu</p>
              <p className="text-xs mt-1">Tilføj et hold for at inkludere nye sælgere i forecastet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cohorts.map((cohort) => (
                <div key={cohort.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cohort.planned_headcount} personer</span>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(cohort.start_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Badge>
                      </div>
                      {cohort.note && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cohort.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingCohort(cohort)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(cohort.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCohortDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => {
          onAdd(data);
          setDialogOpen(false);
        }}
      />

      <EditForecastCohortDialog
        open={!!editingCohort}
        onOpenChange={(open) => { if (!open) setEditingCohort(null); }}
        cohort={editingCohort}
        onSubmit={(id, data) => {
          onEdit?.(id, data);
          setEditingCohort(null);
        }}
      />
    </>
  );
}
