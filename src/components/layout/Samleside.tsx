import { ReactNode, Suspense, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { RouteSkeleton } from "@/components/mobile";
import { cn } from "@/lib/utils";

export interface SamlesideFane {
  id: string;
  label: string;
  element: ReactNode;
  synlig: boolean;
  /** Flere faner kan dele én plads i fanebjælken; de vælges med en undervælger. */
  gruppe?: { id: string; label: string };
}

interface SamlesideProps {
  titel: string;
  faner: SamlesideFane[];
  standard?: string;
  /**
   * Fane, hvis side selv bruger ?tab= til egne underfaner (fx EmployeeMasterData).
   * Ukendte tab-værdier tilhører denne fane, og når den vælges, fjernes tab= fra adressen.
   */
  ejerAfTab?: string;
}

/** Valgt fane: ?tab= → sidst valgte (localStorage) → standard → første synlige. */
export function vaelgFane(synlige: string[], fraUrl: string | null, gemt: string | null, standard?: string): string | null {
  for (const k of [fraUrl, gemt, standard ?? null]) if (k && synlige.includes(k)) return k;
  return synlige[0] ?? null;
}

/** Samler flere eksisterende sider som faner. Kun den aktive fane monteres. */
export function Samleside({ titel, faner, standard, ejerAfTab }: SamlesideProps) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const noegle = `samleside:${pathname}`;
  const synlige = faner.filter((f) => f.synlig);
  const ids = synlige.map((f) => f.id);
  const ejer = ejerAfTab && ids.includes(ejerAfTab) ? ejerAfTab : null;
  let gemt: string | null = null;
  try { gemt = localStorage.getItem(noegle); } catch { /* ingen lager */ }
  const urlTab = params.get("tab");
  const fraUrl = urlTab && !ids.includes(urlTab) && ejer ? ejer : urlTab;
  const aktiv = vaelgFane(ids, fraUrl, gemt, standard);

  useEffect(() => {
    if (!aktiv) return;
    try { localStorage.setItem(noegle, aktiv); } catch { /* ingen lager */ }
  }, [aktiv, noegle]);

  // ?tab=<ejer> ville forvirre ejer-sidens egne faner: fjern det.
  useEffect(() => {
    if (ejer && urlTab === ejer) {
      const next = new URLSearchParams(params);
      next.delete("tab");
      setParams(next, { replace: true });
    }
  }, [ejer, urlTab, params, setParams]);

  const skift = (id: string) => {
    try { localStorage.setItem(noegle, id); } catch { /* ingen lager */ }
    const next = new URLSearchParams(params);
    if (id === ejer) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const fane = synlige.find((f) => f.id === aktiv);
  // Én plads pr. gruppe i fanebjælken.
  const pladser: { value: string; label: string; foerste: string }[] = [];
  for (const f of synlige) {
    const v = f.gruppe?.id ?? f.id;
    if (!pladser.some((p) => p.value === v)) pladser.push({ value: v, label: f.gruppe?.label ?? f.label, foerste: f.id });
  }
  const aktivPlads = fane ? (fane.gruppe?.id ?? fane.id) : "";
  const iGruppe = fane?.gruppe ? synlige.filter((f) => f.gruppe?.id === fane.gruppe!.id) : [];

  return (
    <MainLayout>
      {!fane ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-base text-muted-foreground">Du har ikke adgang til denne side</p>
          <Link to="/home" className="mt-4 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Gå til forsiden</Link>
        </div>
      ) : (
        <Tabs value={aktivPlads} onValueChange={(v) => skift(pladser.find((p) => p.value === v)?.foerste ?? v)} className="w-full">
          {pladser.length > 1 && (
            <TabsList aria-label={titel} className="mb-4 h-auto flex-wrap max-md:flex max-md:w-full max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:[scrollbar-width:none] max-md:[&>button]:min-h-11 max-md:[&>button]:flex-none">
              {pladser.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
              ))}
            </TabsList>
          )}
          {iGruppe.length > 1 && (
            <div role="group" aria-label={fane.gruppe!.label} className="mb-4 inline-flex rounded-lg bg-muted p-1">
              {iGruppe.map((f) => (
                <button key={f.id} type="button" onClick={() => skift(f.id)} aria-pressed={f.id === fane.id}
                  className={cn("min-h-11 rounded-md px-4 text-sm font-medium transition-colors active:scale-[0.98]",
                    f.id === fane.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <Suspense fallback={<RouteSkeleton />}>
            <div key={fane.id}>{fane.element}</div>
          </Suspense>
        </Tabs>
      )}
    </MainLayout>
  );
}
