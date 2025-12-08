import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfWeek, format } from "date-fns";

export type ContentPlatform = "TikTok" | "Instagram";
export type ContentType = "tiktok_video" | "insta_story" | "insta_post";
export type ContentStatus = "planned" | "in_progress" | "filmed" | "edited" | "published";

export interface ContentItem {
  id: string;
  week_start_date: string;
  platform: ContentPlatform;
  type: ContentType;
  title: string;
  status: ContentStatus;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyGoals {
  id: string;
  week_start_date: string;
  tiktok_videos_target: number;
  insta_stories_target: number;
  insta_posts_target: number;
}

export interface DefaultGoals {
  id: string;
  tiktok_videos_target: number;
  insta_stories_target: number;
  insta_posts_target: number;
}

export function getWeekStartDate(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export function useSomeContent(weekStartDate: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch default goals
  const { data: defaultGoals } = useQuery({
    queryKey: ["some-default-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("some_default_goals")
        .select("*")
        .single();
      if (error) throw error;
      return data as DefaultGoals;
    },
  });

  // Fetch weekly goals for selected week
  const { data: weeklyGoals, isLoading: goalsLoading } = useQuery({
    queryKey: ["some-weekly-goals", weekStartDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_goals")
        .select("*")
        .eq("week_start_date", weekStartDate)
        .maybeSingle();
      if (error) throw error;
      return data as WeeklyGoals | null;
    },
  });

  // Fetch content items for selected week
  const { data: contentItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["some-content-items", weekStartDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("week_start_date", weekStartDate)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ContentItem[];
    },
  });

  // Create or update weekly goals
  const upsertGoalsMutation = useMutation({
    mutationFn: async (goals: Partial<WeeklyGoals> & { week_start_date: string }) => {
      const { data, error } = await supabase
        .from("weekly_goals")
        .upsert(goals, { onConflict: "week_start_date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-weekly-goals"] });
    },
  });

  // Update default goals
  const updateDefaultGoalsMutation = useMutation({
    mutationFn: async (goals: Partial<DefaultGoals>) => {
      const { data, error } = await supabase
        .from("some_default_goals")
        .update(goals)
        .eq("id", defaultGoals?.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-default-goals"] });
      toast({ title: "Mål opdateret", description: "Dine standardmål er blevet gemt." });
    },
  });

  // Create content item
  const createItemMutation = useMutation({
    mutationFn: async (item: Omit<ContentItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("content_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-content-items", weekStartDate] });
      toast({ title: "Oprettet", description: "Nyt indhold er tilføjet." });
    },
  });

  // Update content item
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContentItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("content_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-content-items", weekStartDate] });
    },
  });

  // Delete content item
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["some-content-items", weekStartDate] });
      toast({ title: "Slettet", description: "Indhold er blevet fjernet." });
    },
  });

  // Calculate progress
  const getProgress = () => {
    const targets = weeklyGoals || defaultGoals || {
      tiktok_videos_target: 7,
      insta_stories_target: 3,
      insta_posts_target: 1,
    };

    const published = contentItems.filter((item) => item.status === "published");
    const tiktokDone = published.filter((item) => item.type === "tiktok_video").length;
    const storiesDone = published.filter((item) => item.type === "insta_story").length;
    const postsDone = published.filter((item) => item.type === "insta_post").length;

    return {
      tiktok: { done: tiktokDone, target: targets.tiktok_videos_target },
      stories: { done: storiesDone, target: targets.insta_stories_target },
      posts: { done: postsDone, target: targets.insta_posts_target },
    };
  };

  return {
    contentItems,
    weeklyGoals,
    defaultGoals,
    isLoading: goalsLoading || itemsLoading,
    progress: getProgress(),
    createItem: createItemMutation.mutate,
    updateItem: updateItemMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    updateDefaultGoals: updateDefaultGoalsMutation.mutate,
    upsertGoals: upsertGoalsMutation.mutate,
  };
}
