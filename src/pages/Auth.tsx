import { useMemo, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
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
    <div
      className="grid min-h-screen grid-cols-1 bg-[#0d1526] lg:grid-cols-2 antialiased"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* Brandpanel */}
      <div className="relative flex flex-col justify-between gap-12 overflow-hidden px-8 py-14 sm:px-14 bg-[radial-gradient(120%_100%_at_0%_0%,#16233d_0%,#0d1526_55%,#0a1120_100%)]">
        <div className="pointer-events-none absolute -left-32 -top-36 h-[520px] w-[520px] animate-pulse rounded-full bg-[radial-gradient(closest-side,rgba(232,178,58,0.20),rgba(232,178,58,0))]" />
        <div className="pointer-events-none absolute -bottom-44 -right-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(90,140,255,0.16),rgba(90,140,255,0))]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(80% 70% at 30% 30%, #000, transparent)",
            WebkitMaskImage: "radial-gradient(80% 70% at 30% 30%, #000, transparent)",
          }}
        />

        <div className="relative flex items-center gap-4">
          <img
            src={cphSalesLogo}
            alt="Copenhagen Sales"
            fetchPriority="high"
            className="h-[74px] w-auto"
          />
          <span className="h-10 w-px bg-white/15" />
          <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#8a97b1]">
            Provision
          </span>
        </div>

        <div className="relative flex max-w-[460px] flex-col gap-6">
          <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#E8B23A]">
            Stork
          </div>
          <h1 className="text-[clamp(34px,4.2vw,52px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
            Dine tal. Opdateret hver dag.
          </h1>
          <p className="max-w-[400px] text-[20px] leading-relaxed text-[#a8b4ca]">
            Provisionssystemet for Copenhagen Sales. Se optjening, bonus og udbetalinger - samlet ét
            sted.
          </p>
          <ul className="mt-1 flex flex-col gap-3">
            {[
              "Provision og bonus i realtid",
              "Dashboards med dine resultater",
              "Følg Ligaen og konkurrencerne",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[18px] font-medium text-[#c8d2e4]">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#E8B23A]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-wrap items-center gap-2.5 text-[13px] font-semibold text-[#6f7d95]">
          <span>Intern adgang</span>
        </div>
      </div>

      {/* Login */}
      <div className="flex flex-col justify-center border-t border-white/[0.07] bg-[#0f1a2e] px-8 py-14 sm:px-14 lg:border-l lg:border-t-0">
        <div className="mx-auto w-full max-w-[420px]">
          <h2 className="text-[30px] font-extrabold tracking-[-0.01em] text-white">{greeting}</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-[#8a97b1]">
            Log ind med din arbejdsmail for at fortsætte.
          </p>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={msLoading}
            className="mt-8 flex w-full items-center justify-center gap-3.5 rounded-xl border border-white/[0.14] bg-white px-5 py-[17px] text-[16px] font-bold text-[#101828] transition hover:-translate-y-px hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] disabled:opacity-70"
          >
            <span className="grid shrink-0 grid-cols-2 grid-rows-2 gap-[2px]">
              <span className="h-[9px] w-[9px] bg-[#F25022]" />
              <span className="h-[9px] w-[9px] bg-[#7FBA00]" />
              <span className="h-[9px] w-[9px] bg-[#00A4EF]" />
              <span className="h-[9px] w-[9px] bg-[#FFB900]" />
            </span>
            {msLoading ? "Sender dig til Microsoft…" : "Fortsæt med Microsoft"}
          </button>

          <div className="mt-4 flex items-center gap-2.5 text-[13px] font-medium text-[#7c8aa3]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4a8f6a"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
            </svg>
            Single sign-on via Microsoft Entra ID
          </div>

          <div className="my-8 h-px bg-white/[0.08]" />

          <p className="text-[14px] leading-relaxed text-[#8a97b1]">
            Kun for medarbejdere hos Copenhagen Sales. Kan du ikke logge ind, så kontakt din
            teamleder.
          </p>
          <p className="mt-2.5 text-[12px] font-semibold tracking-wide text-[#5d6a81]">
            Stork · Copenhagen Sales
          </p>
        </div>
      </div>
    </div>
  );
}
