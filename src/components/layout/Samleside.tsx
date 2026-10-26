import { ComponentType, ReactNode, Suspense, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { RouteSkeleton } from "@/components/mobile";
import { cn } from "@/lib/utils";

export interface SamlesideFane {
  id: string;
  label: string;
  element: ReactNode;
  synlig: boolean;
  /** Flere faner kan dele én hovedfane; de vælges med en undervælger (?side=<id>). */
  gruppe?: { id: string; label: string };
}

interface SamlesideProps {
  titel: string;
  faner: SamlesideFane[];
  /**
   * Fane, hvis side selv bruger ?tab= til egne underfaner (fx EmployeeMasterData).
   * Ukendte tab-værdier tilhører denne fane, og når den vælges, fjernes tab= fra adressen.
   */
  ejerAfTab?: string;
  /** URL-parameter for fanevalget (standard "tab"). Brug fx "fane", når en fane selv læser ?tab=. */
  parameter?: string;
  /** Ydre layout (standard MainLayout); tavler bruger DashboardLayout. */
  layout?: ComponentType<{ children: ReactNode }>;
}

const SIDE = "side";

/**
 * Valgt fane ud fra adressen. Uden gyldig værdi: første synlige (ingen hukommelse – forudsigeligt).
 * tab=<hovedfane>&side=<id> vælger en underside; tab=<id> på en underside virker også (gamle links).
 */
export function vaelgFane(
  synlige: { id: string; gruppe?: { id: string } }[],
  tab: string | null,
  side: string | null,
): string | null {
  if (tab) {
    if (synlige.some((f) => f.id === tab && !f.gruppe)) return tab;
    const iGruppe = synlige.filter((f) => f.gruppe?.id === tab);
    if (iGruppe.length) return (iGruppe.find((f) => f.id === side) ?? iGruppe[0]).id;
    if (synlige.some((f) => f.id === tab)) return tab;
  }
  return synlige[0]?.id ?? null;
}

/** Samler flere eksisterende sider som faner. Kun den aktive fane monteres. */
export function Samleside({ titel, faner, ejerAfTab, parameter = "tab", layout: Layout = MainLayout }: SamlesideProps) {
  const [params, setParams] = useSearchParams();
  const synlige = faner.filter((f) => f.synlig);
  const ids = synlige.map((f) => f.id);
  const gruppeIds = synlige.flatMap((f) => (f.gruppe ? [f.gruppe.id] : []));
  const ejer = ejerAfTab && ids.includes(ejerAfTab) ? ejerAfTab : null;
  const urlTab = params.get(parameter);
  const kendt = !!urlTab && (ids.includes(urlTab) || gruppeIds.includes(urlTab));
  const fraUrl = urlTab && !kendt && ejer ? ejer : urlTab;
  const aktiv = vaelgFane(synlige, fraUrl, params.get(SIDE));

  // ?tab=<ejer> ville forvirre ejer-sidens egne faner: fjern det.
  useEffect(() => {
    if (ejer && urlTab === ejer) {
      const next = new URLSearchParams(params);
      next.delete(parameter);
      setParams(next, { replace: true });
    }
  }, [ejer, urlTab, params, setParams, parameter]);

  const skift = (id: string) => {
    const f = synlige.find((x) => x.id === id);
    const next = new URLSearchParams(params);
    if (id === ejer) next.delete(parameter);
    else next.set(parameter, f?.gruppe ? f.gruppe.id : id);
    if (f?.gruppe) next.set(SIDE, id);
    else next.delete(SIDE);
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
    <Layout>
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
            <div role="group" aria-label={fane.gruppe!.label} className="mb-4 flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1 md:inline-flex">
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
    </Layout>
  );
}
