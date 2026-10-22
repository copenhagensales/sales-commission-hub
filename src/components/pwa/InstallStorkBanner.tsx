import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallStork } from "@/hooks/useInstallStork";
import { InstallStorkGuide } from "./InstallStorkGuide";

/** Diskret kort øverst på Mit hjem. Ingen modal, tager aldrig fokus. */
export function InstallStorkBanner() {
  const s = useInstallStork();
  if (!s.mobile || s.standalone || s.dismissed) return null;
  if (!s.ios && !s.canPrompt) return null;

  return (
    <section aria-label="Læg Stork på din telefon" className="mb-4 flex items-start gap-3 rounded-3xl bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
        <Smartphone className="h-5 w-5 text-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-bold text-foreground">Læg Stork på din telefon</p>
        <InstallStorkGuide ios={s.ios} canPrompt={s.canPrompt} onInstall={s.install} />
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-muted-foreground" onClick={s.dismiss}>
        <X className="h-4 w-4" aria-hidden="true" /> Ikke nu
      </Button>
    </section>
  );
}
