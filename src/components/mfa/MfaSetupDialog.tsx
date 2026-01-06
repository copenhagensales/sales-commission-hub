import { useState, useEffect } from "react";
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
import { Smartphone, Shield, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MfaSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isRequired?: boolean;
}

type Step = "intro" | "scan" | "verify";

export function MfaSetupDialog({
  isOpen,
  onClose,
  onSuccess,
  isRequired = false,
}: MfaSetupDialogProps) {
  const { startEnrollment, verifyEnrollment } = useMfa();
  const [step, setStep] = useState<Step>("intro");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep("intro");
      setQrCode("");
      setSecret("");
      setVerificationCode("");
      setError(null);
    }
  }, [isOpen]);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    
    const result = await startEnrollment();
    
    if (result) {
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setStep("scan");
    } else {
      setError("Kunne ikke starte MFA-opsætning. Prøv igen.");
    }
    
    setIsLoading(false);
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Indtast en 6-cifret kode");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const success = await verifyEnrollment(verificationCode);
    
    if (success) {
      toast.success("MFA er nu aktiveret!");
      onSuccess();
    } else {
      setError("Forkert kode. Prøv igen.");
    }
    
    setIsLoading(false);
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" hideCloseButton={isRequired}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {step === "intro" && "Opsæt to-faktor-godkendelse"}
                {step === "scan" && "Scan QR-kode"}
                {step === "verify" && "Bekræft opsætning"}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            {step === "intro" && (
              <>
                To-faktor-godkendelse (MFA) tilføjer et ekstra lag af sikkerhed til din konto.
                {isRequired && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Din stilling kræver MFA. Du skal opsætte det for at fortsætte.
                  </span>
                )}
              </>
            )}
            {step === "scan" && "Scan koden med din authenticator-app"}
            {step === "verify" && "Indtast koden fra din authenticator-app"}
          </DialogDescription>
        </DialogHeader>

        {/* Step content */}
        <div className="py-4">
          {step === "intro" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Du skal bruge en authenticator-app</p>
                  <p className="text-muted-foreground mt-1">
                    F.eks. Google Authenticator, Microsoft Authenticator eller Authy
                  </p>
                </div>
              </div>

              <Button
                onClick={handleStartSetup}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Start opsætning
              </Button>
            </div>
          )}

          {step === "scan" && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {qrCode && (
                  <img
                    src={qrCode}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                  />
                )}
              </div>

              {/* Manual entry option */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Kan ikke scanne? Indtast denne kode manuelt:
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => setStep("verify")}
                className="w-full"
              >
                Jeg har scannet koden
              </Button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bekræftelseskode</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  className={cn(
                    "text-center text-2xl tracking-widest font-mono",
                    error && "border-destructive"
                  )}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Indtast den 6-cifrede kode fra din authenticator-app
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("scan")}
                  className="flex-1"
                >
                  Tilbage
                </Button>
                <Button
                  onClick={handleVerify}
                  className="flex-1"
                  disabled={verificationCode.length !== 6 || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Bekræft
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cancel option (only if not required) */}
        {!isRequired && step === "intro" && (
          <div className="text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:underline"
            >
              Spring over for nu
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
