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

export type FeedTargetType = "birthday" | "anniversary" | "league_round";
export type FeedEmoji = "clap" | "party" | "fire";

export const FEED_EMOJIS: { key: FeedEmoji; symbol: string; label: string }[] = [
  { key: "clap", symbol: "👏", label: "Klap" },
  { key: "party", symbol: "🎉", label: "Tillykke" },
  { key: "fire", symbol: "🔥", label: "Sejt" },
];

export interface FeedReactionSummary {
  emoji: FeedEmoji;
  count: number;
  names: string[];
  mine: boolean;
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
        .select("id, target_key, user_id, emoji")
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

  const toggleReaction = useMutation({
    mutationFn: async ({
      targetType,
      targetKey,
      emoji,
    }: {
      targetType: FeedTargetType;
      targetKey: string;
      emoji: FeedEmoji;
    }) => {
      if (!myUserId) throw new Error("Du skal være logget ind");

      const existing = (reactionsQuery.data || []).find(
        (r) => r.target_key === targetKey && r.emoji === emoji && r.user_id === myUserId
      );

      if (existing) {
        const { error } = await supabase
          .from("feed_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("feed_reactions").insert({
        target_type: targetType,
        target_key: targetKey,
        user_id: myUserId,
        emoji,
      });
      if (error) throw error;
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
    (targetKey: string): FeedReactionSummary[] => {
      const rows = (reactionsQuery.data || []).filter((r) => r.target_key === targetKey);
      return FEED_EMOJIS.map(({ key }) => {
        const matching = rows.filter((r) => r.emoji === key);
        return {
          emoji: key,
          count: matching.length,
          names: matching.map((r) => lookupName(r.user_id)),
          mine: !!myUserId && matching.some((r) => r.user_id === myUserId),
        };
      });
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
    toggleReaction,
    addComment,
    deleteComment,
    isLoading: reactionsQuery.isLoading || commentsQuery.isLoading,
    canInteract: !!myUserId,
  };
}
