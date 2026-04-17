import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function CodeOfConductLockOverlay() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    queryClient.clear();
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') || key.includes('supabase')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }

    navigate("/auth");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="max-w-md mx-4 border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Code of Conduct & GDPR afventer</CardTitle>
          <CardDescription className="text-base">
            Du har ikke gennemført den obligatoriske Code of Conduct & GDPR test inden for 7 dage. 
            Du skal gennemføre og bestå testen før du kan fortsætte med at bruge systemet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Påkrævet:</p>
            <p className="font-medium">Code of Conduct & GDPR – Salgskonsulenter</p>
          </div>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate("/code-of-conduct")}
          >
            Gå til testen
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log ud
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Hvis du allerede har bestået testen og stadig ser denne besked, log ud og ind igen, eller kontakt support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
