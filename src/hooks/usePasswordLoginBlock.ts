import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Password-login er lukket i Stork. Microsoft er eneste login-metode.
 *
 * Ekstra sikkerhedslag: hvis en session alligevel er oprettet med
 * adgangskode (fx ved direkte kald mod auth-API'et), logges brugeren ud igen.
 * Rører ikke selve kontoen, roller eller rettigheder.
 */
export function usePasswordLoginBlock() {
  useEffect(() => {
    const enforce = async (provider: string | undefined) => {
      if (!provider || provider === "azure") return;
      await supabase.auth.signOut();
      toast.error("Login med adgangskode er lukket", {
        description:
          "Log ind med din Microsoft-konto (din arbejdsmail). Kan du ikke logge ind, så henvend dig på kontoret.",
        duration: 12000,
      });
    };

    const providerOf = (session: { user: { app_metadata?: Record<string, unknown> } }) =>
      session.user.app_metadata?.provider as string | undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      setTimeout(() => enforce(providerOf(session)), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) enforce(providerOf(session));
    });

    return () => subscription.unsubscribe();
  }, []);
}
