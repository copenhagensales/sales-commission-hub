/**
 * Pulsen: feed, teams, skrive/redigere/slette/skjule, billeder og sidekolonne.
 * Synlighed håndhæves af databasen (RLS på pulsen_posts og storage). Ingen salg/provision/løn.
 */
import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { startOfDay, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { compressPulsenImage } from "@/lib/pulsen/compressImage";
import { PULSEN_MAX_CHARS, PULSEN_PAGE_SIZE } from "@/lib/pulsen/format";

export const PULSEN_BUCKET = "pulsen-images";
export type PulsenScope = { kind: "house" } | { kind: "team"; teamId: string };
export type PulsenPostType = "post" | "praise" | "question" | "image" | "event";

interface PersonRef { id: string; first_name: string | null; last_name: string | null; job_title?: string | null }

export interface PulsenPost {
  id: string;
  author_employee_id: string;
  audience: "house" | "team";
  team_id: string | null;
  post_type: PulsenPostType;
  body: string;
  praised_employee_id: string | null;
  image_path: string | null;
  best_answer_comment_id: string | null;
  hidden_at: string | null;
  created_at: string;
  edited_at: string | null;
  author: PersonRef | null;
  praised: PersonRef | null;
  /** Kun i cachen mens indlægget gemmes. */
  pending?: boolean;
  localImageUrl?: string;
}

const POST_SELECT =
  "id, author_employee_id, audience, team_id, post_type, body, praised_employee_id, image_path, best_answer_comment_id, hidden_at, created_at, edited_at, author:employee_master_data!pulsen_posts_author_employee_id_fkey(id, first_name, last_name, job_title), praised:employee_master_data!pulsen_posts_praised_employee_id_fkey(id, first_name, last_name)";

export const scopeKey = (s: PulsenScope) => (s.kind === "house" ? "house" : `team:${s.teamId}`);
const feedKey = (s: PulsenScope) => ["pulsen-feed", scopeKey(s)];
export const postTargetKey = (id: string) => `pulsen_post:${id}`;

export function usePulsenMe() {
  const { data: employeeId, isLoading } = useCurrentEmployeeId();
  const { isOwner, canEdit } = usePermissions();
  const ledTeams = useQuery({
    queryKey: ["pulsen-led-teams", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pulsen_led_team_ids");
      if (error) throw error;
      return (data as string[]) ?? [];
    },
    enabled: !!employeeId,
    staleTime: 300000,
  });
  const teams = useQuery({
    queryKey: ["pulsen-teams", employeeId, isOwner],
    queryFn: async () => {
      if (isOwner) {
        const { data, error } = await supabase.from("teams").select("id, name").order("name");
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("team_members")
        .select("team:teams(id, name)")
        .eq("employee_id", employeeId as string);
      if (error) throw error;
      const list = (data ?? [])
        .map((r) => (r as { team: { id: string; name: string } | null }).team)
        .filter((t): t is { id: string; name: string } => !!t);
      return list.sort((a, b) => a.name.localeCompare(b.name, "da"));
    },
    enabled: !!employeeId,
    staleTime: 300000,
  });
  const led = ledTeams.data ?? [];
  return {
    employeeId: employeeId ?? null,
    isLoading: isLoading || teams.isLoading,
    teams: teams.data ?? [],
    isOwner,
    canPostHouse: canEdit("action_pulsen_post_house"),
    canManageEvents: canEdit("action_manage_company_events"),
    /** Spejler pulsen_can_moderate i databasen (kun til visning af knappen). */
    canModerate: (p: Pick<PulsenPost, "audience" | "team_id">) =>
      isOwner || (p.audience === "team" && canEdit("action_pulsen_moderate") && !!p.team_id && led.includes(p.team_id)),
  };
}

export function usePulsenFeed(scope: PulsenScope, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: feedKey(scope),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from("pulsen_posts").select(POST_SELECT).is("deleted_at", null);
      q = scope.kind === "house" ? q.eq("audience", "house") : q.eq("audience", "team").eq("team_id", scope.teamId);
      const from = pageParam * PULSEN_PAGE_SIZE;
      const { data, error } = await q.order("created_at", { ascending: false }).range(from, from + PULSEN_PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as PulsenPost[];
    },
    getNextPageParam: (last, all) => (last.length === PULSEN_PAGE_SIZE ? all.length : undefined),
    enabled,
    staleTime: 30000,
  });
}

/** Signerede adresser (1 time) til billeder, som brugeren må se. */
export function usePulsenImageUrls(paths: string[]) {
  const sorted = useMemo(() => Array.from(new Set(paths)).sort(), [paths]);
  return useQuery({
    queryKey: ["pulsen-image-urls", sorted],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PULSEN_BUCKET).createSignedUrls(sorted, 3600);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: 50 * 60 * 1000,
  });
}

export function useActiveColleagues(enabled: boolean) {
  return useQuery({
    queryKey: ["pulsen-colleagues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 600000,
  });
}

export interface NewPulsenPost {
  audience: "house" | "team";
  teamId: string | null;
  postType: Exclude<PulsenPostType, "event">;
  body: string;
  praised?: { id: string; first_name: string | null; last_name: string | null } | null;
  imageFile?: File | null;
}

type FeedData = InfiniteData<PulsenPost[], number>;

export function usePulsenMutations(author: PersonRef | null) {
  const qc = useQueryClient();

  const patchEverywhere = (fn: (p: PulsenPost) => PulsenPost | null) => {
    qc.getQueriesData<FeedData>({ queryKey: ["pulsen-feed"] }).forEach(([key, data]) => {
      if (!data) return;
      qc.setQueryData<FeedData>(key, {
        ...data,
        pages: data.pages.map((page) => page.map(fn).filter((p): p is PulsenPost => !!p)),
      });
    });
  };
  const snapshot = () => qc.getQueriesData<FeedData>({ queryKey: ["pulsen-feed"] });
  const restore = (snap: ReturnType<typeof snapshot>) => snap.forEach(([k, d]) => qc.setQueryData(k, d));

  const create = useMutation({
    mutationFn: async ({ input, id }: { input: NewPulsenPost; id: string; localUrl?: string }) => {
      if (!author) throw new Error("Din bruger er ikke koblet til et medarbejderkort");
      const body = input.body.trim().slice(0, PULSEN_MAX_CHARS);
      let imagePath: string | null = null;
      if (input.imageFile) {
        const blob = await compressPulsenImage(input.imageFile);
        imagePath = `${author.id}/${id}.webp`;
        const { error: upErr } = await supabase.storage
          .from(PULSEN_BUCKET)
          .upload(imagePath, blob, { contentType: "image/webp", upsert: false });
        if (upErr) throw upErr;
      }
      const { data, error } = await supabase
        .from("pulsen_posts")
        .insert({
          id,
          author_employee_id: author.id,
          audience: input.audience,
          team_id: input.audience === "team" ? input.teamId : null,
          post_type: input.postType,
          body,
          praised_employee_id: input.postType === "praise" ? input.praised?.id ?? null : null,
          image_path: imagePath,
        })
        .select(POST_SELECT)
        .single();
      if (error) {
        if (imagePath) await supabase.storage.from(PULSEN_BUCKET).remove([imagePath]);
        throw error;
      }
      return data as unknown as PulsenPost;
    },
    onMutate: async ({ input, id, localUrl }) => {
      const key = feedKey(input.audience === "house" ? { kind: "house" } : { kind: "team", teamId: input.teamId as string });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedData>(key);
      const optimistic: PulsenPost = {
        id,
        author_employee_id: author?.id ?? "",
        audience: input.audience,
        team_id: input.audience === "team" ? input.teamId : null,
        post_type: input.postType,
        body: input.body.trim(),
        praised_employee_id: input.praised?.id ?? null,
        image_path: null,
        best_answer_comment_id: null,
        hidden_at: null,
        created_at: new Date().toISOString(),
        edited_at: null,
        author,
        praised: input.praised ?? null,
        pending: true,
        localImageUrl: localUrl,
      };
      qc.setQueryData<FeedData>(key, (old) =>
        old ? { ...old, pages: [[optimistic, ...(old.pages[0] ?? [])], ...old.pages.slice(1)] } : { pages: [[optimistic]], pageParams: [0] }
      );
      return { key, prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (row, { id, localUrl }) => {
      patchEverywhere((p) => (p.id === id ? { ...row, localImageUrl: localUrl } : p));
      qc.invalidateQueries({ queryKey: ["pulsen-unanswered"] });
    },
  });

  const edit = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from("pulsen_posts").update({ body: body.trim().slice(0, PULSEN_MAX_CHARS) }).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, body }) => {
      const snap = snapshot();
      patchEverywhere((p) => (p.id === id ? { ...p, body: body.trim(), edited_at: new Date().toISOString() } : p));
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(ctx.snap),
  });

  const remove = useMutation({
    mutationFn: async (post: PulsenPost) => {
      const { error } = await supabase.from("pulsen_posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
      if (error) throw error;
      // Billedet slettes sammen med indlægget (forfatterens egen mappe).
      if (post.image_path) await supabase.storage.from(PULSEN_BUCKET).remove([post.image_path]);
    },
    onMutate: (post) => {
      const snap = snapshot();
      patchEverywhere((p) => (p.id === post.id ? null : p));
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(ctx.snap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulsen-unanswered"] }),
  });

  const setHidden = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase
        .from("pulsen_posts")
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, hidden }) => {
      const snap = snapshot();
      patchEverywhere((p) => (p.id === id ? { ...p, hidden_at: hidden ? new Date().toISOString() : null } : p));
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(ctx.snap),
  });

  const setBestAnswer = useMutation({
    mutationFn: async ({ id, commentId }: { id: string; commentId: string | null }) => {
      const { error } = await supabase.from("pulsen_posts").update({ best_answer_comment_id: commentId }).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, commentId }) => {
      const snap = snapshot();
      patchEverywhere((p) => (p.id === id ? { ...p, best_answer_comment_id: commentId } : p));
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(ctx.snap),
  });

  return { create, edit, remove, setHidden, setBestAnswer };
}

/** Huset-spørgsmål uden kommentarer (team-spørgsmål har ingen kommentarer i v1). */
export function usePulsenUnanswered(enabled: boolean) {
  return useQuery({
    queryKey: ["pulsen-unanswered"],
    queryFn: async () => {
      const { data: qs, error } = await supabase
        .from("pulsen_posts")
        .select("id, body, created_at, author:employee_master_data!pulsen_posts_author_employee_id_fkey(id, first_name, last_name)")
        .eq("audience", "house")
        .eq("post_type", "question")
        .is("deleted_at", null)
        .is("hidden_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const list = qs ?? [];
      if (list.length === 0) return [];
      const { data: cs, error: cErr } = await supabase
        .from("feed_comments")
        .select("target_key")
        .in("target_key", list.map((q) => postTargetKey(q.id)));
      if (cErr) throw cErr;
      const answered = new Set((cs ?? []).map((c) => c.target_key));
      return list.filter((q) => !answered.has(postTargetKey(q.id))).slice(0, 5) as unknown as {
        id: string; body: string; created_at: string; author: PersonRef | null;
      }[];
    },
    enabled,
    staleTime: 60000,
  });
}

/** Gårsdagens tal i Pulsen (kun det brugeren kan se – ingen salgstal). */
export function usePulsenYesterday(enabled: boolean) {
  return useQuery({
    queryKey: ["pulsen-yesterday", startOfDay(new Date()).toISOString()],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 1)).toISOString();
      const to = startOfDay(new Date()).toISOString();
      const [posts, reactions] = await Promise.all([
        supabase.from("pulsen_posts").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", from).lt("created_at", to),
        supabase.from("feed_reactions").select("id", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to),
      ]);
      return { posts: posts.count ?? 0, reactions: reactions.count ?? 0 };
    },
    enabled,
    staleTime: 600000,
  });
}
