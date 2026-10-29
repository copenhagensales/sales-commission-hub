/**
 * Reaktioner og korte lykønskninger på forsidens fejringer og ligaplaceringer.
 * Målnøgler:
 *   birthday:<employee_id>:<år>
 *   anniversary:<employee_id>:<år>
 *   league_round:<season_id>:<employee_id>
 */
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sbAfgoer, sbAnmeld, sbModerer, startTjek, type AnmeldKode } from "@/hooks/useSbOpslag";
import { useAuth } from "@/hooks/useAuth";
import { REACTIONS, reactionKeyForEmoji, reactionOption, type ReactionKey } from "@/lib/feedReactions";
import { rensOmtaler, tilOmtaler, type Omtale } from "@/components/pulsen/omtaler";

/** pulsen_post/milestone: kun Huset-indhold (databasen afviser team-indhold). */
export type FeedTargetType = "birthday" | "anniversary" | "league_round" | "pulsen_post" | "milestone";
export interface FeedReactionGroup {
  key: ReactionKey;
  emoji: string;
  label: string;
  count: number;
}

/** Én reaktion pr. bruger (nyeste række tæller); gamle emojis grupperes via feedReactions.ts. */
export interface FeedReactionSummary {
  groups: FeedReactionGroup[];
  total: number;
  myReaction: ReactionKey | null;
  /** Navne på andre end en selv, nyeste først. */
  otherNames: string[];
}

export interface FeedCommentView {
  id: string;
  body: string;
  authorName: string;
  isMine: boolean;
  createdAt: string;
  mentions: Omtale[];
  /** S7: tjekstatus, revision og moderation. */
  status?: string | null;
  revision?: number | null;
  hiddenAt?: string | null;
  hiddenKode?: string | null;
}

export function buildTargetKey(
  targetType: FeedTargetType,
  parts: (string | number)[]
): string {
  return [targetType, ...parts].join(":");
}

function useUserNameLookup() {
  const { data } = useQuery({
    queryKey: ["feed-user-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("auth_user_id, first_name, last_name")
        .not("auth_user_id", "is", null);

      if (error) throw error;

      const map = new Map<string, string>();
      (data || []).forEach((row) => {
        if (!row.auth_user_id) return;
        const last = (row.last_name || "").trim();
        const short = last ? `${row.first_name} ${last.charAt(0).toUpperCase()}.` : row.first_name;
        map.set(row.auth_user_id, short || "Kollega");
      });
      return map;
    },
    staleTime: 1000 * 60 * 30,
  });

  return useCallback(
    (userId: string) => data?.get(userId) ?? "Kollega",
    [data]
  );
}

type ReactionRow = { id: string; target_key: string; user_id: string; emoji: string; created_at: string };
type ReactionVars = { targetType: FeedTargetType; targetKey: string; reaction: ReactionKey };

// Koordinering på modulniveau, delt af alle instanser af hooken (forside, Storkbook m.fl.).
// Skrivninger pr. bruger+mål udføres i rækkefølge; sidste handling vinder.
const chainByTarget = new Map<string, Promise<unknown>>();
// Løbenummer pr. bruger+mål: kun den nyeste handling må rulle cachen tilbage ved fejl.
const seqByTarget = new Map<string, number>();
// Hensigt fundet i onMutate (sæt eller fjern), så mutationFn ikke læser den optimistisk ændrede cache.
const intentByVars = new WeakMap<ReactionVars, "set" | "remove">();
// Samlet tæller for alle afventende reaktioner; genhentning udskydes, til ingen er afventende.
let pendingTotal = 0;
let invalidateAfter = false;

function invalidateReactions(queryClient: QueryClient) {
  if (pendingTotal > 0) {
    invalidateAfter = true;
    return;
  }
  invalidateAfter = false;
  queryClient.invalidateQueries({ queryKey: ["feed-reactions"] });
}

/** Alle reaktions-caches (alle instanser), hvis målliste indeholder targetKey. */
function reactionCachesFor(queryClient: QueryClient, targetKey: string) {
  return queryClient
    .getQueriesData<ReactionRow[]>({ queryKey: ["feed-reactions"] })
    .filter(([qk]) => Array.isArray(qk[1]) && (qk[1] as unknown[]).includes(targetKey));
}

export function useFeedReactions(targetKeys: string[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myUserId = user?.id ?? null;
  const lookupName = useUserNameLookup();

  const keys = useMemo(
    () => Array.from(new Set(targetKeys.filter(Boolean))).sort(),
    [targetKeys]
  );

  const enabled = keys.length > 0;

  const reactionsQuery = useQuery({
    queryKey: ["feed-reactions", keys],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_reactions")
        .select("id, target_key, user_id, emoji, created_at")
        .in("target_key", keys);

      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const commentsQuery = useQuery({
    queryKey: ["feed-comments", keys],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_comments")
        .select("id, target_key, user_id, body, created_at, mentions, status, revision, hidden_at, hidden_kode")
        .in("target_key", keys)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const invalidate = () => {
    invalidateReactions(queryClient);
    queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
  };

  /** Sætter brugerens ene reaktion. Samme reaktion igen = fjern. Anden reaktion = skift. Optimistisk med tilbagerulning. */
  const setReaction = useMutation({
    // Ingen genforsøg: et genforsøg ville køre uden for sin plads i køen pr. mål.
    retry: 0,
    onMutate: async (vars: ReactionVars) => {
      const ownKey = ["feed-reactions", keys];
      const coordKey = `${myUserId ?? ""}:${vars.targetKey}`;
      pendingTotal += 1;
      const seq = (seqByTarget.get(coordKey) ?? 0) + 1;
      seqByTarget.set(coordKey, seq);
      await queryClient.cancelQueries({ queryKey: ["feed-reactions"] });
      const isMine = (r: ReactionRow) => r.target_key === vars.targetKey && r.user_id === myUserId;
      const targets = reactionCachesFor(queryClient, vars.targetKey);
      const own = queryClient.getQueryData<ReactionRow[]>(ownKey);
      const base = own ?? targets.find(([, d]) => d)?.[1] ?? [];
      const previousMine = base.filter(isMine);
      const latest = [...previousMine].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
      const current = latest ? reactionKeyForEmoji(latest.emoji) : null;
      intentByVars.set(vars, current === vars.reaction ? "remove" : "set");
      if (myUserId) {
        const optimistic: ReactionRow | null = current !== vars.reaction
          ? { id: "optimistisk-" + crypto.randomUUID(), target_key: vars.targetKey, user_id: myUserId, emoji: reactionOption(vars.reaction).emoji, created_at: new Date().toISOString() }
          : null;
        targets.forEach(([qk, data]) => {
          if (!data) return;
          const next = data.filter((r) => !isMine(r));
          if (optimistic) next.push(optimistic);
          queryClient.setQueryData<ReactionRow[]>(qk, next);
        });
        if (!own) queryClient.setQueryData<ReactionRow[]>(ownKey, optimistic ? [optimistic] : []);
      }
      return { previousMine, seq, coordKey };
    },
    mutationFn: async (vars: ReactionVars) => {
      const { targetType, targetKey, reaction } = vars;
      const intent = intentByVars.get(vars) ?? "set";
      const coordKey = `${myUserId ?? ""}:${targetKey}`;
      const previous = chainByTarget.get(coordKey) ?? Promise.resolve();
      const run = (async () => {
        await previous.catch(() => {});
        if (!myUserId) throw new Error("Du skal være logget ind");
        if (intent === "remove") {
          const { error } = await supabase.from("feed_reactions").delete()
            .eq("target_key", targetKey).eq("user_id", myUserId);
          if (error) throw error;
          return;
        }
        const { data, error } = await supabase.from("feed_reactions").insert({
          target_type: targetType,
          target_key: targetKey,
          user_id: myUserId,
          emoji: reactionOption(reaction).emoji,
        }).select("id").single();
        if (error) throw error;
        const { error: delError } = await supabase.from("feed_reactions").delete()
          .eq("target_key", targetKey).eq("user_id", myUserId).neq("id", data.id);
        if (delError) throw delError;
      })();
      chainByTarget.set(coordKey, run);
      try {
        await run;
      } finally {
        if (chainByTarget.get(coordKey) === run) chainByTarget.delete(coordKey);
      }
    },
    onError: (_e, vars, ctx) => {
      if (ctx && ctx.seq === seqByTarget.get(ctx.coordKey)) {
        reactionCachesFor(queryClient, vars.targetKey).forEach(([qk, data]) => {
          if (!data) return;
          const others = data.filter((r) => !(r.target_key === vars.targetKey && r.user_id === myUserId));
          queryClient.setQueryData<ReactionRow[]>(qk, [...others, ...ctx.previousMine]);
        });
        const ownKey = ["feed-reactions", keys];
        if (!queryClient.getQueryData<ReactionRow[]>(ownKey)) queryClient.setQueryData<ReactionRow[]>(ownKey, ctx.previousMine);
      }
      toast.error("Reaktionen blev ikke gemt");
    },
    onSettled: (_d, _e, vars) => {
      intentByVars.delete(vars);
      pendingTotal = Math.max(0, pendingTotal - 1);
      if (pendingTotal === 0) {
        invalidateReactions(queryClient);
      } else {
        invalidateAfter = true;
      }
    },
  });


  const addComment = useMutation({
    retry: 0,
    mutationFn: async ({
      targetType,
      targetKey,
      body,
      mentions,
    }: {
      targetType: FeedTargetType;
      targetKey: string;
      body: string;
      mentions?: Omtale[];
    }) => {
      if (!myUserId) throw new Error("Du skal være logget ind");
      const trimmed = body.trim().slice(0, 200);
      if (!trimmed) throw new Error("Beskeden må ikke være tom");

      const { data, error } = await supabase.from("feed_comments").insert({
        target_type: targetType,
        target_key: targetKey,
        user_id: myUserId,
        body: trimmed,
        mentions: rensOmtaler(trimmed, mentions ?? []),
      }).select("id, status, revision").single();
      if (error) throw error;
      const r = data as { id: string; status?: string | null; revision?: number | null };
      if (r.status === "tjekkes") startTjek("kommentar", r.id, r.revision, invalidate);  // S7-c: genhent, når tjekket er slut
    },
    onSuccess: invalidate,
  });
  // S7-c: moderation, anmeldelse og forfatterens afgørelse for kommentarer
  const moderateComment = useMutation({ retry: 0, mutationFn: async ({ id, hide, kode }: { id: string; hide: boolean; kode?: AnmeldKode | null }) => sbModerer("kommentar", id, hide ? "skjul" : "vis", kode), onSettled: invalidate });
  const reportComment = useMutation({ retry: 0, mutationFn: async ({ id, kode }: { id: string; kode: AnmeldKode }) => sbAnmeld("kommentar", id, kode) });
  const decideComment = useMutation({ retry: 0, mutationFn: async ({ id, revision, handling }: { id: string; revision: number; handling: "send" | "traek" }) => sbAfgoer("kommentar", id, revision, handling), onSettled: invalidate });

  const deleteComment = useMutation({
    retry: 0,
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("feed_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const getReactions = useCallback(
    (targetKey: string): FeedReactionSummary => {
      const latestByUser = new Map<string, { emoji: string; created_at: string }>();
      (reactionsQuery.data || [])
        .filter((r) => r.target_key === targetKey)
        .forEach((r) => {
          const prev = latestByUser.get(r.user_id);
          if (!prev || r.created_at > prev.created_at) latestByUser.set(r.user_id, r);
        });
      const counts = new Map<ReactionKey, number>();
      latestByUser.forEach((r) => {
        const key = reactionKeyForEmoji(r.emoji);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      const groups = REACTIONS.filter((o) => counts.has(o.key))
        .map((o) => ({ ...o, count: counts.get(o.key) ?? 0 }))
        .sort((x, y) => y.count - x.count);
      const mine = myUserId ? latestByUser.get(myUserId) : undefined;
      const otherNames = Array.from(latestByUser.entries())
        .filter(([uid]) => uid !== myUserId)
        .sort((x, y) => y[1].created_at.localeCompare(x[1].created_at))
        .map(([uid]) => lookupName(uid));
      return {
        groups,
        total: latestByUser.size,
        myReaction: mine ? reactionKeyForEmoji(mine.emoji) : null,
        otherNames,
      };
    },
    [reactionsQuery.data, lookupName, myUserId]
  );

  const getComments = useCallback(
    (targetKey: string): FeedCommentView[] =>
      (commentsQuery.data || [])
        .filter((c) => c.target_key === targetKey)
        .map((c) => ({
          id: c.id,
          body: c.body,
          authorName: lookupName(c.user_id),
          isMine: c.user_id === myUserId,
          status: (c as { status?: string | null }).status ?? null,
          revision: (c as { revision?: number | null }).revision ?? null,
          hiddenAt: (c as { hidden_at?: string | null }).hidden_at ?? null,
          hiddenKode: (c as { hidden_kode?: string | null }).hidden_kode ?? null,
          createdAt: c.created_at,
          mentions: tilOmtaler(c.mentions),
        })),
    [commentsQuery.data, lookupName, myUserId]
  );

  return {
    getReactions,
    getComments,
    setReaction,
    addComment,
    deleteComment,
    moderateComment,
    reportComment,
    decideComment,
    isLoading: reactionsQuery.isLoading || commentsQuery.isLoading,
    canInteract: !!myUserId && !reactionsQuery.isLoading,
  };
}
