import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveColleagues, usePulsenPoll } from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

function closesIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.round(ms / 3600000);
  if (h < 1) return "om under en time";
  if (h < 24) return `om ${h} ${h === 1 ? "time" : "timer"}`;
  const d = Math.round(h / 24);
  return `om ${d} ${d === 1 ? "dag" : "dage"}`;
}

export function PulsenPollCard({ postId }: { postId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [query_ready_placeholder]);
  const { query, vote, isClosed } = usePulsenPoll(postId, true, { poll: visible });
  const data = query.data;
  const named = !!data?.poll && !data.poll.anonymous;
  const colleagues = useActiveColleagues(named);

  if (query.isLoading) return <div className="mt-3 h-32 animate-pulse rounded-[18px] bg-muted" aria-hidden="true" />;
  if (!data?.poll) return null;

  const { poll, options, votes, hasVoted, myOptionId } = data;
  const closed = isClosed;
  const total = votes.length;
  const showResults = hasVoted || closed;
  const canSwitch = !closed && named;
  const nameById = new Map((colleagues.data ?? []).map((c) => [c.id, c.first_name ?? ""]));

  const onPick = (optionId: string) => {
    if (vote.isPending || closed || optionId === myOptionId) return;
    if (hasVoted && !canSwitch) return;
    vote.mutate(optionId, {
      onError: (e) => toast.error("Stemmen blev ikke gemt", { description: e && typeof e === "object" && "message" in e ? String(e.message) : "Prøv igen" }),
    });
  };

  return (
    <div ref={rootRef} className="mt-3">
      {closed && <p className="mb-2 text-[14px] font-extrabold text-foreground">Afsluttet · {total} {total === 1 ? "stemme" : "stemmer"}</p>}
      <ul className="space-y-2">
        {options.map((o) => {
          const count = votes.filter((v) => v.option_id === o.id).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const mine = myOptionId === o.id;
          const voters = named ? votes.filter((v) => v.option_id === o.id && v.employee_id).map((v) => nameById.get(v.employee_id as string)).filter((n): n is string => !!n) : [];
          const clickable = !closed && (!hasVoted || canSwitch);
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onPick(o.id)}
                disabled={!clickable || vote.isPending}
                aria-pressed={mine}
                className={cn(
                  "relative flex min-h-[44px] w-full items-center gap-2 overflow-hidden rounded-[16px] bg-[hsl(var(--cph-light-blue))] px-4 py-2 text-left text-[15px] text-foreground transition-opacity active:opacity-70 disabled:cursor-default disabled:active:opacity-100",
                  !showResults && "font-extrabold",
                  mine && "ring-2 ring-[hsl(var(--cph-onyx))]"
                )}
              >
                {showResults && (
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-[hsl(var(--cph-onyx)/0.15)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                )}
                <span className="relative flex min-w-0 flex-1 items-center gap-2 break-words">
                  {mine && <Check className="h-4 w-4 flex-none" aria-label="Dit valg" />}
                  {o.label}
                </span>
                {showResults && <span className="relative flex-none text-[14px] font-extrabold tabular-nums">{pct} % · {count}</span>}
              </button>
              {showResults && voters.length > 0 && (
                <p className="mt-1 px-1 text-[13px] text-muted-foreground">
                  {voters.slice(0, 3).join(", ")}{voters.length > 3 ? ` og ${voters.length - 3} andre` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {!closed && (
        <p className="mt-2 text-[14px] text-muted-foreground">
          {total} har stemt · Lukker {closesIn(poll.closes_at)}
          {poll.anonymous && " · Anonym afstemning"}
        </p>
      )}
      {poll.anonymous && hasVoted && !closed && (
        <p className="mt-1 text-[14px] text-muted-foreground">Din stemme er anonym og kan ikke ændres</p>
      )}
    </div>
  );
}
