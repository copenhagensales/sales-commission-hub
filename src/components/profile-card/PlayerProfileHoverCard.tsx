/**
 * Hover-wrapper til spillerprofil-kortet.
 *
 * Genbruger PlayerProfileCard og den præberegnede statistik fra
 * useEmployeeProfileStats. Hooken er delt via React Query-cachen, så hover
 * udløser ingen ekstra forespørgsler.
 *
 * På enheder uden mus (touch/mobil) findes hover ikke. Der bruges derfor en
 * Popover, som åbnes ved tryk, så kortet også kan læses på telefon og tablet.
 */
import { ReactNode, useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEmployeeProfileStats } from "@/hooks/useEmployeeProfileStats";
import { PlayerProfileCard } from "./PlayerProfileCard";

interface PlayerProfileHoverCardProps {
  employeeId: string | null | undefined;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/** Sand når enheden har en rigtig mus — ellers bruges tryk-varianten. */
function useHasHover() {
  const [hasHover, setHasHover] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setHasHover(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return hasHover;
}

const CONTENT_CLASS =
  "w-auto max-w-[calc(100vw-24px)] max-h-[85vh] overflow-y-auto overflow-x-hidden border-0 bg-transparent p-0 shadow-none";

export function PlayerProfileHoverCard({
  employeeId,
  children,
  side = "right",
  align = "center",
}: PlayerProfileHoverCardProps) {
  const { data } = useEmployeeProfileStats();
  const hasHover = useHasHover();
  const person = employeeId ? data?.byId.get(employeeId) : undefined;

  if (!person) return <>{children}</>;

  const card = (
    <PlayerProfileCard
      person={person}
      club200Members={data?.club200Members ?? 0}
    />
  );

  if (!hasHover) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={10}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={CONTENT_CLASS}
        >

          {card}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={12}
        collisionPadding={16}
        avoidCollisions
        className={CONTENT_CLASS}
      >
        {card}
      </HoverCardContent>
    </HoverCard>
  );
}
