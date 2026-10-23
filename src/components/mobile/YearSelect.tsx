import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./BottomSheet";
import { useIsPhone } from "./useIsPhone";

interface YearSelectProps {
  value: number;
  years: number[];
  onChange: (year: number) => void;
  /** Klasser til computerens SelectTrigger (uændret layout ≥ 768 px). */
  triggerClassName?: string;
  title?: string;
}

/** Årsvælger: computer = almindelig Select; telefon = skuffe fra bunden med 44 px rækker. */
export function YearSelect({ value, years, onChange, triggerClassName, title = "Vælg år" }: YearSelectProps) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);

  if (!isPhone) {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${title}: ${value}`}
        className="min-h-11 gap-2 justify-start">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span>{value}</span>
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title={title}>
        <div className="flex flex-col gap-1">
          {years.map((y) => (
            <button key={y} type="button" aria-pressed={y === value}
              onClick={() => { onChange(y); setOpen(false); }}
              className={cn("min-h-11 w-full rounded-lg px-3 text-left text-base active:bg-accent", y === value && "bg-accent font-semibold")}>
              {y}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
