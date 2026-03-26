import { useState } from "react";
import { useAllEvents, useRulesForEvent, type PowerdagEvent, type PowerdagRule } from "@/hooks/usePowerdagData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

export function PowerdagSettings() {
  const qc = useQueryClient();
  const { data: events = [], refetch: refetchEvents } = useAllEvents();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const activeEvent = events.find(e => e.id === selectedEventId) ?? events[0];
  const { data: rules = [], refetch: refetchRules } = useRulesForEvent(activeEvent?.id);

  // New event form
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  // New rule form
  const [newTeam, setNewTeam] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newPts, setNewPts] = useState("1");

  const createEvent = async () => {
    if (!newName || !newDate) return;
    const { error } = await supabase.from("powerdag_events").insert({ name: newName, event_date: newDate, is_active: false } as any);
    if (error) { toast.error("Fejl"); return; }
    toast.success("Event oprettet");
    setNewName(""); setNewDate("");
    refetchEvents();
  };

  const toggleActive = async (ev: PowerdagEvent) => {
    // Deactivate all first, then activate this one
    await supabase.from("powerdag_events").update({ is_active: false } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("powerdag_events").update({ is_active: !ev.is_active } as any).eq("id", ev.id);
    refetchEvents();
    qc.invalidateQueries({ queryKey: ["powerdag-active-event"] });
    toast.success(ev.is_active ? "Deaktiveret" : "Aktiveret");
  };

  const addRule = async () => {
    if (!activeEvent || !newTeam) return;
    const { error } = await supabase.from("powerdag_point_rules").insert({
      event_id: activeEvent.id,
      team_name: newTeam,
      sub_client_name: newSub || null,
      points_per_sale: parseFloat(newPts) || 1,
      display_order: rules.length,
    } as any);
    if (error) { toast.error("Fejl"); return; }
    setNewTeam(""); setNewSub(""); setNewPts("1");
    refetchRules();
    toast.success("Regel tilføjet");
  };

  const deleteRule = async (id: string) => {
    await supabase.from("powerdag_point_rules").delete().eq("id", id);
    refetchRules();
    toast.success("Regel slettet");
  };

  const updatePoints = async (id: string, val: string) => {
    await supabase.from("powerdag_point_rules").update({ points_per_sale: parseFloat(val) || 0 } as any).eq("id", id);
    refetchRules();
  };

  return (
    <div className="space-y-8">
      {/* Events */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Powerdag Events</h2>
        <div className="flex gap-2 items-end">
          <div>
            <Label>Navn</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Powerdag Q2" />
          </div>
          <div>
            <Label>Dato</Label>
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          <Button onClick={createEvent} size="sm"><Plus className="h-4 w-4 mr-1" />Opret</Button>
        </div>
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer ${ev.id === activeEvent?.id ? "border-primary bg-primary/5" : ""}`} onClick={() => setSelectedEventId(ev.id)}>
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-xs text-muted-foreground">{ev.event_date}</p>
              </div>
              <Button size="sm" variant={ev.is_active ? "default" : "outline"} onClick={e => { e.stopPropagation(); toggleActive(ev); }}>
                {ev.is_active ? "Aktiv ✓" : "Aktiver"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Rules for selected event */}
      {activeEvent && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Pointregler — {activeEvent.name}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Sub-klient</TableHead>
                  <TableHead className="w-32">Point/salg</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.team_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sub_client_name ?? "—"}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        className="w-24"
                        defaultValue={r.points_per_sale}
                        onBlur={e => updatePoints(r.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteRule(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Add rule */}
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label>Team</Label>
              <Input value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="F.eks. United" />
            </div>
            <div>
              <Label>Sub-klient (valgfri)</Label>
              <Input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="F.eks. ASE" />
            </div>
            <div>
              <Label>Point/salg</Label>
              <Input type="number" step="0.1" value={newPts} onChange={e => setNewPts(e.target.value)} className="w-24" />
            </div>
            <Button onClick={addRule} size="sm"><Plus className="h-4 w-4 mr-1" />Tilføj</Button>
          </div>
        </section>
      )}
    </div>
  );
}
