import { Share } from "lucide-react";
import { useInstallStork } from "@/hooks/useInstallStork";

/** Forklarer på iPhone, at push kræver »Føj til hjemmeskærm« (iOS 16.4+). Viser intet, når appen er installeret. */
export function InstallHint() {
  const { ios, standalone } = useInstallStork();
  if (standalone || !ios) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-[15px]" role="note">
      <p className="font-semibold">Notifikationer på iPhone</p>
      <p className="mt-1 text-muted-foreground">
        Tryk på <Share className="inline h-4 w-4 align-text-bottom" aria-label="Del" /> og vælg »Føj til hjemmeskærm«.
        Åbn derefter Stork fra ikonet og slå notifikationer til. Kræver iOS 16.4 eller nyere. Stork virker fuldt uden.
      </p>
    </div>
  );
}
