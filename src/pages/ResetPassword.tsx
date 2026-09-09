import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

/**
 * Password-login er lukket i Stork. Nulstilling af adgangskode findes ikke
 * længere - login sker udelukkende med Microsoft-kontoen (arbejdsmailen).
 */
export default function ResetPassword() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Adgangskoder bruges ikke længere</CardTitle>
          <CardDescription>
            Log ind med din Microsoft-konto (din arbejdsmail). Kan du ikke logge ind, så henvend dig
            på kontoret.
          </CardDescription>
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
