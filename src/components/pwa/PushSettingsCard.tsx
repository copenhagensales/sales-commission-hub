import { toast } from "sonner";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications, type PushPrefs } from "@/hooks/usePushNotifications";
import { useInstallStork } from "@/hooks/useInstallStork";
import { useMineUdsendelsespraeferencer } from "@/hooks/useUdsendelser";

const KANAL_NAVN: Record<string, string> = { push: "Push", mail: "Mail", sms: "SMS" };
const KANAL_IKON: Record<string, typeof Mail> = { push: Bell, mail: Mail, sms: MessageSquare };
/** De gamle push-felter samles i kontakten for deres gruppe. */
const PUSH_GRUPPE: Record<string, (keyof PushPrefs)[]> = {
  "Storkbook og Klub": ["klub"],
  "Onboarding og ramp": ["opstart_flag", "missing_one_on_one"],
  "Compliance": ["compliance"],
};

export function PushSettingsCard() {
  const { standalone, ios } = useInstallStork();
  const push = usePushNotifications();
  const praef = useMineUdsendelsespraeferencer();
  const grupper: [string, NonNullable<typeof praef.data>][] = [];
  for (const t of praef.data ?? []) {
    const g = t.gruppe || "Øvrige";
    const f = grupper.find(([n]) => n === g);
    if (f) f[1].push(t); else grupper.push([g, [t]]);
  }

  const status = !standalone
    ? "Notifikationer slås til i Stork-appen på telefonen: åbn Stork fra ikonet på hjemmeskærmen og kom tilbage hertil. Kontakterne nedenfor gælder alle dine enheder."
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
                })} disabled={push.sendTest.isPending}>Send testnotifikation</Button>
                <Button size="sm" variant="outline" onClick={() => void push.unsubscribe()}>Slå fra på denne enhed</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => push.subscribe().then(() => toast.success("Notifikationer er slået til")).catch((e) => toast.error(e instanceof Error ? e.message : "Fejl"))}>Slå notifikationer til</Button>
            )}
          </div>
        )}
        {grupper.map(([gruppe, typer]) => {
          const pushNoegler = PUSH_GRUPPE[gruppe] ?? [];
          const vaerdier = [
            ...typer.map((t) => t.aktiv),
            ...pushNoegler.map((k) => push.prefs.data?.[k] ?? true),
          ];
          const tilCount = vaerdier.filter(Boolean).length;
          const tændt = tilCount > 0;
          const delvis = tændt && tilCount < vaerdier.length;
          const skift = (v: boolean) => {
            praef.saetFlere.mutate(typer.map((t) => ({ noegle: t.noegle, kanal: t.kanal, aktiv: v })), { onError: () => toast.error("Kunne ikke gemme") });
            if (pushNoegler.length) {
              push.setPref.mutate(Object.fromEntries(pushNoegler.map((k) => [k, v])) as Partial<PushPrefs>, { onError: () => toast.error("Kunne ikke gemme") });
            }
          };
          return (
            <section key={gruppe} className="space-y-1 border-t pt-3 first:border-t-0 first:pt-0">
              <label className="flex min-h-11 items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block font-semibold">{gruppe}</span>
                  {delvis && <span className="block text-sm text-muted-foreground">delvist fravalgt</span>}
                </span>
                <Switch checked={tændt} aria-label={`${gruppe} til/fra`} onCheckedChange={skift}
                  disabled={praef.saetFlere.isPending || push.setPref.isPending} />
              </label>
              <details className="text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">Vis hvad der er med ({typer.length})</summary>
                <ul className="space-y-2 pb-2 pl-1">
                  {typer.map((t) => {
                    const I = KANAL_IKON[t.kanal] ?? Mail;
                    return (
                      <li key={`${t.noegle}|${t.kanal}`} className="flex items-center gap-2">
                        <I className="h-4 w-4 shrink-0" aria-label={KANAL_NAVN[t.kanal] ?? t.kanal} />
                        <span className="min-w-0 break-words">{t.navn}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </section>
          );
        })}
        <p className="text-xs text-muted-foreground">Beskeder indeholder aldrig beløb, navne eller kundeoplysninger.</p>
      </CardContent>
    </Card>
  );
}
