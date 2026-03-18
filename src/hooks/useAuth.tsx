import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const loggedSessionKeys = new Set<string>();

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
    
    const lowerEmail = userEmail.toLowerCase();
    
    // Add 3s timeout to prevent blocking - fall back to false (no forced change)
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 3000)
    );
    
    const queryPromise = supabase
      .from("employee_master_data")
      .select("must_change_password")
      .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
      .eq("is_active", true)
      .maybeSingle()
      .then(res => res.data);
    
    const data = await Promise.race([queryPromise, timeoutPromise]);
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

  const logLoginEvent = useCallback((currentSession: Session) => {
    // Use LAST 20 chars of token (unique signature) instead of first 20 (always same JWT header)
    const sessionKey = `${currentSession.user.id}-${currentSession.access_token.slice(-20)}`;
    
    // Only log once per unique session across the entire app
    if (loggedSessionKeys.has(sessionKey)) {
      return;
    }
    loggedSessionKeys.add(sessionKey);

    // Fire-and-forget: Don't block login flow with logging
    (async () => {
      try {
        const lowerEmail = currentSession.user.email?.toLowerCase() || "";
        
        // Add 2s timeout to employee lookup - fall back to auth metadata/null
        const employeePromise = supabase
          .from("employee_master_data")
          .select("first_name, last_name")
          .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
          .eq("is_active", true)
          .maybeSingle();
        
        const timeoutPromise = new Promise<{ data: null }>((resolve) => 
          setTimeout(() => resolve({ data: null }), 2000)
        );
        
        const { data: employee } = await Promise.race([employeePromise, timeoutPromise]);

        const fallbackName =
          typeof currentSession.user.user_metadata?.name === "string"
            ? currentSession.user.user_metadata.name.trim() || null
            : null;

        const userName = employee
          ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || fallbackName
          : fallbackName;

        supabase.functions.invoke("log-login-event", {
          body: {
            user_id: currentSession.user.id,
            user_email: currentSession.user.email,
            user_name: userName,
            session_id: currentSession.access_token.slice(-20),
          },
        }).catch(err => {
          if (import.meta.env.DEV) console.warn("Login logging failed (non-blocking):", err);
        });
      } catch (error) {
        if (import.meta.env.DEV) console.warn("Failed to prepare login event (non-blocking):", error);
      }
    })();
  }, []);

  useEffect(() => {
    const AUTH_TOKEN_KEY = 'sb-jwlimmeijpfmaksvmuru-auth-token';
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Catch failed token refreshes early - clear stale tokens
        if (event === 'TOKEN_REFRESHED' && !session) {
          if (import.meta.env.DEV) console.warn("[useAuth] Token refresh failed - clearing stored session");
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Log login event ONLY for actual sign-ins (not token refreshes)
        if (session && event === "SIGNED_IN") {
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

    // THEN check for existing session with timeout fallback
    const sessionTimeout = setTimeout(() => {
      // If getSession takes too long, stop loading to prevent infinite hang
      setLoading(false);
      if (import.meta.env.DEV) console.warn("Auth session check timed out after 5s");
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // NOTE: Don't call logLoginEvent here - onAuthStateChange SIGNED_IN handles it
      // This prevents duplicate logging on every page load
      if (session?.user?.email) {
        setTimeout(() => {
          checkMustChangePassword(session.user.email);
        }, 0);
      }
    }).catch((error) => {
      clearTimeout(sessionTimeout);
      if (import.meta.env.DEV) console.error("Auth session check failed:", error);
      
      // If Auth service is unreachable, clear stored tokens to prevent retry loops
      if (error.message === "Failed to fetch" || error.name === "AuthRetryableFetchError") {
        if (import.meta.env.DEV) console.warn("Auth service unreachable - clearing stored session to prevent retry loop");
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      
      setLoading(false);
    }).finally(() => {
      // Safety net: If still loading after timeout with a stored token, clear it
      setTimeout(() => {
        const stillHasToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (stillHasToken) {
          // Check if we actually have a valid session now
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && stillHasToken) {
              if (import.meta.env.DEV) console.warn("[useAuth] Stale token detected after timeout - clearing");
              localStorage.removeItem(AUTH_TOKEN_KEY);
            }
          }).catch(() => {
            // On error, clear the token
            if (import.meta.env.DEV) console.warn("[useAuth] Session check failed after timeout - clearing token");
            localStorage.removeItem(AUTH_TOKEN_KEY);
          });
        }
      }, 6000); // Run 1s after the main timeout
    });

    return () => subscription.unsubscribe();
  }, [checkMustChangePassword, logLoginEvent]);

  return { user, session, loading, mustChangePassword, clearMustChangePassword };
}
