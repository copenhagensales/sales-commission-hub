import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle } from "lucide-react";

interface VideoPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoTitle: string;
  videoUrl?: string;
}

export function VideoPlayerDialog({
  open,
  onOpenChange,
  videoTitle,
  videoUrl,
}: VideoPlayerDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle>{videoTitle}</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full"
              >
                Din browser understøtter ikke video afspilning.
              </video>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <AlertCircle className="h-12 w-12" />
                <p className="text-center">Ingen video tilknyttet endnu</p>
                <p className="text-sm text-center">Kontakt din leder for at få adgang til videoen</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
