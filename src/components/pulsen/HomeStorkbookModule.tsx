import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, HandHeart, ImagePlus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { StorkbookMark } from "@/components/storkbook/StorkbookMark";
import { PulsenAvatar } from "@/components/pulsen/PulsenAvatar";
import { CelebrationLines } from "@/components/pulsen/CelebrationLine";
import { LiveDot, TodayMilestonesMini } from "@/components/pulsen/TodayMilestones";
import { ReactButton } from "@/components/home/FeedReactionRow";
import type { Celebration } from "@/components/home/CelebrationStrip";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import { usePermissions } from "@/hooks/usePositionPermissions";
import {
  postTargetKey, usePulsenImageUrls, usePulsenLastSeen, usePulsenLatestPosts, usePulsenMutations, usePulsenSelf, usePulsenUnread,
  type PulsenPost,
} from "@/hooks/usePulsen";
import { PULSEN_MAX_CHARS, pulsenRelativeTime, shortName } from "@/lib/pulsen/format";

const LATEST_KEY = ["pulsen-latest-posts", 3];

interface Props { employeeId: string | null | undefined; firstName: string; celebrations: Celebration[] }

/** Storkbook-modul på forsiden: 3 seneste Huset-indlæg, dagens milepæle, ulæst-tal og hurtig deling. Nulstiller ikke "sidst set". */
export function HomeStorkbookModule({ employeeId, firstName, celebrations }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canEdit } = usePermissions();
  const canPost = canEdit("action_pulsen_post_house");
  const posts = usePulsenLatestPosts(!!employeeId, 3);
  const unread = usePulsenUnread(employeeId);
  const lastSeen = usePulsenLastSeen(employeeId);
  const self = usePulsenSelf(employeeId);
  const mut = usePulsenMutations(self.data ?? null);
  const list = posts.data ?? [];
  const fr = useFeedReactions(list.filter((p) => !p.pending).map((p) => postTargetKey(p.id)));
  const images = usePulsenImageUrls(list.slice(0, 1).filter((p) => p.image_path).map((p) => p.image_path as string));
  const [text, setText] = useState("");

  const isNew = (p: PulsenPost) => p.author_employee_id !== employeeId && (!lastSeen.data || p.created_at > lastSeen.data);
  const count = unread.data ?? 0;

  const share = async () => {
    const body = text.trim();
    if (!body || !self.data) return;
    const id = crypto.randomUUID();
    const optimistic: PulsenPost = {
      id, author_employee_id: self.data.id, audience: "house", team_id: null, post_type: "post", body,
      praised_employee_id: null, image_path: null, best_answer_comment_id: null, hidden_at: null,
      created_at: new Date().toISOString(), edited_at: null, author: self.data, praised: null, pending: true,
    };
    qc.setQueryData<PulsenPost[]>(LATEST_KEY, (old) => [optimistic, ...(old ?? [])].slice(0, 3));
    setText("");
    try {
      await mut.create.mutateAsync({ input: { audience: "house", teamId: null, postType: "post", body }, id });
      toast.success("Delt i Storkbook", { action: { label: "Se det", onClick: () => navigate(`/storkbook?post=${id}`) } });
    } catch (e) {
      setText(body);
      toast.error("Indlægget blev ikke delt", { description: e instanceof Error ? e.message : "Prøv igen" });
    } finally {
      qc.invalidateQueries({ queryKey: ["pulsen-latest-posts"] });
      qc.invalidateQueries({ queryKey: ["pulsen-feed"] });
    }
  };

  const [first, ...rest] = list;

  return (
    <section aria-label="Storkbook" className="rounded-[32px] bg-card p-5 md:p-7">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <StorkbookMark variant="full" tone="light" size={38} />
          <h2 aria-label="Storkbook" className="font-['Figtree'] text-[26px] font-black lowercase leading-none tracking-[-0.045em]">
            <span aria-hidden="true" className="text-[hsl(var(--cph-onyx))]">stork</span>
            <span aria-hidden="true" className="text-[#146c3c]">book</span>
          </h2>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#d6f7e5] px-3 py-1.5 text-[12px] font-extrabold text-[#146c3c]">
          <LiveDot />
          {storkLine(count)}
        </span>
        <Link to="/storkbook" className="ml-auto flex min-h-[44px] items-center gap-1 rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))]">
          Åbn Storkbook <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {canPost && (
        <form onSubmit={(e) => { e.preventDefault(); share(); }}
          className={`mt-5 flex flex-wrap items-center gap-2 rounded-[28px] bg-[hsl(var(--cph-light-blue))] p-2 ${count === 0 ? "md:p-3" : ""}`}>
          <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-0 sm:flex-1">
            <PulsenAvatar employeeId={employeeId} name={shortName(self.data?.first_name, self.data?.last_name)} size={36} />
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={PULSEN_MAX_CHARS}
              aria-label="Del noget med huset"
              placeholder={`Del noget med huset, ${firstName.trim()} …`}
              className="min-h-[44px] min-w-0 flex-1 bg-transparent px-2 text-[16px] outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" aria-label="Del et billede" onClick={() => navigate("/storkbook?compose=image")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-card">
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate("/storkbook?compose=praise")}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-card px-4 text-[14px] font-extrabold text-foreground">
              <HandHeart className="h-4 w-4" aria-hidden="true" /> Giv ros
            </button>
            <button type="submit" disabled={!text.trim() || !self.data}
              className="min-h-[44px] rounded-full bg-[hsl(var(--cph-emerald))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-onyx))] disabled:opacity-50">
              Del
            </button>
          </div>
        </form>
      )}

      {posts.isError ? (
        <p className="mt-5 text-[14px] text-muted-foreground">
          Storkbook kunne ikke hentes. <button type="button" onClick={() => posts.refetch()} className="min-h-[44px] font-extrabold text-foreground underline">Prøv igen</button>
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr_0.95fr]">
          {/* 1. Seneste indlæg i stort */}
          {posts.isLoading ? <Skel h={260} /> : first ? (
            <article className="rounded-[24px] bg-[hsl(var(--cph-light-blue))] p-5">
              <div className="flex items-start gap-3">
                <PulsenAvatar employeeId={first.author_employee_id} name={shortName(first.author?.first_name, first.author?.last_name)} size={40} className="[&>span]:bg-card" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] leading-snug"><Lead p={first} /></p>
                  <p className="text-[12px] text-muted-foreground">{[first.author?.job_title, pulsenRelativeTime(first.created_at)].filter(Boolean).join(" · ")}</p>
                </div>
                {isNew(first) && <span className="rounded-full bg-[hsl(var(--cph-emerald))] px-2.5 py-1 text-[11px] font-black text-[hsl(var(--cph-onyx))]">NYT</span>}
              </div>
              <Link to={`/storkbook?post=${first.id}`} className="mt-3 block">
                <p className="line-clamp-3 whitespace-pre-line text-[15px] leading-[1.5]">{first.body}</p>
                {first.image_path && images.data?.get(first.image_path) && (
                  <img src={images.data.get(first.image_path)} alt="" className="mt-3 h-[132px] w-full rounded-[18px] object-cover" />
                )}
              </Link>
              {!first.pending && (
                <div className="mt-3 flex items-center gap-1">
                  <ReactButton compact summary={fr.getReactions(postTargetKey(first.id))} disabled={!fr.canInteract}
                    onSet={(reaction) => fr.setReaction.mutate({ targetType: "pulsen_post", targetKey: postTargetKey(first.id), reaction })} />
                  <Link to={`/storkbook?post=${first.id}`} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold text-muted-foreground hover:bg-card">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Kommentér · {fr.getComments(postTargetKey(first.id)).length}
                  </Link>
                </div>
              )}
            </article>
          ) : (
            <div className="flex items-center rounded-[24px] bg-[hsl(var(--cph-light-blue))] p-5 text-[14px] text-muted-foreground">Ingen indlæg i Huset endnu – vær den første.</div>
          )}

          {/* 2. Også nyt + dagens fejringer */}
          {posts.isLoading ? <Skel h={260} /> : (
            <div className="flex flex-col">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Også nyt</h3>
              <ul className="mt-1 divide-y divide-border">
                {rest.map((p) => {
                  const n = fr.getComments(postTargetKey(p.id)).length;
                  return (
                    <li key={p.id}>
                      <Link to={`/storkbook?post=${p.id}`} className="flex gap-3 py-3 hover:opacity-80">
                        <PulsenAvatar employeeId={p.author_employee_id} name={shortName(p.author?.first_name, p.author?.last_name)} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px]"><Lead p={p} /></p>
                          <p className="line-clamp-2 text-[13px] text-muted-foreground">{p.body}</p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {pulsenRelativeTime(p.created_at)}
                            {p.post_type === "question" && !p.best_answer_comment_id
                              ? <span className="font-extrabold text-[#146c3c]"> · {n} svar · Hjælp til →</span>
                              : n > 0 && ` · ${n} kommentarer`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {rest.length === 0 && <li className="py-3 text-[13px] text-muted-foreground">Ikke mere nyt lige nu.</li>}
              </ul>
              {celebrations.length > 0 && <div className="mt-2"><CelebrationLines celebrations={celebrations} variant="dashed" /></div>}
            </div>
          )}

          {/* 3. Dagens milepæle mini */}
          <TodayMilestonesMini enabled={!!employeeId} />
        </div>
      )}
    </section>
  );
}

function Lead({ p }: { p: PulsenPost }) {
  const name = shortName(p.author?.first_name, p.author?.last_name);
  const praised = p.praisedAll?.length ? p.praisedAll : p.praised ? [p.praised] : [];
  if (p.post_type === "praise" && praised.length) {
    return <><b className="font-extrabold">{name}</b> gav ros til <b className="font-extrabold">{shortName(praised[0].first_name, praised[0].last_name)}</b>{praised.length > 1 && ` +${praised.length - 1}`}</>;
  }
  if (p.post_type === "question") return <><b className="font-extrabold">{name}</b> spørger</>;
  if (p.post_type === "image") return <><b className="font-extrabold">{name}</b> delte et billede</>;
  return <b className="font-extrabold">{name}</b>;
}

const Skel = ({ h }: { h: number }) => <div className="animate-pulse rounded-[24px] bg-[hsl(var(--cph-light-blue))]" style={{ height: h }} />;

/** Sjove storke-linjer til ulæst-pillen. Vælges pr. dag/time, så teksten ikke skifter ved hver genindlæsning. */
const STORK_EMPTY = [
  "Storken har læst det hele – din tur til at kvække",
  "Helt stille i reden. Læg det første æg i dag",
  "Storken står på ét ben og venter på nyt",
  "Intet nyt i reden – vær den første fugl",
  "Storken har pudset fjerene. Nu mangler den bare noget at læse",
];
const STORK_MORNING = "Storken er tidligt oppe – ingen har sagt noget endnu";
const STORK_NIGHT = "Storken er på vej i seng – men reden er åben";
const STORK_NEW = [
  (n: number) => `Storken har fløjet ${n} ${n === 1 ? "nyhed" : "nyheder"} ind`,
  (n: number) => `${n} ${n === 1 ? "nyt æg" : "nye æg"} i reden siden sidst`,
  (n: number) => `Kvæk! ${n} ${n === 1 ? "ny" : "nye"} siden dit sidste besøg`,
];

function storkLine(count: number, now = new Date()): string {
  const seed = now.getDate() + now.getHours();
  if (count > 0) return STORK_NEW[seed % STORK_NEW.length](count);
  const h = now.getHours();
  if (h < 8) return STORK_MORNING;
  if (h >= 21) return STORK_NIGHT;
  return STORK_EMPTY[seed % STORK_EMPTY.length];
}
