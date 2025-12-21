import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{videoTitle}</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
