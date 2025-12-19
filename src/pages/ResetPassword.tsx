import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, EyeOff, KeyRound } from "lucide-react";

interface TokenInfo {
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: string;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const token = searchParams.get("token");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Intet token angivet i linket.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("validate-reset-token", {
          body: { token },
        });

        if (invokeError) {
          throw new Error(invokeError.message);
        }

        if (!data?.valid) {
          setError(data?.error || "Linket er ugyldigt eller udløbet.");
          setTokenValid(false);
        } else {
          setTokenValid(true);
          setTokenInfo({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            expiresAt: data.expiresAt,
          });
        }
      } catch (err) {
        console.error("Token validation error:", err);
        setError("Kunne ikke validere linket. Prøv igen senere.");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "For kort adgangskode",
        description: "Adgangskoden skal være mindst 6 tegn.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Adgangskoder matcher ikke",
        description: "De to adgangskoder skal være ens.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("complete-password-reset", {
        body: { token, newPassword: password },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCompleted(true);
      setIsNewUser(data?.isNewUser || false);
      
      toast({
        title: data?.isNewUser ? "Konto oprettet!" : "Adgangskode opdateret!",
        description: "Du kan nu logge ind med din nye adgangskode.",
      });
    } catch (err) {
      console.error("Reset error:", err);
      toast({
        title: "Fejl",
        description: err instanceof Error ? err.message : "Kunne ikke opdatere adgangskoden.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validerer link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Ugyldigt link</CardTitle>
            <CardDescription>
              {error || "Dette link er ugyldigt eller udløbet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-6">
              Kontakt venligst din administrator for at få tilsendt et nyt link.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline">
              Gå til login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>{isNewUser ? "Konto oprettet!" : "Adgangskode opdateret!"}</CardTitle>
            <CardDescription>
              {isNewUser 
                ? "Din konto er nu oprettet og du kan logge ind."
                : "Din adgangskode er nu opdateret og du kan logge ind."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/auth")} className="w-full">
              Gå til login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Opret ny adgangskode</CardTitle>
          <CardDescription>
            Hej {tokenInfo?.firstName}{tokenInfo?.lastName ? ` ${tokenInfo.lastName}` : ""}, indtast din nye adgangskode nedenfor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={tokenInfo?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Ny adgangskode</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindst 6 tegn"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekræft adgangskode</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Gentag adgangskode"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opdaterer...
                </>
              ) : (
                "Opret adgangskode"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
