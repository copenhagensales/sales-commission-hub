import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOnboardingDrills } from "@/hooks/useOnboarding";
import { Dumbbell, Clock, Target, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { DrillEditDialog } from "@/components/onboarding/DrillEditDialog";
import type { OnboardingDrill } from "@/hooks/useOnboarding";

const focusColors: Record<string, string> = {
  "B": "bg-blue-500",
  "A": "bg-green-500",
  "L": "bg-purple-500",
  "B/A": "bg-orange-500",
  "Struktur": "bg-gray-500",
  "Mindset": "bg-pink-500",
  "Flow": "bg-cyan-500",
};

export default function DrillLibrary() {
  const { data: drills = [], isLoading } = useOnboardingDrills();
  const [editingDrill, setEditingDrill] = useState<OnboardingDrill | null>(null);
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Indlæser drill-bibliotek...</div>;
  }

  if (drills.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ingen drills oprettet endnu.</p>
        </CardContent>
      </Card>
    );
  }

  // Group drills by focus
  const drillsByFocus = drills.reduce((acc, drill) => {
    const focus = drill.focus;
    if (!acc[focus]) acc[focus] = [];
    acc[focus].push(drill);
    return acc;
  }, {} as Record<string, typeof drills>);

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Drill-bibliotek
            </CardTitle>
            <CardDescription>
              {drills.length} drills tilgængelige til træning og coaching. Klik på en drill for at se detaljer eller redigere.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Focus Legend */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">Fokusområder:</span>
          {Object.entries(focusColors).map(([focus, color]) => (
            <Badge key={focus} className={`${color} text-white`}>
              {focus}
            </Badge>
          ))}
        </div>

        {/* Drills Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drills.map(drill => {
            const isExpanded = expandedDrill === drill.id;
            
            return (
              <Card key={drill.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${focusColors[drill.focus] || "bg-gray-500"} text-white`}>
                          {drill.focus}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {drill.reps || 10} reps
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{drill.title}</CardTitle>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingDrill(drill)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {drill.duration_min} minutter
                    </div>
                    
                    {drill.when_to_use && (
                      <p className="text-sm text-muted-foreground">
                        {drill.when_to_use}
                      </p>
                    )}

                    {/* Variants */}
                    {drill.variants && drill.variants.length > 0 && (
                      <div className="flex gap-1">
                        {drill.variants.map((v, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Expand/collapse button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setExpandedDrill(isExpanded ? null : drill.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Skjul detaljer
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Vis detaljer
                        </>
                      )}
                    </Button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t">
                        {drill.setup && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">SETUP</p>
                            <p className="text-sm">{drill.setup}</p>
                          </div>
                        )}

                        {drill.steps && drill.steps.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">TRIN</p>
                            <ol className="text-sm space-y-1 list-decimal list-inside">
                              {drill.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {drill.script_snippets && drill.script_snippets.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">SCRIPTS</p>
                            <div className="space-y-1">
                              {drill.script_snippets.map((s, i) => (
                                <code key={i} className="block text-xs bg-muted px-2 py-1 rounded">
                                  {s}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {drill.success_criteria && drill.success_criteria.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">SUCCESKRITERIER</p>
                            <ul className="text-sm space-y-1">
                              {drill.success_criteria.map((c, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-green-500">✓</span>
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {drill.common_mistakes && drill.common_mistakes.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">TYPISKE FEJL</p>
                            <ul className="text-sm space-y-1">
                              {drill.common_mistakes.map((m, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-red-500">✗</span>
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* By Focus Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Grupperet efter fokus</h3>
          {Object.entries(drillsByFocus).map(([focus, focusDrills]) => (
            <Card key={focus}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {focus}
                  <Badge variant="secondary">{focusDrills.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {focusDrills.map(drill => (
                    <Badge 
                      key={drill.id} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setEditingDrill(drill)}
                    >
                      {drill.title}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <DrillEditDialog
        open={!!editingDrill}
        onOpenChange={(open) => !open && setEditingDrill(null)}
        drill={editingDrill}
      />
    </>
  );
}
