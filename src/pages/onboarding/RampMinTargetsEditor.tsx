import { useEffect, useState } from "react";
import { useCanEditRampMinTargets, useSetRampMinTargets } from "@/hooks/useRampTeam";

const LABELS = ["Uge 1", "Uge 2", "Uge 3", "Uge 4", "Uge 5 og frem"];

export function RampMinTargetsEditor({ targets }: { targets: number[] }) {
  const { data: canEdit } = useCanEditRampMinTargets();
  const save = useSetRampMinTargets();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    setValues(LABELS.map((_, i) => String(targets[Math.min(i, targets.length - 1)] ?? 0)));
  }, [targets]);

  if (!canEdit) return null;
  const parsed = values.map((v) => Number(v));
  const valid = parsed.every((n) => Number.isInteger(n) && n >= 0);

  return (
    <div className="rounded-[16px] bg-white px-5 py-3" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-[14px] font-extrabold"
        style={{ color: "#1b1f1d" }}
      >
        <span>Minimumskrav · salg pr. uge</span>
        <span className="text-[12px] font-bold" style={{ color: "#57635e" }}>
          {targets.join(" / ")} · {open ? "Luk" : "Ret"}
        </span>
      </button>
      {open && (
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
            Kravet fordeles på de 5 arbejdsdage i ugen (fx 5 salg = 1 pr. dag) og vises som stiplet streg i grafen.
            Grupper og alarmer ændres ikke.
          </p>
        </div>
      )}
    </div>
  );
}
