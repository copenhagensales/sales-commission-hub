import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { ArrowLeft, Heart, ImagePlus, Link2, MapPin, Pencil, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { EditEventDialog } from "@/components/home/EditEventDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PulsenEmpty, PulsenError, PulsenPostSkeleton } from "@/components/pulsen/PulsenStates";
import {
  useCompanyEvent, useDeleteCompanyEvent, useEventAttendees, useToggleEventAttendance, type AttendanceStatus,
} from "@/hooks/useCompanyEvents";
import {
  useCanManageEventGallery, useDeleteEventPhoto, useEventGalleryForEvent, useEventPhotoLikes, useToggleEventPhotoLike, useUploadEventPhotos,
  type EventGalleryPhoto,
} from "@/hooks/useEventGallery";
import { usePulsenMe } from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

const BACK = "/storkbook?tab=begivenheder";
const RSVP: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "Ja" },
  { status: "maybe", label: "Måske" },
  { status: "not_attending", label: "Nej" },
];

type AttendeeRow = { id: string; event_id: string; employee_id: string; status: string; employee?: { first_name: string | null; last_name: string | null } | null };

/** Én begivenhed på egen adresse: /storkbook/begivenhed/:id – info, svar, deltagere og galleri. */
export default function StorkbookBegivenhed() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = usePulsenMe();
  const eventQ = useCompanyEvent(id);
  const event = eventQ.data ?? null;
  const { data: attendeesRaw = [] } = useEventAttendees(event ? [event.id] : []);
  const attendees = attendeesRaw as unknown as AttendeeRow[];
  const toggle = useToggleEventAttendance(me.employeeId);
  const deleteEvent = useDeleteCompanyEvent();
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = event ? `Storkbook · ${event.title}` : "Storkbook";
    return () => { document.title = prev; };
  }, [event]);

  const myStatus = attendees.find((a) => a.employee_id === me.employeeId)?.status as AttendanceStatus | undefined;
  const nameOf = (a: AttendeeRow) => `${a.employee?.first_name ?? ""} ${a.employee?.last_name ?? ""}`.trim() || "Ukendt";
  const group = (s: AttendanceStatus) => attendees.filter((a) => a.status === s).map(nameOf).sort((x, y) => x.localeCompare(y, "da"));

  const copyLink = () => {
    if (!event) return;
    navigator.clipboard.writeText(`${location.origin}/storkbook/begivenhed/${event.id}`)
      .then(() => toast.success("Link kopieret"), () => toast.error("Linket kunne ikke kopieres"));
  };

  const body = () => {
    if (eventQ.isLoading) return <PulsenPostSkeleton />;
    if (eventQ.isError) return <PulsenError onRetry={() => eventQ.refetch()} />;
    if (!event) {
      return (
        <PulsenEmpty icon={SearchX} title="Begivenheden findes ikke, eller du har ikke adgang" text="Den kan være slettet."
          action={<Link to="/storkbook" className="inline-flex min-h-[44px] items-center rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[15px] font-extrabold text-[hsl(var(--cph-light-blue))]">Til Storkbook</Link>} />
      );
    }
    const d = parseISO(event.event_date);
    const when = `${format(d, "EEEE d. MMMM yyyy", { locale: da })}${event.event_time ? ` kl. ${event.event_time.slice(0, 5)}` : ""}`;
    const yes = group("attending");
    const maybe = group("maybe");
    return (
      <>
        <article className="rounded-[24px] bg-card p-5">
          <p className="text-[14px] font-extrabold first-letter:uppercase text-muted-foreground">{when}</p>
          <h1 className="mt-1 break-words text-[24px] font-black leading-tight text-foreground">{event.title}</h1>
          {event.location && (
            <p className="mt-2 flex items-center gap-1.5 text-[15px] text-foreground"><MapPin className="h-4 w-4 flex-none" aria-hidden="true" />{event.location}</p>
          )}
          {event.description && <p className="mt-3 whitespace-pre-wrap break-words text-[16px] leading-[1.5] text-foreground">{event.description}</p>}

          <div role="radiogroup" aria-label="Dit svar" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {RSVP.map((o) => (
              <button key={o.status} type="button" role="radio" aria-checked={myStatus === o.status}
                disabled={!me.employeeId || toggle.isPending}
                onClick={() => toggle.mutate({ eventId: event.id, status: o.status })}
                className={cn("min-h-[44px] rounded-full text-[14px] font-extrabold",
                  myStatus === o.status ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]" : "text-foreground")}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-muted px-4 text-[14px] font-extrabold text-foreground active:opacity-80">
              <Link2 className="h-4 w-4" aria-hidden="true" /> Kopiér link
            </button>
            {me.canManageEvents && (
              <>
                <button type="button" onClick={() => setEditOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-muted px-4 text-[14px] font-extrabold text-foreground active:opacity-80">
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Redigér
                </button>
                <button type="button" disabled={deleteEvent.isPending}
                  onClick={() => deleteEvent.mutate(event.id, { onSuccess: () => navigate(BACK, { replace: true }) })}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-destructive/10 px-4 text-[14px] font-extrabold text-destructive active:opacity-80 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Slet
                </button>
              </>
            )}
          </div>
        </article>

        <section className="rounded-[24px] bg-card p-5" aria-label="Deltagere">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Ja · <span className="tabular-nums">{yes.length}</span></h2>
          {yes.length ? <ul className="mt-2 flex flex-wrap gap-2">{yes.map((n, i) => <li key={`y${i}`} className="rounded-full bg-[hsl(var(--cph-light-blue))] px-3 py-1.5 text-[14px] font-semibold text-foreground">{n}</li>)}</ul>
            : <p className="mt-2 text-[15px] text-muted-foreground">Ingen endnu.</p>}
          <h2 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Måske · <span className="tabular-nums">{maybe.length}</span></h2>
          {maybe.length ? <ul className="mt-2 flex flex-wrap gap-2">{maybe.map((n, i) => <li key={`m${i}`} className="rounded-full bg-muted px-3 py-1.5 text-[14px] font-semibold text-foreground">{n}</li>)}</ul>
            : <p className="mt-2 text-[15px] text-muted-foreground">Ingen endnu.</p>}
        </section>

        <EventGallerySection eventId={event.id} />
        <EditEventDialog event={editOpen ? event : null} open={editOpen} onOpenChange={setEditOpen} />
      </>
    );
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-8">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
          <Link to={BACK} className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full px-2 text-[15px] font-extrabold text-foreground hover:bg-card">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Storkbook
          </Link>
          {body()}
        </div>
      </div>
    </MainLayout>
  );
}

function EventGallerySection({ eventId }: { eventId: string }) {
  const photosQ = useEventGalleryForEvent(eventId);
  const photos = photosQ.data ?? [];
  const likes = useEventPhotoLikes(photos.map((p) => p.id));
  const toggleLike = useToggleEventPhotoLike();
  const canManage = !!useCanManageEventGallery().data;
  const upload = useUploadEventPhotos();
  const remove = useDeleteEventPhoto();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [zoom, setZoom] = useState<EventGalleryPhoto | null>(null);

  const onFiles = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    upload.mutate({ files: list, eventId }, {
      onSuccess: () => toast.success(list.length === 1 ? "Fotoet er tilføjet" : `${list.length} fotos er tilføjet`),
      onError: () => toast.error("Fotos blev ikke gemt"),
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!photosQ.isLoading && photos.length === 0 && !canManage) return null;

  return (
    <section className="rounded-[24px] bg-card p-5" aria-label="Galleri">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Galleri</h2>
        {canManage && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <button type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[hsl(var(--cph-onyx))] px-4 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-60 active:opacity-80">
              <ImagePlus className="h-4 w-4" aria-hidden="true" /> {upload.isPending ? "Gemmer …" : "Tilføj fotos"}
            </button>
          </>
        )}
      </div>
      {photosQ.isLoading ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-muted" />)}</div>
      ) : photos.length === 0 ? (
        <p className="mt-2 text-[15px] text-muted-foreground">Ingen fotos endnu.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {photos.map((ph) => {
            const l = likes.data?.[ph.id] ?? { count: 0, likedByMe: false };
            return (
              <li key={ph.id} className="relative">
                <button type="button" onClick={() => setZoom(ph)} aria-label="Vis fotoet i fuld størrelse" className="block aspect-square w-full overflow-hidden rounded-[14px] bg-muted active:opacity-90">
                  {ph.url && <img src={ph.url} alt={ph.title ?? ""} loading="lazy" className="h-full w-full object-cover" />}
                </button>
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                  <button type="button" aria-pressed={l.likedByMe} aria-label={l.likedByMe ? "Fjern synes godt om" : "Synes godt om"}
                    disabled={toggleLike.isPending} onClick={() => toggleLike.mutate({ photoId: ph.id, liked: l.likedByMe })}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-card/90 px-3 text-[13px] font-extrabold text-foreground">
                    <Heart className={cn("h-4 w-4", l.likedByMe && "fill-destructive text-destructive")} aria-hidden="true" />
                    <span className="tabular-nums">{l.count}</span>
                  </button>
                  {canManage && (
                    <button type="button" aria-label="Fjern foto" disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: ph.id, storage_path: ph.storage_path }, { onError: () => toast.error("Fotoet blev ikke fjernet") })}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-destructive">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-[min(96vw,1400px)] border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Foto fra begivenheden</DialogTitle>
          {zoom?.url && <img src={zoom.url} alt="" className="max-h-[90vh] w-full rounded-[18px] object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
