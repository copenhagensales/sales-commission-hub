import { ReactNode, Suspense, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { RouteSkeleton } from "@/components/mobile";

export interface SamlesideFane {
  id: string;
  label: string;
  element: ReactNode;
  synlig: boolean;
}

interface SamlesideProps {
  titel: string;
  faner: SamlesideFane[];
  standard?: string;
}

/** Valgt fane: ?tab= → sidst valgte (localStorage) → standard → første synlige. */
export function vaelgFane(synlige: string[], fraUrl: string | null, gemt: string | null, standard?: string): string | null {
  for (const k of [fraUrl, gemt, standard ?? null]) if (k && synlige.includes(k)) return k;
  return synlige[0] ?? null;
}

/** Samler flere eksisterende sider som faner. Kun den aktive fane monteres. */
export function Samleside({ titel, faner, standard }: SamlesideProps) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const noegle = `samleside:${pathname}`;
  const synlige = faner.filter((f) => f.synlig);
  let gemt: string | null = null;
  try { gemt = localStorage.getItem(noegle); } catch { /* ingen lager */ }
  const aktiv = vaelgFane(synlige.map((f) => f.id), params.get("tab"), gemt, standard);

  useEffect(() => {
    if (!aktiv) return;
    try { localStorage.setItem(noegle, aktiv); } catch { /* ingen lager */ }
  }, [aktiv, noegle]);

  const skift = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  const fane = synlige.find((f) => f.id === aktiv);

  return (
    <MainLayout>
      {!fane ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-base text-muted-foreground">Du har ikke adgang til denne side</p>
          <Link to="/home" className="mt-4 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Gå til forsiden</Link>
        </div>
      ) : (
        <Tabs value={fane.id} onValueChange={skift} className="w-full">
          {synlige.length > 1 && (
            <TabsList aria-label={titel} className="mb-4 h-auto flex-wrap max-md:flex max-md:w-full max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:[scrollbar-width:none] max-md:[&>button]:min-h-11 max-md:[&>button]:flex-none">
              {synlige.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>
              ))}
            </TabsList>
          )}
          <Suspense fallback={<RouteSkeleton />}>
            <div key={fane.id}>{fane.element}</div>
          </Suspense>
        </Tabs>
      )}
    </MainLayout>
  );
}
