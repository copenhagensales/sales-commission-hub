import { useState, useRef } from "react";
import { Car, CheckCircle2, AlertTriangle, Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

interface VehicleReturnCalloutProps {
  vehicleName: string;
  confirmed: { confirmed_at: string } | null;
  isConfirming: boolean;
  onConfirm: (photo?: File) => void;
}

export function VehicleReturnCallout({ vehicleName, confirmed, isConfirming, onConfirm }: VehicleReturnCalloutProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const clearPhoto = () => {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  if (confirmed) {
    return (
      <div className="mt-1 px-2.5 py-2 rounded-md bg-green-600/10 border border-green-500/20 dark:bg-green-500/10 dark:border-green-400/20">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-300 shrink-0" />
          <span className="text-[11px] font-semibold text-green-700 dark:text-green-300">
            Nøgle afleveret kl. {format(parseISO(confirmed.confirmed_at), "HH:mm")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 px-2.5 py-2 rounded-md bg-yellow-600/10 border border-yellow-500/20 dark:bg-yellow-500/10 dark:border-yellow-400/20 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Car className="w-3.5 h-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
          Aflevering af nøgle i dag
        </span>
      </div>

      <div className="text-[11px] text-foreground space-y-1 ml-5">
        <p>Parker bilen på parkeringspladsen i de afmærkede båse med <strong>"Copenhagen Sales"</strong>.</p>
        <p>Hvis porten er låst, brug nøglebrik fra nøgleboksen til højre for porten <strong>(kode 2109)</strong>. Aflever nøglen på det lille kontor.</p>
      </div>

      <div className="flex items-start gap-1.5 ml-5">
        <AlertTriangle className="w-3 h-3 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
        <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
          Afleveres nøglen ikke, kan kollegaer ikke bruge bilen. Parkerer du udenfor porten, er du selv ansvarlig for eventuelle parkeringsbøder.
        </p>
      </div>

      {/* Photo section */}
      <div className="ml-5 space-y-1.5">
        {preview ? (
          <div className="relative w-full max-w-[200px]">
            <img src={preview} alt="Preview" className="w-full rounded-md border border-border" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] gap-1.5"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5" />
              Tag billede
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] gap-1.5"
              onClick={() => uploadRef.current?.click()}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Upload
            </Button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <p className="text-[10px] text-muted-foreground">Valgfrit: tag et billede af hvor nøglen er lagt</p>
      </div>

      <div className="pt-1">
        <Button
          size="sm"
          className="w-full h-9 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm dark:bg-amber-600 dark:hover:bg-amber-700"
          disabled={isConfirming}
          onClick={() => onConfirm(photo ?? undefined)}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          {isConfirming ? "Bekræfter..." : "Bekræft aflevering af nøgle"}
        </Button>
      </div>
    </div>
  );
}
