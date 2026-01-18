import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { AddTeamExpenseDialog } from "./AddTeamExpenseDialog";
import { EditTeamExpenseDialog } from "./EditTeamExpenseDialog";

interface TeamExpense {
  id: string;
  team_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  notes: string | null;
  teams?: { name: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  konkurrence: "Konkurrence",
  præmie: "Præmie",
  bonus: "Bonus",
  andet: "Andet",
};

export function TeamExpensesTab() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TeamExpense | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: teams } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-expense-filter"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expenses, isLoading } = useQuery<TeamExpense[]>({
    queryKey: ["team-expenses", monthStart.toISOString(), monthEnd.toISOString(), selectedTeam],
    queryFn: async () => {
      let query = (supabase
        .from("team_expenses") as any)
        .select("id, team_id, description, amount, expense_date, category, notes")
        .gte("expense_date", monthStart.toISOString().split("T")[0])
        .lte("expense_date", monthEnd.toISOString().split("T")[0])
        .order("expense_date", { ascending: false });

      if (selectedTeam !== "all") {
        query = query.eq("team_id", selectedTeam);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Attach team names
      const teamIds = [...new Set(data?.map((e: any) => e.team_id) || [])];
      const { data: teamsData } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .in("id", teamIds);

      return data?.map((e: any) => ({
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

  const totalAmount = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Teamomkostninger</CardTitle>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tilføj udgift
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center font-medium capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: da })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

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
                  <TableHead>Kategori</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : !expenses?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Ingen udgifter fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.teams?.name}</TableCell>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          {expense.category && (
                            <Badge variant="outline">
                              {CATEGORY_LABELS[expense.category] || expense.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(expense.expense_date), "d. MMM yyyy", { locale: da })}</TableCell>
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
                      <TableCell colSpan={4}>Total</TableCell>
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
    </>
  );
}
