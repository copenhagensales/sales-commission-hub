import type React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Target, Calendar, Newspaper, User, Menu, Trophy, type LucideIcon } from "lucide-react";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { formatUnread, usePulsenUnread } from "@/hooks/usePulsen";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { cn } from "@/lib/utils";

export interface BottomTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Samme rettighedsflag som punktet i AppSidebar. */
  visible: boolean;
}

/** Højde på bundnavigationen uden safe area (px). Bruges af PageShell og StickyAction. */
export const BOTTOM_NAV_HEIGHT = 64;

/** Sti til profilen, som ligger øverst i »Menu«-skuffen i stedet for som egen fane. */
export const PROFILE_PATH = "/my-profile";

/** Destinationerne med samme rettighedstjek som AppSidebar. Profilen nås via »Menu«. */
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
    { to: "/my-goals", label: "Tal", icon: Target, visible: !!p.canViewMyGoals },
    { to: shiftsTo ?? "/vagt-flow", label: "Vagter", icon: Calendar, visible: !!shiftsTo },
    { to: "/commission-league", label: "Liga", icon: Trophy, visible: !!p.canViewCommissionLeague },
    { to: "/storkbook", label: "Storkbook", icon: Newspaper, visible: !!p.canViewPulsen },
    { to: PROFILE_PATH, label: "Mig", icon: User, visible: !!p.canViewMyProfile },
  ];
}

/** Faneroden for en sti (bruges af tilbage-pilen, når der ingen historik er). */
export function tabRootFor(pathname: string, tabs: BottomTab[]): string | null {
  const hit = tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
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

/** Fire faste faner + »Menu« yderst til højre på telefon. Faner uden adgang vises ikke. */
export function BottomNav({ onMenu, menuOpen }: BottomNavProps) {
  const tabs = useBottomTabs().filter((t) => t.visible && t.to !== PROFILE_PATH);
  const { pathname } = useLocation();
  if (tabs.length === 0 && !onMenu) return null;
  const onProfile = pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`);
  return (
    <nav
      aria-label="Hovednavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-foreground/10 bg-sidebar/[0.97] shadow-[0_-8px_24px_-12px_hsl(var(--cph-onyx)/0.5)] backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      <ul className="flex" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {tabs.map((t) => {
          const root = t.label === "Vagter" ? t.to.split("/").slice(0, 2).join("/") : t.to;
          const active = pathname === root || pathname.startsWith(`${root}/`);
          const Icon = t.icon;
          return (
            <li key={t.to} className="min-w-0 flex-1">
              <NavLink
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "font-bold text-[hsl(var(--cph-emerald))]" : "text-sidebar-foreground/70")}
              >
                <TabIcon icon={Icon} active={active}>
                  {t.to === "/storkbook" && <StorkbookBadge />}
                </TabIcon>
                {t.label}
              </NavLink>
            </li>
          );
        })}
        {onMenu && (
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onMenu}
              aria-haspopup="dialog"
              aria-expanded={!!menuOpen}
              className={cn(itemClass, menuOpen || onProfile ? "font-bold text-[hsl(var(--cph-emerald))]" : "text-sidebar-foreground/70")}
            >
              <TabIcon icon={Menu} active={!!menuOpen || onProfile} />
              Menu
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
