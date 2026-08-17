import { Laptop, Monitor, Headphones, Mouse, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_STATUS_LABELS,
  OVERALL_LABELS,
  type EquipmentKind,
  type ItWorkstation,
} from "@/hooks/useItWorkstations";
import {
  EQUIPMENT_ICON_CLASS,
  OVERALL_CARD_CLASS,
  OVERALL_DOT_CLASS,
  OVERALL_SYMBOL,
  OVERALL_TEXT_CLASS,
} from "./statusStyles";

const KIND_ICON: Record<EquipmentKind, typeof Laptop> = {
  computer: Laptop,
  monitor_1: Monitor,
  monitor_2: Monitor,
  headset: Headphones,
  mouse: Mouse,
  keyboard: Keyboard,
};

interface Props {
  workstation: ItWorkstation;
  onOpen: (ws: ItWorkstation) => void;
  faded?: boolean;
  highlighted?: boolean;
}

export function WorkstationCard({ workstation: ws, onOpen, faded, highlighted }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ws)}
      aria-label={`${ws.code} — ${OVERALL_LABELS[ws.overall]} — ${ws.headline}`}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        OVERALL_CARD_CLASS[ws.overall],
        faded && "opacity-30",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">{ws.code}</span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-muted-foreground" aria-hidden="true">
            {OVERALL_SYMBOL[ws.overall]}
          </span>
          <span
            className={cn("h-2.5 w-2.5 rounded-full", OVERALL_DOT_CLASS[ws.overall])}
            aria-hidden="true"
          />
        </span>
      </div>

      <div className="flex items-center gap-1">
        {ws.equipment.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <span
              key={item.id}
              title={`${EQUIPMENT_LABELS[item.kind]}: ${EQUIPMENT_STATUS_LABELS[item.status]}`}
            >
              <Icon className={cn("h-3.5 w-3.5", EQUIPMENT_ICON_CLASS[item.status])} />
            </span>
          );
        })}
      </div>

      <span className={cn("truncate text-xs font-medium", OVERALL_TEXT_CLASS[ws.overall])}>
        {ws.headline}
      </span>

      <span
        className={cn(
          "truncate text-[11px]",
          STALENESS_TEXT_CLASS[stalenessLevel(ws.last_updated_at)],
        )}
        title={
          ws.last_updated_at
            ? `Sidst opdateret ${new Date(ws.last_updated_at).toLocaleString("da-DK")}`
            : "Aldrig opdateret"
        }
      >
        Opdateret {formatSince(ws.last_updated_at)}
      </span>

    </button>
  );
}
