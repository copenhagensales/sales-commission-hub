import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firstMeasurableCohortMonth } from "@/lib/churn/metrics";
import { useSaveChurnAction, type ChurnActionRow } from "@/hooks/useChurnDashboard";

const STATUSES = ["Planlagt", "I gang", "Afventer moden kohorte", "Effekt måles", "Afsluttet", "Stoppet"];
const DECISIONS = ["Ikke vurderet", "Fortsæt", "Justér", "Skalér", "Stop"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamKey: string | null;
  action?: ChurnActionRow | null;
  canEdit: boolean;
}

export function ChurnActionDialog({ open, onOpenChange, teamKey, action, canEdit }: Props) {
  const save = useSaveChurnAction();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    problem_statement: "",
    hypothesis: "",
    action_description: "",
    owner_name: "",
    start_date: today,
    due_date: "",
    expected_effect_pp: "",
    status: "Planlagt",
    decision: "Ikke vurderet",
    actual_effect_pp: "",
  });

  useEffect(() => {
    if (action) {
      setForm({
        problem_statement: action.problem_statement,
        hypothesis: action.hypothesis ?? "",
        action_description: action.action_description,
        owner_name: action.owner_name ?? "",
        start_date: action.start_date,
        due_date: action.due_date ?? "",
        expected_effect_pp: action.expected_effect_pp?.toString() ?? "",
        status: action.status,
        decision: action.decision,
        actual_effect_pp: action.actual_effect_pp?.toString() ?? "",
      });
    } else {
      setForm((f) => ({ ...f, problem_statement: "", hypothesis: "", action_description: "", start_date: today }));
    }
  }, [action, open, today]);

  const submit = async () => {
    await save.mutateAsync({
      id: action?.id,
      scope_type: teamKey ? "team" : "company",
      team_key: teamKey,
      problem_statement: form.problem_statement,
      hypothesis: form.hypothesis || null,
      action_description: form.action_description,
      owner_name: form.owner_name || null,
      start_date: form.start_date,
      due_date: form.due_date || null,
      expected_effect_pp: form.expected_effect_pp === "" ? null : Number(form.expected_effect_pp),
      first_measurable_cohort_month: firstMeasurableCohortMonth(form.start_date),
      status: form.status,
      decision: form.decision,
      actual_effect_pp: form.actual_effect_pp === "" ? null : Number(form.actual_effect_pp),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action ? "Rediger handling" : "Opret handling"}</DialogTitle>
          <DialogDescription>
            {teamKey ? `Team: ${teamKey}` : "Virksomhedsniveau"} · første målbare kohorte beregnes automatisk til{" "}
            {firstMeasurableCohortMonth(form.start_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="problem">Problem</Label>
            <Textarea
              id="problem"
              value={form.problem_statement}
              onChange={(e) => setForm({ ...form, problem_statement: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="hyp">Hypotese</Label>
            <Textarea
              id="hyp"
              value={form.hypothesis}
              onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="act">Handling</Label>
            <Textarea
              id="act"
              value={form.action_description}
              onChange={(e) => setForm({ ...form, action_description: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="owner">Ansvarlig</Label>
              <Input id="owner" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="exp">Forventet effekt (pp)</Label>
              <Input
                id="exp"
                type="number"
                step="0.1"
                value={form.expected_effect_pp}
                onChange={(e) => setForm({ ...form, expected_effect_pp: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="start">Startdato</Label>
              <Input id="start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="due">Deadline</Label>
              <Input id="due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beslutning</Label>
              <Select value={form.decision} onValueChange={(v) => setForm({ ...form, decision: v })} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button
            onClick={submit}
            disabled={!canEdit || save.isPending || !form.problem_statement || !form.action_description}
          >
            Gem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
