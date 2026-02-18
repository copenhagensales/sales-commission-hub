import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCronMinutes, detectOverlaps } from "@/utils/cronOverlapDetector";
import { Clock } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  provider: string;
  config: any;
  sync_frequency_minutes?: number;
}

interface TimelineOverlapProps {
  integrations: Integration[];
}

export function TimelineOverlap({ integrations }: TimelineOverlapProps) {
  const jobs = useMemo(() =>
    integrations.map(int => ({
      id: int.id,
      name: int.name,
      provider: int.provider,
      schedule: int.config?.sync_schedule || `*/${int.sync_frequency_minutes || 10} * * * *`,
    })),
    [integrations]
  );

  const overlapWarnings = useMemo(() => detectOverlaps(jobs, 2, true), [jobs]);
  const conflictMinutesSet = useMemo(() => {
    const set = new Set<number>();
    overlapWarnings.forEach(w => w.conflictMinutes.forEach(m => set.add(m)));
    return set;
  }, [overlapWarnings]);

  const minuteLabels = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tidslinje (60 min)
          {overlapWarnings.length > 0 && (
            <span className="text-xs font-normal text-destructive ml-2">
              {overlapWarnings.length} overlap{overlapWarnings.length > 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Minute axis */}
        <div className="mb-1">
          <div className="flex ml-[120px]">
            {minuteLabels.map(m => (
              <div key={m} className="text-[10px] text-muted-foreground" style={{ width: `${100 / 12}%` }}>
                :{m.toString().padStart(2, "0")}
              </div>
            ))}
          </div>
        </div>

        {/* Rows per integration */}
        <div className="space-y-1">
          {jobs.map(job => {
            const fireMinutes = parseCronMinutes(job.schedule);
            return (
              <div key={job.id} className="flex items-center gap-2">
                <div className="w-[112px] text-xs font-medium truncate text-right pr-2">
                  {job.name}
                </div>
                <div className="flex-1 relative h-5 bg-muted/30 rounded-sm">
                  {fireMinutes.map(m => {
                    const isConflict = conflictMinutesSet.has(m);
                    return (
                      <div
                        key={m}
                        className={`absolute top-0.5 h-4 w-1.5 rounded-sm ${
                          isConflict ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{ left: `${(m / 60) * 100}%` }}
                        title={`Minut :${m.toString().padStart(2, "0")}${isConflict ? " (OVERLAP)" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-primary" /> Sync-tidspunkt
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-destructive" /> Overlap (&lt;2 min)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
