import { useState, useEffect } from "react";
import { Monitor } from "lucide-react";

export function ScreenResolutionIndicator() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  if (dimensions.width === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
      <Monitor className="h-3 w-3" />
      <span>{dimensions.width} × {dimensions.height}</span>
    </div>
  );
}
