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
import { Smartphone, ShieldCheck, Copy, Check, Loader2, AlertCircle, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface MfaSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isRequired?: boolean;
}

type Step = "intro" | "scan" | "verify" | "success";

const MICROSOFT_AUTHENTICATOR_LINKS = {
  ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
  android: "https://play.google.com/store/apps/details?id=com.azure.authenticator"
};

const STEP_PROGRESS: Record<Step, number> = {
  intro: 25,
  scan: 50,
  verify: 75,
  success: 100
};

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
  const [verifyAttempts, setVerifyAttempts] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep("intro");
      setQrCode("");
      setSecret("");
      setVerificationCode("");
      setError(null);
      setVerifyAttempts(0);
    }
  }, [isOpen]);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await startEnrollment();
      
      if (result) {
        setQrCode(result.qrCode);
        setSecret(result.secret);
        setStep("scan");
      } else {
        setError("Kunne ikke starte MFA-opsætning. Prøv igen.");
      }
    } catch (err) {
      console.error("MFA enrollment error:", err);
      setError("Der opstod en fejl. Prøv igen.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Indtast en 6-cifret kode");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const success = await verifyEnrollment(verificationCode);
      
      if (success) {
        setStep("success");
        toast.success("To-faktor-godkendelse er nu aktiveret");
      } else {
        setVerifyAttempts(prev => prev + 1);
        setError("Forkert kode. Prøv igen.");
        setVerificationCode("");
      }
    } catch (err) {
      console.error("MFA verification error:", err);
      setVerifyAttempts(prev => prev + 1);
      setError("Der opstod en fejl ved bekræftelse.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Kode kopieret til udklipsholder");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" hideCloseButton={isRequired}>
        {/* Progress bar */}
        <div className="mb-2">
          <Progress value={STEP_PROGRESS[step]} className="h-1" />
        </div>

        {step === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Opsæt to-faktor-godkendelse
              </DialogTitle>
              <DialogDescription>
                Beskyt din konto med en authenticator-app
                {isRequired && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Din stilling kræver MFA. Du skal opsætte det for at fortsætte.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Microsoft Authenticator recommendation */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00A4EF] text-white font-bold text-lg">
                    M
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Microsoft Authenticator</p>
                    <p className="text-sm text-muted-foreground">Anbefalet app til opsætning</p>
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(MICROSOFT_AUTHENTICATOR_LINKS.ios, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Download til iPhone
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(MICROSOFT_AUTHENTICATOR_LINKS.android, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Download til Android
                  </Button>
                </div>
              </div>

              {/* Steps overview */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Sådan fungerer det:</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                    <span>Download Microsoft Authenticator (eller anden TOTP-app)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                    <span>Scan QR-koden med appen</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                    <span>Indtast den 6-cifrede kode fra appen</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Du kan også bruge Google Authenticator, Authy eller andre TOTP-kompatible apps.
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleStartSetup} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starter...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Jeg har appen klar - fortsæt
                  </>
                )}
              </Button>
              {!isRequired && (
                <Button variant="ghost" onClick={onClose}>
                  Spring over for nu
                </Button>
              )}
            </div>
          </>
        )}

        {step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan QR-kode</DialogTitle>
              <DialogDescription>
                Åbn din authenticator-app og scan koden nedenfor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Step-by-step instructions */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium mb-2">I Microsoft Authenticator:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Tryk på <strong>+</strong> i øverste højre hjørne</li>
                  <li>Vælg <strong>"Anden konto (Google, Facebook osv.)"</strong></li>
                  <li>Scan QR-koden herunder</li>
                </ol>
              </div>

              {/* QR Code */}
              {qrCode && (
                <div className="flex justify-center">
                  <div className="rounded-lg border bg-white p-4">
                    <img src={qrCode} alt="QR Code" className="h-48 w-48" />
                  </div>
                </div>
              )}

              {/* Manual entry option */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Kan du ikke scanne? Indtast denne kode manuelt:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Vigtigt:</strong> Scan QR-koden og bekræft at kontoen vises i din app, før du trykker næste.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("intro")} className="flex-1">
                Tilbage
              </Button>
              <Button onClick={() => setStep("verify")} className="flex-1">
                Jeg har scannet - næste
              </Button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Bekræft opsætning</DialogTitle>
              <DialogDescription>
                Indtast den 6-cifrede kode fra din authenticator-app
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Where to find the code */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Find koden i din app</p>
                    <p className="text-sm text-muted-foreground">
                      Åbn Microsoft Authenticator og find den 6-cifrede kode for denne konto
                    </p>
                  </div>
                </div>
              </div>

              {/* Code input */}
              <div className="space-y-2">
                <Label htmlFor="mfa-code">6-cifret kode</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setVerificationCode(value);
                    setError(null);
                  }}
                  className={cn(
                    "text-center text-2xl tracking-[0.5em] font-mono",
                    error && "border-destructive"
                  )}
                  autoFocus
                />
              </div>

              {/* Timer hint */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Koder udløber hvert 30. sekund</span>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p>{error}</p>
                    {verifyAttempts >= 2 && (
                      <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                        <li>Tjek at du bruger den korrekte konto i appen</li>
                        <li>Vent på en ny kode (skifter hvert 30s)</li>
                        <li>Tjek at tidszonen på din telefon er korrekt</li>
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("scan")} className="flex-1">
                Tilbage
              </Button>
              <Button 
                onClick={handleVerify} 
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bekræfter...
                  </>
                ) : (
                  "Bekræft"
                )}
              </Button>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                MFA er nu aktiveret
              </DialogTitle>
              <DialogDescription>
                Din konto er nu beskyttet med to-faktor-godkendelse
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 text-center">
                <div className="flex justify-center mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Opsætningen er fuldført!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Næste gang du logger ind, skal du bruge en kode fra din authenticator-app.
                </p>
              </div>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Afslut
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
