import { createContext, MouseEvent, ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Navigér fra en skuffe: skuffens history-post fjernes først, så siden lægges som ét almindeligt skridt. */
const SheetNavigateContext = createContext<((to: string) => void) | null>(null);
export function useSheetNavigate() {
  const ctx = useContext(SheetNavigateContext);
  const navigate = useNavigate();
  return ctx ?? ((to: string) => navigate(to));
}

/**
 * Skuffe fra bunden (Vaul) til filtre, valg og »Mere«.
 * Lukker på træk-ned og på Android-tilbage (via history). Fokus flyttes ind og tilbage af Vaul/Radix.
 * Links inde i skuffen (også den genbrugte menu) lukker skuffen først og navigerer derefter med push,
 * så tilbage fra siden går ét skridt til siden under skuffen.
 */
export function BottomSheet({ open, onOpenChange, title, description, children, className }: BottomSheetProps) {
  const navigate = useNavigate();
  // Refs, så effekten kun afhænger af `open` (nye callbacks ved gen-render må ikke lægge nye history-poster).
  const navigateRef = useRef(navigate);
  const onOpenChangeRef = useRef(onOpenChange);
  navigateRef.current = navigate;
  onOpenChangeRef.current = onOpenChange;
  const pushedRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const isSheetState = () => !!(window.history.state as { bottomSheet?: boolean } | null)?.bottomSheet;
    const prev = (window.history.state ?? {}) as { idx?: number };
    // Én post pr. åbning. Posten tæller som et skridt, så sider oven på den ved, at der er historik.
    window.history.pushState({ ...prev, idx: (prev.idx ?? 0) + 1, bottomSheet: true }, "");
    pushedRef.current = true;
    const onPop = () => {
      window.removeEventListener("popstate", onPop);
      pushedRef.current = false;
      const to = pendingRef.current;
      pendingRef.current = null;
      onOpenChangeRef.current(false);
      if (to) setTimeout(() => navigateRef.current(to), 0);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Lukket via UI (ikke via tilbage): fjern vores post igen.
      if (pushedRef.current) {
        pushedRef.current = false;
        if (isSheetState()) window.history.back();
      }
    };
  }, [open]);

  const sheetNavigate = useCallback((to: string) => {
    if (pushedRef.current && (window.history.state as { bottomSheet?: boolean } | null)?.bottomSheet) {
      pendingRef.current = to;
      window.history.back();
    } else {
      onOpenChangeRef.current(false);
      navigateRef.current(to);
    }
  }, []);

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target === "_blank") return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    e.stopPropagation();
    sheetNavigate(url.pathname + url.search + url.hash);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85dvh] pb-[env(safe-area-inset-bottom,0px)]", className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}
        </DrawerHeader>
        <SheetNavigateContext.Provider value={sheetNavigate}>
          {/* data-vaul-no-drag: indholdet ruller; arket trækkes kun i håndtag/hoved (hold på en flise flyttede ellers arket, Mathias 29/10). */}
          <div data-vaul-no-drag onClickCapture={onClickCapture} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">{children}</div>
        </SheetNavigateContext.Provider>
      </DrawerContent>
    </Drawer>
  );
}
