import { formatUnread } from "@/hooks/usePulsen";
import { useStorkbookUnread } from "@/hooks/useStorkbookUnread";

/** Nyt i Storkbook: Huset-elementer siden sidste besøg + ulæste chatbeskeder (maks. "9+"). */
export function PulsenUnreadBadge() {
  const count = useStorkbookUnread();
  if (count <= 0) return null;
  return (
    <span
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--cph-emerald))] px-1.5 text-[11px] font-black tabular-nums text-[hsl(var(--cph-onyx))]"
      aria-label={`${count} nye i Storkbook`}
    >
      {formatUnread(count)}
    </span>
  );
}
