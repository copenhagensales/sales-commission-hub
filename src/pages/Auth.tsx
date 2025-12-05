import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Mail, Lock, User, Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const { toast } = useToast();

  const testConnection = async () => {
    setConnectionStatus('checking');
    try {
      // Simple health check - just get the session (doesn't require auth)
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setConnectionStatus('connected');
      return true;
    } catch (e) {
      console.error("Connection test failed:", e);
      setConnectionStatus('error');
      return false;
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      toast({
        title: "Ingen forbindelse til server",
        description: "Prøv at genindlæse siden eller brug den publicerede version af appen.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Velkommen tilbage!",
          description: "Du er nu logget ind.",
        });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { name },
          },
        });
        if (error) throw error;
        toast({
          title: "Konto oprettet!",
          description: "Du kan nu logge ind.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      const message = error.message === "Failed to fetch" 
        ? "Kunne ikke forbinde til serveren. Prøv at genindlæse siden."
        : error.message;
      toast({
        title: "Fejl",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    const connected = await testConnection();
    if (connected) {
      toast({
        title: "Forbindelse genoprettet!",
        description: "Du kan nu logge ind.",
      });
    } else {
      toast({
        title: "Stadig ingen forbindelse",
        description: "Prøv at genindlæse siden helt (Ctrl+Shift+R) eller brug den publicerede version.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <TrendingUp className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            PayTrack
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Løn- og provisionssystem til callcentre
          </p>
        </div>

        {/* Connection Status */}
        {connectionStatus === 'error' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Ingen forbindelse til server</p>
                <p className="text-sm text-muted-foreground">
                  Preview-miljøet kan ikke nå serveren. Prøv den publicerede version.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetryConnection}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Prøv igen
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Forbundet til server</span>
            </div>
          </div>
        )}

        {connectionStatus === 'checking' && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Tjekker forbindelse...</span>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {isLogin ? "Log ind" : "Opret konto"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Navn</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Dit fulde navn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="din@email.dk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Adgangskode</Label>
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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || connectionStatus === 'error'}
            >
              {loading ? "Vent venligst..." : isLogin ? "Log ind" : "Opret konto"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin
                ? "Har du ikke en konto? Opret en her"
                : "Har du allerede en konto? Log ind"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
