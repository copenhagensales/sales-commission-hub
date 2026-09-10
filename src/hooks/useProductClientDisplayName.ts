import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Kundevendt produktnavn (`products.client_display_name`).
 * Bruges udelukkende til visning i kunderapporter - rører ikke `products.name`,
 * provision, omsætning eller prisregler.
 */
export function useProductClientDisplayName(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-client-display-name", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("client_display_name")
        .eq("id", productId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.client_display_name ?? "") as string;
    },
  });
}

export function useUpdateProductClientDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      value,
    }: {
      productId: string;
      value: string;
    }) => {
      const trimmed = value.trim();
      const { error } = await supabase
        .from("products")
        .update({ client_display_name: trimmed || null })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["product-client-display-name", variables.productId],
      });
    },
  });
}
