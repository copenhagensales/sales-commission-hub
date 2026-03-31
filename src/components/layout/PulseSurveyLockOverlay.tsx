import { ClipboardCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function PulseSurveyLockOverlay() {
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
      <Card className="max-w-md mx-4 border-primary">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ClipboardCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Pulsmåling afventer besvarelse</CardTitle>
          <CardDescription className="text-base">
            Du skal besvare pulsmålingen før du kan fortsætte med at bruge systemet.
            Det tager kun 2 minutter, og dine svar er 100% anonyme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate("/pulse-survey")}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Besvar pulsmåling
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
        </CardContent>
      </Card>
    </div>
  );
}
