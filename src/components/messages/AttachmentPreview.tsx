import { Button } from "@/components/ui/button";
import { X, FileIcon } from "lucide-react";

interface AttachmentPreviewProps {
  attachment: {
    url: string;
    type: string;
    name: string;
  };
  onRemove: () => void;
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const isImage = attachment.type.startsWith("image/");

  return (
    <div className="px-4 py-2 border-t bg-muted/30">
      <div className="flex items-center gap-2">
        {isImage ? (
          <img 
            src={attachment.url} 
            alt={attachment.name} 
            className="h-16 w-16 object-cover rounded"
          />
        ) : (
          <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.name}</p>
          <p className="text-xs text-muted-foreground">{attachment.type}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
