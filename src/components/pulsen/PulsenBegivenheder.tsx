import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarDays, ImageOff } from "lucide-react";
import { AddEventDialog } from "@/components/home/AddEventDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PulsenEmpty, PulsenPostSkeleton } from "./PulsenStates";
import {
  useEventAttendees, usePastCompanyEvents, useToggleEventAttendance, useUpcomingCompanyEvents, type AttendanceStatus,
} from "@/hooks/useCompanyEvents";
import { useCanManageEventGallery, useEventPhotoCounts, useUnlinkedEventPhotos, useUpdateEventPhoto } from "@/hooks/useEventGallery";
import { usePulsenMe } from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

const RSVP: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "Ja" },
  { status: "maybe", label: "Måske" },
  { status: "not_attending", label: "Nej" },
];

function DateBadge({ date }: { date: string }) {
  const d = parseISO(date);
  return (
    <span className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-[12px] bg-[hsl(var(--cph-light-blue))]">
      <span className="text-[17px] font-extrabold leading-none tabular-nums">{format(d, "d")}</span>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] opacity-70">{format(d, "MMM", { locale: da }).replace(".", "")}</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>;
}

/** Storkbook → Begivenheder: Kommende, Afholdte og (ledere) fotos uden begivenhed. */
export function PulsenBegivenheder() {
  const me = usePulsenMe();
  const [addOpen, setAddOpen] = useState(false);
  const upcoming = useUpcomingCompanyEvents(200);
  const past = usePastCompanyEvents(20);
  const upcomingList = upcoming.data ?? [];
  const pastList = past.data ?? [];
  const { data: attendees = [] } = useEventAttendees(upcomingList.map((e) => e.id));
  const toggle = useToggleEventAttendance(me.employeeId);
  const counts = useEventPhotoCounts(pastList.map((e) => e.id));
  const canGallery = useCanManageEventGallery();
  const isGalleryLead = !!canGallery.data;
  const unlinked = useUnlinkedEventPhotos(isGalleryLead);
  const updatePhoto = useUpdateEventPhoto();
  const [valg, setValg] = useState<Record<string, string>>({});

  const countFor = (id: string, status: AttendanceStatus) => attendees.filter((a) => a.event_id === id && a.status === status).length;
  const mine = (id: string) => attendees.find((a) => a.event_id === id && a.employee_id === me.employeeId)?.status as AttendanceStatus | undefined;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 px-4 pb-16 md:px-0">
      <AddEventDialog open={addOpen} onOpenChange={setAddOpen} />
      {me.canManageEvents && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setAddOpen(true)}
            className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))]">
            Opret begivenhed
          </button>
        </div>
      )}

      <SectionTitle>Kommende</SectionTitle>
      {upcoming.isLoading ? <PulsenPostSkeleton /> : upcomingList.length === 0 ? (
        <PulsenEmpty icon={CalendarDays} title="Ingen kommende begivenheder" text="Når der er planlagt noget, står det her." />
      ) : (
        <ul className="flex flex-col gap-3">
          {upcomingList.map((e) => {
            const my = mine(e.id);
            const meta = [e.event_time ? `kl. ${e.event_time.slice(0, 5)}` : null, e.location].filter(Boolean).join(" · ");
            return (
              <li key={e.id} className="rounded-[24px] bg-card p-4">
                <div className="flex items-start gap-3">
                  <DateBadge date={e.event_date} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/storkbook/begivenhed/${e.id}`} className="block text-[17px] font-extrabold leading-tight text-foreground hover:underline">{e.title}</Link>
                    {meta && <p className="mt-0.5 text-[14px] text-muted-foreground">{meta}</p>}
                    <p className="mt-0.5 text-[14px] text-muted-foreground">
                      <span className="tabular-nums">{countFor(e.id, "attending")}</span> ja · <span className="tabular-nums">{countFor(e.id, "maybe")}</span> måske
                    </p>
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Dit svar til ${e.title}`} className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-[hsl(var(--cph-light-blue))] p-1">
                  {RSVP.map((o) => (
                    <button key={o.status} type="button" role="radio" aria-checked={my === o.status}
                      disabled={!me.employeeId || toggle.isPending}
                      onClick={() => toggle.mutate({ eventId: e.id, status: o.status })}
                      className={cn("min-h-[44px] rounded-full text-[14px] font-extrabold",
                        my === o.status ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground hover:bg-card")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle>Afholdte</SectionTitle>
      {past.isLoading ? <PulsenPostSkeleton /> : pastList.length === 0 ? (
        <p className="px-1 text-[15px] text-muted-foreground">Ingen afholdte begivenheder endnu.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pastList.map((e) => {
            const n = counts.data?.[e.id] ?? 0;
            return (
              <li key={e.id}>
                <Link to={`/storkbook/begivenhed/${e.id}`} className="flex min-h-[64px] items-center gap-3 rounded-[24px] bg-card p-3 hover:bg-[hsl(var(--cph-light-blue)/0.6)]">
                  <DateBadge date={e.event_date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-extrabold text-foreground">{e.title}</p>
                    <p className="text-[14px] text-muted-foreground"><span className="tabular-nums">{n}</span> {n === 1 ? "foto" : "fotos"}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isGalleryLead && (unlinked.data ?? []).length > 0 && (
        <>
          <SectionTitle>Fotos uden begivenhed</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(unlinked.data ?? []).map((ph) => (
              <li key={ph.id} className="flex flex-col gap-2 rounded-[24px] bg-card p-2">
                <div className="aspect-square overflow-hidden rounded-[14px] bg-muted">
                  {ph.url ? <img src={ph.url} alt={ph.title ?? ""} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>}
                </div>
                <Select disabled={updatePhoto.isPending || pastList.length === 0}
                  value={valg[ph.id] ?? ""}
                  onValueChange={(eventId) => {
                    setValg((v) => ({ ...v, [ph.id]: eventId }));
                    const ryd = () => setValg((v) => { const n = { ...v }; delete n[ph.id]; return n; });
                    updatePhoto.mutate({ id: ph.id, eventId }, {
                      onSuccess: ryd,
                      onError: () => { ryd(); toast.error("Kunne ikke knytte fotoet", { description: "Prøv igen." }); },
                    });
                  }}>
                  <SelectTrigger className="min-h-[44px] rounded-full border-0 bg-[hsl(var(--cph-light-blue))] text-[14px] font-extrabold" aria-label="Knyt til begivenhed">
                    <SelectValue placeholder="Knyt til begivenhed" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastList.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="min-h-[44px]">
                        {format(parseISO(e.event_date), "d. MMM yyyy", { locale: da })} · {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
