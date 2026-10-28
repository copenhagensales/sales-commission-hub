import { Button } from "@/components/ui/button";
import { X, FileIcon, Loader2 } from "lucide-react";
import type { FilMeta } from "@/lib/sbKladder";

/**
 * Valgt fil før afsendelse. Forhåndsvisning er altid en lokal blob-URL – aldrig en Storage-URL.
 * `file` er null efter reload (filbytes overlever ikke); kun en bekræftet upload kan sendes uden File.
 */
export interface LokalFil {
  file: File | null;
  name: string;
  type: string;
  size: number;
  previewUrl: string | null;
  uploader: boolean;
  sti?: string;
  trin: FilMeta["trin"];
  fejl?: string;
}

/** Kræver filen et nyt valg (ingen File og ingen bekræftet upload)? */
export const kraeverGenvalg = (f: LokalFil) => !f.file && !(f.trin === "uploadet" && f.sti);

interface AttachmentPreviewProps {
  fil: LokalFil;
  onRemove: () => void;
  onRetry?: () => void;
  onGenvalg?: () => void;
}

export function AttachmentPreview({ fil, onRemove, onRetry, onGenvalg }: AttachmentPreviewProps) {
  const genvalg = kraeverGenvalg(fil);
  return (
    <div className="px-2 md:px-4 py-2 border-t bg-muted/30">
      <div className="flex items-center gap-2 min-w-0">
        {fil.previewUrl ? (
          <img src={fil.previewUrl} alt={fil.name} width={64} height={64} className="h-16 w-16 shrink-0 object-cover rounded" />
        ) : (
          <div className="h-16 w-16 shrink-0 bg-muted rounded flex items-center justify-center">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fil.name}</p>
          {fil.uploader ? (
            <p className="text-[14px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploader …</p>
          ) : genvalg ? (
            <p className="text-[14px] text-destructive">Vælg filen igen</p>
          ) : fil.fejl ? (
            <p className="text-[14px] text-destructive">{fil.fejl}</p>
          ) : (
            <p className="text-[14px] text-muted-foreground">Klar til at sende</p>
          )}
        </div>
        {genvalg && onGenvalg ? (
          <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={onGenvalg}>Vælg filen igen</Button>
        ) : onRetry && (
          <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={onRetry}>Prøv igen</Button>
        )}
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onRemove} aria-label="Fjern fil">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
