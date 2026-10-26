import { ReactNode, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { STRUKTUR, erAktiv, type StrukturOmraade, type StrukturSide } from "@/config/struktur";
import { useStrukturSynlighed } from "@/hooks/useStrukturSynlighed";
import { useSidebarMenuConfig } from "@/hooks/useSidebarMenuConfig";

export interface SynligtOmraade extends Omit<StrukturOmraade, "sider"> { sider: StrukturSide[] }

/**
 * Områder og sider fra `STRUKTUR`, filtreret efter rettigheder og menu-editorens overstyringer
 * (skjul, rækkefølge, label_override via item_key). Mangler en række, gælder konfigurationen.
 */
export function useSynligStruktur(): SynligtOmraade[] {
  const s = useStrukturSynlighed();
  const { data: config } = useSidebarMenuConfig();
  return useMemo(() => {
    const map = new Map((config ?? []).map((c) => [c.item_key, c]));
    const skjult = (id: string) => map.get(id)?.visible === false;
    const label = (id: string, std: string) => map.get(id)?.label_override || std;
    const orden = <T extends { id: string }>(xs: T[]) =>
      xs.map((x, i) => ({ x, k: map.get(x.id)?.sort_order ?? i })).sort((a, b) => a.k - b.k).map((e) => e.x);
    return orden(STRUKTUR)
      .filter((o) => !skjult(o.id))
      .map((o) => ({
        ...o,
        label: label(o.id, o.label),
        sider: orden(o.sider).filter((sd) => sd.synlig(s) && !skjult(sd.id)).map((sd) => ({ ...sd, label: label(sd.id, sd.label) })),
      }))
      .filter((o) => o.sider.length > 0);
  }, [s, config]);
}

interface StrukturMenuProps {
  /** Tal/markering pr. side-id (fx fravær, rekruttering). */
  badges?: Record<string, ReactNode>;
  onNavigate?: () => void;
  /** Områder, der ikke vises (fx Mit arbejde i telefonens Menu-skuffe). */
  udelad?: string[];
  /** Ekstra punkter øverst (fx Min profil i Menu-skuffen). */
  top?: StrukturSide[];
  /** Flad liste (telefonens Menu-skuffe): område som lille overskrift, siderne direkte under, ingen fold-ud. */
  flad?: boolean;
}

const punkt = "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200";
const aktivCls = "bg-sidebar-accent text-sidebar-accent-foreground";
const passivCls = "text-sidebar-foreground hover:bg-sidebar-accent/50";

/** Sidebar og Menu-skuffe: ét område = én foldbar sektion, ét punkt pr. synlig side. */
export function StrukturMenu({ badges = {}, onNavigate, udelad = [], top = [], flad = false }: StrukturMenuProps) {
  const { pathname } = useLocation();
  const omraader = useSynligStruktur().filter((o) => !udelad.includes(o.id));
  const [aaben, setAaben] = useState<Record<string, boolean>>({});

  const link = (sd: StrukturSide) => {
    const aktiv = erAktiv(pathname, sd.rute);
    const Ikon = sd.ikon;
    return (
      <NavLink key={sd.id} to={sd.rute} onClick={onNavigate} aria-current={aktiv ? "page" : undefined}
        className={cn(punkt, aktiv ? aktivCls : passivCls)}>
        <Ikon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{sd.label}</span>
        {badges[sd.id]}
      </NavLink>
    );
  };

  if (flad) {
    return (
      <div className="space-y-1">
        {top.map(link)}
        {omraader.map((o) => {
          const Ikon = o.ikon;
          return (
            <section key={o.id} aria-labelledby={`menu-${o.id}`} className="pt-3">
              <h3 id={`menu-${o.id}`} className="flex items-center gap-2 px-3 pb-1 text-sm font-semibold text-muted-foreground">
                <Ikon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{o.label}</span>
              </h3>
              <div className="space-y-1">{o.sider.map(link)}</div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {top.map(link)}
      {omraader.map((o) => {
        const harAktiv = o.sider.some((sd) => erAktiv(pathname, sd.rute));
        const open = aaben[o.id] ?? harAktiv;
        const Ikon = o.ikon;
        const sum = o.sider.some((sd) => badges[sd.id]);
        return (
          <Collapsible key={o.id} open={open} onOpenChange={(v) => setAaben((a) => ({ ...a, [o.id]: v }))}>
            <CollapsibleTrigger className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              harAktiv ? aktivCls : passivCls)}>
              <span className="flex min-w-0 items-center gap-3">
                <Ikon className="h-5 w-5 shrink-0" />
                <span className="truncate">{o.label}</span>
              </span>
              <span className="flex items-center gap-1">
                {!open && sum && <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />}
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1 pl-4">{o.sider.map(link)}</CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
