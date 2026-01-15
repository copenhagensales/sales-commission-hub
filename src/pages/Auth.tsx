import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Wifi, RefreshCw, ArrowLeft, AlertTriangle, KeyRound } from "lucide-react";
import cphSalesLogo from "@/assets/cph-sales-logo-dark.png";
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

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isNewPasswordMode, setIsNewPasswordMode] = useState(false);
  const [isForcedPasswordChange, setIsForcedPasswordChange] = useState(false);
  const [expiredLinkError, setExpiredLinkError] = useState(false);
  const { toast } = useToast();
  const { mustChangePassword, clearMustChangePassword, user, loading: authLoading } = useAuth();
  
  // Derive connection status from auth loading state
  const connectionStatus = authLoading ? 'checking' : 'connected';

  // Check if user must change password after login
  useEffect(() => {
    if (mustChangePassword && user) {
      setIsForcedPasswordChange(true);
      setPassword("");
      setConfirmPassword("");
    }
  }, [mustChangePassword, user]);

  useEffect(() => {

    // Check URL for error parameters (expired/invalid token)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    const error = hashParams.get('error');
    
    if (error || errorDescription) {
      setExpiredLinkError(true);
      setIsResetMode(true);
      // Clear the hash to clean up URL
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Listen for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsNewPasswordMode(true);
        setIsResetMode(false);
        setExpiredLinkError(false);
      }
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
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast({
          title: "Email sendt",
          description: "Tjek din indbakke. Linket udløber efter 1 time og kan kun bruges én gang.",
        });
        setIsResetMode(false);
        setExpiredLinkError(false);
      } else {
        // ============ EMERGENCY LOGIN MODE ============
        // Database is overloaded - bypass all pre-checks
        // Only use Supabase Auth service directly
        // TODO: Re-enable pre-checks when database is stable
        
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
        
        // Direct login - no database pre-checks
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        
        if (error) throw error;
        
        toast({
          title: "Velkommen tilbage!",
          description: "Du er nu logget ind.",
        });
        
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
      let message = error.message;
      
      // Provide user-friendly error messages
      if (error.message === "Failed to fetch") {
        message = "Kunne ikke forbinde til serveren. Tjek din internetforbindelse og prøv igen.";
      } else if (error.name === "TimeoutError") {
        message = "Login tog for lang tid. Serveren er muligvis overbelastet - prøv igen om lidt.";
      } else if (error.message?.includes("Invalid login")) {
        message = "Forkert email eller adgangskode.";
      }
      
      console.error("[Auth] Login error:", error.message, error.name);
      toast({
        title: "Fejl",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        {/* Logo */}
        <div className="text-center">
          <img 
            src={cphSalesLogo} 
            alt="CPH Sales" 
            className="mx-auto h-24 w-auto"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Løn- og performance-system
          </p>
        </div>

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