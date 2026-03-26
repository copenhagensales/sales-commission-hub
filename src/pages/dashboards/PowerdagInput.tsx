import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useActiveEvent, useRulesForEvent, useScoresForEvent, useUpsertScore } from "@/hooks/usePowerdagData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

export default function PowerdagInput() {
  const { data: event } = useActiveEvent();
  const { data: rules = [] } = useRulesForEvent(event?.id);
  const { data: scores = [] } = useScoresForEvent(event?.id);
  const upsert = useUpsertScore();

  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (scores.length === 0 && rules.length === 0) return;
    const map: Record<string, number> = {};
    for (const r of rules) {
      const s = scores.find(sc => sc.rule_id === r.id);
      map[r.id] = s?.sales_count ?? 0;
    }
    setLocalCounts(prev => {
      if (dirty) return prev; // don't overwrite unsaved changes
      return map;
    });
  }, [scores, rules, dirty]);

  const handleChange = (ruleId: string, val: string) => {
    setLocalCounts(prev => ({ ...prev, [ruleId]: parseInt(val) || 0 }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!event) return;
    try {
      for (const r of rules) {
        await upsert.mutateAsync({ eventId: event.id, ruleId: r.id, salesCount: localCounts[r.id] ?? 0 });
      }
      setDirty(false);
      toast.success("Salgstal gemt!");
    } catch {
      toast.error("Fejl ved gemning");
    }
  };

  // Group rules by team for visual clarity
  const teamGroups = rules.reduce<Record<string, typeof rules>>((acc, r) => {
    (acc[r.team_name] ??= []).push(r);
    return acc;
  }, {});

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboards/powerdag">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Indtast salg</h1>
              <p className="text-sm text-muted-foreground">{event?.name ?? "Powerdag"}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!dirty || upsert.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {upsert.isPending ? "Gemmer..." : "Gem"}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team / Klient</TableHead>
                <TableHead className="w-28 text-right">Point/salg</TableHead>
                <TableHead className="w-28 text-right">Antal salg</TableHead>
                <TableHead className="w-28 text-right">Point</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(teamGroups).map(([teamName, teamRules]) => (
                teamRules.map((r, i) => {
                  const count = localCounts[r.id] ?? 0;
                  const pts = count * r.points_per_sale;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {i === 0 && teamRules.length > 1 ? (
                          <div>
                            <span className="font-semibold">{teamName}</span>
                            <span className="text-muted-foreground"> — {r.sub_client_name}</span>
                          </div>
                        ) : teamRules.length > 1 ? (
                          <span className="pl-4 text-muted-foreground">{r.sub_client_name}</span>
                        ) : (
                          <span className="font-semibold">{teamName}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.points_per_sale}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 ml-auto text-right tabular-nums"
                          value={count}
                          onChange={e => handleChange(r.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {pts % 1 === 0 ? pts : pts.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardShell>
  );
}
