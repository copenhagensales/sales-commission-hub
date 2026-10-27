/**
 * Reaktioner og korte lykønskninger på forsidens fejringer og ligaplaceringer.
 * Målnøgler:
 *   birthday:<employee_id>:<år>
 *   anniversary:<employee_id>:<år>
 *   league_round:<season_id>:<employee_id>
 */
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REACTIONS, reactionKeyForEmoji, reactionOption, type ReactionKey } from "@/lib/feedReactions";

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
        .select("id, target_key, user_id, body, created_at")
        .in("target_key", keys)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["feed-reactions"] });
    queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
  };

  type ReactionRow = { id: string; target_key: string; user_id: string; emoji: string; created_at: string };
  type ReactionVars = { targetType: FeedTargetType; targetKey: string; reaction: ReactionKey };
  // Hensigt fundet i onMutate (sæt eller fjern), så mutationFn ikke læser den optimistisk ændrede cache.
  const intentRef = useRef(new WeakMap<ReactionVars, "set" | "remove">());
  // Skrivninger pr. mål udføres i rækkefølge; sidste handling vinder.
  const chainRef = useRef(new Map<string, Promise<unknown>>());
  const pendingCountRef = useRef(new Map<string, number>());

  /** Sætter brugerens ene reaktion. Samme reaktion igen = fjern. Anden reaktion = skift. Optimistisk med tilbagerulning. */
  const setReaction = useMutation({
    onMutate: async (vars: ReactionVars) => {
      const qk = ["feed-reactions", keys];
      pendingCountRef.current.set(vars.targetKey, (pendingCountRef.current.get(vars.targetKey) ?? 0) + 1);
      await queryClient.cancelQueries({ queryKey: qk });
      const rows = queryClient.getQueryData<ReactionRow[]>(qk) ?? [];
      const isMine = (r: ReactionRow) => r.target_key === vars.targetKey && r.user_id === myUserId;
      const previousMine = rows.filter(isMine);
      const latest = [...previousMine].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
      const current = latest ? reactionKeyForEmoji(latest.emoji) : null;
      intentRef.current.set(vars, current === vars.reaction ? "remove" : "set");
      if (myUserId) {
        const next = rows.filter((r) => !isMine(r));
        if (current !== vars.reaction) {
          next.push({ id: "optimistisk-" + crypto.randomUUID(), target_key: vars.targetKey, user_id: myUserId, emoji: reactionOption(vars.reaction).emoji, created_at: new Date().toISOString() });
        }
        queryClient.setQueryData<ReactionRow[]>(qk, next);
      }
      return { previousMine, qk };
    },
    mutationFn: async (vars: ReactionVars) => {
      const { targetType, targetKey, reaction } = vars;
      const intent = intentRef.current.get(vars) ?? "set";
      const previous = chainRef.current.get(targetKey) ?? Promise.resolve();
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
      chainRef.current.set(targetKey, run);
      try {
        await run;
      } finally {
        if (chainRef.current.get(targetKey) === run) chainRef.current.delete(targetKey);
      }
    },
    onError: (_e, vars, ctx) => {
      if (ctx) {
        const rows = queryClient.getQueryData<ReactionRow[]>(ctx.qk) ?? [];
        const others = rows.filter((r) => !(r.target_key === vars.targetKey && r.user_id === myUserId));
        queryClient.setQueryData<ReactionRow[]>(ctx.qk, [...others, ...ctx.previousMine]);
      }
      toast.error("Reaktionen blev ikke gemt");
    },
    onSettled: (_d, _e, vars) => {
      intentRef.current.delete(vars);
      const left = (pendingCountRef.current.get(vars.targetKey) ?? 1) - 1;
      if (left > 0) {
        pendingCountRef.current.set(vars.targetKey, left);
      } else {
        pendingCountRef.current.delete(vars.targetKey);
        queryClient.invalidateQueries({ queryKey: ["feed-reactions"] });
      }
    },
  });

  const addComment = useMutation({
    mutationFn: async ({
      targetType,
      targetKey,
      body,
    }: {
      targetType: FeedTargetType;
      targetKey: string;
      body: string;
    }) => {
      if (!myUserId) throw new Error("Du skal være logget ind");
      const trimmed = body.trim().slice(0, 200);
      if (!trimmed) throw new Error("Beskeden må ikke være tom");

      const { error } = await supabase.from("feed_comments").insert({
        target_type: targetType,
        target_key: targetKey,
        user_id: myUserId,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
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
          createdAt: c.created_at,
        })),
    [commentsQuery.data, lookupName, myUserId]
  );

  return {
    getReactions,
    getComments,
    setReaction,
    addComment,
    deleteComment,
    isLoading: reactionsQuery.isLoading || commentsQuery.isLoading,
    canInteract: !!myUserId,
  };
}
