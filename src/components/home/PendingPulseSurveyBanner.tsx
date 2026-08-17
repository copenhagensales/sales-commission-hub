import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ArrowRight, PenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useShouldShowPulseSurvey,
  usePulseSurveyDismissal,
  usePulseSurveyHasDraft,
} from "@/hooks/usePulseSurvey";

const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

/**
 * Viser et tydeligt link på forsiden når medarbejderen mangler at besvare
 * den aktive pulsmåling — samme mønster som kontrakt-banneret.
 */
export function PendingPulseSurveyBanner() {
  const navigate = useNavigate();
  const { showMenuItem, activeSurvey, hasCompleted, isLoading } = useShouldShowPulseSurvey();
  const { data: dismissalData } = usePulseSurveyDismissal(activeSurvey?.id);
  const { data: hasDraft } = usePulseSurveyHasDraft(activeSurvey?.id);

  const shouldShow =
    !isLoading &&
    showMenuItem &&
    !!activeSurvey &&
    hasCompleted === false &&
    !!dismissalData &&
    !dismissalData.isStaff &&
    !!dismissalData.employeeId;

  if (!shouldShow) return null;

  const periodLabel = activeSurvey
    ? `${MONTHS[(activeSurvey.month ?? 1) - 1]} ${activeSurvey.year}`
    : "";

  return (
    <Card className="relative overflow-hidden border-0 ring-2 ring-primary/50 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.4)] animate-fade-in">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />

      <CardContent className="py-5 pl-6 pr-4 md:pl-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              {hasDraft ? <PenLine className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive ring-2 ring-card animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Mangler besvarelse
              </p>
              <p className="font-bold text-base md:text-lg leading-snug text-foreground">
                {hasDraft
                  ? "Du har en igangværende pulsmåling"
                  : `Du mangler at besvare pulsmålingen for ${periodLabel}`}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Det tager kun 2 minutter, og dine svar er 100% anonyme.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => navigate("/pulse-survey")}
            className="font-semibold shadow-md"
          >
            {hasDraft ? "Fortsæt besvarelse" : "Besvar pulsmåling"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
