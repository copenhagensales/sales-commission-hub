import { useState } from "react";
import {
  useAllEvents,
  useRulesForEvent,
  useStartNewGame,
  useResetScores,
  useUpdateEvent,
  type PowerdagEvent,
  type PowerdagRule,
} from "@/hooks/usePowerdagData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Play, RotateCcw, Unlock } from "lucide-react";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PowerdagSettings() {
  const qc = useQueryClient();
  const { data: events = [], refetch: refetchEvents } = useAllEvents();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const activeEvent = events.find(e => e.id === selectedEventId) ?? events[0];
  const { data: rules = [], refetch: refetchRules } = useRulesForEvent(activeEvent?.id);

  const currentActive = events.find(e => e.is_active);
  const startNewGame = useStartNewGame();
  const resetScores = useResetScores();
  const updateEvent = useUpdateEvent();

  // Start nyt spil form
  const [gameName, setGameName] = useState("");
  const [gameDate, setGameDate] = useState(todayIso());
  const [confirmReset, setConfirmReset] = useState(false);

  // New event form
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  // New rule form
  const [newTeam, setNewTeam] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newPts, setNewPts] = useState("1");

  const handleStartNewGame = async () => {
    if (!gameName.trim() || !gameDate) {
      toast.error("Udfyld navn og dato");
      return;
    }
    try {
      const created = await startNewGame.mutateAsync({
        name: gameName.trim(),
        eventDate: gameDate,
        copyRulesFromEventId: currentActive?.id,
      });
      setGameName("");
      setGameDate(todayIso());
      setSelectedEventId(created.id);
      await refetchEvents();
      toast.success("Nyt spil startet – tavlen er nulstillet og ulåst");
    } catch (e: any) {
      toast.error("Kunne ikke starte nyt spil: " + (e?.message ?? "ukendt fejl"));
    }
  };

  const handleResetScores = async () => {
    if (!currentActive) return;
    try {
      await resetScores.mutateAsync({ eventId: currentActive.id });
      toast.success("Alle point er nulstillet");
    } catch (e: any) {
      toast.error("Kunne ikke nulstille point: " + (e?.message ?? "ukendt fejl"));
    } finally {
      setConfirmReset(false);
    }
  };

  const handleUnlock = async () => {
    if (!currentActive) return;
    try {
      await updateEvent.mutateAsync({ id: currentActive.id, patch: { is_revealed: false } });
      await refetchEvents();
      toast.success("Spillet er sat tilbage til ikke-afsløret");
    } catch (e: any) {
      toast.error("Kunne ikke låse op: " + (e?.message ?? "ukendt fejl"));
    }
  };

  const createEvent = async () => {
    if (!newName || !newDate) {
      toast.error("Udfyld navn og dato");
      return;
    }
    const { error } = await supabase.from("powerdag_events").insert({ name: newName, event_date: newDate, is_active: false } as any);
    if (error) { toast.error("Kunne ikke oprette event: " + error.message); return; }
    toast.success("Event oprettet");
    setNewName(""); setNewDate("");
    refetchEvents();
  };

  const toggleActive = async (ev: PowerdagEvent) => {
    // Deactivate all first, then activate this one
    const { error: deErr } = await supabase.from("powerdag_events").update({ is_active: false } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    if (deErr) { toast.error("Kunne ikke opdatere events: " + deErr.message); return; }
    const { error: actErr } = await supabase.from("powerdag_events").update({ is_active: !ev.is_active } as any).eq("id", ev.id);
    if (actErr) { toast.error("Kunne ikke opdatere event: " + actErr.message); return; }
    refetchEvents();
    qc.invalidateQueries({ queryKey: ["powerdag-active-event"] });
    toast.success(ev.is_active ? "Deaktiveret" : "Aktiveret");
  };


  const addRule = async () => {
    if (!activeEvent || !newTeam) {
      toast.error("Vælg et event og udfyld team");
      return;
    }
    const { error } = await supabase.from("powerdag_point_rules").insert({
      event_id: activeEvent.id,
      team_name: newTeam,
      sub_client_name: newSub || null,
      points_per_sale: parseFloat(newPts) || 1,
      display_order: rules.length,
    } as any);
    if (error) { toast.error("Kunne ikke tilføje regel: " + error.message); return; }
    setNewTeam(""); setNewSub(""); setNewPts("1");
    refetchRules();
    toast.success("Regel tilføjet");
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from("powerdag_point_rules").delete().eq("id", id);
    if (error) { toast.error("Kunne ikke slette regel: " + error.message); return; }
    refetchRules();
    toast.success("Regel slettet");
  };

  const updatePoints = async (id: string, val: string) => {
    const { error } = await supabase.from("powerdag_point_rules").update({ points_per_sale: parseFloat(val) || 0 } as any).eq("id", id);
    if (error) { toast.error("Kunne ikke opdatere point: " + error.message); return; }
    refetchRules();
  };

  return (
    <div className="space-y-8">
      {/* Start nyt spil */}
      <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div>
          <h2 className="text-lg font-bold">Start nyt spil</h2>
          <p className="text-sm text-muted-foreground">
            Opretter et nyt Powerdag-event med 0 point og ulåst tavle. Pointreglerne kopieres fra
            {currentActive ? ` "${currentActive.name}"` : " det aktive event"}. Historik bevares – intet slettes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label>Navn på nyt spil</Label>
            <Input value={gameName} onChange={e => setGameName(e.target.value)} placeholder="Powerdag august" />
          </div>
          <div>
            <Label>Dato</Label>
            <Input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} />
          </div>
          <Button onClick={handleStartNewGame} disabled={startNewGame.isPending}>
            <Play className="h-4 w-4 mr-1" />
            {startNewGame.isPending ? "Starter…" : "Start nyt spil"}
          </Button>
        </div>
        {currentActive && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={resetScores.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" />Nulstil point på "{currentActive.name}"
            </Button>
            {currentActive.is_revealed && (
              <Button variant="outline" size="sm" onClick={handleUnlock} disabled={updateEvent.isPending}>
                <Unlock className="h-4 w-4 mr-1" />Sæt tilbage til ikke-afsløret
              </Button>
            )}
          </div>
        )}
      </section>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nulstil alle point?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle salgstal på "{currentActive?.name}" sættes til 0. Pointreglerne bevares. Handlingen kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetScores}>Nulstil point</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <h2 className="text-lg font-bold">Pointregler – {activeEvent.name}</h2>
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
                    <TableCell className="text-muted-foreground">{r.sub_client_name ?? "–"}</TableCell>
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
