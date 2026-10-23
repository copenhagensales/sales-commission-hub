import { ReactNode, useEffect, useRef } from "react";
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

/**
 * Skuffe fra bunden (Vaul) til filtre, valg og »Mere«.
 * Lukker på træk-ned og på Android-tilbage (via history). Fokus flyttes ind og tilbage af Vaul/Radix.
 */
export function BottomSheet({ open, onOpenChange, title, description, children, className }: BottomSheetProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      // Lukket via UI: fjern vores history-post igen.
      if (pushedRef.current) {
        pushedRef.current = false;
        if ((window.history.state as { bottomSheet?: boolean } | null)?.bottomSheet) window.history.back();
      }
      return;
    }
    window.history.pushState({ ...(window.history.state ?? {}), bottomSheet: true }, "");
    pushedRef.current = true;
    const onPop = () => {
      pushedRef.current = false;
      onOpenChange(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onOpenChange]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85dvh] pb-[env(safe-area-inset-bottom,0px)]", className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
