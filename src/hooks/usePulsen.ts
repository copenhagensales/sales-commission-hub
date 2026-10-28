/**
 * Pulsen: feed, teams, skrive/redigere/slette/skjule, billeder og sidekolonne.
 * Synlighed håndhæves af databasen (RLS på pulsen_posts og storage). Ingen salg/provision/løn.
 */
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { startOfDay, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { compressPulsenImage } from "@/lib/pulsen/compressImage";
import { PULSEN_MAX_CHARS, PULSEN_PAGE_SIZE } from "@/lib/pulsen/format";
import { rensOmtaler, tilOmtaler, type Omtale } from "@/components/pulsen/omtaler";

export const PULSEN_BUCKET = "pulsen-images";
export type PulsenScope = { kind: "house" } | { kind: "team"; teamId: string };
export type PulsenPostType = "post" | "praise" | "question" | "image" | "event" | "poll";

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
  /** @-omtaler (tom liste for opslag uden omtaler). */
  mentions?: Omtale[];
  author: PersonRef | null;
  praised: PersonRef | null;
  praised_employee_ids?: string[];
  /** Alle roste kolleger i rækkefølge (fyldes efter hentning). */
  praisedAll?: PersonRef[];
  /** Kun i cachen mens indlægget gemmes. */
  pending?: boolean;
  localImageUrl?: string;
}

const POST_SELECT =
  "id, author_employee_id, audience, team_id, post_type, body, praised_employee_id, praised_employee_ids, image_path, best_answer_comment_id, hidden_at, created_at, edited_at, mentions, author:employee_master_data!pulsen_posts_author_employee_id_fkey(id, first_name, last_name, job_title), praised:employee_master_data!pulsen_posts_praised_employee_id_fkey(id, first_name, last_name)";

/** Henter navne på alle roste kolleger, så ros til flere vises korrekt. */
async function attachPraised(posts: PulsenPost[]): Promise<PulsenPost[]> {
  const ids = Array.from(new Set(posts.flatMap((p) => p.praised_employee_ids ?? [])));
  posts = posts.map((p) => ({ ...p, mentions: tilOmtaler(p.mentions) }));
  if (ids.length === 0) return posts;
  const { data, error } = await supabase.from("employee_master_data").select("id, first_name, last_name").in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.id, r as PersonRef]));
  return posts.map((p) => ({
    ...p,
    praisedAll: (p.praised_employee_ids ?? []).map((id) => byId.get(id)).filter((x): x is PersonRef => !!x),
  }));
}

export const scopeKey = (s: PulsenScope) => (s.kind === "house" ? "house" : `team:${s.teamId}`);
const feedKey = (s: PulsenScope) => ["pulsen-feed", scopeKey(s)];
export const postTargetKey = (id: string) => `pulsen_post:${id}`;

/** Den indloggedes eget navn/rolle til optimistiske indlæg. */
export function usePulsenSelf(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["pulsen-self", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("id", employeeId as string)
        .maybeSingle();
      if (error) throw error;
      return data as PersonRef | null;
    },
    enabled: !!employeeId,
    staleTime: 600000,
  });
}

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
  const teams = usePulsenTeams();
  const self = usePulsenSelf(employeeId);
  const led = ledTeams.data ?? [];
  return {
    employeeId: employeeId ?? null,
    self: self.data ?? (employeeId ? { id: employeeId, first_name: null, last_name: null } : null),
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

/** Brugerens teams (ejer: alle teams). Bruges af Storkbook og @-omtaler. */
export function usePulsenTeams() {
  const { data: employeeId } = useCurrentEmployeeId();
  const { isOwner } = usePermissions();
  return useQuery({
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
      return attachPraised((data ?? []) as unknown as PulsenPost[]);
    },
    getNextPageParam: (last, all) => (last.length === PULSEN_PAGE_SIZE ? all.length : undefined),
    enabled,
    staleTime: 30000,
  });
}

/** Ét opslag (samme select som feedet). null = findes ikke eller ingen adgang (RLS). */
export function usePulsenPost(id: string | undefined) {
  return useQuery({
    queryKey: ["pulsen-post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pulsen_posts").select(POST_SELECT).eq("id", id as string).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (await attachPraised([data as unknown as PulsenPost]))[0];
    },
    enabled: !!id,
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
  postType: Exclude<PulsenPostType, "event" | "poll">;
  body: string;
  praised?: { id: string; first_name: string | null; last_name: string | null }[] | null;
  imageFile?: File | null;
  mentions?: Omtale[];
}

type FeedData = InfiniteData<PulsenPost[], number>;

export function usePulsenMutations(author: PersonRef | null) {
  const qc = useQueryClient();

  const patchEverywhere = (fn: (p: PulsenPost) => PulsenPost | null) => {
    // Skriv kun caches, der faktisk ændres, så en tidligere invalidering ikke ophæves.
    qc.getQueriesData<FeedData>({ queryKey: ["pulsen-feed"] }).forEach(([key, data]) => {
      if (!data) return;
      const pages = data.pages.map((page) => {
        const p2 = page.map(fn).filter((p): p is PulsenPost => !!p);
        return p2.length === page.length && p2.every((p, i) => p === page[i]) ? page : p2;
      });
      if (pages.some((pg, i) => pg !== data.pages[i])) qc.setQueryData<FeedData>(key, { ...data, pages });
    });
    qc.getQueriesData<PulsenPost | null>({ queryKey: ["pulsen-post"] }).forEach(([key, data]) => {
      const next = data ? fn(data) : data;
      if (next !== data) qc.setQueryData(key, next);
    });
  };
  const cancelFor = async (id: string) => {
    await qc.cancelQueries({ queryKey: ["pulsen-post", id] });
    await qc.cancelQueries({ queryKey: ["pulsen-feed"] });
  };
  // Serveren er sandheden: hent feed og opslag igen efter fejl og afslutning.
  const refresh = (id: string) => {
    qc.invalidateQueries({ queryKey: ["pulsen-feed"] });
    qc.invalidateQueries({ queryKey: ["pulsen-post", id] });
  };

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
          praised_employee_id: input.postType === "praise" ? input.praised?.[0]?.id ?? null : null,
          praised_employee_ids: input.postType === "praise" ? (input.praised ?? []).map((p) => p.id) : [],
          image_path: imagePath,
          mentions: rensOmtaler(body, input.mentions ?? []),
        })
        .select(POST_SELECT)
        .single();
      if (error) {
        if (imagePath) await supabase.storage.from(PULSEN_BUCKET).remove([imagePath]);
        throw error;
      }
      return (await attachPraised([data as unknown as PulsenPost]))[0];
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
        praised_employee_id: input.praised?.[0]?.id ?? null,
        praised_employee_ids: (input.praised ?? []).map((p) => p.id),
        praisedAll: input.praised ?? [],
        image_path: null,
        best_answer_comment_id: null,
        hidden_at: null,
        created_at: new Date().toISOString(),
        edited_at: null,
        mentions: rensOmtaler(input.body.trim(), input.mentions ?? []),
        author,
        praised: input.praised?.[0] ?? null,
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
    mutationFn: async ({ id, body, mentions }: { id: string; body: string; mentions?: Omtale[] }) => {
      const tekst = body.trim().slice(0, PULSEN_MAX_CHARS);
      // Omtaler sendes kun, når feltet har en liste (databasen tillader kun forfatteren at ændre dem).
      const { error } = await supabase.from("pulsen_posts")
        .update(mentions ? { body: tekst, mentions: rensOmtaler(tekst, mentions) } : { body: tekst }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, body, mentions }) => {
      await cancelFor(id);
      patchEverywhere((p) => (p.id === id
        ? { ...p, body: body.trim(), edited_at: new Date().toISOString(), ...(mentions ? { mentions: rensOmtaler(body.trim(), mentions) } : {}) }
        : p));
    },
    onError: (_e, v) => refresh(v.id),
    onSettled: (_d, _e, v) => refresh(v.id),
  });

  const remove = useMutation({
    mutationFn: async (post: PulsenPost) => {
      const { error } = await supabase.from("pulsen_posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
      if (error) throw error;
      // Billedet slettes sammen med indlægget (forfatterens egen mappe).
      if (post.image_path) await supabase.storage.from(PULSEN_BUCKET).remove([post.image_path]);
    },
    onMutate: async (post) => {
      await cancelFor(post.id);
      patchEverywhere((p) => (p.id === post.id ? null : p));
    },
    onError: (_e, v) => refresh(v.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulsen-unanswered"] }),
    onSettled: (_d, _e, v) => refresh(v.id),
  });

  const setHidden = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase
        .from("pulsen_posts")
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, hidden }) => {
      await cancelFor(id);
      patchEverywhere((p) => (p.id === id ? { ...p, hidden_at: hidden ? new Date().toISOString() : null } : p));
    },
    onError: (_e, v) => refresh(v.id),
    onSettled: (_d, _e, v) => refresh(v.id),
  });

  const setBestAnswer = useMutation({
    mutationFn: async ({ id, commentId }: { id: string; commentId: string | null }) => {
      const { error } = await supabase.from("pulsen_posts").update({ best_answer_comment_id: commentId }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, commentId }) => {
      await cancelFor(id);
      patchEverywhere((p) => (p.id === id ? { ...p, best_answer_comment_id: commentId } : p));
    },
    onError: (_e, v) => refresh(v.id),
    onSettled: (_d, _e, v) => refresh(v.id),
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


/** De nyeste Huset-indlæg til forsidens Storkbook-modul (samme RLS som feedet). Tællinger kommer fra useFeedReactions. */
export function usePulsenLatestPosts(enabled: boolean, limit = 3) {
  return useQuery({
    queryKey: ["pulsen-latest-posts", limit],
    queryFn: async (): Promise<PulsenPost[]> => {
      const { data, error } = await supabase
        .from("pulsen_posts").select(POST_SELECT)
        .eq("audience", "house").is("deleted_at", null).is("hidden_at", null)
        .order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return attachPraised((data ?? []) as unknown as PulsenPost[]);
    },
    enabled,
    staleTime: 60000,
  });
}

/** Tidspunkt for sidste besøg i Storkbook (læses kun; nulstilles kun af /storkbook). */
export function usePulsenLastSeen(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["pulsen-last-seen", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pulsen_last_seen").select("last_seen_house").eq("employee_id", employeeId as string).maybeSingle();
      if (error) throw error;
      return data?.last_seen_house ?? null;
    },
    enabled: !!employeeId,
    staleTime: 120000,
  });
}

// ---------- Trin 6: milepæle ----------
export type PulsenMilestoneType = "first_sale" | "record_day" | "record_week" | "record_pay_period" | "club" | "streak" | "team_day_sales" | "team_record" | "house_record";
export interface PulsenMilestone {
  id: string;
  milestone_type: PulsenMilestoneType;
  employee_id: string | null;
  team_id: string | null;
  period_key: string;
  level: number;
  value: number;
  payload: { text?: string; previous?: number | null; day?: string; tier?: number } | null;
  shown_in_house: boolean;
  occurred_at: string;
}
export const milestoneTargetKey = (id: string) => `milestone:${id}`;

/** Milepæle for Huset (shown_in_house) eller ét team. RLS afgør synlighed. */
export function usePulsenMilestones(scope: PulsenScope, enabled: boolean, limit = 50) {
  return useQuery({
    queryKey: ["pulsen-milestones", scopeKey(scope), limit],
    queryFn: async () => {
      let q = supabase.from("pulsen_milestones")
        .select("id, milestone_type, employee_id, team_id, period_key, level, value, payload, shown_in_house, occurred_at")
        // Første salg fejres ikke længere (Kasper 23/10-2026); gamle rækker bevares, men vises ikke.
        .neq("milestone_type", "first_sale");
      if (scope.kind === "house") {
        q = q.eq("shown_in_house", true);
      } else {
        // Personlige milepæle vises i alle sælgerens teams; teamet afgøres ved læsning via team_members.
        const { data: members, error: mErr } = await supabase.from("team_members").select("employee_id").eq("team_id", scope.teamId);
        if (mErr) throw mErr;
        const ids = [...new Set((members ?? []).map((m) => m.employee_id))];
        q = ids.length ? q.or(`team_id.eq.${scope.teamId},employee_id.in.(${ids.join(",")})`) : q.eq("team_id", scope.teamId);
      }
      const { data, error } = await q.order("occurred_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as PulsenMilestone[];
    },
    enabled,
    staleTime: 60000,
  });
}

/** Dagens milepæle (dansk døgn) for Huset eller ét team: de nyeste `limit` + samlet antal. */
export function usePulsenMilestonesToday(scope: PulsenScope, enabled: boolean, limit = 100) {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
  return useQuery({
    queryKey: ["pulsen-milestones-today", scopeKey(scope), day, limit],
    queryFn: async () => {
      let q = supabase.from("pulsen_milestones")
        .select("id, milestone_type, employee_id, team_id, period_key, level, value, payload, shown_in_house, occurred_at", { count: "exact" })
        .neq("milestone_type", "first_sale")
        .gte("occurred_at", startOfDay(new Date()).toISOString());
      if (scope.kind === "house") {
        q = q.eq("shown_in_house", true);
      } else {
        const { data: members, error: mErr } = await supabase.from("team_members").select("employee_id").eq("team_id", scope.teamId);
        if (mErr) throw mErr;
        const ids = [...new Set((members ?? []).map((m) => m.employee_id))];
        q = ids.length ? q.or(`team_id.eq.${scope.teamId},employee_id.in.(${ids.join(",")})`) : q.eq("team_id", scope.teamId);
      }
      const { data, error, count } = await q.order("occurred_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return { items: (data ?? []) as unknown as PulsenMilestone[], count: count ?? 0 };
    },
    enabled,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

// ---------- Trin 7: toplinje ----------
export interface PulsenToplineTeam { id: string; name: string; today: number; lastWeek: number; yesterday: number }
export interface PulsenTopline {
  house: { today: number; lastWeek: number; yesterday: number };
  teams: PulsenToplineTeam[];
  computedAt: string;
}
/** Husets og teamenes salg i dag (samme tælling som TV-boards/kpi sales_count). Kun aggregater. */
export function usePulsenTopline(enabled: boolean) {
  return useQuery({
    queryKey: ["pulsen-topline"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pulsen-topline", { method: "POST" });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as PulsenTopline;
    },
    enabled,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

/** Antal milepæle i Huset i går (til bundlinjen). */
export function usePulsenMilestonesYesterday(enabled: boolean) {
  return useQuery({
    queryKey: ["pulsen-milestones-yesterday", startOfDay(new Date()).toISOString()],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 1)).toISOString();
      const to = startOfDay(new Date()).toISOString();
      const { count, error } = await supabase.from("pulsen_milestones").select("id", { count: "exact", head: true })
        .eq("shown_in_house", true).gte("occurred_at", from).lt("occurred_at", to);
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
    staleTime: 600000,
  });
}

// ---------- Trin 7: ulæst-badge ----------
const UNREAD_KEY = ["pulsen-unread"];
/** Nye Huset-elementer (indlæg + milepæle) siden sidste besøg. Cache 2 min. */
export function usePulsenUnread(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: [...UNREAD_KEY, employeeId],
    queryFn: async () => {
      const { data: seen, error: sErr } = await supabase.from("pulsen_last_seen").select("last_seen_house").eq("employee_id", employeeId as string).maybeSingle();
      if (sErr) throw sErr;
      const since = seen?.last_seen_house ?? new Date(0).toISOString();
      const [posts, ms] = await Promise.all([
        supabase.from("pulsen_posts").select("id", { count: "exact", head: true })
          .eq("audience", "house").is("deleted_at", null).is("hidden_at", null).neq("author_employee_id", employeeId as string).gt("created_at", since),
        supabase.from("pulsen_milestones").select("id", { count: "exact", head: true }).eq("shown_in_house", true).neq("milestone_type", "first_sale").gt("occurred_at", since),
      ]);
      if (posts.error) throw posts.error;
      if (ms.error) throw ms.error;
      return (posts.count ?? 0) + (ms.count ?? 0);
    },
    enabled: !!employeeId,
    staleTime: 120000,
  });
}

/** Markér Huset som set, når Pulsen åbnes. */
export function useMarkPulsenSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.from("pulsen_last_seen")
        .upsert({ employee_id: employeeId, last_seen_house: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "employee_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.setQueriesData({ queryKey: UNREAD_KEY }, 0),
  });
}

export const formatUnread = (n: number) => (n > 9 ? "9+" : String(n));

// ---------- S2: afstemninger ----------
export interface NewPulsenPoll {
  audience: "house" | "team";
  teamId: string | null;
  body: string;
  options: string[];
  anonymous: boolean;
  dage: number;
  mentions?: Omtale[];
}

/** Afstemningen er oprettet, men omtalerne blev ikke gemt; genforsøg skal kun gentage UPDATE på `postId`. */
export class AfstemningOmtaleFejl extends Error {
  constructor(public postId: string, public cause: unknown) {
    super("Omtalerne kunne ikke gemmes");
  }
}

/** Opretter en afstemning via RPC; feedet hentes igen bagefter (ingen optimistisk række). */
export function useOpretAfstemning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: NewPulsenPoll & { eksisterendeId?: string }) => {
      let data: string | null = p.eksisterendeId ?? null;
      if (!data) {
        const res = await supabase.rpc("pulsen_opret_afstemning", {
          p_audience: p.audience,
          // null for Huset; typerne kender ikke nullable parametre
          p_team_id: (p.audience === "team" ? p.teamId : null) as string,
          p_body: p.body.trim(),
          p_options: p.options,
          p_anonymous: p.anonymous,
          p_dage: p.dage,
        });
        if (res.error) throw res.error;
        data = res.data;
      }
      // RPC'en kender ikke omtaler; forfatteren sætter dem på det oprettede opslag bagefter.
      const omtaler = rensOmtaler(p.body.trim(), p.mentions ?? []);
      if (omtaler.length && data) {
        const { error: mErr } = await supabase.from("pulsen_posts").update({ mentions: omtaler }).eq("id", data);
        if (mErr) throw new AfstemningOmtaleFejl(data, mErr);
      }
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pulsen-feed"] });
      qc.invalidateQueries({ queryKey: ["pulsen-latest-posts"] });
    },
  });
}

export interface PulsenPollData {
  poll: { post_id: string; anonymous: boolean; closes_at: string; closed_at: string | null; created_by: string } | null;
  options: { id: string; position: number; label: string }[];
  votes: { id: string; option_id: string; employee_id: string | null }[];
  hasVoted: boolean;
  /** Eget valg (kun kendt ved navngivne afstemninger eller lige efter stemmen). */
  myOptionId: string | null;
}

export function usePulsenPoll(postId: string, enabled: boolean, opts: { poll?: boolean } = {}) {
  const qc = useQueryClient();
  const { data: employeeId } = useCurrentEmployeeId();
  const key = ["pulsen-poll", postId];
  const shouldPoll = enabled && (opts.poll ?? true);
  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<PulsenPollData> => {
      const [pollR, optR, voteR, ballotR] = await Promise.all([
        supabase.from("pulsen_polls").select("post_id, anonymous, closes_at, closed_at, created_by").eq("post_id", postId).maybeSingle(),
        supabase.from("pulsen_poll_options").select("id, position, label").eq("post_id", postId).order("position"),
        supabase.from("pulsen_poll_votes").select("id, option_id, employee_id").eq("post_id", postId),
        supabase.from("pulsen_poll_ballots").select("stemt").eq("post_id", postId).eq("employee_id", employeeId as string).maybeSingle(),
      ]);
      for (const r of [pollR, optR, voteR, ballotR]) if (r.error) throw r.error;
      const votes = voteR.data ?? [];
      return {
        poll: pollR.data ?? null,
        options: optR.data ?? [],
        votes,
        hasVoted: !!ballotR.data,
        myOptionId: votes.find((v) => v.employee_id === employeeId)?.option_id ?? null,
      };
    },
    enabled: enabled && !!employeeId,
    refetchInterval: shouldPoll ? 30000 : false,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });

  // Udløb: render igen præcis ved closes_at (højst 24 t frem).
  const [tick, setTick] = useState(0);
  const closesAt = query.data?.poll?.closes_at ?? null;
  const closedAt = query.data?.poll?.closed_at ?? null;
  useEffect(() => {
    if (!closesAt || closedAt) return;
    const ms = new Date(closesAt).getTime() - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), Math.min(ms + 50, 24 * 3600000));
    return () => clearTimeout(t);
  }, [closesAt, closedAt, tick]);
  const isClosed = !!closedAt || (!!closesAt && new Date(closesAt).getTime() <= Date.now());

  const vote = useMutation({
    retry: 0,
    mutationFn: async (optionId: string) => {
      const { error } = await supabase.rpc("pulsen_stem", { p_post_id: postId, p_option_id: optionId });
      if (error) throw error;
    },
    onMutate: async (optionId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PulsenPollData>(key);
      if (prev) {
        const without = prev.votes.filter((v) => !(prev.myOptionId && v.employee_id === employeeId) && v.id !== "optimistisk");
        const mine = { id: "optimistisk", option_id: optionId, employee_id: prev.poll?.anonymous ? null : employeeId ?? null };
        qc.setQueryData<PulsenPollData>(key, { ...prev, votes: [...without, mine], hasVoted: true, myOptionId: optionId });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const close = useMutation({
    retry: 0,
    mutationFn: async () => {
      const { error } = await supabase.rpc("pulsen_luk_afstemning", { p_post_id: postId });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { query, vote, close, isClosed, employeeId: employeeId ?? null };
}
