import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  integration_id: string;
  changed_by: string | null;
  change_type: string;
  old_config: any;
  new_config: any;
  old_schedule: string | null;
  new_schedule: string | null;
  created_at: string;
}

interface Integration {
  id: string;
  name: string;
  provider: string;
}

interface AuditLogProps {
  auditLog: AuditEntry[];
  integrations: Integration[];
  onRollback: () => void;
}

export function AuditLog({ auditLog, integrations, onRollback }: AuditLogProps) {
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const handleRollback = async (entry: AuditEntry) => {
    if (!entry.old_schedule) {
      toast.error("Ingen gammel schedule at rulle tilbage til");
      return;
    }

    const integration = integrations.find(i => i.id === entry.integration_id);
    if (!integration) return;

    setRollingBack(entry.id);
    try {
      const { error } = await supabase.functions.invoke("update-cron-schedule", {
        body: {
          integration_type: "dialer",
          integration_id: entry.integration_id,
          provider: integration.provider,
          frequency_minutes: null,
          is_active: true,
          custom_schedule: entry.old_schedule,
        },
      });

      if (error) throw error;

      toast.success(`Rollback udført for ${integration.name}`, {
        description: `Schedule gendannet til: ${entry.old_schedule}`,
      });
      onRollback();
    } catch (err: any) {
      toast.error("Rollback fejlede", { description: err.message });
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Audit Log (Schedule-ændringer)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tid</TableHead>
              <TableHead>Integration</TableHead>
              <TableHead>Ændring</TableHead>
              <TableHead>Gammel schedule</TableHead>
              <TableHead>Ny schedule</TableHead>
              <TableHead className="text-right">Rollback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLog.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Ingen schedule-ændringer logget endnu.
                </TableCell>
              </TableRow>
            ) : (
              auditLog.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(entry.created_at), "dd/MM HH:mm")}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {integrations.find(i => i.id === entry.integration_id)?.name || entry.integration_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{entry.change_type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{entry.old_schedule || "–"}</TableCell>
                  <TableCell className="text-xs font-mono">{entry.new_schedule || "–"}</TableCell>
                  <TableCell className="text-right">
                    {entry.old_schedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRollback(entry)}
                        disabled={rollingBack === entry.id}
                        className="h-7 text-xs"
                      >
                        <RotateCcw className={`h-3 w-3 mr-1 ${rollingBack === entry.id ? "animate-spin" : ""}`} />
                        {rollingBack === entry.id ? "..." : "Rollback"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
