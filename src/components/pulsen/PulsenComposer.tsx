import { useEffect, useRef, useState } from "react";
import { BarChart3, CalendarPlus, Plus, HandHeart, HelpCircle, ImagePlus, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useActiveColleagues, useOpretAfstemning, type NewPulsenPost } from "@/hooks/usePulsen";
import { PULSEN_IMAGE_MAX_BYTES, PULSEN_MAX_CHARS, showCharCounter } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";
import { OmtaleFelt } from "./OmtaleFelt";
import { erOmtaleFejl, type Omtale } from "./omtaler";

export type Mode = "post" | "praise" | "question" | "poll";

const POLL_MAX_OPTIONS = 6;
const POLL_OPTION_MAX = 80;
const DURATIONS = [
  { dage: 1, label: "1 dag" },
  { dage: 3, label: "3 dage" },
  { dage: 7, label: "1 uge" },
  { dage: 14, label: "2 uger" },
];

interface Props {
  myEmployeeId: string;
  canPostHouse: boolean;
  canManageEvents: boolean;
  /** Fanen man står på bestemmer standard-målgruppen. */
  defaultAudience: "house" | "team";
  team: { id: string; name: string } | null;
  onSubmit: (input: NewPulsenPost, localPreviewUrl: string | null) => Promise<unknown>;
  onOpenEvent: () => void;
  /** Åbner composeren i en bestemt tilstand (fx fra forsiden: ?compose=praise). */
  initialMode?: Mode | "image" | null;
  initialBody?: string;
  /** Kaldes når feltet åbnes/lukkes. */
  onOpenChange?: (open: boolean) => void;
}

const MODES: { key: Mode; label: string; icon: typeof PenLine }[] = [
  { key: "post", label: "Indlæg", icon: PenLine },
  { key: "praise", label: "Ros", icon: HandHeart },
  { key: "question", label: "Spørgsmål", icon: HelpCircle },
  { key: "poll", label: "Afstemning", icon: BarChart3 },
];

export function PulsenComposer({ myEmployeeId, canPostHouse, canManageEvents, defaultAudience, team, onSubmit, onOpenEvent, initialMode, initialBody, onOpenChange }: Props) {
  const [open, setOpen] = useState(!!initialMode);
  const [mode, setMode] = useState<Mode>(initialMode && initialMode !== "image" ? initialMode : "post");
  const [body, setBody] = useState(initialBody ?? "");
  const [mentions, setMentions] = useState<Omtale[]>([]);
  const [audience, setAudience] = useState<"house" | "team">(defaultAudience);
  const [praised, setPraised] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDage, setPollDage] = useState(7);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const opretAfstemning = useOpretAfstemning();
  useEffect(() => {
    if (initialMode === "image") fileRef.current?.click();
  }, [initialMode]);
  useEffect(() => {
    onOpenChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
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
    setBody(""); setMentions([]); setPraised([]); setFile(null); setPreview(null); setMode("post"); setOpen(false);
    setPollOptions(["", ""]); setPollDage(7); setPollAnonymous(false);
  };

  const pickMode = (m: Mode) => {
    setOpen(true);
    setMode(m);
    if (m === "poll") { setFile(null); setPreview(null); }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Vælg en billedfil");
    if (f.size > PULSEN_IMAGE_MAX_BYTES) return toast.error("Billedet må højst fylde 10 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setOpen(true);
  };

  const canSend =
    audiences.length > 0 &&
    !busy &&
    body.length <= PULSEN_MAX_CHARS &&
    (mode === "question" || mode === "poll" ? body.trim().length > 0 : body.trim().length > 0 || !!file) &&
    (mode !== "praise" || praised.length > 0);

  const sendPoll = async () => {
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!body.trim()) return toast.error("Skriv et spørgsmål");
    if (options.length < 2) return toast.error("Udfyld mindst 2 svar");
    if (options.length > POLL_MAX_OPTIONS) return toast.error(`Højst ${POLL_MAX_OPTIONS} svar`);
    if (options.some((o) => o.length > POLL_OPTION_MAX)) return toast.error(`Et svar må højst være ${POLL_OPTION_MAX} tegn`);
    setBusy(true);
    try {
      await opretAfstemning.mutateAsync({
        audience,
        teamId: audience === "team" ? team?.id ?? null : null,
        body,
        options,
        anonymous: pollAnonymous,
        dage: pollDage,
        mentions,
      });
      reset();
    } catch (e) {
      if (erOmtaleFejl(e)) { toast.error("Omtalen kunne ikke gemmes"); return; }
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Prøv igen";
      toast.error("Afstemningen blev ikke delt", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (mode === "poll") return sendPoll();
    if (!canSend) return;
    setBusy(true);
    const input: NewPulsenPost = {
      audience,
      teamId: audience === "team" ? team?.id ?? null : null,
      postType: mode as Exclude<Mode, "poll">,
      body,
      praised: mode === "praise" ? praised : null,
      imageFile: file,
      mentions,
    };
    const localUrl = preview;
    reset();
    try {
      await onSubmit(input, localUrl);
    } catch (e) {
      if (erOmtaleFejl(e)) {
        // Feltet beholder teksten.
        setOpen(true); setMode(input.postType === "image" ? "post" : input.postType); setBody(input.body); setMentions(input.mentions ?? []);
        if (input.praised) setPraised(input.praised);
        toast.error("Omtalen kunne ikke gemmes");
        if (localUrl) URL.revokeObjectURL(localUrl);
        return;
      }
      toast.error("Indlægget blev ikke delt", { description: e instanceof Error ? e.message : "Prøv igen" });
      if (localUrl) URL.revokeObjectURL(localUrl);
    } finally {
      setBusy(false);
    }
  };

  if (audiences.length === 0) return null;

  return (
    <section aria-label="Skriv i Storkbook" className="rounded-[24px] bg-card p-5">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-[52px] w-full items-center rounded-[18px] bg-[hsl(var(--cph-light-blue))] px-4 text-left text-[16px] text-muted-foreground">
          Del noget med {defaultAudience === "team" && team ? team.name : "huset"} …
        </button>
      ) : (
        <div>
          {mode === "praise" && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {praised.map((c) => (
                <span key={c.id} className="flex min-h-[40px] items-center gap-1 rounded-full bg-[hsl(var(--cph-praise))] pl-4 pr-1 text-[14px] font-extrabold text-[hsl(var(--cph-praise-foreground))]">
                  {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
                  <button type="button" aria-label={`Fjern ${c.first_name ?? ""}`} onClick={() => setPraised((l) => l.filter((x) => x.id !== c.id))} className="flex h-8 w-8 items-center justify-center rounded-full">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {praised.length < 10 && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="flex min-h-[40px] items-center gap-2 rounded-full bg-[hsl(var(--cph-light-blue))] px-4 text-[14px] font-extrabold text-foreground">
                      <HandHeart className="h-4 w-4" aria-hidden="true" />
                      {praised.length ? "Tilføj kollega" : "Vælg kollega"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 rounded-2xl p-0">
                    <Command>
                      <CommandInput placeholder="Søg kollega …" />
                      <CommandList>
                        <CommandEmpty>{colleagues.isLoading ? "Henter …" : "Ingen fundet"}</CommandEmpty>
                        {(colleagues.data ?? []).filter((c) => c.id !== myEmployeeId && !praised.some((p) => p.id === c.id)).map((c) => (
                          <CommandItem key={c.id} value={`${c.first_name} ${c.last_name} ${c.id}`} onSelect={() => { setPraised((l) => [...l, c]); setPickerOpen(false); }}>
                            {c.first_name} {c.last_name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
          <OmtaleFelt
            autoFocus
            value={body}
            mentions={mentions}
            maxLength={PULSEN_MAX_CHARS}
            onChange={(t, m) => { setBody(t); setMentions(m); }}
            rows={4}
            placeholder={mode === "poll" ? "Hvad vil du spørge om?" : mode === "question" ? "Hvad vil du spørge huset om?" : mode === "praise" ? "Hvad har din kollega gjort godt?" : "Hvad vil du dele?"}
            aria-label="Tekst"
          />
          {mode === "poll" && (
            <div className="mt-3 space-y-2">
              {pollOptions.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={o}
                    maxLength={POLL_OPTION_MAX}
                    onChange={(e) => setPollOptions((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Svar ${i + 1}`}
                    aria-label={`Svar ${i + 1}, højst ${POLL_OPTION_MAX} tegn`}
                    className="h-11 min-w-0 flex-1 rounded-[16px] bg-[hsl(var(--cph-light-blue))] px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" aria-label={`Fjern svar ${i + 1}`} onClick={() => setPollOptions((l) => l.filter((_, j) => j !== i))} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < POLL_MAX_OPTIONS && (
                <button type="button" onClick={() => setPollOptions((l) => [...l, ""])} className="flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[14px] font-extrabold text-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Tilføj svar
                </button>
              )}
              <div>
                <p className="mb-1 text-[13px] font-extrabold text-muted-foreground">Varighed</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Varighed">
                  {DURATIONS.map((d) => (
                    <button key={d.dage} type="button" role="radio" aria-checked={pollDage === d.dage} onClick={() => setPollDage(d.dage)}
                      className={cn("min-h-[44px] rounded-full px-4 text-[14px] font-extrabold", pollDage === d.dage ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "bg-[hsl(var(--cph-light-blue))] text-foreground")}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[13px] font-extrabold text-muted-foreground">Stemmer</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stemmer">
                  {[{ v: false, label: "Med navne" }, { v: true, label: "Anonym" }].map((x) => (
                    <button key={x.label} type="button" role="radio" aria-checked={pollAnonymous === x.v} onClick={() => setPollAnonymous(x.v)}
                      className={cn("min-h-[44px] rounded-full px-4 text-[14px] font-extrabold", pollAnonymous === x.v ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "bg-[hsl(var(--cph-light-blue))] text-foreground")}>
                      {x.label}
                    </button>
                  ))}
                </div>
                {pollAnonymous && (
                  <p className="mt-2 text-[14px] text-muted-foreground">Ingen kan se, hvem der stemte hvad – heller ikke dig. Anonyme stemmer kan ikke ændres.</p>
                )}
              </div>
            </div>
          )}
          {preview && (
            <div className="relative mt-3">
              <img src={preview} alt="Valgt billede" className="max-h-[320px] w-full rounded-[18px] object-cover" />
              <button type="button" aria-label="Fjern billede" onClick={() => { setFile(null); setPreview(null); }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>Del aldrig kundeoplysninger</span>
            {!preview && mode !== "poll" && (
              <button type="button" aria-label="Vedhæft billede" onClick={() => fileRef.current?.click()} className="ml-auto flex h-11 w-11 flex-none items-center justify-center rounded-full text-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
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
          {audiences.length > 1 ? (
            <button
              type="button"
              aria-label="Skift målgruppe"
              onClick={() => { const i = audiences.findIndex((a) => a.key === audience); setAudience(audiences[(i + 1) % audiences.length].key); }}
              className="min-h-[44px] rounded-full bg-[hsl(var(--cph-light-blue))] px-4 text-[14px] font-extrabold text-foreground"
            >
              Til: {audiences.find((a) => a.key === audience)?.label ?? audiences[0].label}
            </button>
          ) : (
            <span className="px-1 text-[14px] font-extrabold text-foreground">Til: {audiences[0].label}</span>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="min-h-[44px] rounded-full px-4 text-[14px] font-extrabold text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">Annullér</button>
            <button type="button" onClick={send} disabled={mode === "poll" ? busy || audiences.length === 0 : !canSend} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))] disabled:opacity-50">Del</button>
          </div>
        </div>
      )}
    </section>
  );
}
