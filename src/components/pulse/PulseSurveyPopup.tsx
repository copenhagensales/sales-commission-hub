import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useShouldShowPulseSurvey,
  usePulseSurveyDismissal,
  useDismissPulseSurvey,
  usePulseSurveyHasDraft,
} from "@/hooks/usePulseSurvey";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Clock, PenLine } from "lucide-react";

export function PulseSurveyPopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [delayPassed, setDelayPassed] = useState(false);

  const { showMenuItem, activeSurvey, hasCompleted } = useShouldShowPulseSurvey();
  const { data: dismissalData, isLoading: dismissalLoading } = usePulseSurveyDismissal(activeSurvey?.id);
  const { data: hasDraft, isLoading: draftLoading } = usePulseSurveyHasDraft(activeSurvey?.id);
  const dismissMutation = useDismissPulseSurvey();

  // 2 second delay before showing
  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Determine if popup should show
  useEffect(() => {
    if (!delayPassed || dismissalLoading || draftLoading) return;

    const baseConditions =
      showMenuItem &&
      !!activeSurvey &&
      !hasCompleted &&
      dismissalData &&
      !dismissalData.isStaff &&
      !!dismissalData.employeeId;

    // If user has a draft, always show (ignore dismiss)
    // If no draft, respect dismiss
    const shouldShow = baseConditions && (hasDraft || !dismissalData?.isDismissed);

    setOpen(!!shouldShow);
  }, [delayPassed, dismissalLoading, draftLoading, showMenuItem, activeSurvey, hasCompleted, dismissalData, hasDraft]);

  const handleAnswerNow = () => {
    setOpen(false);
    navigate("/pulse-survey");
  };

  const handleRemindLater = () => {
    if (activeSurvey?.id && dismissalData?.employeeId) {
      dismissMutation.mutate({
        surveyId: activeSurvey.id,
        employeeId: dismissalData.employeeId,
      });
    }
    setOpen(false);
  };

  const title = hasDraft
    ? "Du har en igangværende pulsmåling"
    : "Din pulsmåling skal besvares igen";

  const description = hasDraft
    ? "Du er allerede i gang – det tager kun et par minutter at gøre den færdig. Dine svar er 100% anonyme."
    : "Vi beklager ulejligheden – din tidligere besvarelse blev desværre ikke registreret korrekt, og vi har derfor brug for, at du besvarer pulsmålingen igen. Det tager kun 2 minutter, og dine svar er fortsat 100% anonyme.";

  const actionLabel = hasDraft ? "Fortsæt besvarelse" : "Besvar nu";
  const ActionIcon = hasDraft ? PenLine : ClipboardCheck;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              {hasDraft ? (
                <PenLine className="h-5 w-5 text-primary" />
              ) : (
                <ClipboardCheck className="h-5 w-5 text-primary" />
              )}
            </div>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {hasDraft ? (
              <>
                Du er allerede i gang – det tager kun et par minutter at gøre den færdig. Dine svar er{" "}
                <span className="font-medium text-foreground">100% anonyme</span>.
              </>
            ) : (
              <>
                Vi beklager ulejligheden – din tidligere besvarelse blev desværre ikke registreret korrekt, og vi har derfor brug for, at du besvarer pulsmålingen igen. Det tager kun 2 minutter, og dine svar er fortsat{" "}
                <span className="font-medium text-foreground">100% anonyme</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleRemindLater} disabled={dismissMutation.isPending} className="gap-2">
            <Clock className="h-4 w-4" />
            {dismissalData && dismissalData.dismissalCount >= 1 ? "Luk" : "Påmind mig i morgen"}
          </Button>
          <Button onClick={handleAnswerNow} className="gap-2">
            <ActionIcon className="h-4 w-4" />
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
