import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";

interface SuperadminGateProps {
  children: React.ReactNode;
  /** Vises i stedet for indholdet, hvis brugeren ikke er superadmin. */
  message?: string;
}

/**
 * Skjuler løn- og overskudstal for alle andre end superadmins.
 *
 * Bemærk: dette er kun brugerfladen. Databasen håndhæver den samme adgang med
 * RLS, så tallene heller ikke kan hentes ved at kalde API'et direkte.
 */
export function SuperadminGate({ children, message }: SuperadminGateProps) {
  const { isSuperadmin, isLoading } = useIsSuperadmin();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Adgang begrænset</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {message ??
                "Løn- og DB-tal er forbeholdt superadmins. Kontakt en superadmin, hvis du har brug for adgang."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
