// D1: telefonens Menu-ark. Fliser pr. område (som Spil-hubben), søgefelt øverst, Min profil + Log ud nederst.
// Samme sider og samme synlighed som sidebaren (useSynligStruktur: rettigheder + menu-editor); alle områder vises (også Mit arbejde, som ligger i bundbjælken – Mathias 29/10: »der mangler sider«).
// Faner (fx Rapporter › Dagsrapporter) kommer fra STRUKTUR_NOEGLER, filtreret med canView på samme nøgler, som samlesiderne bruger; de vises som hint på flisen og kan søges frem.
// Kendt afgrænsning (Codex D1b, accepteret): enkelte samlesider har ekstra betingelser ud over nøglen (fx kun superadmin) – så lander brugeren på siden, som selv skjuler fanen.
// Faner uden egen rute (faneRute = sideRute, fx Storkbook › Begivenheder) åbner siden; fanen vælges der.
import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Search, User, X } from "lucide-react";
import { useSynligStruktur } from "@/components/layout/StrukturMenu";
import { erAktiv, type StrukturSide } from "@/config/struktur";
import { STRUKTUR_NOEGLER } from "@/config/strukturNoegler";
import { Indtast } from "@/components/cph";
import { useSidebarMenuConfig } from "@/hooks/useSidebarMenuConfig";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { SkeletonList } from "./Skeletons";
import { useSheetNavigate } from "./BottomSheet";
import { cn } from "@/lib/utils";

type SideMedOmraade = StrukturSide & { omraade: string };
/** Fane fra registret (strukturNoegler): søgbar og vist som hint på flisen. */
interface Fane { id: string; label: string; rute: string; side: SideMedOmraade }

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
  // Faner pr. side fra registret: kun faner, brugeren må se (samme nøgler som samlesiderne: canView), dubletter pr. navn fjernes.
  const canView = rettigheder.canView;
  const fanerPrSide = useMemo(() => {
    const m = new Map<string, Fane[]>();
    for (const sd of alle) {
      const sideRute = sd.rute.split("?")[0];
      const set = new Set<string>();
      const faner: Fane[] = [];
      for (const n of STRUKTUR_NOEGLER) {
        // Dublet = samme navn OG samme mål; TM/FM-varianter med forskellige ruter bevares begge [Codex D1b].
        const noegle = `${n.fane}|${n.faneRute ?? sideRute}`;
        if (n.sideRute !== sideRute || set.has(noegle) || !canView(n.noegle)) continue;
        set.add(noegle);
        faner.push({ id: `${sd.id}:${n.noegle}`, label: n.fane, rute: n.faneRute ?? sd.rute, side: sd });
      }
      if (faner.length > 0) m.set(sd.id, faner);
    }
    return m;
  }, [alle, canView]);
  const alleFaner = useMemo(() => [...fanerPrSide.values()].flat(), [fanerPrSide]);
  const q = soeg.trim().toLowerCase();
  const match = (t: string) => t.toLowerCase().includes(q);
  // Søgning først når alt er hentet, ellers kunne et halvt resultat vises [Codex D1]. Sider først, derefter faner.
  const fund = q && !konfigIndlaeses
    ? [
        ...alle.filter((sd) => match(sd.label) || match(sd.omraade)).map((sd) => ({ noegle: sd.id, label: sd.label, under: sd.omraade, rute: sd.rute, ikon: sd.ikon, badge: badges[sd.id] })),
        ...alleFaner.filter((f) => match(f.label)).map((f) => ({ noegle: f.id, label: f.label, under: `${f.side.omraade} · ${f.side.label}`, rute: f.rute, ikon: f.side.ikon, badge: undefined })),
      ]
    : null;
  const ryd = () => setSoeg("");

  const flise = (sd: StrukturSide) => {
    const Ikon = sd.ikon;
    const aktiv = erAktiv(pathname, sd.rute);
    const faner = fanerPrSide.get(sd.id) ?? [];
    const hint = faner.length ? faner.slice(0, 2).map((f) => f.label).join(" · ") + (faner.length > 2 ? ` · +${faner.length - 2}` : "") : null;
    return (
      <button key={sd.id} type="button" onClick={() => go(sd.rute)} aria-current={aktiv ? "page" : undefined}
        // Langt tryk: ingen tekstmarkering/iOS-callout, ingen skalering (gav »mærkelig« følelse ved hold, Mathias 29/10) – kun farveskift.
        className={cn("relative flex min-h-[88px] min-w-0 flex-col items-start justify-between gap-2 rounded-2xl bg-card px-3.5 py-3.5 text-left select-none touch-manipulation [-webkit-touch-callout:none] transition-colors active:bg-[hsl(var(--cph-light-blue))]",
          aktiv && "ring-2 ring-[hsl(var(--cph-emerald))]")}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]"><Ikon className="h-5 w-5" aria-hidden="true" /></span>
        <span className="block w-full min-w-0">
          <span className="block truncate text-[15px] font-extrabold leading-tight text-foreground">{sd.label}</span>
          {hint && <span className="mt-0.5 block truncate text-[12px] leading-snug text-muted-foreground">{hint}</span>}
        </span>
        {badges[sd.id] && <span className="absolute right-3 top-3">{badges[sd.id]}</span>}
      </button>
    );
  };
  const raekke = (r: { noegle: string; label: string; under?: string; rute: string; ikon: StrukturSide["ikon"]; badge?: ReactNode }, taet = false) => {
    const Ikon = r.ikon;
    return (
      <button key={r.noegle} type="button" onClick={() => go(r.rute)}
        className={cn("flex w-full items-center gap-3 rounded-2xl px-3 text-left select-none touch-manipulation [-webkit-touch-callout:none] active:bg-muted", taet ? "min-h-[48px] py-1.5" : "min-h-[56px]")}>
        <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]", taet ? "h-8 w-8" : "h-10 w-10")}><Ikon className={taet ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-extrabold text-foreground">{r.label}</span>
          {r.under && <span className="block truncate text-[12px] leading-snug text-muted-foreground">{r.under}</span>}
        </span>
        {r.badge}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5 px-2 pb-2" data-mobil-menu>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Indtast type="search" value={soeg} onChange={(e) => setSoeg(e.target.value)}
          placeholder="Søg i menuen …" aria-label="Søg i menuen" autoComplete="off" enterKeyHint="search" className="bg-card pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden" />
        {soeg && (
          <button type="button" onClick={ryd} aria-label="Ryd søgning" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {konfigIndlaeses ? (
        <SkeletonList />
      ) : fund ? (
        <section aria-label="Søgeresultater" className="divide-y divide-border rounded-3xl bg-card p-1 [&>button+button]:mt-0">
          {fund.length === 0
            ? <p className="px-3 py-4 text-[14px] text-muted-foreground">Ingen sider eller faner matcher »{soeg.trim()}«.</p>
            : fund.map((r) => raekke(r, true))}
        </section>
      ) : (
        omraader.map((o) => {
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
        {profil && raekke({ noegle: profil.id, label: profil.label, rute: profil.rute, ikon: User, badge: badges[profil.id] })}
        {/* »Se som« (superadmin) bruger sidebarens lyse tekst → mørk flade, så den kan læses [Codex D1]. */}
        {ekstra && <div className="mx-1 my-1 rounded-2xl bg-[hsl(var(--cph-onyx))] px-3 py-2 text-[hsl(var(--cph-light-blue))]">{ekstra}</div>}
        <button type="button" onClick={onLogout} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left text-destructive select-none touch-manipulation [-webkit-touch-callout:none] active:bg-muted">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><LogOut className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-[15px] font-extrabold">Log ud</span>
        </button>
      </section>
    </div>
  );
}
