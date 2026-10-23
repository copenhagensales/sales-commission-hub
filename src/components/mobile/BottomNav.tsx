import { NavLink, useLocation } from "react-router-dom";
import { Home, Target, Calendar, MessageSquare, User, type LucideIcon } from "lucide-react";
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

/** Bundfanerne med samme rettighedstjek som AppSidebar (Hjem, Løn & Mål, Vagtplan-overblik, Beskeder, Min profil). */
export function useBottomTabs(): BottomTab[] {
  const p = usePermissions();
  return [
    { to: "/home", label: "Hjem", icon: Home, visible: !!p.canViewHome },
    { to: "/my-goals", label: "Tal", icon: Target, visible: !!p.canViewMyGoals },
    { to: "/vagt-flow", label: "Vagter", icon: Calendar, visible: !!p.canViewFmOverview },
    { to: "/messages", label: "Beskeder", icon: MessageSquare, visible: !!p.canViewMessagesPersonal },
    { to: "/my-profile", label: "Mig", icon: User, visible: !!p.canViewMyProfile },
  ];
}

/** Faneroden for en sti (bruges af tilbage-pilen, når der ingen historik er). */
export function tabRootFor(pathname: string, tabs: BottomTab[]): string | null {
  const hit = tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
  return hit ? hit.to : null;
}

/** Fem faste faner i bunden på telefon. Faner uden adgang vises ikke. */
export function BottomNav() {
  const tabs = useBottomTabs().filter((t) => t.visible);
  const { pathname } = useLocation();
  if (tabs.length === 0) return null;
  return (
    <nav
      aria-label="Hovednavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      <ul className="flex" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(`${t.to}/`);
          const Icon = t.icon;
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors active:opacity-70",
                  active ? "text-primary" : "text-sidebar-foreground/70",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                {t.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
