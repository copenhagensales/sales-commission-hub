import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, X, Loader2, Link } from "lucide-react";
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
  const [videoUrl, setVideoUrl] = useState("");
  const [activeTab, setActiveTab] = useState<string>("upload");
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
      handleClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Kunne ikke uploade video: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Extract URL from iframe code if pasted
  const extractUrlFromInput = (input: string): string => {
    const trimmed = input.trim();
    
    // Check if it's an iframe tag
    if (trimmed.startsWith('<iframe')) {
      const srcMatch = trimmed.match(/src=["']([^"']+)["']/);
      if (srcMatch) {
        return srcMatch[1];
      }
    }
    
    return trimmed;
  };

  const handleSaveLink = () => {
    if (!videoUrl.trim()) {
      toast.error("Indtast venligst et video-link eller embed-kode");
      return;
    }

    const extractedUrl = extractUrlFromInput(videoUrl);

    // Basic URL validation
    try {
      new URL(extractedUrl);
    } catch {
      toast.error("Kunne ikke finde et gyldigt URL i det indtastede");
      return;
    }

    onUploadComplete(extractedUrl);
    toast.success("Video-link gemt!");
    handleClose();
  };

  const handleRemoveVideo = async () => {
    if (!currentUrl) return;

    try {
      // Only try to delete from storage if it's a storage URL
      if (currentUrl.includes("onboarding-videos")) {
        const urlParts = currentUrl.split("/onboarding-videos/");
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from("onboarding-videos").remove([filePath]);
        }
      }

      onUploadComplete("");
      toast.success("Video fjernet");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error("Kunne ikke fjerne video");
    }
  };

  const handleClose = () => {
    setFile(null);
    setProgress(0);
    setVideoUrl("");
    onOpenChange(false);
  };

  const isYouTubeOrExternalUrl = (url: string) => {
    return url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com") || !url.includes("onboarding-videos");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj video til: {videoTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {currentUrl && (
            <div className="space-y-2">
              <Label>Nuværende video</Label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                {isYouTubeOrExternalUrl(currentUrl) ? (
                  <Link className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Video className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm truncate flex-1">
                  {isYouTubeOrExternalUrl(currentUrl) ? "Eksternt video-link" : "Uploadet video"}
                </span>
                <Button variant="ghost" size="icon" onClick={handleRemoveVideo}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload fil
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link className="h-4 w-4 mr-2" />
                Video-link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2">
                <Label>Vælg videofil</Label>
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

              <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploader...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload video
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL eller Embed-kode</Label>
                <Input
                  id="video-url"
                  placeholder="Indsæt URL eller hele iframe-koden"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Understøtter YouTube, Vimeo, SharePoint embed-kode og andre video-links
                </p>
              </div>

              <Button onClick={handleSaveLink} disabled={!videoUrl.trim()} className="w-full">
                <Link className="h-4 w-4 mr-2" />
                Gem video-link
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Annuller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
