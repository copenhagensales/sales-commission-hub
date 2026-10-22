import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications, type PushPrefs } from "@/hooks/usePushNotifications";
import { useInstallStork } from "@/hooks/useInstallStork";
import { PUSH_PREF_TYPES } from "@/lib/push/pushText";

export function PushSettingsCard() {
  const { standalone, ios } = useInstallStork();
  const push = usePushNotifications();

  const status = !push.supported
    ? ios && !standalone ? "Installér Stork på hjemmeskærmen først (iOS 16.4 eller nyere)." : "Denne browser understøtter ikke notifikationer."
    : push.permission === "denied" ? "Notifikationer er blokeret i telefonens indstillinger."
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
                })} disabled={push.sendTest.isPending}>Send testnotifikation</Button>
                <Button size="sm" variant="outline" onClick={() => void push.unsubscribe()}>Slå fra på denne enhed</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => push.subscribe().then(() => toast.success("Notifikationer er slået til")).catch((e) => toast.error(e instanceof Error ? e.message : "Fejl"))}>Slå notifikationer til</Button>
            )}
          </div>
        )}
        <div className="space-y-3">
          {PUSH_PREF_TYPES.map((t) => (
            <label key={t.key} className="flex items-center justify-between gap-4 text-sm">
              <span>{t.label}</span>
              <Switch
                checked={push.prefs.data?.[t.key as keyof PushPrefs] ?? true}
                onCheckedChange={(v) => push.setPref.mutate({ [t.key]: v } as Partial<PushPrefs>, { onError: () => toast.error("Kunne ikke gemme") })}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Beskeder indeholder aldrig beløb, navne eller kundeoplysninger.</p>
      </CardContent>
    </Card>
  );
}
