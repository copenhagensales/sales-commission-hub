import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, Check, Loader2, Play, ShieldCheck, ShieldAlert, Activity } from "lucide-react";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  useAcknowledgeAlert,
  useComplianceAlerts,
  useLastComplianceRun,
  useRunComplianceChecks,
  type ComplianceAlert,
} from "@/hooks/useComplianceMonitoring";
import { IngestionFieldRegistry } from "@/components/compliance/IngestionFieldRegistry";

const SEVERITY_STYLE: Record<string, string> = {
  KRITISK: "bg-red-500/10 text-red-700 border-red-500/40",
  HOEJ: "bg-orange-500/10 text-orange-700 border-orange-500/40",
  MIDDEL: "bg-yellow-500/10 text-yellow-700 border-yellow-500/40",
  INFO: "bg-blue-500/10 text-blue-700 border-blue-500/40",
};

const formatDaDateTime = (iso: string | null | undefined) => {
  if (!iso) return "aldrig";
  return new Date(iso).toLocaleString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const openFor = (firstSeen: string) => {
  const ms = Date.now() - new Date(firstSeen).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? "dag" : "dage"}`;
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  return `${hours} ${hours === 1 ? "time" : "timer"}`;
};

function AlertRow({ alert, canAcknowledge }: { alert: ComplianceAlert; canAcknowledge: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const acknowledge = useAcknowledgeAlert();
  const isAcknowledged = alert.status === "acknowledged";

  const handleAcknowledge = () => {
    acknowledge.mutate(
      { id: alert.id, note },
      {
        onSuccess: () => {
          toast.success("Alarmen er kvitteret");
          setNote("");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Kunne ikke kvittere alarmen"),
      },
    );
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`rounded-md border ${isAcknowledged ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3 p-3">
        <Badge variant="outline" className={SEVERITY_STYLE[alert.severity] ?? ""}>
          {alert.severity}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{alert.title}</p>
          <p className="text-xs text-muted-foreground">
            {alert.check_key} ·{" "}
            {alert.observed_value === null
              ? "ingen målt værdi"
              : `målt ${alert.observed_value}${alert.threshold === null ? "" : ` mod grænse ${alert.threshold}`}`}{" "}
            · åben i {openFor(alert.first_seen)}
          </p>
        </div>
        {isAcknowledged && <Badge variant="secondary">Kvitteret</Badge>}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            Detaljer <ChevronDown className={`ml-1 h-4 w-4 ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-3 border-t p-3">
        <div className="text-xs text-muted-foreground">
          Første gang: {formatDaDateTime(alert.first_seen)} · Senest set:{" "}
          {formatDaDateTime(alert.last_seen)}
        </div>
        <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(alert.detail ?? {}, null, 2)}
        </pre>
        {alert.note && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> {alert.note}
          </p>
        )}
        {canAcknowledge && !isAcknowledged && (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note til kvitteringen (hvad er gjort eller besluttet)"
              rows={2}
            />
            <Button size="sm" onClick={handleAcknowledge} disabled={acknowledge.isPending}>
              {acknowledge.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              Kvitter
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ComplianceMonitoringPanel() {
  const { isSuperadmin } = useIsSuperadmin();
  const { data: alerts = [], isLoading } = useComplianceAlerts();
  const { data: lastRun } = useLastComplianceRun();
  const runChecks = useRunComplianceChecks();

  const openAlerts = alerts.filter((a) => a.status === "open");
  const criticalCount = openAlerts.filter((a) => a.severity === "KRITISK").length;

  const statusTone =
    openAlerts.length === 0
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
      : criticalCount > 0
        ? "border-red-500/40 bg-red-500/10 text-red-800"
        : "border-yellow-500/40 bg-yellow-500/10 text-yellow-800";

  const statusText =
    openAlerts.length === 0
      ? "Alt i orden — ingen åbne afvigelser."
      : criticalCount > 0
        ? `${openAlerts.length} åbne afvigelser, heraf ${criticalCount} kritiske.`
        : `${openAlerts.length} åbne afvigelser. Ingen kritiske.`;

  const handleRun = () => {
    runChecks.mutate(undefined, {
      onSuccess: () => toast.success("Kontrollen er kørt"),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Kunne ikke køre kontrollen"),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" /> Overvågning
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Automatiske kontroller af indtag, sletning og datadisciplin. Kører kl. 05:00 og 13:00.
            </p>
          </div>
          {isSuperadmin && (
            <Button size="sm" variant="outline" onClick={handleRun} disabled={runChecks.isPending}>
              {runChecks.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              Kør kontrollen nu
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-start gap-3 rounded-md border p-3 ${statusTone}`}>
          {openAlerts.length === 0 ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="text-sm">
            <p className="font-semibold">{statusText}</p>
            <p className="opacity-80">Sidste kørsel: {formatDaDateTime(lastRun?.run_at)}</p>
          </div>
        </div>

        <Tabs defaultValue="alarmer">
          <TabsList>
            <TabsTrigger value="alarmer">Alarmer ({alerts.length})</TabsTrigger>
            <TabsTrigger value="felter">Feltregister</TabsTrigger>
          </TabsList>

          <TabsContent value="alarmer" className="space-y-2 pt-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : alerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ingen åbne alarmer.
              </p>
            ) : (
              alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} canAcknowledge={isSuperadmin} />
              ))
            )}
          </TabsContent>

          <TabsContent value="felter" className="pt-3">
            <IngestionFieldRegistry canEdit={isSuperadmin} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
