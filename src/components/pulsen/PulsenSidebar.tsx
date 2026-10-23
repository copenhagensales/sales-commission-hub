import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useEventAttendees, useToggleEventAttendance, useUpcomingCompanyEvents, type AttendanceStatus } from "@/hooks/useCompanyEvents";
import { usePulsenUnanswered } from "@/hooks/usePulsen";
import { pulsenRelativeTime, shortName } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-card p-5">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PulsenSidebar({ employeeId, onOpenQuestion, top, className }: { employeeId: string | null; onOpenQuestion: (id: string) => void; top?: React.ReactNode; className?: string }) {
  const { data: events = [], isLoading } = useUpcomingCompanyEvents();
  const next = events.slice(0, 3);
  const { data: attendees = [] } = useEventAttendees(events.map((e) => e.id));
  const toggle = useToggleEventAttendance(employeeId);
  const unanswered = usePulsenUnanswered(true);
  const myStatus = (id: string) => attendees.find((a) => a.event_id === id && a.employee_id === employeeId)?.status as AttendanceStatus | undefined;

  return (
    <aside className={cn("flex flex-col gap-4", className)} aria-label="Storkbook sidekolonne">
      {top}
      <SideCard title="Kommer snart">
        {isLoading ? (
          <p className="text-[14px] text-muted-foreground">Henter …</p>
        ) : next.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Ingen kommende begivenheder.</p>
        ) : (
          <ul className="space-y-3">
            {next.map((e) => {
              const mine = myStatus(e.id);
              const d = parseISO(e.event_date);
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-[12px] bg-[hsl(var(--cph-light-blue))]">
                    <span className="text-[15px] font-extrabold leading-none tabular-nums">{format(d, "d")}</span>
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.06em] opacity-70">{format(d, "MMM", { locale: da }).replace(".", "")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold text-foreground">{e.title}</p>
                    {e.event_time && <p className="text-[12px] text-muted-foreground">kl. {e.event_time.slice(0, 5)}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={!employeeId || toggle.isPending}
                    aria-pressed={mine === "attending"}
                    aria-label={mine === "attending" ? `Du deltager i ${e.title}` : `Tilmeld dig ${e.title}`}
                    onClick={() => toggle.mutate({ eventId: e.id, status: mine === "attending" ? "not_attending" : "attending" })}
                    className={cn(
                      "min-h-[36px] flex-none rounded-full px-3 text-[12px] font-extrabold",
                      mine === "attending" ? "bg-[#d6f7e5] text-[#146c3c]" : "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
                    )}
                  >
                    {mine === "attending" ? "✓ Tilmeldt" : "Tilmeld"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SideCard>

      <SideCard title="Ubesvarede spørgsmål">
        {unanswered.isLoading ? (
          <p className="text-[14px] text-muted-foreground">Henter …</p>
        ) : (unanswered.data ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Alle spørgsmål i Huset har fået svar.</p>
        ) : (
          <ul className="space-y-1">
            {(unanswered.data ?? []).map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => onOpenQuestion(q.id)} className="block min-h-[44px] w-full rounded-2xl px-2 py-2 text-left hover:bg-[hsl(var(--cph-light-blue))]">
                  <span className="line-clamp-2 text-[14px] font-extrabold text-foreground">{q.body}</span>
                  <span className="text-[12px] text-muted-foreground">{shortName(q.author?.first_name, q.author?.last_name)} · {pulsenRelativeTime(q.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SideCard>
    </aside>
  );
}
