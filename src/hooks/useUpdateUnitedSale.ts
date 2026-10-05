import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";
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
  /** Ny mødetype-prisregel — udelades hvis uændret. */
  meetingRuleId?: string;
}

/** Betingelsesnøgler for mødetype ("Hvilket type møde" / "Hvilken type møde"). */
const isMeetingKey = (k: string) => /type møde/i.test(k);

export interface MeetingRuleOption {
  id: string;
  name: string;
  conditions: Record<string, string>;
}

/** Aktive prisregler for produktet der har en betingelse på mødetype. */
export function useMeetingTypeRules(productId: string | null | undefined) {
  return useQuery({
    queryKey: ["meeting-type-rules", productId],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MeetingRuleOption[]> => {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("id, name, conditions, priority")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data || [])
        .map((r) => ({
          id: r.id,
          name: r.name || "Unavngivet regel",
          conditions: (r.conditions || {}) as Record<string, string>,
        }))
        .filter((r) => Object.keys(r.conditions).some(isMeetingKey));
    },
  });
}

type Payload = Record<string, unknown>;
const asObj = (v: unknown): Payload =>
  v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Payload) } : {};

/** Skriver reglens mødetype ind i salget og bevarer dialerens oprindelige værdi. */
async function applyMeetingRule(saleId: string, ruleId: string) {
  const [{ data: rule, error: ruleError }, { data: sale, error: saleError }, { data: auth }] =
    await Promise.all([
      supabase.from("product_pricing_rules").select("conditions").eq("id", ruleId).single(),
      supabase.from("sales").select("raw_payload").eq("id", saleId).single(),
      supabase.auth.getUser(),
    ]);
  if (ruleError) throw ruleError;
  if (saleError) throw saleError;

  const conditions = asObj(rule.conditions);
  const payload = asObj(sale.raw_payload);
  const data = asObj(payload.data);
  const leadResultFields = payload.leadResultFields ? asObj(payload.leadResultFields) : null;
  const previous: Payload = {};

  for (const [key, value] of Object.entries(conditions)) {
    if (!isMeetingKey(key) || typeof value !== "string") continue;
    previous[key] = leadResultFields?.[key] ?? data[key] ?? null;
    data[key] = value;
    if (leadResultFields) leadResultFields[key] = value;
  }

  const prior = asObj(payload.manual_override);
  payload.data = data;
  if (leadResultFields) payload.leadResultFields = leadResultFields;
  payload.manual_override = {
    // Første dialer-værdi bevares, også ved flere rettelser.
    original: prior.original ?? previous,
    fields: Object.fromEntries(Object.keys(previous).map((k) => [k, data[k]])),
    rule_id: ruleId,
    changed_at: new Date().toISOString(),
    changed_by: auth.user?.email ?? null,
  };

  const { data: updated, error } = await supabase
    .from("sales")
    .update({ raw_payload: payload as Json })
    .eq("id", saleId)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) throw new Error(NO_ACCESS);
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

      if (input.meetingRuleId) await applyMeetingRule(input.saleId, input.meetingRuleId);

      // Pris afhænger af produkt, dato og mødetype — genberegn ved alle.
      if (input.productId || input.saleDatetime || input.meetingRuleId) {

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
        if (input.meetingRuleId) {
          const { data: item, error } = await supabase
            .from("sale_items")
            .select("matched_pricing_rule_id")
            .eq("id", input.saleItemId)
            .single();
          if (error) throw error;
          if (item.matched_pricing_rule_id !== input.meetingRuleId) {
            throw new Error(
              "Mødetypen er gemt, men prismotoren valgte en anden regel. Kontrollér prisreglerne i MG Test."
            );
          }
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
