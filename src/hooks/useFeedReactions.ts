/**
 * Reaktioner og korte lykønskninger på forsidens fejringer og ligaplaceringer.
 * Målnøgler:
 *   birthday:<employee_id>:<år>
 *   anniversary:<employee_id>:<år>
 *   league_round:<season_id>:<employee_id>
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REACTIONS, reactionKeyForEmoji, reactionOption, type ReactionKey } from "@/lib/feedReactions";

export type FeedTargetType = "birthday" | "anniversary" | "league_round";
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

  /** Sætter brugerens ene reaktion. Samme reaktion igen = fjern. Anden reaktion = skift. */
  const setReaction = useMutation({
    mutationFn: async ({
      targetType,
      targetKey,
      reaction,
    }: {
      targetType: FeedTargetType;
      targetKey: string;
      reaction: ReactionKey;
    }) => {
      if (!myUserId) throw new Error("Du skal være logget ind");
      const mine = (reactionsQuery.data || [])
        .filter((r) => r.target_key === targetKey && r.user_id === myUserId)
        .sort((x, y) => y.created_at.localeCompare(x.created_at));
      const current = mine[0] ? reactionKeyForEmoji(mine[0].emoji) : null;

      if (current !== reaction) {
        const { error } = await supabase.from("feed_reactions").insert({
          target_type: targetType,
          target_key: targetKey,
          user_id: myUserId,
          emoji: reactionOption(reaction).emoji,
        });
        if (error) throw error;
      }
      // Fjern brugerens egne tidligere reaktioner på samme mål.
      if (mine.length > 0) {
        const { error } = await supabase
          .from("feed_reactions")
          .delete()
          .in("id", mine.map((r) => r.id));
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
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
