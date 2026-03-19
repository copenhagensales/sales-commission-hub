import { ReactNode } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

interface PlayerHoverCardProps {
  children: ReactNode;
  playerName: string;
  teamName: string;
  todayProvision: number;
  totalProvision: number;
  division: number;
}

export function PlayerHoverCard({
  children,
  playerName,
  teamName,
  todayProvision,
  totalProvision,
  division,
}: PlayerHoverCardProps) {
  const divLabel = division === 1 ? "Salgsligaen" : `${division - 1}. Division`;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-52 p-3 text-xs space-y-2">
        <p className="font-semibold text-sm">{playerName}</p>
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Team</span>
            <span className="text-foreground">{teamName || "Ingen"}</span>
          </div>
          <div className="flex justify-between">
            <span>Division</span>
            <span className="text-foreground">{divLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Total provision</span>
            <span className="text-foreground font-mono">
              {totalProvision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
            </span>
          </div>
          <div className="flex justify-between">
            <span>I dag</span>
            <span className="text-emerald-400 font-mono">
              {todayProvision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
