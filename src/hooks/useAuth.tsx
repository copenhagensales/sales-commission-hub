import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const checkMustChangePassword = useCallback(async (userEmail: string | undefined) => {
    if (!userEmail) {
      setMustChangePassword(false);
      return;
    }
    
    const { data } = await supabase
      .from("employee_master_data")
      .select("must_change_password")
      .or(`private_email.eq.${userEmail},work_email.eq.${userEmail}`)
      .eq("is_active", true)
      .maybeSingle();
    
    setMustChangePassword(data?.must_change_password === true);
  }, []);

  const clearMustChangePassword = useCallback(async () => {
    if (!user?.email) return;
    
    await supabase
      .from("employee_master_data")
      .update({ must_change_password: false })
      .or(`private_email.eq.${user.email},work_email.eq.${user.email}`);
    
    setMustChangePassword(false);
  }, [user?.email]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Defer the must_change_password check
        if (session?.user?.email) {
          setTimeout(() => {
            checkMustChangePassword(session.user.email);
          }, 0);
        } else {
          setMustChangePassword(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user?.email) {
        setTimeout(() => {
          checkMustChangePassword(session.user.email);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkMustChangePassword]);

  return { user, session, loading, mustChangePassword, clearMustChangePassword };
}
