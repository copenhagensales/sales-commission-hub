import { useAvatarLookup } from "@/hooks/useAvatarLookup";
import { PlayerProfileHoverCard } from "@/components/profile-card/PlayerProfileHoverCard";
import { cn } from "@/lib/utils";

interface LeaguePlayerAvatarProps {
  employeeId: string;
  name: string;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LeaguePlayerAvatar({ employeeId, name, className }: LeaguePlayerAvatarProps) {
  const lookupAvatar = useAvatarLookup();
  const avatarUrl = lookupAvatar({ employeeId, name });

  return (
    <PlayerProfileHoverCard employeeId={employeeId}>
      <span
        className={cn(
          "flex h-8 w-8 sm:h-9 sm:w-9 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-bold text-muted-foreground",
          className
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </span>
    </PlayerProfileHoverCard>
  );
}
