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

interface CronJobRow {
  jobname: string;
  schedule: string;
}

interface TimelineOverlapProps {
  integrations: Integration[];
  cronJobs?: CronJobRow[];
}

interface TimelineJob {
  id: string;
  name: string;
  provider: string;
  schedule: string;
  type: "sales" | "meta";
}

/**
 * Match a cron job row to an integration by extracting the UUID from the jobname.
 * Pattern: dialer-<uuid>-sync-<sales|meta>
 */
function buildJobsFromCron(integrations: Integration[], cronJobs: CronJobRow[]): TimelineJob[] {
  const jobs: TimelineJob[] = [];

  for (const cj of cronJobs) {
    // Extract UUID and type from jobname like "dialer-657c2050-sync-sales"
    const match = cj.jobname.match(/^dialer-([0-9a-f-]+)-sync-(sales|meta)$/i);
    if (!match) continue;

    const idPrefix = match[1];
    const type = match[2] as "sales" | "meta";

    // Find matching integration (id starts with the prefix)
    const int = integrations.find(i => i.id.startsWith(idPrefix));
    if (!int) continue;

    jobs.push({
      id: `${int.id}-${type}`,
      name: `${int.name} ${type === "sales" ? "Sales" : "Meta"}`,
      provider: int.provider,
      schedule: cj.schedule,
      type,
    });
  }

  return jobs;
}

function buildJobsFromConfig(integrations: Integration[]): TimelineJob[] {
  return integrations.map(int => ({
    id: `${int.id}-sales`,
    name: int.name,
    provider: int.provider,
    schedule: int.config?.sync_schedule || `*/${int.sync_frequency_minutes || 10} * * * *`,
    type: "sales" as const,
  }));
}

export function TimelineOverlap({ integrations, cronJobs }: TimelineOverlapProps) {
  const jobs = useMemo(() => {
    if (cronJobs && cronJobs.length > 0) {
      return buildJobsFromCron(integrations, cronJobs);
    }
    return buildJobsFromConfig(integrations);
  }, [integrations, cronJobs]);

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
          Tidslinje (60 min) — Sales + Meta
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
          <div className="flex ml-[140px]">
            {minuteLabels.map(m => (
              <div key={m} className="text-[10px] text-muted-foreground" style={{ width: `${100 / 12}%` }}>
                :{m.toString().padStart(2, "0")}
              </div>
            ))}
          </div>
        </div>

        {/* Rows per job (sales + meta) */}
        <div className="space-y-1">
          {jobs.map(job => {
            const fireMinutes = parseCronMinutes(job.schedule);
            const isMeta = job.type === "meta";
            return (
              <div key={job.id} className="flex items-center gap-2">
                <div className="w-[132px] text-xs font-medium truncate text-right pr-2 flex items-center justify-end gap-1.5">
                  <span className={isMeta ? "text-muted-foreground" : "text-foreground"}>
                    {job.name}
                  </span>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isMeta ? "bg-muted-foreground" : "bg-primary"}`} />
                </div>
                <div className="flex-1 relative h-5 bg-muted/30 rounded-sm">
                  {fireMinutes.map(m => {
                    const isConflict = conflictMinutesSet.has(m);
                    return (
                      <div
                        key={m}
                        className={`absolute top-0.5 h-4 w-1.5 rounded-sm ${
                          isConflict ? "bg-destructive" : isMeta ? "bg-muted-foreground" : "bg-primary"
                        }`}
                        style={{ left: `${(m / 60) * 100}%` }}
                        title={`${job.name} :${m.toString().padStart(2, "0")}${isConflict ? " (OVERLAP)" : ""}`}
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
            <div className="w-2 h-2 rounded-sm bg-primary" /> Sales
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-muted-foreground" /> Meta
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-destructive" /> Overlap
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
