import { cn } from "@/lib/utils";

type Props = {
  variant?: "full" | "head";
  /** Kun for "full": "dark" = mørk bund, "light" = lys bund. */
  tone?: "dark" | "light";
  size?: number;
  /** Kun for "head": aktivt menupunkt (emerald bund) – næbbet følger da currentColor. */
  active?: boolean;
  className?: string;
};

const LB = "hsl(var(--cph-light-blue))";
const ONYX = "hsl(var(--cph-onyx))";
const EM = "hsl(var(--cph-emerald))";

/** Storkbook-logo. Dekorativt (aria-hidden). Hoved-varianten: krop følger currentColor; næb er emerald, men currentColor når aktiv. */
export function StorkbookMark({ variant = "full", tone = "light", size = 44, active = false, className }: Props) {
  if (variant === "head") {
    return (
      <svg viewBox="56 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
        <path d="M70 64 C80 46 78 30 82 22" stroke="currentColor" strokeWidth="11" fill="none" strokeLinecap="round" />
        <circle cx="84" cy="19" r="11" fill="currentColor" />
        <path d="M90 11 L120 25 L90 26 Z" fill={active ? "currentColor" : EM} />
      </svg>
    );
  }
  const dark = tone === "dark";
  const BODY = dark ? LB : ONYX;
  const WING = dark ? "#9fb0b5" : "#59606a";
  const EYE = dark ? ONYX : LB;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <path d="M22 62 C30 46 58 40 76 45 C84 47 86 56 80 62 C70 72 44 74 22 62 Z" fill={BODY} />
      <path d="M10 70 L30 60 C42 56 56 58 66 64 C54 72 30 74 10 70 Z" fill={WING} />
      <path d="M72 50 C82 42 78 30 82 22" stroke={BODY} strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="84" cy="19" r="8" fill={BODY} />
      <circle cx="86.5" cy="17" r="1.8" fill={EYE} />
      <path d="M90 14 L118 25 L90 23 Z" fill={EM} />
      <path d="M57 70 L57 112 M53 70 L46 88 L57 93 M57 112 L51 114 M57 112 L63 114" stroke={EM} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
