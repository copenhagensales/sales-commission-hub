import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
}

interface LiveCronStatusProps {
  integrations: Array<{ id: string; name: string; provider: string; is_active: boolean }>;
}

export function LiveCronStatus({ integrations }: LiveCronStatusProps) {
  const { data: cronJobs = [] } = useQuery({
    queryKey: ["system-stability-cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_cron_jobs" as any);
      if (error) {
        // Fallback: try direct query via edge function or just return empty
        console.warn("Could not fetch cron jobs:", error.message);
        return [];
      }
      return (data || []) as unknown as CronJob[];
    },
    refetchInterval: 60000,
  });

  // Known provider-level job names
  const KNOWN_PROVIDER_JOBS = ["provider-adversus-sync", "provider-enreach-sync", "enrichment-healer"];

  // Filter to integration-engine related jobs
  const integrationJobs = cronJobs.filter(
    (job) =>
      job.command?.includes("integration-engine") ||
      job.command?.includes("enrichment-healer") ||
      job.jobname?.startsWith("dialer-") ||
      job.jobname?.startsWith("provider-") ||
      job.jobname === "enrichment-healer"
  );

  // Check for unexpected jobs (not matching known integrations or provider jobs)
  const knownPrefixes = integrations.map((i) => `dialer-${i.id.slice(0, 8)}`);
  const unexpectedJobs = integrationJobs.filter(
    (job) =>
      !knownPrefixes.some((prefix) => job.jobname?.startsWith(prefix)) &&
      !KNOWN_PROVIDER_JOBS.includes(job.jobname) &&
      !["integration-engine"].includes(job.jobname)
  );

  // Check for legacy sync jobs that shouldn't exist
  const legacyJobs = cronJobs.filter(
    (job) =>
      job.command?.includes("adversus-sync-v2") ||
      job.command?.includes("sync-adversus") ||
      job.command?.includes("customer-crm-syncer") ||
      job.jobname?.includes("adversus-sync")
  );

  // CRITICAL: Detect duplicate sync architecture (both provider-* AND dialer-* active)
  const activeProviderJobs = integrationJobs.filter((job) => job.jobname?.startsWith("provider-"));
  const activeDialerJobs = integrationJobs.filter((job) => job.jobname?.startsWith("dialer-"));
  const hasDuplicateSyncArchitecture = activeProviderJobs.length > 0 && activeDialerJobs.length > 0;

  const hasIssues = unexpectedJobs.length > 0 || legacyJobs.length > 0 || hasDuplicateSyncArchitecture;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Live Cron Status
          {hasIssues ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {unexpectedJobs.length + legacyJobs.length} uoverensstemmelse(r)
            </Badge>
          ) : integrationJobs.length > 0 ? (
            <Badge variant="default" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Synkroniseret
            </Badge>
          ) : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Aktive cron jobs sammenlignet med Schedule Editor
        </p>
      </CardHeader>
      <CardContent>
        {cronJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kunne ikke hente cron jobs – opret en database-funktion for at aktivere denne visning.
          </p>
        ) : (
          <div className="space-y-4">
            {hasDuplicateSyncArchitecture && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  KRITISK: Dobbelt sync-arkitektur aktiv
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Både provider-jobs ({activeProviderJobs.map(j => j.jobname).join(", ")}) og 
                  dialer-jobs ({activeDialerJobs.length} stk) kører samtidigt. 
                  Dette forårsager dobbelte API-kald og 429-fejl. Deaktivér én strategi.
                </p>
              </div>
            )}

            {legacyJobs.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Forældede cron jobs fundet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disse jobs bruger gamle sync-funktioner og bør fjernes:
                </p>
                <ul className="mt-2 space-y-1">
                  {legacyJobs.map((job) => (
                    <li key={job.jobid} className="text-xs font-mono text-destructive">
                      {job.jobname} ({job.schedule})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unexpectedJobs.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Ukendte integration-jobs
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disse cron jobs matcher ikke nogen aktiv integration i Schedule Editor:
                </p>
                <ul className="mt-2 space-y-1">
                  {unexpectedJobs.map((job) => (
                    <li key={job.jobid} className="text-xs font-mono text-amber-600">
                      {job.jobname} ({job.schedule})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrationJobs.map((job) => {
                  const isLegacy = legacyJobs.some((l) => l.jobid === job.jobid);
                  const isUnexpected = unexpectedJobs.some((u) => u.jobid === job.jobid);
                  return (
                    <TableRow key={job.jobid}>
                      <TableCell className="text-xs font-mono">{job.jobname}</TableCell>
                      <TableCell className="text-xs font-mono">{job.schedule}</TableCell>
                      <TableCell>
                        {isLegacy ? (
                          <Badge variant="destructive" className="text-xs">Forældet</Badge>
                        ) : isUnexpected ? (
                          <Badge variant="secondary" className="text-xs text-amber-600">Ukendt</Badge>
                        ) : (
                          <Badge variant="default" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {integrationJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                      Ingen integration cron jobs fundet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
