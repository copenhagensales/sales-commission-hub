import { useRef, useState } from "react";
import {
  ImagePlus,
  Trash2,
  Image as ImageIcon,
  Pencil,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useEventGalleryPhotos,
  useCanManageEventGallery,
  useUploadEventPhotos,
  useDeleteEventPhoto,
  useUpdateEventPhoto,
  useReorderEventPhotos,
  useEventPhotoLikes,
  useToggleEventPhotoLike,
  type EventGalleryPhoto,
  type PhotoLikeState,
} from "@/hooks/useEventGallery";

const SLOT_PLACEHOLDERS = ["Foto 1", "Foto 2", "Foto 3", "Foto 4"];

function PhotoSlot({
  photo,
  placeholder,
  canManage,
  canMoveBack,
  canMoveForward,
  onDelete,
  onAdd,
  onEdit,
  onMove,
  like,
  onToggleLike,
}: {
  photo?: EventGalleryPhoto;
  placeholder: string;
  canManage: boolean;
  canMoveBack?: boolean;
  canMoveForward?: boolean;
  onDelete: (photo: EventGalleryPhoto) => void;
  onAdd: () => void;
  onEdit: (photo: EventGalleryPhoto) => void;
  onMove: (photo: EventGalleryPhoto, direction: -1 | 1) => void;
  like?: PhotoLikeState;
  onToggleLike: (photo: EventGalleryPhoto, liked: boolean) => void;
}) {
  if (photo?.url) {
    return (
      <div className="group relative h-full w-full overflow-hidden rounded-xl bg-[hsl(var(--cph-light-blue)/0.06)]">
        <img
          src={photo.url}
          alt={photo.title || "Billede fra seneste event"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {(photo.title || photo.event_date) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[hsl(var(--cph-onyx)/0.72)] px-3 py-2 text-[12px] font-extrabold text-[hsl(var(--cph-light-blue))]">
            {photo.title}
            {photo.event_date && (
              <span className="ml-1 font-normal opacity-75">
                · {format(parseISO(photo.event_date), "d. MMM", { locale: da })}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onToggleLike(photo, !!like?.likedByMe)}
          aria-label={like?.likedByMe ? "Fjern like" : "Like billedet"}
          className="absolute left-2 top-2 flex items-center gap-1.5 rounded-xl bg-[hsl(var(--cph-onyx)/0.8)] px-2.5 py-1.5 text-[12px] font-extrabold text-[hsl(var(--cph-light-blue))] transition-colors hover:bg-[hsl(var(--cph-onyx)/0.95)]"
        >
          <Heart
            className={
              like?.likedByMe
                ? "h-3.5 w-3.5 fill-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-emerald))]"
                : "h-3.5 w-3.5"
            }
          />
          <span className="tabular-nums">{like?.count ?? 0}</span>
        </button>
        {canManage && (
          <div className="absolute right-2 top-2 flex flex-wrap items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onMove(photo, -1)}
              disabled={!canMoveBack}
              aria-label="Flyt billedet frem i rækkefølgen"
              className="rounded-lg bg-[hsl(var(--cph-onyx)/0.8)] p-1.5 text-[hsl(var(--cph-light-blue))] disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(photo, 1)}
              disabled={!canMoveForward}
              aria-label="Flyt billedet tilbage i rækkefølgen"
              className="rounded-lg bg-[hsl(var(--cph-onyx)/0.8)] p-1.5 text-[hsl(var(--cph-light-blue))] disabled:opacity-30"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(photo)}
              aria-label="Rediger billedet"
              className="rounded-lg bg-[hsl(var(--cph-onyx)/0.8)] p-1.5 text-[hsl(var(--cph-light-blue))]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(photo)}
              aria-label="Fjern billede"
              className="rounded-lg bg-[hsl(var(--cph-onyx)/0.8)] p-1.5 text-[hsl(var(--cph-light-blue))]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={canManage ? onAdd : undefined}
      disabled={!canManage}
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[hsl(var(--cph-light-blue)/0.25)] bg-[hsl(var(--cph-light-blue)/0.06)] px-2 py-3 text-center text-[11px] text-[hsl(var(--cph-light-blue)/0.6)] transition-colors enabled:hover:bg-[hsl(var(--cph-light-blue)/0.12)]"
    >
      {canManage ? (
        <ImagePlus className="h-4 w-4" />
      ) : (
        <ImageIcon className="h-4 w-4" />
      )}
      <span>{placeholder}</span>
    </button>
  );
}

export function EventGallery() {
  const { data: photos = [] } = useEventGalleryPhotos(4);
  const { data: canManage = false } = useCanManageEventGallery();
  const uploadMutation = useUploadEventPhotos();
  const deleteMutation = useDeleteEventPhoto();
  const updateMutation = useUpdateEventPhoto();
  const reorderMutation = useReorderEventPhotos();
  const { data: likes = {} } = useEventPhotoLikes(photos.map((p) => p.id));
  const toggleLikeMutation = useToggleEventPhotoLike();

  const handleToggleLike = (photo: EventGalleryPhoto, liked: boolean) => {
    toggleLikeMutation.mutate(
      { photoId: photo.id, liked },
      { onError: () => toast.error("Kunne ikke gemme dit like") }
    );
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [editPhoto, setEditPhoto] = useState<EventGalleryPhoto | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  const openDialog = () => {
    setFiles([]);
    setTitle("");
    setEventDate("");
    setDialogOpen(true);
  };

  const openEdit = (photo: EventGalleryPhoto) => {
    setEditPhoto(photo);
    setEditTitle(photo.title || "");
    setEditDate(photo.event_date || "");
  };

  const handleSaveEdit = () => {
    if (!editPhoto) return;
    updateMutation.mutate(
      { id: editPhoto.id, title: editTitle, eventDate: editDate },
      {
        onSuccess: () => {
          toast.success("Billedet er opdateret");
          setEditPhoto(null);
        },
        onError: () => toast.error("Kunne ikke opdatere billedet"),
      }
    );
  };

  const handleMove = (photo: EventGalleryPhoto, direction: -1 | 1) => {
    const currentIndex = photos.findIndex((p) => p.id === photo.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= photos.length) return;

    const ordered = photos.map((p) => p.id);
    [ordered[currentIndex], ordered[targetIndex]] = [
      ordered[targetIndex],
      ordered[currentIndex],
    ];

    reorderMutation.mutate(ordered, {
      onSuccess: () => toast.success("Rækkefølgen er gemt"),
      onError: () => toast.error("Kunne ikke ændre rækkefølgen"),
    });
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    uploadMutation.mutate(
      { files, title, eventDate },
      {
        onSuccess: () => {
          toast.success(
            files.length === 1 ? "Billede uploadet" : `${files.length} billeder uploadet`
          );
          setDialogOpen(false);
          setFiles([]);
        },
        onError: () => toast.error("Kunne ikke uploade billederne"),
      }
    );
  };

  const handleDelete = (photo: EventGalleryPhoto) => {
    deleteMutation.mutate(
      { id: photo.id, storage_path: photo.storage_path },
      {
        onSuccess: () => toast.success("Billede fjernet"),
        onError: () => toast.error("Kunne ikke fjerne billedet"),
      }
    );
  };

  // Vis mindst 4 felter, ellers alle billeder i vandret scroll
  const slots =
    photos.length >= SLOT_PLACEHOLDERS.length
      ? photos.map((photo, index) => ({
          photo,
          placeholder: `Foto ${index + 1}`,
        }))
      : SLOT_PLACEHOLDERS.map((placeholder, index) => ({
          placeholder,
          photo: photos[index],
        }));

  const scrollByCards = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[hsl(var(--cph-onyx))] p-5 text-[hsl(var(--cph-light-blue))] md:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--cph-light-blue)/0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--cph-light-blue)/0.03) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[14px] font-extrabold">
          <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-emerald))]" />
          Seneste event
        </h2>
        <div className="flex items-center gap-2">
          {photos.length > SLOT_PLACEHOLDERS.length && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                aria-label="Vis tidligere billeder"
                className="rounded-xl bg-[hsl(var(--cph-light-blue)/0.12)] p-2 text-[hsl(var(--cph-light-blue))] transition-colors hover:bg-[hsl(var(--cph-light-blue)/0.22)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCards(1)}
                aria-label="Vis flere billeder"
                className="rounded-xl bg-[hsl(var(--cph-light-blue)/0.12)] p-2 text-[hsl(var(--cph-light-blue))] transition-colors hover:bg-[hsl(var(--cph-light-blue)/0.22)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {canManage && (
            <Button
              onClick={openDialog}
              className="h-auto gap-2 rounded-xl bg-[hsl(var(--cph-light-blue))] px-3.5 py-2 text-[13px] font-extrabold text-[hsl(var(--cph-onyx))] hover:bg-white"
            >
              <ImagePlus className="h-4 w-4" />
              Læg billeder op
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {slots.map((slot, index) => (
          <div
            key={slot.photo?.id ?? `slot-${index}`}
            className="aspect-[4/3] w-[calc(50%-5px)] shrink-0 snap-start md:w-[calc(25%-8px)]"
          >
            <PhotoSlot
              photo={slot.photo}
              placeholder={slot.placeholder}
              canManage={canManage}
              canMoveBack={index > 0}
              canMoveForward={index + 1 < photos.length}
              onDelete={handleDelete}
              onAdd={openDialog}
              onEdit={openEdit}
              onMove={handleMove}
              like={slot.photo ? likes[slot.photo.id] : undefined}
              onToggleLike={handleToggleLike}
            />
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Læg billeder op</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-files">Billeder *</Label>
              <Input
                id="gallery-files"
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {files.length} fil(er) valgt
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-title">Titel</Label>
              <Input
                id="gallery-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fx Firmadag hos Suitclub"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-date">Dato for begivenheden</Label>
              <Input
                id="gallery-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploader..." : "Læg op"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPhoto} onOpenChange={(open) => !open && setEditPhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger billede</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-edit-title">Titel</Label>
              <Input
                id="gallery-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Fx Firmadag hos Suitclub"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-edit-date">Dato for begivenheden</Label>
              <Input
                id="gallery-edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}
