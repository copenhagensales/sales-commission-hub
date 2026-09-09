import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

export default function Auth() {
  const [msLoading, setMsLoading] = useState(false);
  const { toast } = useToast();

  const handleMicrosoftSignIn = async () => {
    setMsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: `${window.location.origin}/auth`,
      });

      if (result.error) {
        toast({
          title: "Microsoft-login fejlede",
          description: result.error.message || "Prøv igen om et øjeblik.",
          variant: "destructive",
        });
        setMsLoading(false);
        return;
      }

      if (result.redirected) {
        // Browseren sendes videre til Microsoft.
        return;
      }

      // Session er sat - auth-listeneren håndterer resten.
    } catch (err) {
      toast({
        title: "Microsoft-login fejlede",
        description: err instanceof Error ? err.message : "Ukendt fejl",
        variant: "destructive",
      });
      setMsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <img
            src={cphSalesLogo}
            alt="CPH Sales"
            width={161}
            height={96}
            fetchPriority="high"
            className="mx-auto h-40 w-auto"
          />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Velkommen til Stork</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-foreground mb-6">Log ind</h2>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleMicrosoftSignIn}
            disabled={msLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill="#f25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
              <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
              <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
            </svg>
            {msLoading ? "Åbner Microsoft..." : "Log ind med Microsoft"}
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            Log ind med din Microsoft-konto (din arbejdsmail). Kan du ikke logge ind, så henvend dig
            på kontoret.
          </p>
        </div>
      </div>
    </div>
  );
}
