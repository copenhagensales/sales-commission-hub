import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarLookup } from "@/hooks/useAvatarLookup";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export function PulsenAvatar({ employeeId, name, size = 44, className }: { employeeId?: string | null; name: string; size?: number; className?: string }) {
  const lookup = useAvatarLookup();
  const url = lookup({ employeeId, name });
  return (
    <Avatar className={cn("flex-none", className)} style={{ width: size, height: size }}>
      {url && <AvatarImage src={url} alt="" className="object-cover" />}
      <AvatarFallback className="bg-[hsl(var(--cph-light-blue))] text-[13px] font-extrabold text-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
