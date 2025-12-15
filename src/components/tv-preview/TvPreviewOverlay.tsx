import { useState } from "react";
import { Monitor, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TvPreviewOverlayProps {
  children: React.ReactNode;
  className?: string;
}

export function TvPreviewOverlay({ children, className }: TvPreviewOverlayProps) {
  const [tvMode, setTvMode] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);

  return (
    <div className={cn("relative", className)}>
      {/* Control buttons - fixed position */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <Button
          variant={tvMode ? "default" : "outline"}
          size="sm"
          onClick={() => setTvMode(!tvMode)}
          className="gap-2 shadow-lg"
        >
          <Monitor className="h-4 w-4" />
          {tvMode ? "Exit TV Mode" : "TV Preview"}
        </Button>
        
        <Button
          variant={showSafeZone ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSafeZone(!showSafeZone)}
          className="gap-2 shadow-lg"
        >
          {showSafeZone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          Safe Zone
        </Button>
      </div>

      {/* TV Mode wrapper */}
      {tvMode ? (
        <div className="fixed inset-0 z-40 bg-black flex items-center justify-center p-4">
          {/* TV frame simulation */}
          <div className="relative w-full max-w-[1920px] aspect-video bg-slate-900 rounded-lg overflow-hidden shadow-2xl border-4 border-slate-700">
            {/* Resolution badge */}
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 z-10 bg-black/70 text-white text-xs"
            >
              1920×1080 (16:9)
            </Badge>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTvMode(false)}
              className="absolute top-2 right-2 z-10 bg-black/70 hover:bg-black/90 text-white"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Safe zone overlay in TV mode */}
            {showSafeZone && <SafeZoneOverlay />}

            {/* Content scaled to fit */}
            <div className="absolute inset-0 overflow-auto">
              {children}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Safe zone overlay in normal mode */}
          {showSafeZone && <SafeZoneOverlay />}
          {children}
        </div>
      )}
    </div>
  );
}

function SafeZoneOverlay() {
  return (
    <>
      {/* Safe zone border (90% of screen) */}
      <div className="absolute inset-[5%] border-2 border-dashed border-red-500/70 pointer-events-none z-20 rounded-lg">
        {/* Corner labels */}
        <span className="absolute -top-6 left-0 text-red-500 text-xs font-mono bg-black/70 px-2 py-1 rounded">
          Safe Zone (90%)
        </span>
        
        {/* Corner markers */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500" />
      </div>

      {/* Title safe zone (80% - inner area for text) */}
      <div className="absolute inset-[10%] border border-dashed border-yellow-500/50 pointer-events-none z-20 rounded-lg">
        <span className="absolute -top-5 left-0 text-yellow-500 text-xs font-mono bg-black/70 px-2 py-0.5 rounded">
          Title Safe (80%)
        </span>
      </div>

      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
        <div className="w-8 h-0.5 bg-green-500/70 absolute -translate-x-1/2" />
        <div className="w-0.5 h-8 bg-green-500/70 absolute -translate-y-1/2" />
      </div>

      {/* Design guidelines legend */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs p-3 rounded-lg pointer-events-none z-20 space-y-1.5 font-mono">
        <div className="font-bold mb-2">TV Design Guidelines</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-red-500" />
          <span>Action Safe (90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 border-t border-dashed border-yellow-500" />
          <span>Title Safe (80%)</span>
        </div>
        <div className="border-t border-white/20 pt-2 mt-2 space-y-1">
          <div>Min font: 24px</div>
          <div>Min button: 44×44px</div>
          <div>High contrast required</div>
        </div>
      </div>
    </>
  );
}
