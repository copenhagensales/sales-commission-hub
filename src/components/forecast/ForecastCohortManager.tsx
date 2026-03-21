import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Plus, Calendar, Users, Sparkles } from "lucide-react";
import { CreateCohortDialog } from "./CreateCohortDialog";
import type { ClientForecastCohort } from "@/types/forecast";

interface Props {
  cohorts: ClientForecastCohort[];
  onAdd: (cohort: Omit<ClientForecastCohort, 'id' | 'created_at' | 'created_by'>) => void;
}

export function ForecastCohortManager({ cohorts, onAdd }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const onboardingCohorts = cohorts.filter(c => c.source === 'onboarding');
  const manualCohorts = cohorts.filter(c => c.source !== 'onboarding');

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
              <p className="text-sm">Ingen opstartshold fundet</p>
              <p className="text-xs mt-1">Tilføj et hold eller opret kommende opstarter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {onboardingCohorts.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Fra kommende opstarter</p>
                  {onboardingCohorts.map((cohort) => (
                    <div key={cohort.id} className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 hover:bg-primary/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{cohort.name || `${cohort.planned_headcount} personer`}</span>
                            <Badge variant="secondary" className="text-xs">
                              {cohort.planned_headcount} pers.
                              {cohort.actual_members !== undefined && (
                                <span className="text-muted-foreground ml-1">({cohort.actual_members} tilmeldt)</span>
                              )}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(cohort.start_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {manualCohorts.length > 0 && (
                <>
                  {onboardingCohorts.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3 mb-1">Manuelt tilføjet</p>
                  )}
                  {manualCohorts.map((cohort) => (
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
                    </div>
                  ))}
                </>
              )}
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
    </>
  );
}
