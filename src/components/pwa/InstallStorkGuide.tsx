import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fælles vejledning (banner og profil). */
export function InstallStorkGuide({ ios, canPrompt, onInstall }: { ios: boolean; canPrompt: boolean; onInstall: () => void }) {
  if (ios) {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Tryk på Del-knappen <Share className="inline h-4 w-4 align-text-bottom" aria-label="Del" /> (firkant med pil op)</li>
        <li>Vælg <span className="font-semibold text-foreground">Føj til hjemmeskærm</span></li>
        <li>Tryk <span className="font-semibold text-foreground">Tilføj</span></li>
      </ol>
    );
  }
  if (canPrompt) {
    return (
      <Button size="sm" className="gap-2 rounded-full" onClick={onInstall}>
        <Download className="h-4 w-4" /> Installér Stork
      </Button>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Åbn browserens menu (⋮) og vælg <span className="font-semibold text-foreground">Installér app</span> eller <span className="font-semibold text-foreground">Føj til startskærm</span>.
    </p>
  );
}
