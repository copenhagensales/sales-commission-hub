import { useEffect, useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, Info, MapPin, Pencil, Trash2 } from "lucide-react";

interface NextEventHeroProps {
  eventDate: Date;
  eventTime?: string | null;
  title: string;
  location?: string | null;
  onOpenDetail: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** Countdown-hero til næste begivenhed. Ren præsentation – ingen forretningslogik. */
export function NextEventHero({
  eventDate,
  eventTime,
  title,
  location,
  onOpenDetail,
  canManage,
  onEdit,
  onDelete,
}: NextEventHeroProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const target = new Date(eventDate);
  if (eventTime) {
    const [hours, minutes] = eventTime.split(":");
    target.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  } else {
    target.setHours(0, 0, 0, 0);
  }

  const msLeft = Math.max(target.getTime() - now.getTime(), 0);
  const totalMinutes = Math.floor(msLeft / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  // Fremdrift vist over et 14-dages vindue frem mod begivenheden
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const progress = Math.min(100, Math.max(0, ((windowMs - msLeft) / windowMs) * 100));

  const dateLabel = format(target, "EEEE d. MMM", { locale: da }).toUpperCase();
  const timeLabel = eventTime ? `KL. ${eventTime.slice(0, 5)}` : null;

  const units = [
    { value: days, label: "Dage", accent: true },
    { value: hours, label: "Timer", accent: false },
    { value: minutes, label: "Min", accent: false },
  ];

  return (
    <div className="rounded-2xl bg-[hsl(var(--cph-onyx))] p-5 text-[hsl(var(--cph-light-blue))]">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 text-[11px] font-extrabold uppercase leading-[1.35] tracking-[0.1em] text-[hsl(var(--cph-emerald))]">
          <Clock className="mt-[1px] h-3.5 w-3.5 flex-none" />
          <span>{[dateLabel, timeLabel].filter(Boolean).join(" · ")}</span>
        </p>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={onOpenDetail}
            title="Læs mere"
            className="rounded-md p-1 text-[hsl(var(--cph-light-blue)/0.7)] transition-colors hover:bg-[hsl(var(--cph-light-blue)/0.12)] hover:text-[hsl(var(--cph-light-blue))]"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="Rediger"
                className="rounded-md p-1 text-[hsl(var(--cph-light-blue)/0.7)] transition-colors hover:bg-[hsl(var(--cph-light-blue)/0.12)] hover:text-[hsl(var(--cph-light-blue))]"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Slet"
                className="rounded-md p-1 text-destructive transition-colors hover:bg-destructive/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {units.map((unit) => (
          <div key={unit.label}>
            <p
              className={`text-[clamp(28px,5vw,46px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${
                unit.accent ? "text-[hsl(var(--cph-emerald))]" : ""
              }`}
            >
              {unit.accent ? unit.value : String(unit.value).padStart(2, "0")}
            </p>
            <p className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--cph-light-blue)/0.6)]">
              {unit.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--cph-light-blue)/0.16)]">
        <div
          className="h-full rounded-full bg-[hsl(var(--cph-emerald))] transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p
        className="mt-4 cursor-pointer text-[18px] font-extrabold uppercase leading-[1.25] tracking-[-0.01em] hover:underline"
        onClick={onOpenDetail}
      >
        {title}
      </p>
      {location && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[hsl(var(--cph-light-blue)/0.72)]">
          <MapPin className="mt-[2px] h-3.5 w-3.5 flex-none" />
          <span>{location}</span>
        </p>
      )}
    </div>
  );
}
