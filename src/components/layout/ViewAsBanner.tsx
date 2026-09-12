import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEndViewAs, useViewAsStatus } from "@/hooks/useViewAs";

/**
 * Permanent banner mens "se som" er aktiv. Kan ikke scrolles vaek.
 */
export function ViewAsBanner() {
  const { data: status } = useViewAsStatus();
  const endViewAs = useEndViewAs();

  if (!status?.active) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[200] bg-destructive text-destructive-foreground px-4 py-2 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Eye className="h-5 w-5 shrink-0" />
            <span className="font-medium truncate">
              Du ser Stork som <strong>{status.target_name ?? "en anden bruger"}</strong>. Læseadgang.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={endViewAs.isPending}
            onClick={() => endViewAs.mutate()}
          >
            <X className="h-4 w-4" />
            Afslut
          </Button>
        </div>
      </div>
      {/* Plads til banneret, saa indholdet ikke ligger under det */}
      <div className="h-11" aria-hidden />
    </>
  );
}
