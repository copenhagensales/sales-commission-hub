import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle } from "lucide-react";

interface VideoPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoTitle: string;
  videoUrl?: string;
}

// Convert YouTube/Vimeo/SharePoint URLs to embeddable format
function getEmbedUrl(url: string): { type: 'embed' | 'video'; url: string } {
  // YouTube patterns
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    return {
      type: 'embed',
      url: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`,
    };
  }

  // Vimeo patterns
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/)(\d+)/
  );
  if (vimeoMatch) {
    return {
      type: 'embed',
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    };
  }

  // SharePoint embed URLs (already in embed format)
  if (url.includes('sharepoint.com') && url.includes('/_layouts/15/embed.aspx')) {
    return { type: 'embed', url };
  }

  // SharePoint stream URLs - convert to embed format if possible
  if (url.includes('sharepoint.com') && url.includes('/_layouts/15/stream.aspx')) {
    // Try to extract UniqueId and convert to embed URL
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    if (id) {
      // Extract the base SharePoint URL and construct embed URL
      const baseUrl = url.split('/_layouts/')[0];
      return {
        type: 'embed',
        url: `${baseUrl}/_layouts/15/embed.aspx?UniqueId=${encodeURIComponent(id)}`,
      };
    }
  }

  // Direct video file
  return { type: 'video', url };
}

export function VideoPlayerDialog({
  open,
  onOpenChange,
  videoTitle,
  videoUrl,
}: VideoPlayerDialogProps) {
  const embedInfo = videoUrl ? getEmbedUrl(videoUrl) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle>{videoTitle}</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {embedInfo ? (
              embedInfo.type === 'embed' ? (
                <iframe
                  src={embedInfo.url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={videoTitle}
                />
              ) : (
                <video
                  src={embedInfo.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                >
                  Din browser understøtter ikke video afspilning.
                </video>
              )
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
