import type React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Home, Target, Calendar, Newspaper, User, Menu, Trophy, Gamepad2, Swords, BadgeCheck, type LucideIcon } from "lucide-react";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { formatUnread, usePulsenUnread } from "@/hooks/usePulsen";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { cn } from "@/lib/utils";
import { HubSheet } from "./HubSheet";

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

/** Alle destinationer bag bundbjælken (også dem i »Mig« og »Spil«), med samme rettighedstjek som AppSidebar. */
export function useBottomTabs(): BottomTab[] {
  const p = usePermissions();
  // »Vagter« peger på det første mål, brugeren har ret til (oversigt → egen FM-plan → egen TM-plan).
  const shiftsTo = p.canViewFmOverview
    ? "/vagt-flow"
    : p.canViewFmMySchedule
      ? "/vagt-flow/my-schedule"
      : p.canViewMySchedule
        ? "/shift-planning/my-schedule"
        : null;
  return [
    { to: "/home", label: "Hjem", icon: Home, visible: !!p.canViewHome },
    { to: "/vagt-flow/sales-registration", label: "Salgsregistrering", icon: BadgeCheck, visible: !!p.canViewFmSalesRegistration, hub: "me", hint: "Registrér dit salg" },
    { to: shiftsTo ?? "/vagt-flow", label: "Vagter", icon: Calendar, visible: !!shiftsTo, hub: "me", hint: "Din vagtplan" },
    { to: "/my-goals", label: "Tal", icon: Target, visible: !!p.canViewMyGoals, hub: "me", hint: "Dine tal og mål" },
    { to: PROFILE_PATH, label: "Min profil", icon: User, visible: !!p.canViewMyProfile, hub: "me", hint: "Dine kontrakter og oplysninger" },
    { to: "/commission-league", label: "Superligaen", icon: Trophy, visible: !!p.canViewCommissionLeague, hub: "games", hint: "Provisionsligaen" },
    { to: "/head-to-head", label: "Head2Head", icon: Swords, visible: !!p.canViewH2h, hub: "games", hint: "1v1 og holdkampe" },
    { to: "/storkbook", label: "Storkbook", icon: Newspaper, visible: !!p.canViewPulsen },
  ];
}

/** Området en destination dækker (Vagter med egen FM-plan dækker hele /vagt-flow). */
function areaOf(t: BottomTab): string {
  return t.to.startsWith("/vagt-flow") ? "/vagt-flow" : t.to;
}
function isOn(pathname: string, t: BottomTab): boolean {
  const r = areaOf(t);
  return pathname === r || pathname.startsWith(`${r}/`);
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
  const { data: employeeId } = useCurrentEmployeeId();
  const { data: count = 0 } = usePulsenUnread(employeeId);
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
  const { pathname } = useLocation();
  const [hubOpen, setHubOpen] = useState<null | "me" | "games">(null);
  const home = all.find((t) => t.to === "/home");
  const storkbook = all.find((t) => t.to === "/storkbook");
  const me = all.filter((t) => t.hub === "me");
  const games = all.filter((t) => t.hub === "games");
  if (all.length === 0 && !onMenu) return null;

  const link = (t: BottomTab, label: string) => {
    const active = isOn(pathname, t);
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
    const active = hubOpen === key || items.some((t) => isOn(pathname, t));
    return (
      <li className="min-w-0 flex-1">
        <button type="button" onClick={() => setHubOpen(key)} aria-haspopup="dialog" aria-expanded={hubOpen === key}
          aria-current={items.some((t) => isOn(pathname, t)) ? "page" : undefined}
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
