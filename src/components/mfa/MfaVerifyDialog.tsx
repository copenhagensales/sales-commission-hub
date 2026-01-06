import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMfa } from "@/hooks/useMfa";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MfaVerifyDialogProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MfaVerifyDialog({
  isOpen,
  onSuccess,
  onCancel,
}: MfaVerifyDialogProps) {
  const { verifyCode } = useMfa();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Indtast en 6-cifret kode");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const success = await verifyCode(code);
    
    if (success) {
      onSuccess();
    } else {
      setAttempts(prev => prev + 1);
      setError("Forkert kode. Prøv igen.");
      setCode("");
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Bekræft identitet
            </DialogTitle>
          </div>
          <DialogDescription>
            Indtast koden fra din authenticator-app for at fortsætte
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Bekræftelseskode</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                "text-center text-2xl tracking-widest font-mono",
                error && "border-destructive"
              )}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
              {attempts >= 3 && (
                <span className="text-muted-foreground ml-1">
                  ({attempts} forsøg)
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Annuller
            </Button>
            <Button
              onClick={handleVerify}
              className="flex-1"
              disabled={code.length !== 6 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Bekræft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
