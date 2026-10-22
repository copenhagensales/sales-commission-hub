import { Link } from "react-router-dom";
import { ArrowRight, Heart, Image as ImageIcon, MessageCircle } from "lucide-react";
import { PulsenAvatar } from "@/components/pulsen/PulsenAvatar";
import { usePulsenLatest, type PulsenLatestItem } from "@/hooks/usePulsen";
import { pulsenRelativeTime, shortName } from "@/lib/pulsen/format";

function lead(p: PulsenLatestItem) {
  const name = shortName(p.author?.first_name, p.author?.last_name);
  if (p.post_type === "praise") return <><b className="font-extrabold">{name}</b> gav ros til <b className="font-extrabold">{shortName(p.praised?.first_name, p.praised?.last_name)}</b>{(p.praised_employee_ids?.length ?? 0) > 1 && ` +${(p.praised_employee_ids?.length ?? 1) - 1}`}</>;
  if (p.post_type === "question") return <><b className="font-extrabold">{name}</b> spørger</>;
  if (p.post_type === "image") return <><b className="font-extrabold">{name}</b> delte et billede</>;
  return <b className="font-extrabold">{name}</b>;
}

/** Kompakt "Seneste fra Pulsen" til forsiden – kun Huset, kun visning. */
export function PulsenLatestCard({ enabled }: { enabled: boolean }) {
  const { data } = usePulsenLatest(enabled);
  if (!enabled || !data || data.length === 0) return null;

  return (
    <section className="rounded-3xl bg-card px-6 py-5" aria-label="Seneste fra Storkbook">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Seneste fra Storkbook</h2>
        <Link to="/storkbook" className="flex min-h-[44px] items-center gap-1 text-[13px] font-extrabold text-foreground hover:text-primary">
          Se alle <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {data.map((p) => (
          <li key={p.id}>
            <Link to={`/storkbook?post=${p.id}`} className="flex min-h-[44px] items-center gap-3 py-2 hover:opacity-80">
              <PulsenAvatar employeeId={p.author?.id} name={shortName(p.author?.first_name, p.author?.last_name)} size={28} />
              <p className="min-w-0 flex-1 truncate text-[14px]">
                {lead(p)}
                {p.image_path && <ImageIcon className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" aria-label="Billede" />}
                <span className="text-muted-foreground"> · {p.body}</span>
              </p>
              <span className="flex shrink-0 items-center gap-3 text-[12px] tabular-nums text-muted-foreground">
                {p.reactions > 0 && <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.reactions}</span>}
                {p.comments > 0 && <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{p.comments}</span>}
                <span className="w-[72px] text-right">{pulsenRelativeTime(p.created_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
