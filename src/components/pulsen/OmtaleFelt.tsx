import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useActiveColleagues, usePulsenTeams } from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";
import { OMTALER_MAX, OMTALE_NAVN_MAX, rensOmtaler, type Omtale } from "./omtaler";

interface Props {
  value: string;
  mentions: Omtale[];
  onChange: (tekst: string, mentions: Omtale[]) => void;
  /** Grænsen gælder teksten inkl. »@Navn«. */
  maxLength: number;
  placeholder?: string;
  "aria-label": string;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
  className?: string;
  /** Kaldes for taster, vælgeren ikke selv bruger (fx Enter = send i kommentarer). */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

type Kandidat = { t: "e" | "t"; id: string; navn: string };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Finder et aktivt »@præfiks« lige før markøren (ved linjestart eller efter mellemrum). */
function findAktiv(tekst: string, caret: number): { start: number; q: string } | null {
  const foer = tekst.slice(0, caret);
  const m = /(^|\s)@([^@\n]{0,30})$/.exec(foer);
  if (!m) return null;
  return { start: caret - m[2].length - 1, q: m[2] };
}

/** Tekstfelt med @-omtaler af kolleger og teams. Vælgeren vises under feltet. */
export function OmtaleFelt({ value, mentions, onChange, maxLength, placeholder, disabled, autoFocus, rows = 4, className, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [aktiv, setAktiv] = useState<{ start: number; q: string } | null>(null);
  const [valgt, setValgt] = useState(0);
  const [dublet, setDublet] = useState(false);
  const kolleger = useActiveColleagues(true);
  const teams = usePulsenTeams();
  const listeId = useMemo(() => `omtaler-${Math.random().toString(36).slice(2)}`, []);

  const kandidater: Kandidat[] = useMemo(() => {
    if (!aktiv) return [];
    const q = norm(aktiv.q.trim());
    const passer = (navn: string) => !q || norm(navn).startsWith(q) || norm(navn).split(/\s+/).some((w) => w.startsWith(q));
    const brugt = new Set(mentions.map((m) => `${m.t}:${m.id}`));
    const t: Kandidat[] = (teams.data ?? []).map((x) => ({ t: "t" as const, id: x.id, navn: x.name.trim().slice(0, OMTALE_NAVN_MAX) }));
    const e: Kandidat[] = (kolleger.data ?? []).map((x) => ({
      t: "e" as const, id: x.id, navn: `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim().slice(0, OMTALE_NAVN_MAX),
    }));
    return [...t, ...e].filter((k) => k.navn && !brugt.has(`${k.t}:${k.id}`) && passer(k.navn)).slice(0, 8);
  }, [aktiv, teams.data, kolleger.data, mentions]);

  const fuld = mentions.length >= OMTALER_MAX;
  const aaben = !!aktiv && (fuld || dublet || kandidater.length > 0);

  const opdaterAktiv = (tekst: string, caret: number) => {
    const a = findAktiv(tekst, caret);
    setAktiv((f) => (f && a && f.start === a.start && f.q === a.q ? f : a));
    if (!a || !aktiv || a.start !== aktiv.start) setValgt(0);
    setDublet(false);
  };

  // Omtaleområdet følger markøren (piletaster, Home/End, klik, mobilmarkør).
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const vedSkift = () => {
      const el = ref.current;
      if (!el || document.activeElement !== el) return;
      const a = findAktiv(valueRef.current, el.selectionStart ?? valueRef.current.length);
      setAktiv((f) => (f && a && f.start === a.start && f.q === a.q ? f : a));
    };
    document.addEventListener("selectionchange", vedSkift);
    return () => document.removeEventListener("selectionchange", vedSkift);
  }, []);

  const skift = (tekst: string, caret: number) => {
    onChange(tekst, rensOmtaler(tekst, mentions));
    opdaterAktiv(tekst, caret);
  };

  const vaelg = (k: Kandidat) => {
    if (!aktiv || fuld) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    // Validér umiddelbart før indsættelse: teksten fra start til markør skal stadig være »@præfiks«.
    const nu = findAktiv(value, caret);
    if (!nu || nu.start !== aktiv.start || (el && el.selectionEnd !== caret)) {
      setAktiv(null);
      return;
    }
    if (mentions.some((m) => m.navn === k.navn && !(m.t === k.t && m.id === k.id) && value.includes(`@${m.navn}`))) {
      setDublet(true);
      return;
    }
    const indsat = `@${k.navn} `;
    const ny = value.slice(0, aktiv.start) + indsat + value.slice(caret);
    if (ny.length > maxLength) {
      toast.error("Pladsen er brugt");
      return;
    }
    const pos = aktiv.start + indsat.length;
    const nyeOmtaler = rensOmtaler(ny, [...mentions.filter((m) => !(m.t === k.t && m.id === k.id)), { t: k.t, id: k.id, navn: k.navn }]);
    onChange(ny, nyeOmtaler);
    setAktiv(null);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(pos, pos);
    });
  };

  const tast = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME/composition: ingen vælger- eller send-genveje.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (aaben) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAktiv(null); return; }
      if (!fuld && kandidater.length) {
        if (e.key === "ArrowDown") { e.preventDefault(); setValgt((v) => (v + 1) % kandidater.length); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setValgt((v) => (v - 1 + kandidater.length) % kandidater.length); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); vaelg(kandidater[Math.min(valgt, kandidater.length - 1)]); return; }
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="min-w-0">
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={rest["aria-label"]}
        role="combobox"
        aria-expanded={aaben}
        aria-controls={aaben ? listeId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={aaben && !fuld && !dublet && kandidater[valgt] ? `${listeId}-${valgt}` : undefined}
        onChange={(e) => skift(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={tast}
        onClick={(e) => opdaterAktiv(value, e.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(e) => { if (!e.nativeEvent.isComposing && !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) opdaterAktiv(value, e.currentTarget.selectionStart ?? value.length); }}
        onBlur={() => window.setTimeout(() => setAktiv(null), 150)}
        className={cn(
          "w-full resize-y rounded-[18px] bg-[hsl(var(--cph-light-blue))] px-4 py-3 text-[17px] leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          className,
        )}
      />
      {aaben && (
        fuld || dublet ? (
          <p className="mt-1 rounded-[16px] bg-card px-4 py-3 text-[14px] text-muted-foreground" role="status">{fuld ? "Højst 10 omtaler" : "Navnet er allerede omtalt"}</p>
        ) : (
          <ul id={listeId} role="listbox" aria-label="Vælg kollega eller team" className="mt-1 overflow-hidden rounded-[16px] border border-border bg-card">
            {kandidater.map((k, i) => (
              <li
                key={`${k.t}:${k.id}`}
                id={`${listeId}-${i}`}
                role="option"
                aria-selected={i === valgt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => vaelg(k)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-2 px-4 text-[16px] text-foreground",
                  i === valgt && "bg-[hsl(var(--cph-light-blue))]",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{k.navn}</span>
                {k.t === "t" && <span className="flex-none text-[13px] font-extrabold text-muted-foreground">Team</span>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
