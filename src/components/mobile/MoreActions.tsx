import { createContext, useContext, useEffect, useId, useRef, type ComponentType } from "react";

/** En sidehandling, der på telefon ligger som 44 px række i »Mere«-skuffen i stedet for som knap på siden. */
export interface MoreAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface MoreActionsContextValue {
  register: (id: string, action: MoreAction) => () => void;
}

export const MoreActionsContext = createContext<MoreActionsContextValue | null>(null);

/**
 * Registrerer en handling i »Mere« på telefon. Returnerer true, når handlingen ligger i skuffen
 * (dvs. siden er inde i PageShell på telefon) — så skal siden ikke selv vise knappen.
 */
export function useMoreAction(action: MoreAction | null): boolean {
  const ctx = useContext(MoreActionsContext);
  const id = useId();
  const ref = useRef(action);
  ref.current = action;
  const label = action?.label;
  const icon = action?.icon;
  useEffect(() => {
    if (!ctx || !label) return;
    return ctx.register(id, { label, icon, onSelect: () => ref.current?.onSelect() });
  }, [ctx, id, label, icon]);
  return !!ctx && !!action;
}
