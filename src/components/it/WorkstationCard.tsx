import { Laptop, Monitor, Headphones, Mouse, Keyboard, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_STATUS_LABELS,
  OVERALL_LABELS,
  type EquipmentKind,
  type EquipmentStatus,
  seatLabel,
  type ItWorkstation,
} from "@/hooks/useItWorkstations";
import {
  EQUIPMENT_ICON_CLASS,
  OVERALL_CARD_CLASS,
  OVERALL_DOT_CLASS,
  OVERALL_SYMBOL,
  OVERALL_TEXT_CLASS,
} from "./statusStyles";
import { formatSince, stalenessLevel, STALENESS_TEXT_CLASS } from "@/lib/itTime";


const KIND_ICON: Record<EquipmentKind, typeof Laptop> = {
  computer: Laptop,
  monitor_1: Monitor,
  monitor_2: Monitor,
  headset: Headphones,
  mouse: Mouse,
  keyboard: Keyboard,
  desk: ArrowUpDown,
};

interface Props {
  workstation: ItWorkstation;
  onOpen: (ws: ItWorkstation) => void;
  /** Hurtig toggle af udstyr direkte på kortet (kun med redigeringsadgang). */
  onToggleEquipment?: (ws: ItWorkstation, kind: EquipmentKind, next: EquipmentStatus) => void;
  faded?: boolean;
  highlighted?: boolean;
}

export function WorkstationCard({
  workstation: ws,
  onOpen,
  onToggleEquipment,
  faded,
  highlighted,
}: Props) {
  const interactiveEquipment = !!onToggleEquipment;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ws)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(ws);
        }
      }}
      aria-label={`${seatLabel(ws)} — ${OVERALL_LABELS[ws.overall]} — ${ws.headline}`}
      className={cn(
        "group flex w-full min-w-0 cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-150 sm:p-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        OVERALL_CARD_CLASS[ws.overall],
        faded && "opacity-30",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold tracking-tight text-foreground">{seatLabel(ws)}</span>
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

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {ws.equipment.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const isMissing = item.status === "missing" || item.status === "broken";
          const next: EquipmentStatus = isMissing ? "ok" : "missing";
          const label = `${EQUIPMENT_LABELS[item.kind]}: ${EQUIPMENT_STATUS_LABELS[item.status]}`;

          const icon = (
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
              <Icon className={cn("h-3.5 w-3.5", EQUIPMENT_ICON_CLASS[item.status])} />
              {isMissing && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-destructive"
                />
              )}
            </span>
          );

          if (!interactiveEquipment) {
            return (
              <span key={item.id} title={label}>
                {icon}
              </span>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              title={`${label} — klik for at markere som ${EQUIPMENT_STATUS_LABELS[next].toLowerCase()}`}
              aria-label={`${label} — klik for at markere som ${EQUIPMENT_STATUS_LABELS[next].toLowerCase()}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleEquipment?.(ws, item.kind, next);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className="rounded p-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {icon}
            </button>
          );
        })}
      </div>

      <span className={cn("truncate text-xs font-medium", OVERALL_TEXT_CLASS[ws.overall])}>
        {ws.headline}
      </span>

      {ws.last_updated_at && (
        <span
          className={cn(
            "truncate text-[11px]",
            STALENESS_TEXT_CLASS[stalenessLevel(ws.last_updated_at)],
          )}
          title={`Sidst opdateret ${new Date(ws.last_updated_at).toLocaleString("da-DK")}`}
        >
          Opdateret {formatSince(ws.last_updated_at)}
        </span>
      )}

    </div>
  );
}
