import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpdateUnitedSaleInput {
  saleId: string;
  saleItemId: string;
  /** Ny salgsdato/tid (ISO) — udelades hvis uændret. */
  saleDatetime?: string;
  /** Ny sælger-mail — udelades hvis uændret. */
  agentEmail?: string;
  /** Nyt produkt på salgslinjen — udelades hvis uændret. */
  productId?: string;
  /** Nyt telefonnummer på salget — udelades hvis uændret, null rydder feltet. */
  customerPhone?: string | null;
}

const NO_ACCESS = "Du har ikke adgang, eller salget findes ikke længere.";

const INVALIDATE_KEYS = [
  ["united-sales"],
  ["tryg-kanvas-sales"],
  ["tryg-alka-sales"],
  ["sales"],
  ["sales-aggregates"],
];

/**
 * Retter salgsdato, sælger og/eller produkt på ét salg og genberegner
 * provision/omsætning for salgslinjen via `rematch-pricing-rules`
 * (prismotoren er fortsat eneste kilde til beløbene).
 */
export function useUpdateUnitedSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateUnitedSaleInput) => {
      const saleUpdate: {
        sale_datetime?: string;
        agent_email?: string;
        agent_name?: null;
        customer_phone?: string | null;
      } = {};
      if (input.saleDatetime) saleUpdate.sale_datetime = input.saleDatetime;
      if (input.customerPhone !== undefined) {
        saleUpdate.customer_phone = input.customerPhone;
      }
      if (input.agentEmail) {
        saleUpdate.agent_email = input.agentEmail;
        // Navnet slås op via work_email — det gamle navn må ikke blive stående.
        saleUpdate.agent_name = null;
      }

      if (Object.keys(saleUpdate).length > 0) {
        const { data, error } = await supabase
          .from("sales")
          .update(saleUpdate)
          .eq("id", input.saleId)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(NO_ACCESS);
      }

      if (input.productId) {
        const { data, error } = await supabase
          .from("sale_items")
          .update({ product_id: input.productId, needs_mapping: false })
          .eq("id", input.saleItemId)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(NO_ACCESS);
      }

      // Pris afhænger af produkt og dato — genberegn ved begge.
      if (input.productId || input.saleDatetime) {

        // Genberegn kun den ene salgslinje.
        const { error: rematchError } = await supabase.functions.invoke(
          "rematch-pricing-rules",
          { body: { sale_item_ids: [input.saleItemId] } }
        );
        if (rematchError) {
          throw new Error(
            `Salget er rettet, men provisionen kunne ikke genberegnes: ${rematchError.message}`
          );
        }
      }
    },
    onSuccess: () => {
      for (const key of INVALIDATE_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
