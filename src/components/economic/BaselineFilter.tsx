import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEconomicKategorier, useBaselineExclusions, useUpdateBaselineExclusions } from "@/hooks/useEconomicData";
import { toast } from "sonner";

export function BaselineFilter() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: kategorier } = useEconomicKategorier();
  const { data: exclusions = [] } = useBaselineExclusions();
  const updateExclusions = useUpdateBaselineExclusions();
  
  const [localExclusions, setLocalExclusions] = useState<Set<string>>(new Set(exclusions));
  
  // Update local state when data loads
  if (exclusions.length > 0 && localExclusions.size === 0) {
    setLocalExclusions(new Set(exclusions));
  }
  
  const handleToggle = (kategoriId: string) => {
    const newExclusions = new Set(localExclusions);
    if (newExclusions.has(kategoriId)) {
      newExclusions.delete(kategoriId);
    } else {
      newExclusions.add(kategoriId);
    }
    setLocalExclusions(newExclusions);
  };
  
  const handleSave = async () => {
    try {
      await updateExclusions.mutateAsync(Array.from(localExclusions));
      toast.success("Baseline-filter gemt");
    } catch (error) {
      toast.error("Kunne ikke gemme filter");
    }
  };
  
  const expenseKategorier = kategorier?.filter(k => k.is_expense) || [];
  
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Baseline-filter</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Baseline viser gennemsnitlige månedlige udgifter <strong>uden</strong> de kategorier du vælger at ekskludere. 
                      Brug dette til at se "faste driftsomkostninger" uden variable udgifter som løn, transport, rejser osv.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Vælg hvilke kategorier der skal <strong>ekskluderes</strong> fra baseline-beregningen:
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {expenseKategorier.map((kat) => (
                <div key={kat.id} className="flex items-center gap-2">
                  <Checkbox
                    id={kat.id}
                    checked={localExclusions.has(kat.id)}
                    onCheckedChange={() => handleToggle(kat.id)}
                  />
                  <Label htmlFor={kat.id} className="text-sm cursor-pointer">
                    {kat.navn}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={updateExclusions.isPending}>
                Gem filter
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
