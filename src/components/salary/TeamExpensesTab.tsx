import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { AddTeamExpenseDialog } from "./AddTeamExpenseDialog";
import { EditTeamExpenseDialog } from "./EditTeamExpenseDialog";
import { CreateAIExpenseDialog } from "./CreateAIExpenseDialog";
import { PayrollPeriodSelector } from "@/components/employee/PayrollPeriodSelector";

interface TeamExpense {
  id: string;
  team_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  notes: string | null;
  is_recurring?: boolean;
  is_dynamic?: boolean;
  all_days?: boolean;
  formula_description?: string | null;
  teams?: { name: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  konkurrence: "Konkurrence",
  præmie: "Præmie",
  bonus: "Bonus",
  andet: "Andet",
  kantineordning: "Kantineordning",
  firmabil: "Firmabil",
  parkering: "Parkering",
  telefon: "Telefon",
  internet: "Internet",
  forsikring: "Forsikring",
  uddannelse: "Uddannelse",
  udstyr: "Udstyr",
  software: "Software",
  transport: "Transport",
  repræsentation: "Repræsentation",
};

export function TeamExpensesTab() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [periodStart, setPeriodStart] = useState<Date>(new Date());
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TeamExpense | null>(null);

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const { data: teams } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-expense-filter"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expenses, isLoading } = useQuery<TeamExpense[]>({
    queryKey: ["team-expenses", periodStart.toISOString(), periodEnd.toISOString(), selectedTeam],
    queryFn: async () => {
      // Fetch one-time expenses within period
      let oneTimeQuery = (supabase
        .from("team_expenses") as any)
        .select("id, team_id, description, amount, expense_date, category, notes, is_recurring, is_dynamic, all_days, formula_description")
        .eq("is_recurring", false)
        .gte("expense_date", periodStart.toISOString().split("T")[0])
        .lte("expense_date", periodEnd.toISOString().split("T")[0]);

      if (selectedTeam !== "all") {
        oneTimeQuery = oneTimeQuery.eq("team_id", selectedTeam);
      }

      // Fetch all recurring expenses (they appear in every period)
      let recurringQuery = (supabase
        .from("team_expenses") as any)
        .select("id, team_id, description, amount, expense_date, category, notes, is_recurring, is_dynamic, all_days, formula_description")
        .eq("is_recurring", true);

      if (selectedTeam !== "all") {
        recurringQuery = recurringQuery.eq("team_id", selectedTeam);
      }

      const [oneTimeResult, recurringResult] = await Promise.all([
        oneTimeQuery,
        recurringQuery,
      ]);

      if (oneTimeResult.error) throw oneTimeResult.error;
      if (recurringResult.error) throw recurringResult.error;

      const allExpenses = [...(oneTimeResult.data || []), ...(recurringResult.data || [])];
      
      // Sort by expense_date descending
      allExpenses.sort((a: any, b: any) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

      // Attach team names
      const teamIds = [...new Set(allExpenses.map((e: any) => e.team_id))];
      const { data: teamsData } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .in("id", teamIds);

      return allExpenses.map((e: any) => ({
        ...e,
        teams: teamsData?.find((t: any) => t.id === e.team_id),
      })) as TeamExpense[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Udgift slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette udgift");
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("recalculate-dynamic-expenses", {
        body: selectedTeam !== "all" ? { team_id: selectedTeam } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team-expenses"] });
      const summary = data?.summary;
      if (summary) {
        toast.success(`Genberegnet: ${summary.updated} opdateret, ${summary.unchanged} uændret`);
      } else {
        toast.success("AI-udgifter genberegnet");
      }
    },
    onError: (error) => {
      console.error("Recalculation error:", error);
      toast.error("Kunne ikke genberegne AI-udgifter");
    },
  });

  const totalAmount = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  // formatCurrency imported from @/lib/calculations

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Teamomkostninger</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => recalculateMutation.mutate()} 
              disabled={recalculateMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
              {recalculateMutation.isPending ? 'Genberegner...' : 'Genberegn AI'}
            </Button>
            <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Opret med AI
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj udgift
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <PayrollPeriodSelector onChange={handlePeriodChange} />

            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vælg team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle teams</SelectItem>
                {teams?.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : !expenses?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Ingen udgifter fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.teams?.name}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {expense.description}
                            {expense.is_dynamic && (
                              <span title={expense.formula_description || "AI-beregnet"}>
                                <Sparkles className="h-3 w-3 text-primary" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={expense.is_recurring ? "default" : "secondary"}>
                              {expense.is_recurring ? "Fast" : "Engang"}
                            </Badge>
                            {expense.is_dynamic && (
                              <Badge variant="outline" className="border-primary/50 text-primary">
                                AI
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {expense.category && (
                            <Badge variant="outline">
                              {CATEGORY_LABELS[expense.category] || expense.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {expense.all_days 
                            ? "Alle dage" 
                            : format(new Date(expense.expense_date), "d. MMM yyyy", { locale: da })}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(expense.amount))}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingExpense(expense)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rediger
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(expense.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Slet
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={5}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddTeamExpenseDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen}
        teams={teams || []}
      />

      <EditTeamExpenseDialog
        open={!!editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        expense={editingExpense}
        teams={teams || []}
      />

      <CreateAIExpenseDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        teams={teams || []}
      />
    </>
  );
}
