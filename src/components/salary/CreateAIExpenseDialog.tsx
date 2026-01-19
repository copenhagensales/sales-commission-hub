import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface CreateAIExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: { id: string; name: string }[];
}

interface FormulaResult {
  formula: string;
  variables: Record<string, number>;
  calculated_amount: number;
  explanation: string;
  expense_name: string;
  category: string;
}

interface ParseResponse {
  success: boolean;
  result?: FormulaResult;
  context?: {
    team_name: string;
    team_member_count: number;
    team_sales_count: number;
    team_revenue: number;
  };
  error?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
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
  andet: "Andet",
};

export function CreateAIExpenseDialog({
  open,
  onOpenChange,
  teams,
}: CreateAIExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const resetForm = () => {
    setTeamId("");
    setDescription("");
    setParseResult(null);
  };

  const parseFormula = async () => {
    if (!teamId || !description.trim()) {
      toast.error("Vælg et team og skriv en beskrivelse");
      return;
    }

    setIsParsing(true);
    setParseResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-expense-formula", {
        body: { description: description.trim(), team_id: teamId },
      });

      if (error) throw error;

      setParseResult(data as ParseResponse);

      if (!data.success) {
        toast.error(data.error || "Kunne ikke fortolke beskrivelsen");
      }
    } catch (error) {
      console.error("Error parsing formula:", error);
      toast.error("Der opstod en fejl ved fortolkning af beskrivelsen");
      setParseResult({ success: false, error: "Netværksfejl" });
    } finally {
      setIsParsing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult?.result || !teamId) {
        throw new Error("Ingen gyldig formel at gemme");
      }

      const { result } = parseResult;

      const { error } = await supabase.from("team_expenses").insert({
        team_id: teamId,
        description: result.expense_name,
        amount: result.calculated_amount,
        category: result.category,
        expense_date: new Date().toISOString().split("T")[0],
        notes: `AI-genereret: ${description}\n\nFormel: ${result.formula}\nForklaring: ${result.explanation}`,
        is_recurring: true,
        is_dynamic: true,
        calculation_formula: result.formula,
        formula_variables: result.variables,
        formula_description: result.explanation,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Dynamisk udgift oprettet!");
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error saving expense:", error);
      toast.error("Kunne ikke gemme udgiften");
    },
  });

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Opret udgift med AI
          </DialogTitle>
          <DialogDescription>
            Beskriv udgiften i naturligt sprog, og AI'en hjælper med at definere
            beregningen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskriv udgiften</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. '500 kr per sælger i teamet' eller '1% af omsætningen' eller '2000 kr fast bonus'"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Du kan bruge: antal sælgere, antal salg, omsætning, faste beløb,
              procenter m.m.
            </p>
          </div>

          <Button
            onClick={parseFormula}
            disabled={isParsing || !teamId || !description.trim()}
            className="w-full"
            variant="secondary"
          >
            {isParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyserer...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Fortolk med AI
              </>
            )}
          </Button>

          {parseResult && (
            <Card className={`p-4 ${parseResult.success ? "border-green-500/50" : "border-destructive/50"}`}>
              {parseResult.success && parseResult.result ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">AI-fortolkning</span>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Navn:</span>
                      <span className="font-medium">{parseResult.result.expense_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kategori:</span>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[parseResult.result.category] || parseResult.result.category}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Beregnet beløb:</span>
                      <span className="font-bold text-lg">
                        {parseResult.result.calculated_amount.toLocaleString("da-DK")} kr
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {parseResult.result.explanation}
                    </p>
                  </div>

                  {parseResult.context && (
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      <p>
                        Baseret på: {parseResult.context.team_member_count} sælgere,{" "}
                        {parseResult.context.team_sales_count} salg,{" "}
                        {parseResult.context.team_revenue.toLocaleString("da-DK")} kr omsætning
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{parseResult.error || "Kunne ikke fortolke beskrivelsen"}</span>
                </div>
              )}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuller
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!parseResult?.success || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gemmer...
              </>
            ) : (
              "Opret udgift"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
