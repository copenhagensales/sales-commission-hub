import { Skeleton } from "@/components/ui/skeleton";

/** Skelet for et enkelt kort. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" aria-hidden>
      <Skeleton className="mb-3 h-5 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-4" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** Skelet for en liste af kort. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Indlæser …</span>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
    </div>
  );
}

/** Skelet for KPI-kort (stablet på telefon, gitter på computer). */
export function SkeletonKpi({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <Skeleton className="mb-3 h-3 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Suspense-fallback for sideskift: vises straks i stedet for en spinner. */
export function RouteSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-8">
      <SkeletonKpi />
      <SkeletonList count={4} />
    </div>
  );
}
