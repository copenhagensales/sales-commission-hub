import { useEffect, useState } from "react";
import { useCanEditRampMinTargets, useSetRampMinTargets } from "@/hooks/useRampTeam";

const LABELS = ["Uge 1", "Uge 2", "Uge 3", "Uge 4", "Uge 5+"];

/** Forventning pr. opstartsuge. Alle med adgang til siden ser den; kun ejere kan rette. */
export function RampMinTargetsEditor({ targets }: { targets: number[] }) {
  const { data: canEdit } = useCanEditRampMinTargets();
  const save = useSetRampMinTargets();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    setValues(LABELS.map((_, i) => String(targets[Math.min(i, targets.length - 1)] ?? 0)));
  }, [targets]);

  const parsed = values.map((v) => Number(v));
  const valid = parsed.every((n) => Number.isInteger(n) && n >= 0);
  const shown = LABELS.map((l, i) => ({ l, v: targets[Math.min(i, targets.length - 1)] ?? 0 }));

  return (
    <div className="rounded-[12px] px-4 py-2.5" style={{ background: "#f6f8f7" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="font-extrabold" style={{ color: "#1b1f1d" }}>
          Forventning · salg pr. uge
        </span>
        <span className="font-semibold tabular-nums" style={{ color: "#3c4743" }}>
          {shown.map((s, i) => (
            <span key={s.l}>
              {i > 0 && " · "}
              {s.l} <strong>{s.v}</strong>
            </span>
          ))}
        </span>
        {canEdit && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ background: "#ffffff", color: "#1b1f1d" }}
          >
            {open ? "Luk" : "Ret"}
          </button>
        )}
      </div>
      {canEdit && open && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {LABELS.map((l, i) => (
            <label key={l} className="grid gap-1 text-[12px] font-bold" style={{ color: "#57635e" }}>
              {l}
              <input
                type="number"
                min={0}
                step={1}
                value={values[i] ?? ""}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-24 rounded-md border px-2 py-1.5 text-[14px] font-bold"
                style={{ color: "#1b1f1d", borderColor: "#d7e0dc" }}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate(parsed)}
            className="rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-50"
            style={{ background: "#1b1f1d", color: "#ffffff" }}
          >
            {save.isPending ? "Gemmer…" : "Gem"}
          </button>
          <p className="basis-full text-[12px] font-semibold" style={{ color: "#57635e" }}>
            Kravet fordeles på de 5 arbejdsdage i ugen (fx 5 salg = 1 pr. dag). Grafen, grupperne og alarmerne på dag 10 og
            15 måles mod det.
          </p>
        </div>
      )}
    </div>
  );
}
