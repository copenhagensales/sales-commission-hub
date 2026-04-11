import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Zap, Loader2, CheckCircle, Brain, Globe, Clock, Briefcase, User, Flame, AlertTriangle } from "lucide-react";

interface SegmentationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
  candidateId?: string;
  applicationId?: string;
}

interface SegmentationSignals {
  detectedAge: number | null;
  ageConfidence: string;
  detectedExperienceYears: number | null;
  experienceConfidence: string;
  englishWordPct: number;
  isDanish: boolean;
  isPartTime: boolean;
  motivationScore: number;
  motivationKeywordsFound: string[];
  fullTimeIndicators: boolean;
}

interface AnalysisResult {
  tier: "A" | "B" | "C";
  requiresApproval: boolean;
  reason: string;
  signals: SegmentationSignals;
  enrollmentId?: string;
  approvalStatus?: string;
}

const tierInfo = {
  A: {
    label: "Tier A — Høj prioritet",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    description: "Automatisk flow: SMS sendes straks, fuldt outreach-flow starter",
    icon: Zap,
  },
  B: {
    label: "Tier B — Kræver godkendelse",
    color: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    description: "Erfaren profil — gennemse og godkend før flow starter",
    icon: AlertTriangle,
  },
  C: {
    label: "Tier C — Lav prioritet",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/30",
    description: "Muligt mismatch — gennemse inden flow",
    icon: Clock,
  },
};

export function SegmentationModal({ open, onOpenChange, onEnrolled, candidateId: propCandidateId, applicationId: propApplicationId }: SegmentationModalProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const getCandidateId = () => {
    const candidate = (window as any).__selectedCandidateForFlow;
    return propCandidateId || candidate?.id;
  };

  // Run auto-analysis
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const candidateId = getCandidateId();
      if (!candidateId) throw new Error("Ingen kandidat valgt");

      setAnalyzing(true);
      const { data, error } = await supabase.functions.invoke("auto-segment-candidate", {
        body: { candidate_id: candidateId, dry_run: true },
      });
      if (error) throw error;
      return data as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      setAnalyzing(false);
    },
    onError: (err: any) => {
      toast.error("Analyse fejlede: " + err.message);
      setAnalyzing(false);
    },
  });

  // Enroll candidate (actual enrollment)
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const candidateId = getCandidateId();
      if (!candidateId) throw new Error("Ingen kandidat valgt");

      const { data, error } = await supabase.functions.invoke("auto-segment-candidate", {
        body: { candidate_id: candidateId, dry_run: false },
      });
      if (error) throw error;
      return data as AnalysisResult;
    },
    onSuccess: (data) => {
      if (data.requiresApproval) {
        toast.success(`Kandidat tilføjet som Tier ${data.tier} — afventer godkendelse`);
      } else {
        toast.success(`Tier ${data.tier} flow startet automatisk — SMS sendt!`);
      }
      resetAndClose();
      onEnrolled();
    },
    onError: (err: any) => {
      toast.error("Fejl: " + err.message);
    },
  });

  const resetAndClose = () => {
    setAnalysis(null);
    setAnalyzing(false);
    delete (window as any).__selectedCandidateForFlow;
    onOpenChange(false);
  };

  // Auto-analyze when modal opens
  const handleOpenChange = (o: boolean) => {
    if (o && !analysis && !analyzing) {
      analyzeMutation.mutate();
    }
    if (!o) {
      resetAndClose();
    } else {
      onOpenChange(o);
    }
  };

  // Trigger analysis on open
  if (open && !analysis && !analyzing && !analyzeMutation.isPending) {
    analyzeMutation.mutate();
  }

  const info = analysis ? tierInfo[analysis.tier] : null;
  const TierIcon = info?.icon || Zap;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            Auto-segmentering
          </DialogTitle>
        </DialogHeader>

        {(analyzing || analyzeMutation.isPending) && !analysis ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyserer kandidatprofil...</p>
          </div>
        ) : analysis ? (
          <div className="space-y-5">
            {/* Tier result */}
            <div className={`p-4 rounded-lg border ${info?.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <TierIcon className="h-4 w-4" />
                <span className="font-semibold text-sm">{info?.label}</span>
              </div>
              <p className="text-xs opacity-80">{info?.description}</p>
              <p className="text-xs mt-2 font-medium">{analysis.reason}</p>
            </div>

            <Separator />

            {/* Parsed signals */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analyserede signaler</p>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Age */}
                <SignalCard
                  icon={User}
                  label="Alder"
                  value={analysis.signals.detectedAge !== null ? `${analysis.signals.detectedAge} år` : "Ikke fundet"}
                  confidence={analysis.signals.ageConfidence}
                />

                {/* Experience */}
                <SignalCard
                  icon={Briefcase}
                  label="Erfaring"
                  value={analysis.signals.detectedExperienceYears !== null ? `${analysis.signals.detectedExperienceYears} år` : "Ikke fundet"}
                  confidence={analysis.signals.experienceConfidence}
                />

                {/* Language */}
                <SignalCard
                  icon={Globe}
                  label="Sprog"
                  value={analysis.signals.isDanish ? "Dansk" : `Engelsk (${analysis.signals.englishWordPct}%)`}
                  confidence={analysis.signals.isDanish ? "high" : "low"}
                />

                {/* Job type */}
                <SignalCard
                  icon={Clock}
                  label="Jobtype"
                  value={analysis.signals.isPartTime ? "Deltid" : analysis.signals.fullTimeIndicators ? "Fuldtid" : "Ukendt"}
                  confidence={analysis.signals.isPartTime ? "low" : analysis.signals.fullTimeIndicators ? "high" : "none"}
                />
              </div>

              {/* Motivation */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Motivation</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    Score: {analysis.signals.motivationScore}
                  </Badge>
                </div>
                {analysis.signals.motivationKeywordsFound.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.signals.motivationKeywordsFound.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Ingen motivations-keywords fundet</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuller
          </Button>
          {analysis && (
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
            >
              {enrollMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {analysis.requiresApproval
                ? `Opret Tier ${analysis.tier} — afventer godkendelse`
                : `Start Tier ${analysis.tier} flow automatisk`
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignalCard({ icon: Icon, label, value, confidence }: {
  icon: typeof User;
  label: string;
  value: string;
  confidence: string;
}) {
  const confidenceColor = {
    high: "bg-emerald-500",
    medium: "bg-amber-500",
    low: "bg-red-500",
    none: "bg-gray-300",
  }[confidence] || "bg-gray-300";

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`w-2 h-2 rounded-full ml-auto ${confidenceColor}`} />
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
