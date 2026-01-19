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
import { Sparkles, Loader2, CheckCircle2, AlertCircle, MapPin, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateAIExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: { id: string; name: string }[];
}

interface LocationDetail {
  name: string;
  location_id: string;
  days: number;
  daily_rate: number;
  total: number;
  sales: number;
  revenue: number;
}

interface EmployeeDetail {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  booking_days: number;
}

interface FormulaResult {
  formula: string;
  variables: Record<string, number | string | object>;
  calculated_amount: number;
  explanation: string;
  expense_name: string;
  category: string;
  formula_readable?: string;
}

interface RichContext {
  team_name: string;
  team_member_count: number;
  team_sales_count: number;
  team_revenue: number;
  booking_count: number;
  booked_locations_count: number;
  booking_days_count: number;
  location_costs_total: number;
  location_details: LocationDetail[];
  avg_location_daily_rate: number;
  fm_sales_count: number;
  avg_sales_per_employee: number;
  employee_details: EmployeeDetail[];
  working_days_in_month: number;
}

interface ParseResponse {
  success: boolean;
  result?: FormulaResult;
  context?: RichContext;
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
  lokation: "Lokation",
  bonus: "Bonus",
  provision: "Provision",
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
  const [showDetails, setShowDetails] = useState(false);

  const resetForm = () => {
    setTeamId("");
    setDescription("");
    setParseResult(null);
    setShowDetails(false);
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
        formula_variables: result.variables as Record<string, unknown>,
        formula_description: result.explanation,
      } as never);

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

  const context = parseResult?.context;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Opret udgift med AI
          </DialogTitle>
          <DialogDescription>
            Beskriv udgiften i naturligt sprog – AI'en forstår komplekse beregninger med lokationer, salg og dagspriser.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
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
                placeholder="F.eks. 'Lokationsudgift baseret på dagspriser' eller '500 kr per lokation med over 5 salg' eller '10% rabat på total lokationsudgift'"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                AI'en kan beregne: dagspriser × dage per lokation, bonus per salg, rabatter, betingelser (over X salg), og meget mere.
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
                  Analyserer data og beregner...
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
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Beregnet beløb:</span>
                        <span className="font-bold text-xl text-primary">
                          {parseResult.result.calculated_amount.toLocaleString("da-DK")} kr
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        {parseResult.result.formula_readable || parseResult.result.explanation}
                      </p>
                    </div>

                    {/* Compact context summary */}
                    {context && (
                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{context.team_member_count} sælgere</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            <span>{context.team_sales_count} salg</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{context.booked_locations_count} lokationer</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{context.booking_days_count} dage</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expandable details */}
                    {context && context.location_details.length > 0 && (
                      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs">
                            <span>Se lokationsdetaljer ({context.location_details.length} lokationer)</span>
                            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {context.location_details.map((loc, idx) => (
                              <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
                                <span className="text-muted-foreground truncate max-w-[150px]">{loc.name}</span>
                                <span className="text-muted-foreground">
                                  {loc.days}d × {loc.daily_rate.toLocaleString("da-DK")} kr = <span className="font-medium text-foreground">{loc.total.toLocaleString("da-DK")} kr</span>
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs pt-1 font-medium">
                              <span>Total lokationsudgift:</span>
                              <span>{context.location_costs_total.toLocaleString("da-DK")} kr</span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
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
