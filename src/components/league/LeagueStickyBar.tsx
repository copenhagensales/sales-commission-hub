import { memo } from "react";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

interface LeagueStickyBarProps {
  rank: number;
  division: number;
  points?: number;
  provision?: number;
  zone: "top" | "promo" | "playoff" | "relegation" | "safe";
  isQualification?: boolean;
  visible: boolean;
}

const zoneConfig = {
  top: { label: "Top 2", color: "bg-yellow-500", textColor: "text-yellow-400" },
  promo: { label: "Oprykker", color: "bg-green-500", textColor: "text-green-400" },
  playoff: { label: "Playoff", color: "bg-orange-500", textColor: "text-orange-400" },
  relegation: { label: "Nedrykker", color: "bg-red-500", textColor: "text-red-400" },
  safe: { label: "Sikker", color: "bg-muted-foreground", textColor: "text-muted-foreground" },
};

export const LeagueStickyBar = memo(function LeagueStickyBar({
  rank,
  division,
  points,
  provision,
  zone,
  isQualification,
  visible,
}: LeagueStickyBarProps) {
  const z = zoneConfig[zone];
  const divLabel = division === 1 ? "Salgsligaen" : `${division - 1}. Division`;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-full pointer-events-none"
      )}
    >
      <div className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm px-3 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: rank + division */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
              <span className="font-bold text-sm">#{rank}</span>
            </div>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-sm text-muted-foreground truncate">{divLabel}</span>
          </div>

          {/* Center: points/provision */}
          <div className="font-mono text-sm font-semibold whitespace-nowrap">
            {isQualification
              ? `${(provision ?? 0).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr`
              : `${(points ?? 0).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt`}
          </div>

          {/* Right: zone badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn("w-2 h-2 rounded-full", z.color)} />
            <span className={cn("text-xs font-medium", z.textColor)}>{z.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
