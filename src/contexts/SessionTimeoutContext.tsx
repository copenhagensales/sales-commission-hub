import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SessionTimeoutModal } from "@/components/session/SessionTimeoutModal";

interface SessionTimeoutContextType {
  isActive: boolean;
  remainingTime: number | null;
  resetActivity: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType>({
  isActive: true,
  remainingTime: null,
  resetActivity: () => {},
});

export const useSessionTimeout = () => useContext(SessionTimeoutContext);

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
const WARNING_TIME_SECONDS = 300; // 5 minutes before timeout

export function SessionTimeoutProvider({ children }: SessionTimeoutProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(60);
  const [maxSessionHours, setMaxSessionHours] = useState<number>(10);
  
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // TV board routes are exempt from timeout
  const isTvBoardRoute = location.pathname.startsWith("/tv-board") ||
                         location.pathname.startsWith("/t/") ||
                         location.pathname.startsWith("/tv/");

  // Fetch timeout settings based on user's position
  useEffect(() => {
    const fetchTimeoutSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;

      // Get employee's position and its timeout settings
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .eq("private_email", session.user.email)
        .maybeSingle();

      if (employee?.job_title) {
        const { data: position } = await supabase
          .from("job_positions")
          .select("session_timeout_minutes, max_session_hours")
          .eq("name", employee.job_title)
          .maybeSingle();

        if (position) {
          setTimeoutMinutes(position.session_timeout_minutes || 60);
          setMaxSessionHours(position.max_session_hours || 10);
        }
      }
    };

    if (!isTvBoardRoute) {
      fetchTimeoutSettings();
    }
  }, [isTvBoardRoute]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  }, [navigate]);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(null);
  }, []);

  const checkTimeout = useCallback(() => {
    if (isTvBoardRoute) return;

    const now = Date.now();
    const timeSinceActivity = (now - lastActivityRef.current) / 1000;
    const timeSinceSessionStart = (now - sessionStartRef.current) / 1000;
    const timeoutSeconds = timeoutMinutes * 60;
    const maxSessionSeconds = maxSessionHours * 3600;

    // Check max session duration
    if (timeSinceSessionStart >= maxSessionSeconds) {
      handleLogout();
      return;
    }

    // Check inactivity timeout
    if (timeSinceActivity >= timeoutSeconds) {
      handleLogout();
      return;
    }

    // Show warning before timeout
    const timeUntilTimeout = timeoutSeconds - timeSinceActivity;
    if (timeUntilTimeout <= WARNING_TIME_SECONDS && timeUntilTimeout > 0) {
      setShowWarning(true);
      setRemainingTime(Math.ceil(timeUntilTimeout));
    } else {
      setShowWarning(false);
      setRemainingTime(null);
    }
  }, [isTvBoardRoute, timeoutMinutes, maxSessionHours, handleLogout]);

  // Activity tracking
  useEffect(() => {
    if (isTvBoardRoute) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isTvBoardRoute]);

  // Timeout checking interval
  useEffect(() => {
    if (isTvBoardRoute) return;

    // Check every 10 seconds
    timeoutRef.current = setInterval(checkTimeout, 10000);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [isTvBoardRoute, checkTimeout]);

  // Countdown timer when warning is shown
  useEffect(() => {
    if (showWarning && remainingTime !== null && remainingTime > 0) {
      countdownRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev === null || prev <= 1) {
            handleLogout();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [showWarning, handleLogout]);

  // Reset session start on auth change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        sessionStartRef.current = Date.now();
        lastActivityRef.current = Date.now();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleContinueSession = () => {
    resetActivity();
  };

  return (
    <SessionTimeoutContext.Provider value={{ isActive, remainingTime, resetActivity }}>
      {children}
      <SessionTimeoutModal
        isOpen={showWarning}
        remainingTime={remainingTime || 0}
        onContinue={handleContinueSession}
        onLogout={handleLogout}
      />
    </SessionTimeoutContext.Provider>
  );
}
