import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FmRegistrationProduct {
  id: string;
  name: string;
}

/**
 * Produkter en FM-sælger kan vælge på en booking.
 *
 * Bruger RPC'en `get_fm_registration_products`, der returnerer aktive produkter
 * på bookingens kampagne. For Eesy FM udvides listen med aktive produkter fra
 * kundens øvrige kampagner, som har en prisregel knyttet til denne kampagnes
 * mapping — det er dem der bærer den korrekte kampagnesats. Dubletter på navn
 * fjernes i RPC'en.
 */
export const useFmRegistrationProducts = (campaignId: string | undefined) => {
  return useQuery({
    queryKey: ["fm-registration-products", campaignId],
    queryFn: async (): Promise<FmRegistrationProduct[]> => {
      if (!campaignId) return [];
      const { data, error } = await supabase.rpc("get_fm_registration_products", {
        p_campaign_id: campaignId,
      });
      if (error) throw error;

      return (data || [])
        .filter((p) => p.name !== "Lokation")
        .sort((a, b) => a.name.localeCompare(b.name, "da"));
    },
    enabled: !!campaignId,
  });
};
