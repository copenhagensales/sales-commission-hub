import type { OverallStatus, EquipmentStatus } from "@/hooks/useItWorkstations";

/** Card surface + border per overall status (semantic tokens only). */
export const OVERALL_CARD_CLASS: Record<OverallStatus, string> = {
  ok: "border-border bg-card hover:border-success/60",
  attention: "border-warning/50 bg-warning/10 hover:border-warning",
  down: "border-destructive/50 bg-destructive/10 hover:border-destructive",
  unknown: "border-border bg-muted/40 hover:border-muted-foreground/50",
};

export const OVERALL_DOT_CLASS: Record<OverallStatus, string> = {
  ok: "bg-success",
  attention: "bg-warning",
  down: "bg-destructive",
  unknown: "bg-muted-foreground",
};

export const OVERALL_TEXT_CLASS: Record<OverallStatus, string> = {
  ok: "text-muted-foreground",
  attention: "text-warning",
  down: "text-destructive",
  unknown: "text-muted-foreground",
};

export const EQUIPMENT_ICON_CLASS: Record<EquipmentStatus, string> = {
  ok: "text-muted-foreground/70",
  missing: "text-warning",
  broken: "text-destructive",
  unknown: "text-muted-foreground/40",
};

/** Non-colour cue so status is never communicated by colour alone. */
export const OVERALL_SYMBOL: Record<OverallStatus, string> = {
  ok: "✓",
  attention: "!",
  down: "×",
  unknown: "?",
};
