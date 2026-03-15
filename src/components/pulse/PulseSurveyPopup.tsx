import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActivePulseSurvey,
  useHasCompletedSurvey,
  usePulseSurveyDismissal,
  useDismissPulseSurvey,
} from "@/hooks/usePulseSurvey";
import { useShouldShowPulseSurvey } from "@/hooks/usePulseSurvey";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Clock } from "lucide-react";

export function PulseSurveyPopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [delayPassed, setDelayPassed] = useState(false);

  const { showMenuItem, activeSurvey, hasCompleted } = useShouldShowPulseSurvey();
  const { data: dismissalData, isLoading: dismissalLoading } = usePulseSurveyDismissal(activeSurvey?.id);
  const dismissMutation = useDismissPulseSurvey();

  // 2 second delay before showing
  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Determine if popup should show
  useEffect(() => {
    if (!delayPassed || dismissalLoading) return;

    const shouldShow =
      showMenuItem &&
      !!activeSurvey &&
      !hasCompleted &&
      dismissalData &&
      !dismissalData.isStaff &&
      !dismissalData.isDismissed &&
      !!dismissalData.employeeId;

    setOpen(!!shouldShow);
  }, [delayPassed, dismissalLoading, showMenuItem, activeSurvey, hasCompleted, dismissalData]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-lg">Din månedlige pulsmåling er klar</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Vi vil gerne høre, hvordan du har det. Det tager kun 2 minutter, og dine svar er
            <span className="font-medium text-foreground"> 100% anonyme</span>.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleRemindLater} disabled={dismissMutation.isPending} className="gap-2">
            <Clock className="h-4 w-4" />
            Påmind mig i morgen
          </Button>
          <Button onClick={handleAnswerNow} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Besvar nu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
