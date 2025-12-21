import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayId: string;
  videoIndex: number;
  videoTitle: string;
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
}

export function VideoUploadDialog({
  open,
  onOpenChange,
  dayId,
  videoIndex,
  videoTitle,
  currentUrl,
  onUploadComplete,
}: VideoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("video/")) {
        toast.error("Vælg venligst en videofil");
        return;
      }
      // Max 500MB
      if (selectedFile.size > 500 * 1024 * 1024) {
        toast.error("Filen er for stor. Maksimum 500MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `day-${dayId}/video-${videoIndex}-${Date.now()}.${fileExt}`;

      setProgress(30);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("onboarding-videos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      setProgress(80);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("onboarding-videos")
        .getPublicUrl(fileName);

      setProgress(100);
      onUploadComplete(publicUrl);
      toast.success("Video uploadet!");
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Kunne ikke uploade video: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!currentUrl) return;

    try {
      // Extract file path from URL
      const urlParts = currentUrl.split("/onboarding-videos/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("onboarding-videos").remove([filePath]);
      }

      onUploadComplete("");
      toast.success("Video fjernet");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error("Kunne ikke fjerne video");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload video til: {videoTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {currentUrl && (
            <div className="space-y-2">
              <Label>Nuværende video</Label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                <Video className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm truncate flex-1">Video tilknyttet</span>
                <Button variant="ghost" size="icon" onClick={handleRemoveVideo}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Vælg ny video</Label>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            >
              {file ? (
                <div className="space-y-1">
                  <Video className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Klik for at vælge en video</p>
                  <p className="text-xs text-muted-foreground">MP4, MOV, WEBM (maks 500MB)</p>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">{progress}% uploadet</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Annuller
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploader...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
