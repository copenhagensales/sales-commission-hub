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
  const pushedRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Lukket via UI: fjern vores history-post igen.
      if (pushedRef.current) {
        pushedRef.current = false;
        if ((window.history.state as { bottomSheet?: boolean } | null)?.bottomSheet) window.history.back();
      }
      return;
    }
    const prev = (window.history.state ?? {}) as { idx?: number };
    // Posten tæller som et skridt, så sider der alligevel lægges oven på den, ved at der er historik.
    window.history.pushState({ ...prev, idx: (prev.idx ?? 0) + 1, bottomSheet: true }, "");
    pushedRef.current = true;
    const onPop = () => {
      pushedRef.current = false;
      onOpenChange(false);
      const to = pendingRef.current;
      pendingRef.current = null;
      if (to) setTimeout(() => navigate(to), 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onOpenChange, navigate]);

  const sheetNavigate = useCallback((to: string) => {
    if (pushedRef.current && (window.history.state as { bottomSheet?: boolean } | null)?.bottomSheet) {
      pendingRef.current = to;
      window.history.back();
    } else {
      onOpenChange(false);
      navigate(to);
    }
  }, [navigate, onOpenChange]);

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
          <div onClickCapture={onClickCapture} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">{children}</div>
        </SheetNavigateContext.Provider>
      </DrawerContent>
    </Drawer>
  );
}
