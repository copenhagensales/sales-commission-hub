import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { formatUnread, usePulsenUnread } from "@/hooks/usePulsen";

/** Antal nye Huset-elementer siden sidste besøg i Pulsen (maks. "9+"). */
export function PulsenUnreadBadge() {
  const { data: employeeId } = useCurrentEmployeeId();
  const { data: count = 0 } = usePulsenUnread(employeeId);
  if (count <= 0) return null;
  return (
    <span
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald))] px-1.5 text-[11px] font-black tabular-nums text-[hsl(var(--cph-onyx))]"
      aria-label={`${count} nye i Pulsen`}
    >
      {formatUnread(count)}
    </span>
  );
}
