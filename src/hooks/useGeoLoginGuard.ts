import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * EU/EØS-spærre ved login. Tjekkes én gang pr. session (ved login og ved
 * åbning af appen med en eksisterende session). Serveren tilbagekalder
 * sessionen ved afvisning; klienten logger desuden ud.
 * Ukendt land eller fejl i opslaget = afvist.
 */
export function useGeoLoginGuard() {
  const checked = useRef<Set<string>>(new Set());

  useEffect(() => {
    const validate = async (userId: string) => {
      if (checked.current.has(userId)) return;
      checked.current.add(userId);
      const { data, error } = await supabase.functions.invoke("geo-login-guard");
      if (!error && data?.allowed === true) return;
      checked.current.delete(userId);
      await supabase.auth.signOut();
      toast.error("Login afvist", {
        description: data?.message || "Stork kan kun bruges fra EU/EØS",
        duration: 12000,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") checked.current.clear();
      if (event !== "SIGNED_IN" || !session) return;
      setTimeout(() => validate(session.user.id), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) validate(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);
}
