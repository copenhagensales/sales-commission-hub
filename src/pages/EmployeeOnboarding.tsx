import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "@/assets/cph-sales-logo.png";

interface InvitationData {
  id: string;
  employee_id: string;
  email: string;
  status: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  password_set_at: string | null;
}

export default function EmployeeOnboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Intet token fundet. Brug linket fra din invitation.");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Use secure function to lookup invitation by token - now returns ONLY non-sensitive data
      const { data, error: invError } = await supabase
        .rpc("get_invitation_by_token_v2", { _token: token });

      if (invError || !data || data.length === 0) {
        setError("Ugyldigt eller udløbet link.");
        setLoading(false);
        return;
      }

      const invitationData = data[0] as InvitationData;

      if (new Date(invitationData.expires_at) < new Date()) {
        setError("Invitationen er udløbet. Kontakt venligst din leder for at få et nyt link.");
        setLoading(false);
        return;
      }

      if (invitationData.password_set_at) {
        setError("Din konto er oprettet — log ind med Microsoft");
        setLoading(false);
        return;
      }

      setInvitation(invitationData);
      setLoading(false);
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Der opstod en fejl. Prøv igen senere.");
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setCreatingAccount(true);
    try {
      const response = await supabase.functions.invoke("complete-employee-registration", {
        body: { token },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || "Kunne ikke oprette konto");
      }

      setCompleted(true);
      toast({
        title: "Konto oprettet!",
        description: "Din konto er oprettet — log ind med Microsoft",
      });
    } catch (err) {
      console.error("Account creation error:", err);
      toast({
        title: "Fejl",
        description: err instanceof Error ? err.message : "Kunne ikke oprette konto",
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Fejl</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Gå til login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Velkommen!</CardTitle>
            <CardDescription>
              Din konto er oprettet — log ind med Microsoft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Næste trin efter login:</p>
              <p className="text-sm font-medium">Udfyld dine personlige oplysninger på "Min Profil"</p>
            </div>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Gå til login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <img src={logo} alt="CPH Sales" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Velkommen til CPH Sales</h1>
          <p className="text-muted-foreground mt-2">
            Hej {invitation?.first_name}! Aktivér din konto for at komme i gang.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Log ind med Microsoft</CardTitle>
            <CardDescription>
              Du logger ind med din Microsoft-arbejdskonto ({invitation?.email}). Der skal ikke oprettes en adgangskode.
            </CardDescription>
          </CardHeader>
        </Card>

        <Button
          type="button"
          className="w-full"
          size="lg"
          onClick={handleCreateAccount}
          disabled={creatingAccount}
        >
          {creatingAccount ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opretter konto...
            </>
          ) : (
            <>
              Opret konto <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Efter login kan du udfylde dine personlige oplysninger, adresse og bankdetaljer på din profil.
        </p>
      </div>
    </div>
  );
}
