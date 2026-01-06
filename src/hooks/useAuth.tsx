import { useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const loggedSessionsRef = useRef<Set<string>>(new Set());

  const checkMustChangePassword = useCallback(async (userEmail: string | undefined) => {
    if (!userEmail) {
      setMustChangePassword(false);
      return;
    }
    
    const lowerEmail = userEmail.toLowerCase();
    const { data } = await supabase
      .from("employee_master_data")
      .select("must_change_password")
      .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
      .eq("is_active", true)
      .maybeSingle();
    
    setMustChangePassword(data?.must_change_password === true);
  }, []);

  const clearMustChangePassword = useCallback(async () => {
    if (!user?.email) return;
    
    const lowerEmail = user.email.toLowerCase();
    await supabase
      .from("employee_master_data")
      .update({ must_change_password: false })
      .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`);
    
    setMustChangePassword(false);
  }, [user?.email]);

  const logLoginEvent = useCallback(async (currentSession: Session) => {
    const sessionKey = `${currentSession.user.id}-${currentSession.access_token.substring(0, 20)}`;
    
    // Only log once per unique session
    if (loggedSessionsRef.current.has(sessionKey)) {
      return;
    }
    loggedSessionsRef.current.add(sessionKey);

    try {
      // Get user's name from employee_master_data
      const lowerEmail = currentSession.user.email?.toLowerCase() || "";
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      const userName = employee 
        ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() 
        : null;

      // Call edge function to log the event
      await supabase.functions.invoke("log-login-event", {
        body: {
          user_id: currentSession.user.id,
          user_email: currentSession.user.email,
          user_name: userName,
          session_id: currentSession.access_token.substring(0, 20),
        },
      });
    } catch (error) {
      console.error("Failed to log login event:", error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Log login event for new sessions
        if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          logLoginEvent(session);
        }
        
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
        logLoginEvent(session);
        setTimeout(() => {
          checkMustChangePassword(session.user.email);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkMustChangePassword, logLoginEvent]);

  return { user, session, loading, mustChangePassword, clearMustChangePassword };
}
