import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Sparkles, Loader2 } from "lucide-react";
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
  is_recurring?: boolean;
  all_days?: boolean;
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
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [allDays, setAllDays] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState(false);
  const [aiResult, setAiResult] = useState<{ amount: number; explanation: string } | null>(null);

  useEffect(() => {
    if (expense) {
      setTeamId(expense.team_id);
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category || "");
      setExpenseDate(new Date(expense.expense_date));
      setNotes(expense.notes || "");
      setIsRecurring(expense.is_recurring || false);
      setAllDays(expense.all_days || false);
      setAiResult(null);
    }
  }, [expense]);

  const parseFormula = async () => {
    if (!teamId || !description) {
      toast.error("Vælg team og indtast beskrivelse først");
      return;
    }

    setIsParsing(true);
    setAiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-expense-formula", {
        body: {
          description: description,
          team_id: teamId,
        },
      });

      if (error) throw error;

      if (data?.amount !== undefined) {
        setAiResult({
          amount: data.amount,
          explanation: data.explanation || "AI beregning",
        });
      } else {
        toast.error("Kunne ikke fortolke beskrivelsen");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Fejl ved AI-fortolkning");
    } finally {
      setIsParsing(false);
    }
  };

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
          is_recurring: isRecurring,
          all_days: allDays,
          updated_at: new Date().toISOString(),
        } as any)
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
            <div className="flex gap-2">
              <Input
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setAiResult(null);
                }}
                placeholder="F.eks. Konkurrence Q1"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={parseFormula}
                disabled={isParsing || !teamId || !description}
                title="Fortolk med AI"
              >
                {isParsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {aiResult && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI forslag
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAmount(String(aiResult.amount));
                    toast.success("Beløb anvendt");
                  }}
                >
                  Anvend beløb
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{aiResult.explanation}</p>
              <p className="text-sm">
                Beregnet beløb: <strong>{aiResult.amount.toLocaleString("da-DK")} kr.</strong>
              </p>
            </div>
          )}

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
            <Label>Udgiftstype *</Label>
            <RadioGroup
              value={isRecurring ? "recurring" : "onetime"}
              onValueChange={(value) => setIsRecurring(value === "recurring")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="onetime" id="edit-onetime" />
                <Label htmlFor="edit-onetime" className="font-normal cursor-pointer">Engangsudgift</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recurring" id="edit-recurring" />
                <Label htmlFor="edit-recurring" className="font-normal cursor-pointer">Fast udgift</Label>
              </div>
            </RadioGroup>
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
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="edit-allDays" 
                checked={allDays} 
                onCheckedChange={(checked) => setAllDays(checked === true)} 
              />
              <Label htmlFor="edit-allDays" className="font-normal cursor-pointer">
                Alle dage i perioden
              </Label>
            </div>
          </div>

          {!allDays && (
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
          )}

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
