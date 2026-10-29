// D1: telefonens Menu-ark. Fliser pr. område (som Spil-hubben), søgefelt øverst, Min profil + Log ud nederst.
// Samme sider og samme synlighed som sidebaren (useSynligStruktur: rettigheder + menu-editor). Mit arbejde ligger i bundbjælken og udelades her, men findes i søgningen.
import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import { useSynligStruktur } from "@/components/layout/StrukturMenu";
import { MIT_ARBEJDE, erAktiv, type StrukturSide } from "@/config/struktur";
import { Indtast } from "@/components/cph";
import { useSidebarMenuConfig } from "@/hooks/useSidebarMenuConfig";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { SkeletonList } from "./Skeletons";
import { useSheetNavigate } from "./BottomSheet";
import { cn } from "@/lib/utils";

type SideMedOmraade = StrukturSide & { omraade: string };

export function MobilMenu({ badges = {}, onLogout, ekstra }: { badges?: Record<string, ReactNode>; onLogout: () => void; ekstra?: ReactNode }) {
  const omraader = useSynligStruktur();
  // Skelet, til både menu-editorens konfiguration og rettighederne er hentet – ellers vises en halv menu et øjeblik.
  const konfig = useSidebarMenuConfig();
  const rettigheder = usePermissions();
  const konfigIndlaeses = konfig.isLoading || rettigheder.isLoading;
  const go = useSheetNavigate();
  const { pathname } = useLocation();
  const [soeg, setSoeg] = useState("");
  const alle = useMemo<SideMedOmraade[]>(() => omraader.flatMap((o) => o.sider.map((sd) => ({ ...sd, omraade: o.label }))), [omraader]);
  const profil = alle.find((sd) => sd.id === "side_min_profil");
  const grupper = omraader.filter((o) => o.id !== MIT_ARBEJDE);
  const q = soeg.trim().toLowerCase();
  // Søgning først når alt er hentet, ellers kunne et halvt resultat vises [Codex D1].
  const fund = q && !konfigIndlaeses ? alle.filter((sd) => sd.label.toLowerCase().includes(q) || sd.omraade.toLowerCase().includes(q)) : null;

  const flise = (sd: StrukturSide) => {
    const Ikon = sd.ikon;
    const aktiv = erAktiv(pathname, sd.rute);
    return (
      <button key={sd.id} type="button" onClick={() => go(sd.rute)} aria-current={aktiv ? "page" : undefined}
        className={cn("relative flex min-h-[88px] min-w-0 flex-col items-start justify-between gap-2 rounded-2xl bg-card px-3.5 py-3.5 text-left transition-transform duration-100 active:scale-[0.97]",
          aktiv && "ring-2 ring-[hsl(var(--cph-emerald))]")}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]"><Ikon className="h-5 w-5" aria-hidden="true" /></span>
        <span className="block w-full truncate text-[15px] font-extrabold leading-tight text-foreground">{sd.label}</span>
        {badges[sd.id] && <span className="absolute right-3 top-3">{badges[sd.id]}</span>}
      </button>
    );
  };
  const raekke = (sd: SideMedOmraade | StrukturSide, undertekst?: string) => {
    const Ikon = sd.ikon;
    return (
      <button key={sd.id} type="button" onClick={() => go(sd.rute)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left active:bg-muted">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]"><Ikon className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-foreground">{sd.label}</span>
          {undertekst && <span className="block truncate text-[13px] text-muted-foreground">{undertekst}</span>}
        </span>
        {badges[sd.id]}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5 px-2 pb-2" data-mobil-menu>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Indtast type="search" value={soeg} onChange={(e) => setSoeg(e.target.value)} placeholder="Søg i menuen …" aria-label="Søg i menuen" autoComplete="off" className="bg-card pl-12" />
      </div>

      {konfigIndlaeses ? (
        <SkeletonList />
      ) : fund ? (
        <section aria-label="Søgeresultater" className="rounded-3xl bg-card p-1">
          {fund.length === 0
            ? <p className="px-3 py-4 text-[14px] text-muted-foreground">Ingen sider matcher »{soeg.trim()}«.</p>
            : fund.map((sd) => raekke(sd, sd.omraade))}
        </section>
      ) : (
        grupper.map((o) => {
          const Ikon = o.ikon;
          return (
            <section key={o.id} aria-labelledby={`menu-${o.id}`}>
              <h3 id={`menu-${o.id}`} className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                <Ikon className="h-4 w-4" aria-hidden="true" />{o.label}
              </h3>
              <div className="grid grid-cols-2 gap-3">{o.sider.map(flise)}</div>
            </section>
          );
        })
      )}

      <section aria-label="Konto" className="rounded-3xl bg-card p-1">
        {profil && raekke({ ...profil, ikon: User })}
        {/* »Se som« (superadmin) bruger sidebarens lyse tekst → mørk flade, så den kan læses [Codex D1]. */}
        {ekstra && <div className="mx-1 my-1 rounded-2xl bg-[hsl(var(--cph-onyx))] px-3 py-2 text-[hsl(var(--cph-light-blue))]">{ekstra}</div>}
        <button type="button" onClick={onLogout} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left text-destructive active:bg-muted">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><LogOut className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-[15px] font-extrabold">Log ud</span>
        </button>
      </section>
    </div>
  );
}
