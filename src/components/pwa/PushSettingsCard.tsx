import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useInstallStork } from "@/hooks/useInstallStork";

export function PushSettingsCard() {
  const { standalone, ios } = useInstallStork();
  const push = usePushNotifications();

  const status = !standalone
    ? "Notifikationer slås til i Stork-appen på telefonen: åbn Stork fra ikonet på hjemmeskærmen og kom tilbage hertil."
    : !push.supported ? (ios ? "Kræver iOS 16.4 eller nyere." : "Denne telefon understøtter ikke notifikationer.")
    : push.permission === "denied" ? "Notifikationer er blokeret for Stork i telefonens indstillinger."
    : push.subscribed ? "Slået til på denne enhed." : "Slået fra på denne enhed.";

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notifikationer</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{status}</p>
        {push.supported && push.permission !== "denied" && (
          <div className="flex flex-wrap gap-2">
            {push.subscribed ? (
              <>
                <Button size="sm" onClick={() => push.sendTest.mutate(undefined, {
                  onSuccess: () => toast.success("Testnotifikation sendt"),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Fejl"),
                })} disabled={push.sendTest.isPending}>Send test</Button>
                <Button size="sm" variant="outline" onClick={() => void push.unsubscribe()}>Slå fra</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => push.subscribe().then(() => toast.success("Notifikationer er slået til")).catch((e) => toast.error(e instanceof Error ? e.message : "Fejl"))}>Slå til</Button>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Du får de beskeder, der hører til din rolle og dit team. Beskeder indeholder aldrig beløb, navne eller kundeoplysninger.</p>
      </CardContent>
    </Card>
  );
}
