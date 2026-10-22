import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MilestoneBarProps {
  icon: LucideIcon;
  tone?: "emerald" | "onyx";
  children: ReactNode;
  time: string;
  /** Kompakt reaktionsknap (kun Huset-milepæle har reaktioner). */
  reaction?: ReactNode;
}

/** Lille milepælslinje i feedet. Data kommer i trin 6. */
export function MilestoneBar({ icon: Icon, tone = "emerald", children, time, reaction }: MilestoneBarProps) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 rounded-[18px] bg-card px-2.5 py-2">
      <span
        className={cn(
          "flex h-9 w-9 flex-none items-center justify-center rounded-[12px]",
          tone === "emerald"
            ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]"
            : "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-emerald))]"
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 truncate text-[15px] text-foreground [&_b]:font-extrabold [&_b]:tabular-nums">
        {children} <span className="text-muted-foreground">· {time}</span>
      </p>
      {reaction && <div className="flex-none">{reaction}</div>}
    </div>
  );
}
