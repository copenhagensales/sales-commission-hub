import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Check, Info, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type RsvpStatus = "attending" | "maybe" | "not_attending";

interface EventRsvpCardProps {
  title: string;
  eventDate: string;
  eventTime?: string | null;
  location?: string | null;
  requiresRegistration?: boolean;
  attendeeCount: number;
  myStatus: RsvpStatus | null;
  featured?: boolean;
  disabled?: boolean;
  canManage?: boolean;
  onRespond: (status: RsvpStatus) => void;
  onOpenDetail: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const STATUS_LABEL: Record<RsvpStatus, string> = {
  attending: "Du deltager",
  maybe: "Du har svaret måske",
  not_attending: "Du har meldt afbud",
};

export function EventRsvpCard({
  title,
  eventDate,
  eventTime,
  location,
  requiresRegistration,
  attendeeCount,
  myStatus,
  featured = false,
  disabled,
  canManage,
  onRespond,
  onOpenDetail,
  onEdit,
  onDelete,
}: EventRsvpCardProps) {
  const date = parseISO(eventDate);
  const days = differenceInCalendarDays(date, new Date());
  const whenLabel = days <= 0 ? "I dag" : days === 1 ? "I morgen" : `Om ${days} dage`;
  const weekday = format(date, "EEE", { locale: da }).replace(".", "");
  const meta = [
    `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}${eventTime ? ` kl. ${eventTime.slice(0, 5)}` : ""}`,
    location,
  ]
    .filter(Boolean)
    .join(" · ");

  const attendLabel = requiresRegistration ? (myStatus === "attending" ? "Tilmeldt" : "Tilmeld") : "Deltager";
  const options: { status: RsvpStatus; label: string }[] = [
    { status: "attending", label: attendLabel },
    { status: "maybe", label: "Måske" },
    { status: "not_attending", label: "Afbud" },
  ];

  const iconBtn = cn(
    "rounded-md p-1 transition-colors",
    featured
      ? "text-[hsl(var(--cph-light-blue)/0.7)] hover:bg-[hsl(var(--cph-light-blue)/0.1)] hover:text-[hsl(var(--cph-light-blue))]"
      : "text-foreground/60 hover:bg-[hsl(var(--cph-onyx)/0.06)] hover:text-foreground",
  );

  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        featured
          ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
          : "border border-[hsl(var(--cph-onyx)/0.12)] bg-card text-foreground",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl",
            featured ? "bg-[hsl(var(--cph-light-blue)/0.1)]" : "bg-[hsl(var(--cph-light-blue))]",
          )}
        >
          <span className="text-[18px] font-extrabold leading-none tabular-nums">{format(date, "d")}</span>
          <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] opacity-70">
            {format(date, "MMM", { locale: da }).replace(".", "")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em]",
                myStatus
                  ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]"
                  : "bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning))]",
              )}
            >
              {myStatus ? whenLabel : "Ikke svaret"}
            </span>
            <div className="flex flex-none items-center gap-0.5">
              <button type="button" title="Læs mere" onClick={onOpenDetail} className={iconBtn}>
                <Info className="h-3.5 w-3.5" />
              </button>
              {canManage && (
                <>
                  <button type="button" title="Rediger" onClick={onEdit} className={iconBtn}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Slet" onClick={onDelete} className="rounded-md p-1 text-destructive transition-colors hover:bg-destructive/15">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
          <button type="button" onClick={onOpenDetail} className="mt-1 block text-left text-[16px] font-extrabold leading-tight hover:underline">
            {title}
          </button>
          {meta && <p className={cn("mt-0.5 text-[13px]", featured ? "opacity-75" : "text-foreground/60")}>{meta}</p>}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Dit svar"
        className={cn(
          "mt-4 grid grid-cols-3 gap-1 rounded-full p-1",
          featured ? "bg-[hsl(var(--cph-light-blue)/0.1)]" : "bg-[hsl(var(--cph-onyx)/0.06)]",
        )}
      >
        {options.map((o) => {
          const active = myStatus === o.status;
          return (
            <button
              key={o.status}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onRespond(o.status)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-full px-2 py-2 text-[13px] font-extrabold transition-colors",
                active
                  ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]"
                  : featured
                    ? "hover:bg-[hsl(var(--cph-light-blue)/0.1)]"
                    : "hover:bg-[hsl(var(--cph-onyx)/0.08)]",
              )}
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={attendees.length === 0}
            className={cn(
              "mt-3 flex items-center gap-2 rounded-full text-left text-[12px] hover:underline disabled:no-underline",
              featured ? "opacity-90" : "text-foreground/60",
            )}
          >
            {preview.length > 0 && (
              <span className="flex -space-x-2">
                {preview.map((a) => {
                  const url = lookupAvatar({ employeeId: a.id, name: a.name });
                  return (
                    <span
                      key={a.id}
                      title={a.name}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2",
                        featured ? "ring-[hsl(var(--cph-onyx))]" : "ring-card",
                      )}
                    >
                      {url ? <img src={url} alt={a.name} className="h-full w-full object-cover" /> : initials(a.name)}
                    </span>
                  );
                })}
              </span>
            )}
            <span>
              {attendeeCount} deltager{myStatus === "attending" ? " · inkl. dig" : ""}
              {myStatus && myStatus !== "attending" ? ` · ${STATUS_LABEL[myStatus]}` : ""}
              {attendees.length > 0 ? " · Se hvem" : ""}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <p className="px-2 pb-2 text-xs font-bold text-muted-foreground">{attendees.length} deltager</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {[...attendees].sort((a, b) => a.name.localeCompare(b.name, "da")).map((a) => {
              const url = lookupAvatar({ employeeId: a.id, name: a.name });
              return (
                <li key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                  <span className="flex h-6 w-6 flex-none items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                    {url ? <img src={url} alt={a.name} className="h-full w-full object-cover" /> : initials(a.name)}
                  </span>
                  <span className="truncate">{a.name}</span>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
