import { ReactNode, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Menu } from "lucide-react";
import { useIsPhone } from "./useIsPhone";
import { BottomNav, BOTTOM_NAV_HEIGHT, tabRootFor, useBottomTabs } from "./BottomNav";
import { BottomSheet } from "./BottomSheet";
import { cn } from "@/lib/utils";
import { MoreActionsContext, type MoreAction } from "./MoreActions";

interface TopBarProps {
  title: ReactNode;
  /** Vis tilbage-pil. Går til forrige side, ellers til fanens rod. */
  showBack?: boolean;
  right?: ReactNode;
}

/** Topbjælke på telefon: titel, valgfri tilbage-pil og valgfri højre handling. */
export function TopBar({ title, showBack, right }: TopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = useBottomTabs();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(tabRootFor(pathname, tabs) ?? "/home");
  };
  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top,0px)] text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-2">
        {showBack ? (
          <button type="button" onClick={goBack} aria-label="Tilbage"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full active:bg-sidebar-accent">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : <span className="w-2" />}
        <div className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</div>
        {right}
      </div>
    </header>
  );
}

interface PageShellProps {
  children: ReactNode;
  title?: ReactNode;
  showBack?: boolean;
  right?: ReactNode;
  /** Indhold til »Mere«-skuffen (den eksisterende menu). Udelades = ingen »Mere«-knap. */
  moreMenu?: (close: () => void) => ReactNode;
  /** Pladsreservation til en StickyAction (px). */
  stickyActionSpace?: number;
}

/**
 * Wrapper til en side på telefon (< 768 px): TopBar + indhold + BottomNav.
 * På ≥ 768 px renderes kun children uændret.
 */
export function PageShell({ children, title, showBack, right, moreMenu, stickyActionSpace = 0 }: PageShellProps) {
  const isMobile = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const tabs = useBottomTabs();
  const [actions, setActions] = useState<Array<[string, MoreAction]>>([]);
  const register = useCallback((id: string, action: MoreAction) => {
    setActions((prev) => [...prev.filter(([k]) => k !== id), [id, action]]);
    return () => setActions((prev) => prev.filter(([k]) => k !== id));
  }, []);
  const ctx = useMemo(() => ({ register }), [register]);
  if (!isMobile) return <>{children}</>;

  // Mobilstandard pkt. 2: »Mere« ligger nederst i fanen »Mig«. Har brugeren ikke adgang til »Mig«,
  // bliver »Mere« i topbjælken, så den gamle menu stadig kan nås.
  const meTab = tabs.find((t) => t.to === "/my-profile" && t.visible);
  const hasActions = actions.length > 0;
  // Sidehandlinger (TV-link, fuldskærm m.fl.) gør »Mere« tilgængelig i topbjælken på siden.
  const moreInTopBar = (!!moreMenu && !meTab) || hasActions;
  const showMoreRow = !!moreMenu && !!meTab && pathname === meTab.to;

  const moreButton = moreInTopBar ? (
    <button type="button" onClick={() => setMoreOpen(true)} aria-label="Mere" aria-haspopup="dialog"
      className="flex h-11 min-w-11 flex-none items-center justify-center gap-1 rounded-full px-2 text-[14px] font-semibold active:bg-sidebar-accent">
      <Menu className="h-6 w-6" />
      <span>Mere</span>
    </button>
  ) : null;

  return (
    <>
      <TopBar title={title ?? "Stork"} showBack={showBack} right={<>{right}{moreButton}</>} />
      <div
        data-mobil-indhold
        className={cn("min-w-0 max-w-full overflow-x-auto [&_iframe]:max-w-full [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto")}
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT + stickyActionSpace}px + env(safe-area-inset-bottom, 0px) + 16px)` }}
      >
        <MoreActionsContext.Provider value={ctx}>{children}</MoreActionsContext.Provider>
        {showMoreRow && (
          <div className="px-4 pt-2">
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog"
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-[16px] font-semibold text-foreground active:bg-muted">
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span className="flex-1 text-left">Mere</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <BottomNav />
      {(moreMenu || hasActions) && (
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Mere">
          {hasActions && (
            <div className={cn("flex flex-col gap-1", moreMenu && "mb-2 border-b border-border pb-2")}>
              {actions.map(([id, a]) => {
                const Icon = a.icon;
                return (
                  <button key={id} type="button"
                    onClick={() => { setMoreOpen(false); a.onSelect(); }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base active:bg-accent">
                    {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          {moreMenu?.(() => setMoreOpen(false))}
        </BottomSheet>
      )}
    </>
  );
}
