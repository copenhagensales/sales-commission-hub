import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Validerer Microsoft (azure) logins server-side, så der ikke opstår
 * dublet-auth-brugere for medarbejdere hvis eksisterende konto ligger på
 * privat-e-mailen.
 *
 * Påvirker IKKE e-mail/adgangskode-login: guarden kalder kun edge functionen
 * når sessionens provider er azure.
 */
export function useMicrosoftLoginGuard() {
  const checkedTokens = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const validate = async (accessToken: string, provider: string | undefined) => {
      if (provider !== "azure") return;
      if (checkedTokens.current.has(accessToken)) return;
      checkedTokens.current.add(accessToken);

      try {
        const { data, error } = await supabase.functions.invoke("microsoft-login-guard");
        if (cancelled || error) return;
        if (data && data.allowed === false) {
          await supabase.auth.signOut();
          toast.error("Microsoft-login afvist", {
            description:
              data.message ||
              "Din konto skal opdateres før Microsoft-login — kontakt administrationen",
            duration: 12000,
          });
        }
      } catch {
        // Netværksfejl må ikke låse brugeren ude - ignoreres bevidst.
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      const provider = (session.user.app_metadata as Record<string, unknown> | undefined)
        ?.provider as string | undefined;
      setTimeout(() => validate(session.access_token, provider), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const provider = (session.user.app_metadata as Record<string, unknown> | undefined)
        ?.provider as string | undefined;
      validate(session.access_token, provider);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
}
