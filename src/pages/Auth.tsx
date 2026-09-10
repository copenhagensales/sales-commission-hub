import { useEffect, useMemo, useRef, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bird, ShieldCheck, TrendingUp, BarChart3, Trophy, AlertTriangle, Copy } from "lucide-react";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

type SsoError = {
  code: string;
  description: string;
  origin: string;
};

const logFailedLogin = (failureReason: string) => {
  supabase.functions
    .invoke("log-failed-login", {
      body: {
        failure_reason: failureReason,
        origin: window.location.origin,
      },
    })
    .catch(() => {
      // Logning må ikke blokere loginsiden.
    });
};

const FEATURES = [
  { icon: TrendingUp, label: "Provision og bonus i realtid" },
  { icon: BarChart3, label: "Dashboards med dine resultater" },
  { icon: Trophy, label: "Følg Ligaen og konkurrencerne" },
];

export default function Auth() {
  const [msLoading, setMsLoading] = useState(false);
  const [ssoError, setSsoError] = useState<SsoError | null>(null);
  const loggedUrlError = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (loggedUrlError.current) return;

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const pick = (key: string) => search.get(key) || hash.get(key) || "";
    const error = pick("error");
    const errorCode = pick("error_code");
    const errorDescription = pick("error_description");

    if (!error && !errorCode && !errorDescription) return;

    loggedUrlError.current = true;

    const code = errorCode || error || "ukendt_fejl";
    const description = errorDescription || error || "Ingen beskrivelse fra Microsoft.";

    setSsoError({ code, description, origin: window.location.origin });
    logFailedLogin(`sso: ${code} — ${description}`);

    // Ryd fejl-parametre, så et refresh ikke logger samme fejl igen.
    ["error", "error_code", "error_description"].forEach((key) => {
      search.delete(key);
      hash.delete(key);
    });
    const nextSearch = search.toString();
    const nextHash = hash.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash ? `#${nextHash}` : ""}`
    );
  }, []);

  const copyErrorDetails = async () => {
    if (!ssoError) return;
    const text = [
      `Fejlkode: ${ssoError.code}`,
      `Beskrivelse: ${ssoError.description}`,
      `Origin: ${ssoError.origin}`,
      `Tidspunkt: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Fejldetaljer kopieret" });
    } catch {
      toast({ title: "Kunne ikke kopiere", variant: "destructive" });
    }
  };


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
        const message = result.error.message || "Prøv igen om et øjeblik.";
        logFailedLogin(`sso-klient: ${message}`);
        toast({
          title: "Microsoft-login fejlede",
          description: message,
          variant: "destructive",
        });
        setMsLoading(false);
        return;
      }

      if (result.redirected) return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      logFailedLogin(`sso-klient: ${message}`);
      toast({
        title: "Microsoft-login fejlede",
        description: message,
        variant: "destructive",
      });
      setMsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(var(--cph-onyx-pressed))] font-sans antialiased">
      {/* Subtilt grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--cph-white)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--cph-white)) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1600px] grid-cols-1 items-stretch gap-10 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-12">
        {/* Venstre: brand */}
        <div className="flex flex-col justify-between gap-14 py-6 lg:py-10">
          <div className="flex items-center gap-6">
            <img
              src={cphSalesLogo}
              alt="Copenhagen Sales"
              fetchPriority="high"
              className="h-[92px] w-auto"
            />
            <span className="h-12 w-px bg-white/15" />
            <span className="text-[13px] font-extrabold uppercase tracking-[0.24em] text-white/55">
              Stork
            </span>
          </div>

          <div className="flex max-w-[720px] flex-col gap-8">
            <div className="flex items-center gap-3">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald))]/25">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--cph-emerald))]" />
              </span>
              <span className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-[hsl(var(--cph-emerald))]">
                Live · Opdateres hvert minut
              </span>
            </div>

            <h1 className="text-[clamp(46px,6.4vw,104px)] font-extrabold leading-[0.94] tracking-[-0.035em] text-white">
              Dine tal.
              <br />
              Opdateret{" "}
              <span className="text-[hsl(var(--cph-emerald))]">
                hver dag.
              </span>
            </h1>

            <p className="max-w-[560px] text-[clamp(17px,1.4vw,21px)] leading-relaxed text-white/60">
              Provisionssystemet for Copenhagen Sales. Se optjening, bonus og salg - samlet
              ét sted.
            </p>

            <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col gap-5 rounded-[20px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[hsl(var(--cph-emerald))]/15">
                    <Icon className="h-5 w-5 text-[hsl(var(--cph-emerald))]" strokeWidth={2.4} />
                  </span>
                  <span className="text-[16px] font-extrabold leading-snug text-white">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[13px] font-medium text-white/40">
            Intern adgang · Copenhagen Sales
          </div>
        </div>

        {/* Højre: login */}
        <div className="flex items-stretch">
          <div className="flex w-full flex-col justify-center rounded-[28px] bg-[hsl(var(--cph-light-blue))] px-8 py-14 sm:px-12">
            <div className="flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.2em] text-[hsl(var(--cph-onyx))]/55">
              <Bird className="h-4 w-4" />
              <span>Storken siger</span>
            </div>

            <h2 className="mt-4 text-[clamp(32px,3.2vw,46px)] font-extrabold leading-[1.06] tracking-[-0.02em] text-[hsl(var(--cph-onyx))]">
              {greeting} til dig
            </h2>

            <p className="mt-4 text-[17px] leading-relaxed text-[hsl(var(--cph-onyx))]/70">
              Log ind med din arbejdsmail for at fortsætte.
            </p>

            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={msLoading}
              className="mt-8 flex w-full items-center justify-center gap-3.5 rounded-[16px] bg-[hsl(var(--cph-onyx))] px-5 py-[20px] text-[17px] font-extrabold text-white transition-colors hover:bg-[hsl(var(--cph-onyx-pressed))] disabled:opacity-60"
            >
              <span className="grid shrink-0 grid-cols-2 grid-rows-2 gap-[2px]">
                <span className="h-[9px] w-[9px] bg-[#F25022]" />
                <span className="h-[9px] w-[9px] bg-[#7FBA00]" />
                <span className="h-[9px] w-[9px] bg-[#00A4EF]" />
                <span className="h-[9px] w-[9px] bg-[#FFB900]" />
              </span>
              {msLoading ? "Sender dig til Microsoft" : "Fortsæt med Microsoft"}
            </button>

            <div className="mt-4 flex items-center gap-2.5 text-[14px] font-medium text-[hsl(var(--cph-onyx))]/65">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Single sign-on via Microsoft Entra ID
            </div>

            <div className="my-8 h-px bg-[hsl(var(--cph-onyx))]/12" />

            <p className="text-[15px] leading-relaxed text-[hsl(var(--cph-onyx))]/70">
              Kun for medarbejdere hos Copenhagen Sales. Kan du ikke logge ind, så{" "}
              <span className="font-semibold underline decoration-[hsl(var(--cph-onyx))]/30 underline-offset-4">
                kontakt din teamleder
              </span>
              .
            </p>
            <p className="mt-4 text-[14px] font-extrabold text-[hsl(var(--cph-onyx))]">
              {"\n"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
