import { useEffect, useId, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

/**
 * Globalt register over uafsendte indtastninger.
 * Opdateringer (service worker / ny version) spørger her, før de genindlæser:
 * er der en kladde, udskydes genindlæsningen til næste sideskift.
 */
const dirtyIds = new Set<string>();
let pendingReload: (() => void) | null = null;

/** Sand, hvis mindst én formular har uafsendte ændringer. */
export function hasUnsentDrafts(): boolean {
  return dirtyIds.size > 0;
}

/**
 * Genindlæs nu, hvis det er sikkert; ellers udskyd til næste sideskift og vis »Ny version klar«.
 * @param reload funktionen, der genindlæser (typisk `window.location.reload`).
 * @param delayMs ventetid, når der ikke er kladder (bevarer eksisterende adfærd).
 */
export function requestSafeReload(reload: () => void, delayMs = 0): void {
  if (!hasUnsentDrafts()) {
    if (delayMs > 0) window.setTimeout(reload, delayMs);
    else reload();
    return;
  }
  if (pendingReload) return;
  pendingReload = reload;
  toast("Ny version klar", { description: "Opdaterer, når du skifter side." });
}

/** Markér en formular som uafsendt, så længe `dirty` er sand. Ryddes automatisk ved unmount. */
export function useDraftGuard(dirty: boolean): void {
  const id = useId();
  useEffect(() => {
    if (dirty) dirtyIds.add(id);
    else dirtyIds.delete(id);
    return () => {
      dirtyIds.delete(id);
    };
  }, [dirty, id]);
}

/** Monteres én gang i layoutet: udfører en udskudt genindlæsning ved næste sideskift. */
export function DraftGuardNavigationListener() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (pendingReload && !hasUnsentDrafts()) {
      const r = pendingReload;
      pendingReload = null;
      r();
    }
  }, [location.pathname]);
  return null;
}
