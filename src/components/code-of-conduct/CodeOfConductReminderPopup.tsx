import { Shield, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useCodeOfConductReminder,
  useSnoozeCodeOfConductReminder,
  useAcknowledgeCodeOfConductReminder,
} from "@/hooks/useCodeOfConductReminder";
import { useCodeOfConductCompletion } from "@/hooks/useCodeOfConduct";
import { toast } from "sonner";

export function CodeOfConductReminderPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reminder, shouldShowPopup, canSnooze } = useCodeOfConductReminder();
  const { data: completion } = useCodeOfConductCompletion();
  const snoozeMut = useSnoozeCodeOfConductReminder();
  const ackMut = useAcknowledgeCodeOfConductReminder();

  // Don't show on the test page itself
  const onTestPage = location.pathname === "/code-of-conduct";

  // Hide if user already has valid completion (sometimes acknowledged_at lags)
  const hasValidCompletion = completion && !completion.isExpired;

  const open = shouldShowPopup && !onTestPage && !hasValidCompletion && !!reminder;

  if (!reminder) return null;

  const handleTakeTest = async () => {
    try {
      await ackMut.mutateAsync(reminder.id);
    } catch (e) {
      console.error(e);
    }
    navigate("/code-of-conduct");
  };

  const handleSnooze = async () => {
    try {
      await snoozeMut.mutateAsync(reminder.id);
      toast.success("Påmindelsen er udskudt 24 timer. Derefter låses systemet, indtil testen er bestået.");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke udskyde påmindelsen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* not dismissible by clicking outside */ }}>
      <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="h-7 w-7 text-destructive" />
          </div>
          <DialogTitle className="text-center">Code of Conduct & GDPR påmindelse</DialogTitle>
          <DialogDescription className="text-center">
            Du skal gennemføre Code of Conduct & GDPR-testen. Alle spørgsmål skal besvares korrekt for at bestå.
            <br /><br />
            {canSnooze ? (
              <>Du kan udskyde påmindelsen <strong>én gang i 24 timer</strong>. Hvis testen ikke er bestået inden da, låses systemet.</>
            ) : (
              <>Du har allerede udskudt påmindelsen. Testen skal tages nu.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {canSnooze && (
            <Button
              variant="outline"
              onClick={handleSnooze}
              disabled={snoozeMut.isPending || ackMut.isPending}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Udskyd 24 timer
            </Button>
          )}
          <Button
            onClick={handleTakeTest}
            disabled={snoozeMut.isPending || ackMut.isPending}
          >
            Tag testen nu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
