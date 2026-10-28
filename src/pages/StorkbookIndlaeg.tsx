import { useEffect } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PulsenPostCard } from "@/components/pulsen/PulsenPostCard";
import { PulsenEmpty, PulsenError, PulsenPostSkeleton } from "@/components/pulsen/PulsenStates";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import { postTargetKey, usePulsenImageUrls, usePulsenMe, usePulsenMutations, usePulsenPost } from "@/hooks/usePulsen";

/** Ét Storkbook-opslag på egen adresse: /storkbook/indlaeg/:id. Adgang afgøres af RLS. */
export default function StorkbookIndlaeg() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = usePulsenMe();
  const postQ = usePulsenPost(id);
  const post = postQ.data ?? null;
  const images = usePulsenImageUrls(post?.image_path ? [post.image_path] : []);
  const mut = usePulsenMutations(me.self);
  const key = id ? postTargetKey(id) : "";
  const fr = useFeedReactions(post ? [key] : []);

  useEffect(() => {
    const prev = document.title;
    const first = post?.author?.first_name?.trim();
    document.title = first ? `Storkbook · ${first}` : "Storkbook";
    return () => { document.title = prev; };
  }, [post?.author?.first_name]);

  const backTo = post?.audience === "team" && post.team_id ? `/storkbook?team=${post.team_id}` : "/storkbook";
  const contextLabel = post
    ? post.audience === "team"
      ? [post.author?.job_title, me.teams.find((t) => t.id === post.team_id)?.name].filter(Boolean).join(" / ") || null
      : post.author?.job_title ?? null
    : null;

  const body = () => {
    if (postQ.isLoading) return <PulsenPostSkeleton />;
    if (postQ.isError) return <PulsenError onRetry={() => postQ.refetch()} />;
    if (!post) {
      return (
        <PulsenEmpty icon={SearchX} title="Opslaget findes ikke, eller du har ikke adgang" text="Det kan være slettet, eller det er delt i et team, du ikke er med i."
          action={<Link to="/storkbook" className="inline-flex min-h-[44px] items-center rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[15px] font-extrabold text-[hsl(var(--cph-light-blue))]">Til Storkbook</Link>} />
      );
    }
    return (
      <PulsenPostCard
        post={post}
        isMine={post.author_employee_id === me.employeeId}
        canModerate={me.canModerate(post)}
        contextLabel={contextLabel}
        imageUrl={post.image_path ? images.data?.get(post.image_path) : null}
        interactions={{
          summary: fr.getReactions(key),
          comments: fr.getComments(key),
          canInteract: fr.canInteract,
          onReact: (reaction) => fr.setReaction.mutate({ targetType: "pulsen_post", targetKey: key, reaction }),
          onComment: (b, m) => fr.addComment.mutateAsync({ targetType: "pulsen_post", targetKey: key, body: b, mentions: m }),
          onDeleteComment: (cid) => fr.deleteComment.mutateAsync(cid),
        }}
        onEdit={(b, m) => mut.edit.mutateAsync({ id: post.id, body: b, mentions: m }).then(() => postQ.refetch())}
        onDelete={() => mut.remove.mutate(post, { onSuccess: () => navigate(backTo, { replace: true }), onError: () => toast.error("Kunne ikke slette opslaget", { description: "Prøv igen." }) })}
        onHide={(hidden) => mut.setHidden.mutate({ id: post.id, hidden }, { onSettled: () => postQ.refetch(), onError: () => toast.error("Kunne ikke ændre synligheden", { description: "Prøv igen." }) })}
        onBestAnswer={(commentId) => mut.setBestAnswer.mutate({ id: post.id, commentId }, { onSettled: () => postQ.refetch(), onError: () => toast.error("Kunne ikke markere bedste svar", { description: "Prøv igen." }) })}
      />
    );
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-8">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
          <Link to={backTo} className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full px-2 text-[15px] font-extrabold text-foreground hover:bg-card">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Storkbook
          </Link>
          {body()}
        </div>
      </div>
    </MainLayout>
  );
}
