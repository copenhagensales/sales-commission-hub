import type { LucideIcon } from "lucide-react";
import { RotateCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PulsenEmpty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[24px] bg-card px-8 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[hsl(var(--cph-light-blue))]">
        <Icon className="h-7 w-7 text-foreground" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-[20px] font-extrabold text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-[16px] leading-relaxed text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PulsenError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-[24px] bg-card px-8 py-10 text-center">
      <h2 className="text-[18px] font-extrabold text-foreground">Storkbook kunne ikke hentes</h2>
      <p className="mt-1 text-[15px] text-muted-foreground">Tjek forbindelsen, og prøv igen.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))]"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Prøv igen
      </button>
    </div>
  );
}

export function PulsenPostSkeleton() {
  return (
    <div className="rounded-[24px] bg-card p-5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
    </div>
  );
}
