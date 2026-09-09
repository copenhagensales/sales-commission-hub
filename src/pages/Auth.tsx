import { useMemo, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import { Bird, ShieldCheck, Check } from "lucide-react";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

export default function Auth() {
  const [msLoading, setMsLoading] = useState(false);
  const { toast } = useToast();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "God nat";
    if (h < 10) return "Godmorgen";
    if (h < 12) return "God formiddag";
    if (h < 14) return "God middag";
    if (h < 18) return "God eftermiddag";
    if (h < 22) return "Godaften";
    return "God nat";
  }, []);

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
    <div className="grid min-h-screen grid-cols-1 bg-background font-sans antialiased lg:grid-cols-[1.05fr_1fr]">
      {/* Brandpanel - onyx */}
      <div className="relative flex flex-col justify-between gap-12 bg-primary px-8 py-14 sm:px-14">
        <div className="flex items-center gap-4">
          <img
            src={cphSalesLogo}
            alt="Copenhagen Sales"
            fetchPriority="high"
            className="h-[64px] w-auto"
          />
          <span className="h-9 w-px bg-primary-foreground/20" />
          <span className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-primary-foreground/60">
            Velkommen
          </span>
        </div>

        <div className="flex max-w-[480px] flex-col gap-6">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[hsl(var(--cph-emerald))]">
            Stork
          </div>
          <h1 className="text-[clamp(34px,4.2vw,52px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-primary-foreground">
            Dine tal. Opdateret hver dag.
          </h1>
          <p className="max-w-[420px] text-[19px] leading-relaxed text-primary-foreground/70">
            Provisionssystemet for Copenhagen Sales. Se optjening, bonus og udbetalinger - samlet ét
            sted.
          </p>
          <ul className="mt-1 flex flex-col gap-3.5">
            {[
              "Provision og bonus i realtid",
              "Dashboards med dine resultater",
              "Følg Ligaen og konkurrencerne",
            ].map((t) => (
              <li
                key={t}
                className="flex items-center gap-3 text-[17px] font-medium text-primary-foreground/85"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--cph-emerald))]">
                  <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[13px] font-semibold text-primary-foreground/45">Intern adgang</div>
      </div>

      {/* Login */}
      <div className="flex flex-col justify-center bg-background px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-[460px] rounded-3xl bg-card p-8 sm:p-10">
          <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
            <Bird className="h-4 w-4 text-[hsl(var(--success))]" />
            <span>Storken siger</span>
          </div>
          <h2 className="mt-3 text-[clamp(28px,3vw,36px)] font-extrabold leading-[1.1] tracking-[-0.01em] text-foreground">
            {greeting} til dig
          </h2>

          <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">
            Log ind med din arbejdsmail for at fortsætte.
          </p>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={msLoading}
            className="mt-8 flex w-full items-center justify-center gap-3.5 rounded-[14px] bg-primary px-5 py-[17px] text-[16px] font-extrabold text-primary-foreground transition-colors hover:bg-[hsl(var(--cph-onyx-pressed))] disabled:opacity-60"
          >
            <span className="grid shrink-0 grid-cols-2 grid-rows-2 gap-[2px]">
              <span className="h-[9px] w-[9px] bg-[#F25022]" />
              <span className="h-[9px] w-[9px] bg-[#7FBA00]" />
              <span className="h-[9px] w-[9px] bg-[#00A4EF]" />
              <span className="h-[9px] w-[9px] bg-[#FFB900]" />
            </span>
            {msLoading ? "Sender dig til Microsoft…" : "Fortsæt med Microsoft"}
          </button>

          <div className="mt-4 flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
            Single sign-on via Microsoft Entra ID
          </div>

          <div className="my-8 h-px bg-border" />

          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Kun for medarbejdere hos Copenhagen Sales. Kan du ikke logge ind, så kontakt din
            teamleder.
          </p>
          <p className="mt-2.5 text-[12px] font-semibold tracking-wide text-muted-foreground/70">
            Stork · Copenhagen Sales
          </p>
        </div>
      </div>
    </div>
  );
}
