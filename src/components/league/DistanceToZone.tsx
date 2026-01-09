import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DistanceToZoneProps {
  currentProvision: number;
  nextZoneProvision: number | null;
  prevZoneProvision: number | null;
  zoneType: "promo" | "safe" | "playoff" | "relegation" | "top";
  className?: string;
}

export function DistanceToZone({
  currentProvision,
  nextZoneProvision,
  prevZoneProvision,
  zoneType,
  className,
}: DistanceToZoneProps) {
  // Calculate distance to move up (escape current zone or reach better zone)
  const distanceUp = nextZoneProvision !== null ? nextZoneProvision - currentProvision : null;
  // Calculate distance down (buffer before falling)
  const distanceDown = prevZoneProvision !== null ? currentProvision - prevZoneProvision : null;

  const getZoneLabel = () => {
    switch (zoneType) {
      case "promo": return "til oprykning";
      case "top": return "til top 2";
      case "playoff": return "til playoff";
      case "relegation": return "til sikker zone";
      case "safe": return "til oprykning";
      default: return "";
    }
  };

  const isInDanger = zoneType === "relegation";
  const isInPlayoff = zoneType === "playoff";

  if (distanceUp === null && distanceDown === null) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
            {distanceUp !== null && distanceUp > 0 && (
              <div className={cn(
                "flex items-center gap-1",
                isInDanger ? "text-red-500" : isInPlayoff ? "text-orange-500" : "text-green-600"
              )}>
                <ArrowUp className="h-3 w-3" />
                <span className="font-mono font-medium">
                  {distanceUp.toLocaleString("da-DK")} kr
                </span>
              </div>
            )}
            {distanceDown !== null && distanceDown > 0 && !isInDanger && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span className="font-mono text-[10px]">
                  +{distanceDown.toLocaleString("da-DK")}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {distanceUp !== null && distanceUp > 0 && (
            <p>Mangler <strong>{distanceUp.toLocaleString("da-DK")} kr</strong> {getZoneLabel()}</p>
          )}
          {distanceDown !== null && distanceDown > 0 && !isInDanger && (
            <p className="text-muted-foreground mt-1">
              Buffer: {distanceDown.toLocaleString("da-DK")} kr før nedrykning
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
