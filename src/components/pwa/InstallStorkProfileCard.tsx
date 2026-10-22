import { Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInstallStork } from "@/hooks/useInstallStork";
import { InstallStorkGuide } from "./InstallStorkGuide";

/** Kan altid findes på profilen, også efter "Ikke nu". */
export function InstallStorkProfileCard() {
  const s = useInstallStork();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5" aria-hidden="true" /> Læg Stork på din telefon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.standalone ? (
          <p className="text-sm text-muted-foreground">Stork er allerede installeret og kører som app.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Åbn Stork på telefonen i browseren, og følg vejledningen.</p>
            <p className="text-sm font-semibold text-foreground">iPhone (Safari)</p>
            <InstallStorkGuide ios canPrompt={false} onInstall={s.install} />
            <p className="text-sm font-semibold text-foreground">Android (Chrome)</p>
            <InstallStorkGuide ios={false} canPrompt={s.canPrompt && !s.ios} onInstall={s.install} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
