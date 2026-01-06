import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, LogOut } from "lucide-react";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingTime: number;
  onContinue: () => void;
  onLogout: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function SessionTimeoutModal({
  isOpen,
  remainingTime,
  onContinue,
  onLogout,
}: SessionTimeoutModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-xl">
              Session udløber snart
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Du har været inaktiv i et stykke tid. Din session udløber om{" "}
            <span className="font-bold text-foreground tabular-nums">
              {formatTime(remainingTime)}
            </span>
            . Klik "Fortsæt" for at forblive logget ind.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Progress bar */}
        <div className="my-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000"
              style={{
                width: `${Math.max(0, (remainingTime / 300) * 100)}%`,
              }}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Log ud nu
          </AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>
            Fortsæt session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
