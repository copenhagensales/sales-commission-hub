import { ReactNode, useEffect, useState } from "react";
import { BOTTOM_NAV_HEIGHT } from "./BottomNav";
import { cn } from "@/lib/utils";

/** Afstand fra bunden, når tastaturet er åbent (0 når lukket). Bruger visualViewport. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 120 ? covered : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * Fast handlingsknap(per) i bunden over BottomNav.
 * Flytter op over tastaturet og respekterer hjemmebjælken. Kun til telefonvisning.
 */
export function StickyAction({ children, withBottomNav = true, className }: { children: ReactNode; withBottomNav?: boolean; className?: string }) {
  const keyboard = useKeyboardInset();
  const bottom = keyboard > 0
    ? `${keyboard}px`
    : `calc(${withBottomNav ? BOTTOM_NAV_HEIGHT : 0}px + env(safe-area-inset-bottom, 0px))`;
  return (
    <div className={cn("fixed inset-x-0 z-40 flex gap-2 border-t border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden [&>*]:min-h-[44px] [&>*]:flex-1", className)}
      style={{ bottom }}>
      {children}
    </div>
  );
}
