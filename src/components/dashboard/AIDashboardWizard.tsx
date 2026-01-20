import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ChevronRight, ChevronLeft, BarChart3, Clock, Users, Palette, Target, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useKpiDefinitions, KpiCategory } from "@/hooks/useKpiDefinitions";
import { useDesignTypes } from "@/hooks/useDesignTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PlacedWidget {
  id: string;
  widgetTypeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dataSource: "kpi" | "custom";
  kpiTypeIds: string[];
  timePeriodId: string;
  title?: string;
  showTrend?: boolean;
}

export interface AIDashboardWizardOptions {
  scopeType: "all" | "team" | "client";
  teamId?: string;
  clientId?: string;
  period: string;
  selectedKpis: string[];
  focusKpis: string[];
  aiPrompt?: string;
}

interface AIDashboardWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (widgets: PlacedWidget[], designId: string, options: AIDashboardWizardOptions) => void;
  teams: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}

const TIME_PERIODS = [
  { id: "today", name: "I dag" },
  { id: "this-week", name: "Denne uge" },
  { id: "this-month", name: "Denne måned" },
  { id: "this-quarter", name: "Dette kvartal" },
  { id: "this-year", name: "I år" },
  { id: "last-7-days", name: "Sidste 7 dage" },
  { id: "last-30-days", name: "Sidste 30 dage" },
];

const CATEGORY_LABELS: Record<KpiCategory, string> = {
  sales: "Salg",
  hours: "Timer",
  calls: "Opkald",
  employees: "Medarbejdere",
  other: "Andet",
};

const CATEGORY_ICONS: Record<KpiCategory, React.ReactNode> = {
  sales: <BarChart3 className="h-4 w-4" />,
  hours: <Clock className="h-4 w-4" />,
  calls: <Target className="h-4 w-4" />,
  employees: <Users className="h-4 w-4" />,
  other: <BarChart3 className="h-4 w-4" />,
};

type WizardStep = "kpis" | "focus" | "scope" | "period" | "design" | "prompt";

const STEPS: { id: WizardStep; title: string; icon: React.ReactNode }[] = [
  { id: "kpis", title: "KPI'er", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "focus", title: "Fokus", icon: <Target className="h-4 w-4" /> },
  { id: "scope", title: "Scope", icon: <Users className="h-4 w-4" /> },
  { id: "period", title: "Periode", icon: <Clock className="h-4 w-4" /> },
  { id: "design", title: "Design", icon: <Palette className="h-4 w-4" /> },
  { id: "prompt", title: "AI Forslag", icon: <MessageSquare className="h-4 w-4" /> },
];

export function AIDashboardWizard({ open, onOpenChange, onGenerate, teams, clients }: AIDashboardWizardProps) {
  const { toast } = useToast();
  const { data: kpiDefinitions = [], isLoading: kpisLoading } = useKpiDefinitions();
  const { activeDesignTypes } = useDesignTypes();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>("kpis");
  const [selectedKpis, setSelectedKpis] = useState<string[]>([]);
  const [focusKpis, setFocusKpis] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState<"all" | "team" | "client">("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("this-month");
  const [selectedDesign, setSelectedDesign] = useState<string>("minimal");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const kpisByCategory = kpiDefinitions.reduce((acc, kpi) => {
    const category = kpi.category as KpiCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(kpi);
    return acc;
  }, {} as Record<KpiCategory, typeof kpiDefinitions>);

  const toggleKpi = (slug: string) => {
    setSelectedKpis(prev => 
      prev.includes(slug) ? prev.filter(k => k !== slug) : [...prev, slug]
    );
    // Remove from focus if unselected
    if (selectedKpis.includes(slug)) {
      setFocusKpis(prev => prev.filter(k => k !== slug));
    }
  };

  const toggleFocusKpi = (slug: string) => {
    if (!selectedKpis.includes(slug)) return;
    setFocusKpis(prev => {
      if (prev.includes(slug)) return prev.filter(k => k !== slug);
      if (prev.length >= 3) return prev; // Max 3 focus KPIs
      return [...prev, slug];
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case "kpis": return selectedKpis.length > 0;
      case "focus": return true; // Optional
      case "scope": return scopeType === "all" || 
        (scopeType === "team" && selectedTeamId) || 
        (scopeType === "client" && selectedClientId);
      case "period": return !!selectedPeriod;
      case "design": return !!selectedDesign;
      case "prompt": return true; // AI instruktioner er valgfrie
      default: return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const selectedKpiDetails = kpiDefinitions
        .filter(k => selectedKpis.includes(k.slug))
        .map(k => ({ slug: k.slug, name: k.name, category: k.category }));
      
      const focusKpiDetails = kpiDefinitions
        .filter(k => focusKpis.includes(k.slug))
        .map(k => ({ slug: k.slug, name: k.name }));

      const { data, error } = await supabase.functions.invoke("generate-dashboard-layout", {
        body: {
          kpis: selectedKpiDetails,
          focusKpis: focusKpiDetails,
          scopeType,
          teamId: scopeType === "team" ? selectedTeamId : undefined,
          clientId: scopeType === "client" ? selectedClientId : undefined,
          period: selectedPeriod,
          designId: selectedDesign,
          aiPrompt: aiPrompt.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.widgets) {
        onGenerate(data.widgets, selectedDesign, {
          scopeType,
          teamId: selectedTeamId || undefined,
          clientId: selectedClientId || undefined,
          period: selectedPeriod,
          selectedKpis,
          focusKpis,
          aiPrompt: aiPrompt.trim() || undefined,
        });
        toast({ title: "Dashboard genereret!", description: "AI har oprettet dit dashboard baseret på dine valg." });
        resetWizard();
      } else {
        throw new Error("Ingen widgets modtaget fra AI");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      toast({ 
        title: "Fejl ved generering", 
        description: error instanceof Error ? error.message : "Kunne ikke generere dashboard",
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep("kpis");
    setSelectedKpis([]);
    setFocusKpis([]);
    setScopeType("all");
    setSelectedTeamId("");
    setSelectedClientId("");
    setSelectedPeriod("this-month");
    setSelectedDesign("minimal");
    setAiPrompt("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Design med AI
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator - Progress bar design */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                {/* Step circle */}
                <button
                  onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                  disabled={index > currentStepIndex}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all shrink-0",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                      : index < currentStepIndex
                        ? "bg-primary/80 text-primary-foreground hover:bg-primary cursor-pointer"
                        : "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {index + 1}
                </button>
                
                {/* Connecting line */}
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-1 mx-2 rounded-full transition-colors",
                    index < currentStepIndex ? "bg-primary/80" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>
          
          {/* Current step title */}
          <div className="flex items-center gap-2 mt-3 text-sm font-medium text-foreground">
            {STEPS[currentStepIndex].icon}
            <span>Step {currentStepIndex + 1}: {STEPS[currentStepIndex].title}</span>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="py-4">
            {/* Step 1: KPI Selection */}
            {currentStep === "kpis" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vælg de KPI'er du vil have på dit dashboard. Du kan vælge flere.
                </p>
                {kpisLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(Object.keys(kpisByCategory) as KpiCategory[]).map(category => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {CATEGORY_ICONS[category]}
                          {CATEGORY_LABELS[category]}
                          <Badge variant="secondary" className="text-xs">
                            {kpisByCategory[category].length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          {kpisByCategory[category].map(kpi => (
                            <div
                              key={kpi.slug}
                              onClick={() => toggleKpi(kpi.slug)}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                                selectedKpis.includes(kpi.slug)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <Checkbox checked={selectedKpis.includes(kpi.slug)} />
                              <span className="text-sm truncate">{kpi.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedKpis.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedKpis.length} KPI'er valgt
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Focus KPIs */}
            {currentStep === "focus" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vælg op til 3 KPI'er der skal fremhæves på dashboardet (valgfrit).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {kpiDefinitions
                    .filter(k => selectedKpis.includes(k.slug))
                    .map(kpi => (
                      <div
                        key={kpi.slug}
                        onClick={() => toggleFocusKpi(kpi.slug)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors",
                          focusKpis.includes(kpi.slug)
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50",
                          !selectedKpis.includes(kpi.slug) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Target className={cn(
                          "h-4 w-4",
                          focusKpis.includes(kpi.slug) ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className="text-sm">{kpi.name}</span>
                      </div>
                    ))}
                </div>
                {focusKpis.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {focusKpis.length}/3 fokus-KPI'er valgt
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Scope */}
            {currentStep === "scope" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vælg om dashboardet skal vise data for alle, et specifikt team eller en kunde.
                </p>
                <RadioGroup value={scopeType} onValueChange={(v) => setScopeType(v as typeof scopeType)}>
                  <div className="flex items-center space-x-2 p-3 rounded-md border">
                    <RadioGroupItem value="all" id="scope-all" />
                    <Label htmlFor="scope-all" className="flex-1 cursor-pointer">
                      Alle data
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-3 rounded-md border">
                      <RadioGroupItem value="team" id="scope-team" />
                      <Label htmlFor="scope-team" className="flex-1 cursor-pointer">
                        Specifikt team
                      </Label>
                    </div>
                    {scopeType === "team" && (
                      <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                        <SelectTrigger className="ml-6 w-[calc(100%-1.5rem)]">
                          <SelectValue placeholder="Vælg team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-3 rounded-md border">
                      <RadioGroupItem value="client" id="scope-client" />
                      <Label htmlFor="scope-client" className="flex-1 cursor-pointer">
                        Specifik kunde
                      </Label>
                    </div>
                    {scopeType === "client" && (
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="ml-6 w-[calc(100%-1.5rem)]">
                          <SelectValue placeholder="Vælg kunde..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Step 4: Period */}
            {currentStep === "period" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vælg standard tidsperiode for dashboardets widgets.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_PERIODS.map(period => (
                    <div
                      key={period.id}
                      onClick={() => setSelectedPeriod(period.id)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors",
                        selectedPeriod === period.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Clock className={cn(
                        "h-4 w-4",
                        selectedPeriod === period.id ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="text-sm">{period.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Design */}
            {currentStep === "design" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vælg et design tema for dit dashboard.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {activeDesignTypes.map(design => (
                    <div
                      key={design.id}
                      onClick={() => setSelectedDesign(design.id)}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all",
                        selectedDesign === design.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn("h-12 rounded-md mb-2", design.preview)} />
                      <p className="text-sm font-medium text-center">{design.name}</p>
                      <p className="text-xs text-muted-foreground text-center">{design.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: AI Prompt */}
            {currentStep === "prompt" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Giv AI'en ekstra instruktioner eller forslag til dit dashboard (valgfrit).
                </p>
                <div className="space-y-2">
                  <Label htmlFor="ai-prompt">Instruktioner til AI</Label>
                  <Textarea
                    id="ai-prompt"
                    placeholder="F.eks. 'Fokuser på visualisering af månedlig vækst' eller 'Vis sammenligning mellem teams'"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="min-h-[120px] resize-none"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Tilbage
            </Button>
            
            {currentStep === "prompt" ? (
              <Button 
                onClick={handleGenerate} 
                disabled={!canProceed() || isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Genererer...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generer Dashboard
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed()}>
                Næste
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
