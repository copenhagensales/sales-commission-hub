import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnboardingDrills } from "@/hooks/useOnboarding";
import { Dumbbell, Clock, Target } from "lucide-react";

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Drill-bibliotek
          </CardTitle>
          <CardDescription>
            {drills.length} drills tilgængelige til træning og coaching
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
        {drills.map(drill => (
          <Card key={drill.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={`${focusColors[drill.focus] || "bg-gray-500"} text-white mb-2`}>
                    {drill.focus}
                  </Badge>
                  <CardTitle className="text-base">{drill.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {drill.duration_min} minutter
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                  {drill.id}
                </code>
                {drill.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {drill.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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
                  <Badge key={drill.id} variant="outline">
                    {drill.title}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
