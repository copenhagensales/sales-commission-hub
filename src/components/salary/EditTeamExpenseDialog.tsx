import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamExpense {
  id: string;
  team_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  notes: string | null;
}

interface EditTeamExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: TeamExpense | null;
  teams: { id: string; name: string }[];
}

const CATEGORIES = [
  { value: "konkurrence", label: "Konkurrence" },
  { value: "præmie", label: "Præmie" },
  { value: "bonus", label: "Bonus" },
  { value: "andet", label: "Andet" },
];

export function EditTeamExpenseDialog({ open, onOpenChange, expense, teams }: EditTeamExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (expense) {
      setTeamId(expense.team_id);
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category || "");
      setExpenseDate(new Date(expense.expense_date));
      setNotes(expense.notes || "");
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!expense) return;
      const { error } = await supabase
        .from("team_expenses")
        .update({
          team_id: teamId,
          description,
          amount: parseFloat(amount),
          category: category || null,
          expense_date: format(expenseDate, "yyyy-MM-dd"),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Udgift opdateret");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Kunne ikke opdatere udgift");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !description || !amount) {
      toast.error("Udfyld venligst alle påkrævede felter");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rediger udgift</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team">Team *</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Konkurrence Q1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Beløb (kr.) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(expenseDate, "d. MMMM yyyy", { locale: da })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expenseDate}
                  onSelect={(date) => date && setExpenseDate(date)}
                  locale={da}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Evt. yderligere noter..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
