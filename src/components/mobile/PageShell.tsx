import { ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { useIsPhone } from "./useIsPhone";
import { BottomNav, BOTTOM_NAV_HEIGHT, tabRootFor, useBottomTabs } from "./BottomNav";
import { BottomSheet } from "./BottomSheet";
import { cn } from "@/lib/utils";

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
  if (!isMobile) return <>{children}</>;

  const moreButton = moreMenu ? (
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
        className={cn("min-w-0")}
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT + stickyActionSpace}px + env(safe-area-inset-bottom, 0px) + 16px)` }}
      >
        {children}
      </div>
      <BottomNav />
      {moreMenu && (
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Mere">
          {moreMenu(() => setMoreOpen(false))}
        </BottomSheet>
      )}
    </>
  );
}
