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
    const isUnauthorized = (err: unknown) =>
      (err as { context?: { status?: number } } | null)?.context?.status === 401;

    const validate = async (userId: string) => {
      if (checked.current.has(userId)) return;
      checked.current.add(userId);
      try {
        let res = await supabase.functions.invoke("geo-login-guard");
        // Udløbet/forældet token ved app-åbning: forny én gang og prøv igen.
        if (res.error && isUnauthorized(res.error)) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            checked.current.delete(userId);
            await supabase.auth.signOut();
            return;
          }
          res = await supabase.functions.invoke("geo-login-guard");
        }
        const { data, error } = res;
        if (!error && data?.allowed === true) return;
        checked.current.delete(userId);
        await supabase.auth.signOut();
        if (error && isUnauthorized(error)) return; // ugyldig session, ikke geo-afvisning
        toast.error("Login afvist", {
          description: data?.message || "Stork kan kun bruges fra EU/EØS",
          duration: 12000,
        });
      } catch {
        checked.current.delete(userId);
        await supabase.auth.signOut();
        toast.error("Login afvist", { description: "Stork kan kun bruges fra EU/EØS", duration: 12000 });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") checked.current.clear();
      if (event !== "SIGNED_IN" || !session) return;
      setTimeout(() => validate(session.user.id), 0);
    });

    // Ved app-åbning: bekræft først at den gemte session stadig er gyldig,
    // så et forældet token ikke giver et 401-kald til funktionen.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          await supabase.auth.signOut();
          return;
        }
      }
      validate(session.user.id);
    }).catch(() => undefined);

    return () => subscription.unsubscribe();
  }, []);
}
