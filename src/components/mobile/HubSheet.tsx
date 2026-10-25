import type { LucideIcon } from "lucide-react";
import { BottomSheet, useSheetNavigate } from "./BottomSheet";

export interface HubTile {
  to: string;
  label: string;
  /** Fast, kort undertekst (ingen data). */
  hint: string;
  icon: LucideIcon;
}

interface HubSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tiles: HubTile[];
}

/**
 * Samlefane som skuffe fra bunden: store fliser i 2 kolonner.
 * Valg lukker skuffen og erstatter skuffens history-post med siden, så tilbage ikke åbner den igen.
 * Tilbage-gestus/Android-tilbage lukker skuffen uden sideskift (håndteres af BottomSheet).
 */
export function HubSheet({ open, onOpenChange, title, tiles }: HubSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <HubTiles tiles={tiles} />
    </BottomSheet>
  );
}

/** Inde i skuffen: valg lukker skuffen først og lægger siden som ét almindeligt skridt. */
function HubTiles({ tiles }: { tiles: HubTile[] }) {
  const go = useSheetNavigate();
  return (
    <div className="grid grid-cols-2 gap-3 px-2 pb-2">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.to}
            type="button"
            onClick={() => go(t.to)}
            className="flex min-h-[96px] min-w-0 flex-col items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-4 text-left shadow-sm transition-transform duration-100 active:scale-[0.98] active:bg-muted motion-reduce:transform-none"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald)/0.14)] text-[hsl(var(--cph-emerald))]">
              <Icon className="h-7 w-7" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold leading-tight text-foreground">{t.label}</span>
              <span className="mt-1 block text-[14px] leading-snug text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
