import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenuConfigItem {
  id: string;
  item_key: string;
  parent_key: string | null;
  sort_order: number;
  visible: boolean;
  label_override: string | null;
  icon_name: string | null;
  href: string | null;
}

export interface MenuSection extends MenuConfigItem {
  children: MenuConfigItem[];
}

export function useSidebarMenuConfig() {
  return useQuery({
    queryKey: ["sidebar-menu-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sidebar_menu_config")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as MenuConfigItem[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/** Returns hierarchical structure: sections with children */
export function useSidebarMenuTree() {
  const { data: items, ...rest } = useSidebarMenuConfig();

  const sections: MenuSection[] = [];
  const standaloneItems: MenuConfigItem[] = [];

  if (items) {
    const topLevel = items
      .filter((i) => i.parent_key === null)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const item of topLevel) {
      if (item.item_key.startsWith("section_")) {
        const children = items
          .filter((c) => c.parent_key === item.item_key)
          .sort((a, b) => a.sort_order - b.sort_order);
        sections.push({ ...item, children });
      } else {
        standaloneItems.push(item);
      }
    }
  }

  return { sections, standaloneItems, allItems: items || [], ...rest };
}

/** Batch-save entire menu config */
export function useSaveMenuConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: MenuConfigItem[]) => {
      // Update each item's sort_order, parent_key, visible, label_override
      const updates = items.map((item) =>
        supabase
          .from("sidebar_menu_config")
          .update({
            sort_order: item.sort_order,
            parent_key: item.parent_key,
            visible: item.visible,
            label_override: item.label_override,
          })
          .eq("id", item.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} items`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sidebar-menu-config"] });
    },
  });
}
