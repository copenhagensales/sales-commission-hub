import type React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Home, Target, Calendar, Newspaper, User, Menu, Trophy, Gamepad2, Swords, BadgeCheck, type LucideIcon } from "lucide-react";
import { formatUnread } from "@/hooks/usePulsen";
import { useStorkbookUnread } from "@/hooks/useStorkbookUnread";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { cn } from "@/lib/utils";
import { HubSheet } from "./HubSheet";
import { useStrukturSynlighed } from "@/hooks/useStrukturSynlighed";
import { useSynligStruktur } from "@/components/layout/StrukturMenu";
import { MIT_ARBEJDE } from "@/config/struktur";

export interface BottomTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Samme rettighedsflag som punktet i AppSidebar. */
  visible: boolean;
  /** Samlefane, destinationen ligger under (»Mig« / »Spil«). */
  hub?: "me" | "games";
  /** Fast undertekst på flisen i samlefanen. */
  hint?: string;
}

/** Højde på bundnavigationen uden safe area (px). Bruges af PageShell og StickyAction. */
export const BOTTOM_NAV_HEIGHT = 64;

/** Sti til profilen, som ligger øverst i »Menu«-skuffen i stedet for som egen fane. */
export const PROFILE_PATH = "/my-profile";

const HINT: Record<string, string> = {
  side_mine_tal: "Dine tal og mål",
  side_vagter: "Vagtplan og stempelur",
  side_registrer_salg: "Registrér dit salg",
  side_min_profil: "Dine kontrakter og oplysninger",
};
/** Sider i Mit arbejde, der har egen plads i bundbjælken og derfor ikke står i »Mig«. */
const EGEN_FANE = ["side_hjem", "side_storkbook", "side_spil"];

/** Alle destinationer bag bundbjælken, fra `STRUKTUR` (samme synlighed som sidebaren). */
export function useBottomTabs(): BottomTab[] {
  const s = useStrukturSynlighed();
  const mitArbejde = useSynligStruktur().find((o) => o.id === MIT_ARBEJDE)?.sider ?? [];
  const has = (id: string) => mitArbejde.find((x) => x.id === id);
  const home = has("side_hjem");
  const stork = has("side_storkbook");
  const spilSide = has("side_spil");
  return [
    ...(home ? [{ to: home.rute, label: home.label, icon: home.ikon, visible: true }] : []),
    ...mitArbejde.filter((x) => !EGEN_FANE.includes(x.id))
      .map((x) => ({ to: x.rute, label: x.label, icon: x.ikon, visible: true, hub: "me" as const, hint: HINT[x.id] })),
    // Spil-skuffens fliser kommer fra sidens faner i STRUKTUR.
    ...(spilSide?.faner ?? []).filter((f) => f.synlig(s))
      .map((f) => ({ to: f.rute, label: f.label, icon: f.ikon, visible: true, hub: "games" as const, hint: f.hint })),
    ...(stork ? [{ to: stork.rute, label: stork.label, icon: Newspaper, visible: true }] : []),
  ];
}

function isOn(pathname: string, t: BottomTab, search = ""): boolean {
  const [r, q] = t.to.split("?");
  if (!(pathname === r || pathname.startsWith(`${r}/`))) return false;
  // Fliser til samme samleside (fx /spil?tab=…) er kun aktive på deres egen fane, når fanen står i adressen.
  if (q && search) return new URLSearchParams(search).get("tab") === new URLSearchParams(q).get("tab");
  return true;
}

/** Faneroden for en sti (bruges af tilbage-pilen, når der ingen historik er). */
export function tabRootFor(pathname: string, tabs: BottomTab[]): string | null {
  const hit = tabs.find((t) => isOn(pathname, t));
  return hit ? hit.to : null;
}

interface BottomNavProps {
  /** Åbner »Menu«-skuffen. Udelades = ingen menu-fane. */
  onMenu?: () => void;
  menuOpen?: boolean;
}

const itemClass = "group flex h-full min-h-[44px] w-full min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-medium tracking-[0.01em] transition-colors duration-200 active:scale-95 motion-reduce:transform-none";

/** Ikon med blød pille bag den aktive fane (iOS/Material-stil). */
function TabIcon({ icon: Icon, active, children }: { icon: LucideIcon; active: boolean; children?: React.ReactNode }) {
  return (
    <span className={cn("relative flex h-8 w-12 max-w-full items-center justify-center rounded-full transition-colors duration-200",
      active ? "bg-[hsl(var(--cph-emerald)/0.16)]" : "bg-transparent")}>
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
      {children}
    </span>
  );
}

/** Rødt tal på ikonet, når der er nyt i Storkbook (som notifikationer på Facebook). */
function StorkbookBadge() {
  const count = useStorkbookUnread();
  if (count <= 0) return null;
  return (
    <span aria-label={`${count} nye i Storkbook`}
      className="absolute right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black leading-none tabular-nums text-destructive-foreground ring-2 ring-sidebar">
      {formatUnread(count)}
    </span>
  );
}

/** Hjem · Mig · Spil · Storkbook · Menu på telefon. Mig/Spil åbner en samleskuffe; faner uden adgang vises ikke. */
export function BottomNav({ onMenu, menuOpen }: BottomNavProps) {
  const all = useBottomTabs().filter((t) => t.visible);
  const { pathname, search } = useLocation();
  const [hubOpen, setHubOpen] = useState<null | "me" | "games">(null);
  const home = all.find((t) => t.to === "/home");
  const storkbook = all.find((t) => t.to === "/storkbook");
  const me = all.filter((t) => t.hub === "me");
  const games = all.filter((t) => t.hub === "games");
  if (all.length === 0 && !onMenu) return null;

  const link = (t: BottomTab, label: string) => {
    const active = isOn(pathname, t, search);
    return (
      <li key={t.to} className="min-w-0 flex-1">
        <NavLink to={t.to} aria-current={active ? "page" : undefined}
          className={cn(itemClass, active ? "font-bold text-[hsl(var(--cph-emerald))]" : "text-sidebar-foreground/70")}>
          <TabIcon icon={t.icon} active={active}>{t.to === "/storkbook" && <StorkbookBadge />}</TabIcon>
          {label}
        </NavLink>
      </li>
    );
  };
  const hubButton = (key: "me" | "games", label: string, icon: LucideIcon, items: BottomTab[]) => {
    if (items.length === 0) return null;
    const active = hubOpen === key || items.some((t) => isOn(pathname, t, search));
    return (
      <li className="min-w-0 flex-1">
        <button type="button" onClick={() => setHubOpen(key)} aria-haspopup="dialog" aria-expanded={hubOpen === key}
          aria-current={items.some((t) => isOn(pathname, t, search)) ? "page" : undefined}
          className={cn(itemClass, active ? "font-bold text-[hsl(var(--cph-emerald))]" : "text-sidebar-foreground/70")}>
          <TabIcon icon={icon} active={active} />
          {label}
        </button>
      </li>
    );
  };
  const tiles = (items: BottomTab[]) => items.map((t) => ({ to: t.to, label: t.label, hint: t.hint ?? "", icon: t.icon }));

  return (
    <>
    <nav
      aria-label="Hovednavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-foreground/10 bg-sidebar/[0.97] shadow-[0_-8px_24px_-12px_hsl(var(--cph-onyx)/0.5)] backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      <ul className="flex" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {home && link(home, "Hjem")}
        {hubButton("me", "Mig", User, me)}
        {hubButton("games", "Spil", Gamepad2, games)}
        {storkbook && link(storkbook, "Storkbook")}
        {onMenu && (
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onMenu}
              aria-haspopup="dialog"
              aria-expanded={!!menuOpen}
              className={cn(itemClass, menuOpen ? "font-bold text-[hsl(var(--cph-emerald))]" : "text-sidebar-foreground/70")}
            >
              <TabIcon icon={Menu} active={!!menuOpen} />
              Menu
            </button>
          </li>
        )}
      </ul>
    </nav>
    <HubSheet open={hubOpen === "me"} onOpenChange={(o) => setHubOpen(o ? "me" : null)} title="Mig" tiles={tiles(me)} />
    <HubSheet open={hubOpen === "games"} onOpenChange={(o) => setHubOpen(o ? "games" : null)} title="Spil" tiles={tiles(games)} />
    </>
  );
}
