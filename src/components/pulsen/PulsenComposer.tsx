import { useEffect, useRef, useState } from "react";
import { CalendarPlus, HandHeart, HelpCircle, ImagePlus, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useActiveColleagues, type NewPulsenPost } from "@/hooks/usePulsen";
import { PULSEN_IMAGE_MAX_BYTES, PULSEN_MAX_CHARS, showCharCounter } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";

type Mode = "post" | "praise" | "question" | "image";

interface Props {
  myEmployeeId: string;
  canPostHouse: boolean;
  canManageEvents: boolean;
  /** Fanen man står på bestemmer standard-målgruppen. */
  defaultAudience: "house" | "team";
  team: { id: string; name: string } | null;
  onSubmit: (input: NewPulsenPost, localPreviewUrl: string | null) => Promise<unknown>;
  onOpenEvent: () => void;
}

const MODES: { key: Mode; label: string; icon: typeof PenLine }[] = [
  { key: "post", label: "Indlæg", icon: PenLine },
  { key: "praise", label: "Ros", icon: HandHeart },
  { key: "question", label: "Spørgsmål", icon: HelpCircle },
  { key: "image", label: "Billede", icon: ImagePlus },
];

export function PulsenComposer({ myEmployeeId, canPostHouse, canManageEvents, defaultAudience, team, onSubmit, onOpenEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("post");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"house" | "team">(defaultAudience);
  const [praised, setPraised] = useState<{ id: string; first_name: string | null; last_name: string | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const colleagues = useActiveColleagues(open && mode === "praise");

  const audiences: { key: "house" | "team"; label: string }[] = [
    ...(canPostHouse ? [{ key: "house" as const, label: "Huset" }] : []),
    ...(team ? [{ key: "team" as const, label: team.name }] : []),
  ];
  useEffect(() => {
    const allowed = audiences.map((a) => a.key);
    setAudience(allowed.includes(defaultAudience) ? defaultAudience : allowed[0] ?? "house");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAudience, canPostHouse, team?.id]);

  const reset = () => {
    setBody(""); setPraised(null); setFile(null); setPreview(null); setMode("post"); setOpen(false);
  };

  const pickMode = (m: Mode) => {
    setOpen(true);
    setMode(m);
    if (m === "image") fileRef.current?.click();
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Vælg en billedfil");
    if (f.size > PULSEN_IMAGE_MAX_BYTES) return toast.error("Billedet må højst fylde 10 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode("image");
    setOpen(true);
  };

  const canSend =
    audiences.length > 0 &&
    !busy &&
    body.length <= PULSEN_MAX_CHARS &&
    (mode === "image" ? !!file : body.trim().length > 0) &&
    (mode !== "praise" || !!praised);

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    const input: NewPulsenPost = {
      audience,
      teamId: audience === "team" ? team?.id ?? null : null,
      postType: mode,
      body,
      praised: mode === "praise" ? praised : null,
      imageFile: mode === "image" ? file : null,
    };
    const localUrl = preview;
    reset();
    try {
      await onSubmit(input, localUrl);
    } catch (e) {
      toast.error("Indlægget blev ikke delt", { description: e instanceof Error ? e.message : "Prøv igen" });
      if (localUrl) URL.revokeObjectURL(localUrl);
    } finally {
      setBusy(false);
    }
  };

  if (audiences.length === 0) return null;

  return (
    <section aria-label="Skriv i Pulsen" className="rounded-[24px] bg-card p-5">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-[52px] w-full items-center rounded-[18px] bg-[hsl(var(--cph-light-blue))] px-4 text-left text-[16px] text-muted-foreground">
          Del noget med {defaultAudience === "team" && team ? team.name : "huset"} …
        </button>
      ) : (
        <div>
          {mode === "praise" && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="mb-3 flex min-h-[44px] items-center gap-2 rounded-full bg-[hsl(var(--cph-praise))] px-4 text-[14px] font-extrabold text-[hsl(var(--cph-praise-foreground))]">
                  <HandHeart className="h-4 w-4" aria-hidden="true" />
                  {praised ? `Ros til ${praised.first_name ?? ""} ${praised.last_name ?? ""}`.trim() : "Vælg kollega"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 rounded-2xl p-0">
                <Command>
                  <CommandInput placeholder="Søg kollega …" />
                  <CommandList>
                    <CommandEmpty>{colleagues.isLoading ? "Henter …" : "Ingen fundet"}</CommandEmpty>
                    {(colleagues.data ?? []).filter((c) => c.id !== myEmployeeId).map((c) => (
                      <CommandItem key={c.id} value={`${c.first_name} ${c.last_name} ${c.id}`} onSelect={() => { setPraised(c); setPickerOpen(false); }}>
                        {c.first_name} {c.last_name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <textarea
            autoFocus
            value={body}
            maxLength={PULSEN_MAX_CHARS}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={mode === "question" ? "Hvad vil du spørge huset om?" : mode === "praise" ? "Hvad har din kollega gjort godt?" : "Hvad vil du dele?"}
            aria-label="Tekst"
            className="w-full resize-y rounded-[18px] bg-[hsl(var(--cph-light-blue))] px-4 py-3 text-[17px] leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {preview && (
            <div className="relative mt-3">
              <img src={preview} alt="Valgt billede" className="max-h-[320px] w-full rounded-[18px] object-cover" />
              <button type="button" aria-label="Fjern billede" onClick={() => { setFile(null); setPreview(null); setMode("post"); }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>Del aldrig kundeoplysninger</span>
            {showCharCounter(body.length) && <span className="tabular-nums">{body.length}/{PULSEN_MAX_CHARS}</span>}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => pickMode(key)}
            aria-pressed={open && mode === key}
            className={cn(
              "flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[14px] font-extrabold transition-colors",
              open && mode === key ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground hover:bg-[hsl(var(--cph-light-blue))]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
        {canManageEvents && (
          <button type="button" onClick={onOpenEvent} className="flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[14px] font-extrabold text-foreground hover:bg-[hsl(var(--cph-light-blue))]">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Begivenhed
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div role="radiogroup" aria-label="Målgruppe" className="flex rounded-full bg-[hsl(var(--cph-light-blue))] p-1">
            {audiences.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={audience === a.key}
                onClick={() => setAudience(a.key)}
                className={cn("min-h-[40px] rounded-full px-4 text-[13px] font-extrabold", audience === a.key ? "bg-card text-foreground" : "text-muted-foreground")}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="min-h-[44px] rounded-full px-4 text-[14px] font-extrabold text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">Annullér</button>
            <button type="button" onClick={send} disabled={!canSend} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))] disabled:opacity-50">Del</button>
          </div>
        </div>
      )}
    </section>
  );
}
