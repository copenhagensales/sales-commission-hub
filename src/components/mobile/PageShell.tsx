import { ReactNode, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, User } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-sidebar-foreground/10 bg-sidebar pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-sidebar-foreground shadow-[0_8px_24px_-12px_hsl(var(--cph-onyx)/0.5)]">
      <div className="flex h-[88px] items-center gap-3 px-4 min-[380px]:px-6">
        {showBack ? (
          <button type="button" onClick={goBack} aria-label="Tilbage"
            className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors active:bg-sidebar-accent">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : <span className="w-2" />}
        <div className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</div>
        {right && <div className="flex flex-none items-center">{right}</div>}
      </div>
    </header>
  );
}

interface PageShellProps {
  children: ReactNode;
  title?: ReactNode;
  showBack?: boolean;
  right?: ReactNode;
  /** Indhold til »Menu«-skuffen (den eksisterende menu). */
  moreMenu?: (close: () => void) => ReactNode;
  /** Pladsreservation til en StickyAction (px). */
  stickyActionSpace?: number;
}

/**
 * Wrapper til en side på telefon (< 768 px): TopBar + indhold + BottomNav.
 * »Menu« yderst til højre i bunden åbner skuffen med profil, sidehandlinger og den fulde menu.
 * På ≥ 768 px renderes kun children uændret.
 */
export function PageShell({ children, title, showBack, right, moreMenu, stickyActionSpace = 0 }: PageShellProps) {
  const isMobile = useIsPhone();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [actions, setActions] = useState<Array<[string, MoreAction]>>([]);
  const register = useCallback((id: string, action: MoreAction) => {
    setActions((prev) => [...prev.filter(([k]) => k !== id), [id, action]]);
    return () => setActions((prev) => prev.filter(([k]) => k !== id));
  }, []);
  const ctx = useMemo(() => ({ register }), [register]);
  if (!isMobile) return <>{children}</>;

  const hasActions = actions.length > 0;
  const hasMenu = !!moreMenu || hasActions;

  return (
    <>
      <TopBar title={title ?? "Stork"} showBack={showBack} right={right} />
      <div
        data-mobil-indhold
        className={cn("min-w-0 max-w-full overflow-x-auto [&_iframe]:max-w-full [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto")}
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT + stickyActionSpace}px + env(safe-area-inset-bottom, 0px) + 16px)` }}
      >
        <MoreActionsContext.Provider value={ctx}>{children}</MoreActionsContext.Provider>
      </div>
      <BottomNav onMenu={hasMenu ? () => setMoreOpen(true) : undefined} menuOpen={moreOpen} />
      {hasMenu && (
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Menu">
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
