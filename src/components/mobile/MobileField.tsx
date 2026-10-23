import { ReactNode, useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MobileFieldKind = "text" | "number" | "decimal" | "tel" | "email" | "date" | "textarea" | "select";

const INPUT_PROPS: Record<Exclude<MobileFieldKind, "textarea" | "select">, { type: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string }> = {
  text: { type: "text" },
  number: { type: "text", inputMode: "numeric" },
  decimal: { type: "text", inputMode: "decimal" },
  tel: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  email: { type: "email", inputMode: "email", autoComplete: "email" },
  date: { type: "date" },
};

interface MobileFieldProps {
  label: string;
  kind?: MobileFieldKind;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  /** Kun for kind="select": valgmuligheder. */
  options?: { value: string; label: string }[];
  name?: string;
  disabled?: boolean;
  right?: ReactNode;
}

/** Formularfelt med rigtigt tastatur pr. felttype, skrift ≥ 16 px på telefon og fejltekst ved feltet. */
export function MobileField({ label, kind = "text", value, onChange, error, hint, required, placeholder, options = [], name, disabled, right }: MobileFieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const common = {
    id,
    name,
    disabled,
    required,
    placeholder,
    "aria-invalid": !!error || undefined,
    "aria-describedby": error || hint ? msgId : undefined,
    className: cn("min-h-[44px] text-base md:text-sm", error && "border-destructive"),
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[14px]">{label}{required && <span aria-hidden> *</span>}</Label>
        {right}
      </div>
      {kind === "textarea" ? (
        <Textarea {...common} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : kind === "select" ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}
          className={cn("flex w-full rounded-md border border-input bg-background px-3 py-2", common.className)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input {...common} {...INPUT_PROPS[kind]} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {(error || hint) && (
        <p id={msgId} className={cn("text-[14px]", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
