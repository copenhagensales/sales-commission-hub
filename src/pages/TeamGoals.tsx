import { MainLayout } from "@/components/layout/MainLayout";
import { Target, Plus, Pencil, Trash2, Users, Calendar, Lightbulb, ChevronDown, ChevronUp, Sparkles, RotateCcw } from "lucide-react";
import { useState, useMemo } from "react";
import { useTeamGoalForecast, type EmployeeForecast } from "@/hooks/useTeamGoalForecast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BonusStaircase, type BonusTiers } from "@/components/team-goals/BonusStaircase";

const MONTH_NAMES = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December"
];

interface GoalForm {
  team_id: string;
  month: number;
  year: number;
  sales_target: number;
  bonus_description: string;
  bonus_tier1_amount: number;
  bonus_tier1_description: string;
  bonus_tier2_amount: number;
  bonus_tier2_description: string;
  bonus_tier3_amount: number;
  bonus_tier3_description: string;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function TeamGoals() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState<number | null>(currentMonth);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [overriddenEmployees, setOverriddenEmployees] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<GoalForm>({
    team_id: "",
    month: currentMonth,
    year: currentYear,
    sales_target: 0,
    bonus_description: "",
    bonus_tier1_amount: 500,
    bonus_tier1_description: "Spisning på Retour Steak",
    bonus_tier2_amount: 750,
    bonus_tier2_description: "",
    bonus_tier3_amount: 1000,
    bonus_tier3_description: "Valgfrit",
  });

  const { forecast: rawForecast, perEmployee, isLoading: forecastLoading, prevMonthLabel } = useTeamGoalForecast(
    form.team_id || undefined,
    form.month,
    form.year
  );

  // Calculate team average S/D from established (non-new) employees
  const { avgSalesPerDay, adjustedForecast, adjustedPerEmployee } = useMemo(() => {
    const established = perEmployee.filter(e => !e.isNew);
    const totalSales = established.reduce((s, e) => s + e.prevSales, 0);
    const totalShifts = established.reduce((s, e) => s + e.prevShifts, 0);
    const avgSD = totalShifts > 0 ? Math.round((totalSales / totalShifts) * 100) / 100 : 0;

    const adjusted = perEmployee.map(e => {
      if (e.isNew && overriddenEmployees.has(e.employeeId)) {
        const newForecast = Math.round(avgSD * e.targetShifts);
        return { ...e, salesPerDay: avgSD, forecast: newForecast };
      }
      return e;
    });

    return {
      avgSalesPerDay: avgSD,
      adjustedForecast: adjusted.reduce((s, e) => s + e.forecast, 0),
      adjustedPerEmployee: adjusted,
    };
  }, [perEmployee, overriddenEmployees]);

  const { data: teams } = useQuery({
    queryKey: ["teams-for-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ["team-monthly-goals", filterYear, filterMonth],
    queryFn: async () => {
      let query = supabase
        .from("team_monthly_goals")
        .select("*, teams(name)")
        .eq("year", filterYear)
        .order("month")
        .order("team_id");
      
      if (filterMonth) {
        query = query.eq("month", filterMonth);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const upsertGoal = useMutation({
    mutationFn: async (goal: GoalForm & { id?: string }) => {
      if (goal.id) {
        const { error } = await supabase
          .from("team_monthly_goals")
          .update({
            team_id: goal.team_id,
            month: goal.month,
            year: goal.year,
            sales_target: goal.sales_target,
            bonus_description: goal.bonus_description || null,
            bonus_tier1_amount: goal.bonus_tier1_amount,
            bonus_tier1_description: goal.bonus_tier1_description || null,
            bonus_tier2_amount: goal.bonus_tier2_amount,
            bonus_tier2_description: goal.bonus_tier2_description || null,
            bonus_tier3_amount: goal.bonus_tier3_amount,
            bonus_tier3_description: goal.bonus_tier3_description || null,
          })
          .eq("id", goal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("team_monthly_goals")
          .insert({
            team_id: goal.team_id,
            month: goal.month,
            year: goal.year,
            sales_target: goal.sales_target,
            bonus_description: goal.bonus_description || null,
            bonus_tier1_amount: goal.bonus_tier1_amount,
            bonus_tier1_description: goal.bonus_tier1_description || null,
            bonus_tier2_amount: goal.bonus_tier2_amount,
            bonus_tier2_description: goal.bonus_tier2_description || null,
            bonus_tier3_amount: goal.bonus_tier3_amount,
            bonus_tier3_description: goal.bonus_tier3_description || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-monthly-goals"] });
      toast.success(editingId ? "Mål opdateret" : "Mål oprettet");
      closeDialog();
    },
    onError: (err: any) => {
      toast.error("Fejl: " + (err.message || "Kunne ikke gemme mål"));
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("team_monthly_goals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-monthly-goals"] });
      toast.success("Mål slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette mål");
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setShowBreakdown(false);
    setOverriddenEmployees(new Set());
    setForm({
      team_id: "",
      month: currentMonth,
      year: currentYear,
      sales_target: 0,
      bonus_description: "",
      bonus_tier1_amount: 500,
      bonus_tier1_description: "Spisning på Retour Steak",
      bonus_tier2_amount: 750,
      bonus_tier2_description: "",
      bonus_tier3_amount: 1000,
      bonus_tier3_description: "Valgfrit",
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      team_id: "",
      month: filterMonth || currentMonth,
      year: filterYear,
      sales_target: 0,
      bonus_description: "",
      bonus_tier1_amount: 500,
      bonus_tier1_description: "Spisning på Retour Steak",
      bonus_tier2_amount: 750,
      bonus_tier2_description: "",
      bonus_tier3_amount: 1000,
      bonus_tier3_description: "Valgfrit",
    });
    setDialogOpen(true);
  };

  const openEdit = (goal: any) => {
    setEditingId(goal.id);
    setForm({
      team_id: goal.team_id,
      month: goal.month,
      year: goal.year,
      sales_target: goal.sales_target,
      bonus_description: goal.bonus_description || "",
      bonus_tier1_amount: goal.bonus_tier1_amount ?? 500,
      bonus_tier1_description: goal.bonus_tier1_description ?? "Spisning på Retour Steak",
      bonus_tier2_amount: goal.bonus_tier2_amount ?? 750,
      bonus_tier2_description: goal.bonus_tier2_description ?? "",
      bonus_tier3_amount: goal.bonus_tier3_amount ?? 1000,
      bonus_tier3_description: goal.bonus_tier3_description ?? "Valgfrit",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.team_id) {
      toast.error("Vælg et team");
      return;
    }
    if (form.sales_target <= 0) {
      toast.error("Salgsmål skal være større end 0");
      return;
    }
    upsertGoal.mutate({ ...form, id: editingId ?? undefined });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Teammål</h1>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Opret mål
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="w-32">
                <Label className="text-xs text-muted-foreground mb-1 block">År</Label>
                <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs text-muted-foreground mb-1 block">Måned</Label>
                <Select value={filterMonth ? String(filterMonth) : "all"} onValueChange={(v) => setFilterMonth(v === "all" ? null : Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle måneder</SelectItem>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              {filterMonth ? `${MONTH_NAMES[filterMonth - 1]} ${filterYear}` : `Alle måneder ${filterYear}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Indlæser...</p>
            ) : !goals?.length ? (
              <div className="text-center py-12 space-y-3">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Ingen teammål fundet for denne periode</p>
                <Button variant="outline" onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Opret det første mål
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Måned</TableHead>
                      <TableHead className="text-right">Salgsmål</TableHead>
                      
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map((goal: any) => (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">{goal.teams?.name || "–"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {MONTH_NAMES[goal.month - 1]} {goal.year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {goal.sales_target.toLocaleString("da-DK")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(goal)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Er du sikker på, at du vil slette dette mål?")) {
                                  deleteGoal.mutate(goal.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Rediger teammål" : "Opret teammål"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Team</Label>
              <Select value={form.team_id} onValueChange={(v) => setForm((f) => ({ ...f, team_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg team" />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Måned</Label>
                <Select value={String(form.month)} onValueChange={(v) => setForm((f) => ({ ...f, month: Number(v) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>År</Label>
                <Select value={String(form.year)} onValueChange={(v) => setForm((f) => ({ ...f, year: Number(v) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Salgsmål</Label>
              <Input
                type="number"
                min={0}
                value={form.sales_target || ""}
                onChange={(e) => setForm((f) => ({ ...f, sales_target: Number(e.target.value) }))}
                placeholder="F.eks. 500"
              />
              {/* Forecast suggestion */}
              {form.team_id && !editingId && (
                <div className="mt-2 space-y-1">
                  {forecastLoading ? (
                    <p className="text-xs text-muted-foreground">Beregner forecast...</p>
                  ) : adjustedForecast > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">
                          Forecast: {adjustedForecast.toLocaleString("da-DK")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {[5, 10, 15].map((pct) => {
                          const target = Math.round(adjustedForecast * (1 + pct / 100));
                          return (
                            <Button
                              key={pct}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setForm((f) => ({ ...f, sales_target: target }))}
                            >
                              +{pct}%: {target.toLocaleString("da-DK")}
                            </Button>
                          );
                        })}
                      </div>
                       <p className="text-xs text-muted-foreground">
                        Baseret på {adjustedPerEmployee.length} medarbejderes salg/dag i {prevMonthLabel}
                        {overriddenEmployees.size > 0 && (
                          <span className="ml-1 text-primary">
                            ({overriddenEmployees.size} bruger gns. {avgSalesPerDay.toFixed(2)} S/D)
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => setShowBreakdown((v) => !v)}
                      >
                        {showBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showBreakdown ? "Skjul detaljer" : "Vis detaljer"}
                      </button>
                      {showBreakdown && (
                        <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-48 overflow-y-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left pb-1">Navn</th>
                                <th className="text-right pb-1">Salg</th>
                                <th className="text-right pb-1">Vagter</th>
                                <th className="text-right pb-1">S/D</th>
                                <th className="text-right pb-1">Vagter*</th>
                                <th className="text-right pb-1">Forecast</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adjustedPerEmployee.map((e, i) => {
                                const isOverridden = e.isNew && overriddenEmployees.has(e.employeeId);
                                return (
                                  <tr key={i} className={`border-t border-border/50 ${e.isNew ? 'bg-primary/5' : ''}`}>
                                    <td className="py-0.5 truncate max-w-[120px] flex items-center gap-1">
                                      {e.isNew && (
                                        <button
                                          type="button"
                                          title={isOverridden ? "Brug eget S/D" : "Brug team-gennemsnit S/D"}
                                          className={`inline-flex items-center justify-center h-4 w-4 rounded-sm transition-colors ${
                                            isOverridden
                                              ? 'bg-primary text-primary-foreground'
                                              : 'bg-muted text-muted-foreground hover:bg-accent'
                                          }`}
                                          onClick={() => {
                                            setOverriddenEmployees(prev => {
                                              const next = new Set(prev);
                                              if (next.has(e.employeeId)) {
                                                next.delete(e.employeeId);
                                              } else {
                                                next.add(e.employeeId);
                                              }
                                              return next;
                                            });
                                          }}
                                        >
                                          {isOverridden ? <RotateCcw className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                                        </button>
                                      )}
                                      {e.name}
                                      {e.isNew && (
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-0.5">NY</Badge>
                                      )}
                                    </td>
                                    <td className="text-right tabular-nums">{e.prevSales}</td>
                                    <td className="text-right tabular-nums">{e.prevShifts}</td>
                                    <td className={`text-right tabular-nums ${isOverridden ? 'text-primary font-medium' : ''}`}>
                                      {e.salesPerDay.toFixed(2)}
                                    </td>
                                    <td className="text-right tabular-nums">{e.targetShifts}</td>
                                    <td className={`text-right tabular-nums font-medium ${isOverridden ? 'text-primary' : ''}`}>
                                      {e.forecast}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <p className="text-muted-foreground mt-1">* Vagter i den valgte måned</p>
                        </div>
                      )}
                    </>
                  ) : adjustedForecast === 0 && !forecastLoading && form.team_id ? (
                    <p className="text-xs text-muted-foreground">Ingen salgsdata fra {prevMonthLabel}</p>
                  ) : null}
                </div>
              )}
            </div>
            <BonusStaircase
              tiers={{
                bonus_tier1_amount: form.bonus_tier1_amount,
                bonus_tier1_description: form.bonus_tier1_description,
                bonus_tier2_amount: form.bonus_tier2_amount,
                bonus_tier2_description: form.bonus_tier2_description,
                bonus_tier3_amount: form.bonus_tier3_amount,
                bonus_tier3_description: form.bonus_tier3_description,
              }}
              onChange={(partial) => setForm((f) => ({ ...f, ...partial }))}
              salesTarget={form.sales_target}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuller</Button>
            <Button onClick={handleSubmit} disabled={upsertGoal.isPending}>
              {upsertGoal.isPending ? "Gemmer..." : editingId ? "Opdater" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
