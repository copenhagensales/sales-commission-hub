import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Wifi, RefreshCw, ArrowLeft, AlertTriangle, KeyRound } from "lucide-react";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { PasswordStrengthIndicator } from "@/components/password/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/password-validation";

// Timeout helper - returns fallback value on timeout, but propagates actual errors
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  
  // Wrap original promise to clear timeout and propagate errors
  const wrappedPromise = promise
    .then((result) => {
      clearTimeout(timeoutId);
      return result;
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      throw error; // Propagate the actual error instead of falling back
    });
  
  return Promise.race([wrappedPromise, timeoutPromise]);
};

// Check if auth server is healthy - with fallback to allow login during instability
const checkAuthHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // Extended to 10s
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`,
      { 
        signal: controller.signal,
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
      }
    );
    clearTimeout(timeout);
    return response.ok;
  } catch (e) {
    // Allow login attempt even if health check fails - user will get proper error from actual login
    console.warn('[Auth] Health check failed, proceeding anyway:', e);
    return true;
  }
};

// Login with retry, exponential backoff, and 15s global timeout
const LOGIN_TIMEOUT_MS = 15000;

const loginWithRetry = async (
  email: string, 
  password: string, 
  onRetry: (attempt: number) => void,
  retries = 3
): Promise<{ data: any; error: any }> => {
  const authUrl = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`;
  console.log('[Auth Diagnostic] Starting login flow');
  console.log('[Auth Diagnostic] Auth URL:', authUrl);
  console.log('[Auth Diagnostic] Email:', email.trim().toLowerCase());
  
  // Global timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[Auth Diagnostic] Global timeout triggered after 15s');
    controller.abort();
  }, LOGIN_TIMEOUT_MS);
  
  try {
    for (let i = 0; i < retries; i++) {
      console.log(`[Auth Diagnostic] Attempt ${i + 1}/${retries}`);
      const attemptStart = Date.now();
      
      try {
        // Check if already aborted
        if (controller.signal.aborted) {
          throw new Error('LOGIN_TIMEOUT');
        }
        
        const result = await supabase.auth.signInWithPassword({ 
          email: email.trim().toLowerCase(), 
          password 
        });
        
        const elapsed = Date.now() - attemptStart;
        console.log(`[Auth Diagnostic] Attempt ${i + 1} completed in ${elapsed}ms`);
        console.log('[Auth Diagnostic] Result:', result.data ? 'SUCCESS (user data received)' : 'NO DATA');
        console.log('[Auth Diagnostic] Error:', result.error ? `${result.error.name}: ${result.error.message}` : 'NONE');
        
        clearTimeout(timeoutId);
        return result;
      } catch (error: any) {
        const elapsed = Date.now() - attemptStart;
        console.log(`[Auth Diagnostic] Attempt ${i + 1} EXCEPTION after ${elapsed}ms`);
        console.log('[Auth Diagnostic] Error name:', error.name);
        console.log('[Auth Diagnostic] Error message:', error.message);
        console.log('[Auth Diagnostic] Error stack:', error.stack?.substring(0, 500));
        
        // Check for timeout abort
        if (controller.signal.aborted || error.message === 'LOGIN_TIMEOUT') {
          clearTimeout(timeoutId);
          throw new Error('LOGIN_TIMEOUT');
        }
        
        // Check for network errors (multiple patterns)
        const isNetworkError = 
          error.message === "Failed to fetch" ||
          error.message?.includes("Failed to fetch") ||
          error.name === "AuthRetryableFetchError" ||
          error.name === "TypeError";
        
        if (isNetworkError && i < retries - 1) {
          console.log(`[Auth Diagnostic] Network error detected, will retry in ${1000 * Math.pow(2, i)}ms`);
          onRetry(i + 2);
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
          continue;
        }
        
        clearTimeout(timeoutId);
        throw error;
      }
    }
    
    clearTimeout(timeoutId);
    return { data: null, error: new Error("Max retries exceeded") };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Diagnostic summary type
interface DiagnosticSummary {
  timestamp: string;
  hostname: string;
  supabaseUrl: string;
  authEndpoint: string;
  apikeyPresent: boolean;
  apikeyLength: number;
  healthCheck: { status: string; time: number } | null;
  loginAttempt: { outcome: string; errorName?: string; errorMessage?: string; time: number } | null;
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isNewPasswordMode, setIsNewPasswordMode] = useState(false);
  const [isForcedPasswordChange, setIsForcedPasswordChange] = useState(false);
  const [expiredLinkError, setExpiredLinkError] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [diagSummary, setDiagSummary] = useState<DiagnosticSummary | null>(null);
  const { toast } = useToast();
  const { mustChangePassword, clearMustChangePassword, user, loading: authLoading } = useAuth();
  
  // Derive connection status from auth loading state
  const connectionStatus = authLoading ? 'checking' : 'connected';
  
  // Run diagnostics to test connectivity
  const runDiagnostics = async () => {
    setDiagnostics(['Running tests...']);
    const results: string[] = [];
    
    // Test 1: External connectivity
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      await fetch('https://httpbin.org/get', { signal: controller.signal });
      results.push('✅ Internet: OK');
    } catch (e: any) {
      results.push(`❌ Internet: ${e.message}`);
    }
    
    // Test 2: Supabase Auth health
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`,
        { signal: controller.signal, headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      results.push(`✅ Auth server: ${res.status} ${res.statusText}`);
    } catch (e: any) {
      results.push(`❌ Auth server: ${e.message}`);
    }
    
    // Test 3: Supabase Edge Functions
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/`,
        { signal: controller.signal, headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      results.push(`✅ Edge functions: ${res.status}`);
    } catch (e: any) {
      results.push(`❌ Edge functions: ${e.message}`);
    }
    
    setDiagnostics(results);
  };
  
  // Handle triple-click on logo for diagnostics
  const handleLogoClick = (e: React.MouseEvent) => {
    if (e.detail === 3) {
      setShowDiagnostics(!showDiagnostics);
    }
  };

  // Check if user must change password after login
  useEffect(() => {
    if (mustChangePassword && user) {
      setIsForcedPasswordChange(true);
      setPassword("");
      setConfirmPassword("");
    }
  }, [mustChangePassword, user]);

  useEffect(() => {
    // Check URL for error parameters (expired/invalid token) and recovery flow
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    const error = hashParams.get('error');
    
    console.log('[Auth] Checking URL hash:', { 
      hasHash: window.location.hash.length > 1,
      hasError: !!error,
      errorDescription 
    });
    
    // Show expired link error if Supabase returns an error in the URL hash
    // This can happen if someone clicks an old/expired Supabase recovery link
    if (error || errorDescription) {
      console.log('[Auth] Error in URL hash - showing expired link message');
      setExpiredLinkError(true);
      setIsResetMode(true);
      // Clear the hash to clean up URL
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Keep auth state listener for other events (SIGNED_IN, SIGNED_OUT, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[Auth] Auth state changed:', event);
      // Note: PASSWORD_RECOVERY event is no longer used since we now use 
      // custom token-based reset flow via /reset-password page
    });

    return () => subscription.unsubscribe();
  }, []);


  const handleClearCacheAndReload = () => {
    console.log("[Auth] User requested cache clear");
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Clear any stale auth tokens before attempting fresh login
    const storedToken = localStorage.getItem('sb-jwlimmeijpfmaksvmuru-auth-token');
    if (storedToken && !isResetMode && !isForcedPasswordChange && !isNewPasswordMode) {
      console.log("[Auth] Clearing existing token before fresh login attempt");
      localStorage.removeItem('sb-jwlimmeijpfmaksvmuru-auth-token');
      // Give the SDK a moment to reset
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      if (isForcedPasswordChange) {
        // Forced password change after first login
        if (password !== confirmPassword) {
          toast({
            title: "Fejl",
            description: "Adgangskoderne matcher ikke.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          toast({
            title: "Fejl",
            description: "Adgangskoden opfylder ikke alle sikkerhedskrav.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        
        // Clear the must_change_password flag
        await clearMustChangePassword();
        
        toast({
          title: "Adgangskode ændret",
          description: "Din nye adgangskode er gemt. Velkommen!",
        });
        setIsForcedPasswordChange(false);
      } else if (isNewPasswordMode) {
        // Validate passwords match
        if (password !== confirmPassword) {
          toast({
            title: "Fejl",
            description: "Adgangskoderne matcher ikke.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        
        toast({
          title: "Adgangskode opdateret",
          description: "Din adgangskode er blevet ændret. Du er nu logget ind.",
        });
        setIsNewPasswordMode(false);
      } else if (isResetMode) {
        // Use custom token-based reset flow instead of Supabase native recovery
        // This prevents the race condition where Supabase auto-logs users in
        const { data, error: invokeError } = await supabase.functions.invoke(
          "initiate-password-reset",
          { body: { email: email.trim().toLowerCase() } }
        );
        
        if (invokeError) throw invokeError;
        
        toast({
          title: "Email sendt",
          description: "Hvis din email er registreret, modtager du et link inden for få minutter. Tjek også spam-mappen.",
        });
        setIsResetMode(false);
        setExpiredLinkError(false);
      } else {
        // ============ DIAGNOSTIC LOGIN MODE ============
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const authEndpoint = `${supabaseUrl}/auth/v1/token?grant_type=password`;
        
        // Check API key status - detailed debug
        const apikeyPresent = Boolean(supabaseKey && supabaseKey.length > 0);
        const apikeyLength = supabaseKey?.length || 0;
        const apikeyType = typeof supabaseKey;
        const apikeyFirst10 = supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'N/A';
        
        // Also check all VITE env vars
        const allViteEnvKeys = Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'));
        
        console.log('[Auth Diagnostic] ========== ENV VAR DEBUG ==========');
        console.log('[Auth Diagnostic] All VITE_ env vars:', allViteEnvKeys);
        console.log('[Auth Diagnostic] VITE_SUPABASE_URL:', supabaseUrl);
        console.log('[Auth Diagnostic] VITE_SUPABASE_PUBLISHABLE_KEY type:', apikeyType);
        console.log('[Auth Diagnostic] VITE_SUPABASE_PUBLISHABLE_KEY value:', apikeyPresent ? apikeyFirst10 : 'MISSING/EMPTY');
        console.log('[Auth Diagnostic] VITE_SUPABASE_PUBLISHABLE_KEY length:', apikeyLength);
        console.log('[Auth Diagnostic] Full import.meta.env:', JSON.stringify(import.meta.env, null, 2));
        
        // Initialize diagnostic summary
        const summary: DiagnosticSummary = {
          timestamp: new Date().toISOString(),
          hostname: window.location.hostname,
          supabaseUrl: supabaseUrl?.replace(/https:\/\/([^.]+)\./, 'https://[PROJECT_ID].') || 'NOT SET',
          authEndpoint: authEndpoint?.replace(/https:\/\/([^.]+)\./, 'https://[PROJECT_ID].') || 'NOT SET',
          apikeyPresent,
          apikeyLength,
          healthCheck: null,
          loginAttempt: null,
        };
        
        console.log('[Auth Diagnostic] ========== LOGIN ATTEMPT ==========');
        console.log('[Auth Diagnostic] Hostname:', window.location.hostname);
        console.log('[Auth Diagnostic] Auth endpoint:', authEndpoint);
        
        // Check if we're online first
        if (!navigator.onLine) {
          toast({
            title: "Ingen internetforbindelse",
            description: "Tjek din forbindelse og prøv igen.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // ===== HEALTH CHECK WITH TIMING =====
        setRetryStatus("Tjekker server health...");
        const healthStart = Date.now();
        try {
          const controller = new AbortController();
          const healthTimeout = setTimeout(() => controller.abort(), 10000);
          
          const healthRes = await fetch(
            `${supabaseUrl}/auth/v1/health`,
            { 
              signal: controller.signal,
              headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
            }
          );
          clearTimeout(healthTimeout);
          
          const healthTime = Date.now() - healthStart;
          summary.healthCheck = { 
            status: `${healthRes.status} ${healthRes.statusText}`, 
            time: healthTime 
          };
          console.log(`[Auth Diagnostic] Health check: ${healthRes.status} in ${healthTime}ms`);
        } catch (healthErr: any) {
          const healthTime = Date.now() - healthStart;
          summary.healthCheck = { 
            status: `ERROR: ${healthErr.name} - ${healthErr.message}`, 
            time: healthTime 
          };
          console.log(`[Auth Diagnostic] Health check FAILED after ${healthTime}ms:`, healthErr.name, healthErr.message);
        }
        
        // ===== LOGIN ATTEMPT WITH TIMING =====
        setRetryStatus(null);
        setRetryAttempt(1);
        
        const loginStart = Date.now();
        try {
          const { data, error } = await loginWithRetry(
            email,
            password,
            (attempt) => {
              setRetryAttempt(attempt);
              setRetryStatus(`Serveren svarer langsomt - forsøg ${attempt}/3...`);
            }
          );
          
          const loginTime = Date.now() - loginStart;
          
          if (error) {
            summary.loginAttempt = {
              outcome: 'AUTH_ERROR',
              errorName: error.name || 'AuthError',
              errorMessage: error.message,
              time: loginTime,
            };
            setDiagSummary(summary);
            throw error;
          }
          
          summary.loginAttempt = { outcome: 'SUCCESS', time: loginTime };
          setDiagSummary(summary);
          console.log(`[Auth Diagnostic] Login SUCCESS in ${loginTime}ms`);
          
          setRetryAttempt(0);
          setRetryStatus(null);
          
          toast({
            title: "Velkommen tilbage!",
            description: "Du er nu logget ind.",
          });
        } catch (loginErr: any) {
          const loginTime = Date.now() - loginStart;
          summary.loginAttempt = {
            outcome: loginErr.message === 'LOGIN_TIMEOUT' ? 'TIMEOUT_15S' : 'EXCEPTION',
            errorName: loginErr.name,
            errorMessage: loginErr.message,
            time: loginTime,
          };
          setDiagSummary(summary);
          console.log(`[Auth Diagnostic] Login FAILED after ${loginTime}ms`);
          throw loginErr;
        }
        
        /* ============ DISABLED DURING EMERGENCY ============
        // Run work_email lookup and lock check in parallel with 3s timeouts
        const emailLookupPromise = withTimeout(
          Promise.resolve(supabase.rpc('get_auth_email_by_work_email', { _work_email: email }))
            .then(res => res.data),
          3000,
          null as string | null
        ).catch(() => null);

        const lockCheckPromise = withTimeout(
          supabase.functions.invoke('check-account-locked', { body: { email } })
            .then(res => res.data),
          3000,
          null
        ).catch(() => null);

        const [privateEmail, lockCheck] = await Promise.all([emailLookupPromise, lockCheckPromise]);
        const authEmail = privateEmail || email;

        if (lockCheck?.locked) {
          toast({
            title: "Konto låst",
            description: lockCheck.message || "Din konto er midlertidigt låst.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        ============ END DISABLED ============ */
      }
    } catch (error: any) {
      // ============ DIAGNOSTIC CATCH BLOCK ============
      console.log('[Auth Diagnostic] CAUGHT ERROR in handleSubmit');
      console.log('[Auth Diagnostic] error.name:', error.name);
      console.log('[Auth Diagnostic] error.message:', error.message);
      console.log('[Auth Diagnostic] error.stack:', error.stack?.substring(0, 500));
      console.log('[Auth Diagnostic] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      let title = "Fejl";
      let message = `${error.name || 'Error'}: ${error.message}`;
      
      // Track failed attempts for offline fallback
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      
      // Provide user-friendly error messages based on error type
      if (error.message === "LOGIN_TIMEOUT") {
        title = "Timeout (15 sek)";
        message = "Login tog for lang tid. Serveren svarede ikke inden for 15 sekunder.";
        console.log('[Auth Diagnostic] Classified as: TIMEOUT');
      } else if (error.message === "Failed to fetch" || error.message?.includes("Failed to fetch") || error.name === "AuthRetryableFetchError") {
        title = "Server utilgængelig";
        message = newFailedAttempts >= 3 
          ? `Serveren kan ikke nås efter ${newFailedAttempts} forsøg. Fejl: ${error.name}`
          : `Login-serveren svarer ikke (forsøg ${newFailedAttempts}/3). Fejl: ${error.name}`;
        console.log('[Auth Diagnostic] Classified as: NETWORK_ERROR');
      } else if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
        title = "Timeout";
        message = "Login tog for lang tid. Serveren er overbelastet - prøv igen om lidt.";
        console.log('[Auth Diagnostic] Classified as: SDK_TIMEOUT');
      } else if (error.message?.includes("Invalid login")) {
        title = "Forkert login";
        message = "Forkert email eller adgangskode.";
        setFailedAttempts(0);
        console.log('[Auth Diagnostic] Classified as: INVALID_CREDENTIALS');
      } else if (error.message?.includes("Email not confirmed")) {
        title = "Email ikke bekræftet";
        message = "Tjek din indbakke for bekræftelsesmail.";
        setFailedAttempts(0);
        console.log('[Auth Diagnostic] Classified as: EMAIL_NOT_CONFIRMED');
      } else if (error.message?.includes("Max retries")) {
        title = "Server utilgængelig";
        message = "Kunne ikke forbinde efter flere forsøg. Prøv igen om lidt.";
        console.log('[Auth Diagnostic] Classified as: MAX_RETRIES');
      } else {
        console.log('[Auth Diagnostic] Classified as: UNKNOWN');
      }
      
      console.log('[Auth Diagnostic] Will show toast:', { title, message });
      toast({
        title,
        description: message,
        variant: "destructive",
      });
    } finally {
      // ============ DIAGNOSTIC FINALLY BLOCK ============
      console.log('[Auth Diagnostic] FINALLY block executing - resetting loading state');
      setLoading(false);
      setRetryAttempt(0);
      setRetryStatus(null);
      console.log('[Auth Diagnostic] Loading state reset complete');
    }
  };


  const getTitle = () => {
    if (isForcedPasswordChange) return "Skift din adgangskode";
    if (isNewPasswordMode) return "Vælg ny adgangskode";
    if (isResetMode) return "Nulstil adgangskode";
    return "Log ind";
  };

  const getButtonText = () => {
    if (retryStatus) return retryStatus;
    if (loading) return "Vent venligst...";
    if (isForcedPasswordChange) return "Gem ny adgangskode";
    if (isNewPasswordMode) return "Gem ny adgangskode";
    if (isResetMode) return "Send nulstillingslink";
    return "Log ind";
  };

  const showPasswordChangeForm = isForcedPasswordChange || isNewPasswordMode;
  
  // Password validation for submit button
  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const canSubmitPasswordChange = showPasswordChangeForm 
    ? passwordValidation.isValid && password === confirmPassword && password.length > 0
    : true;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo - triple-click for diagnostics */}
        <div className="text-center" onClick={handleLogoClick}>
          <img 
            src={cphSalesLogo} 
            alt="CPH Sales" 
            width={161}
            height={96}
            fetchPriority="high"
            className="mx-auto h-40 w-auto cursor-pointer"
          />
        </div>
        
        {/* DIAGNOSTIC SUMMARY - Always visible after login attempt */}
        {diagSummary && (
          <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4 font-mono text-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-orange-600">🔍 Login Diagnostic Summary</span>
              <Button size="sm" variant="ghost" onClick={() => setDiagSummary(null)}>
                ✕
              </Button>
            </div>
            <div className="space-y-2 text-foreground">
              <div><strong>Tid:</strong> {diagSummary.timestamp}</div>
              <div><strong>Hostname:</strong> {diagSummary.hostname}</div>
              <div><strong>Supabase URL:</strong> {diagSummary.supabaseUrl}</div>
              <div><strong>Auth Endpoint:</strong> {diagSummary.authEndpoint}</div>
              <div className={diagSummary.apikeyPresent ? "text-green-600" : "text-red-600"}>
                <strong>API Key:</strong> {diagSummary.apikeyPresent ? `✅ Present (${diagSummary.apikeyLength} chars)` : '❌ MISSING'}
              </div>
              <div className="border-t border-orange-500/30 pt-2 mt-2">
                <strong>Health Check:</strong>{' '}
                {diagSummary.healthCheck 
                  ? `${diagSummary.healthCheck.status} (${diagSummary.healthCheck.time}ms)`
                  : 'Not run'}
              </div>
              <div className="border-t border-orange-500/30 pt-2">
                <strong>Login Attempt:</strong>{' '}
                {diagSummary.loginAttempt 
                  ? `${diagSummary.loginAttempt.outcome} (${diagSummary.loginAttempt.time}ms)`
                  : 'Not run'}
              </div>
              {diagSummary.loginAttempt?.errorName && (
                <div className="text-red-500">
                  <strong>Error:</strong> {diagSummary.loginAttempt.errorName}: {diagSummary.loginAttempt.errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Hidden diagnostics panel */}
        {showDiagnostics && (
          <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-blue-600">Diagnostik</span>
              <Button size="sm" variant="outline" onClick={runDiagnostics}>
                Kør Test
              </Button>
            </div>
            {diagnostics.length > 0 && (
              <div className="space-y-1 mt-2">
                {diagnostics.map((d, i) => (
                  <div key={i} className="text-foreground">{d}</div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Server unavailable fallback after 3 failures */}
        {failedAttempts >= 3 && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Serveren er utilgængelig</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vi kan ikke forbinde til login-serveren efter flere forsøg.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setFailedAttempts(0);
                      handleClearCacheAndReload();
                    }}
                  >
                    Ryd cache og prøv igen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setShowDiagnostics(true)}
                  >
                    Vis diagnostik
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}

        {connectionStatus === 'connected' && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Forbundet til server</span>
            </div>
          </div>
        )}

        {connectionStatus === 'checking' && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Tjekker forbindelse...</span>
              </div>
              <button 
                onClick={handleClearCacheAndReload}
                className="text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Ryd cache og prøv igen
              </button>
            </div>
          </div>
        )}

        {/* Expired link warning */}
        {expiredLinkError && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700">Linket er udløbet eller allerede brugt</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Password-links kan kun bruges én gang og udløber efter 1 time. 
                  Indtast din email nedenfor for at få et nyt link.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Forced password change warning */}
        {isForcedPasswordChange && (
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 mb-4">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">Du skal vælge en ny adgangskode</p>
                <p className="text-sm text-muted-foreground mt-1">
                  For din sikkerhed skal du ændre din midlertidige adgangskode før du kan fortsætte.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {getTitle()}
          </h2>


          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field - only show for login and reset request */}
            {!showPasswordChangeForm && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Privat eller arbejdsemail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password field - show for login and password change modes */}
            {(!isResetMode || showPasswordChangeForm) && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {showPasswordChangeForm ? "Ny adgangskode" : "Adgangskode"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {/* Password strength indicator - for password change modes */}
            {showPasswordChangeForm && password.length > 0 && (
              <PasswordStrengthIndicator password={password} />
            )}

            {/* Confirm password - for password change modes */}
            {showPasswordChangeForm && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bekræft adgangskode</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Adgangskoderne matcher ikke</p>
                )}
              </div>
            )}

            {/* Retry status indicator */}
            {retryAttempt > 1 && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Serveren svarer langsomt - forsøg {retryAttempt}/3...</span>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || authLoading || (showPasswordChangeForm && !canSubmitPasswordChange)}
            >
              {getButtonText()}
            </Button>
          </form>

          {/* Footer links */}
          {!showPasswordChangeForm && (
            <div className="mt-6 text-center">
              {isResetMode ? (
                <button
                  type="button"
                  onClick={() => setIsResetMode(false)}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Tilbage til login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  Glemt adgangskode?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}