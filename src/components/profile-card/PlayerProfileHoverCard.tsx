/**
 * Hover-wrapper til spillerprofil-kortet.
 *
 * Genbruger PlayerProfileCard og den præberegnede statistik fra
 * useEmployeeProfileStats. Hooken er delt via React Query-cachen, så hover
 * udløser ingen ekstra forespørgsler.
 */
import { ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useEmployeeProfileStats } from "@/hooks/useEmployeeProfileStats";
import { PlayerProfileCard } from "./PlayerProfileCard";

interface PlayerProfileHoverCardProps {
  employeeId: string | null | undefined;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function PlayerProfileHoverCard({
  employeeId,
  children,
  side = "right",
  align = "start",
}: PlayerProfileHoverCardProps) {
  const { data } = useEmployeeProfileStats();
  const person = employeeId ? data?.byId.get(employeeId) : undefined;

  if (!person) return <>{children}</>;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <PlayerProfileCard
          person={person}
          club200Members={data?.club200Members ?? 0}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
