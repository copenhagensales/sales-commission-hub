import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useInstallStork } from "@/hooks/useInstallStork";
import { useMineUdsendelsespraeferencer } from "@/hooks/useUdsendelser";
import { Switch } from "@/components/ui/switch";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORKBOOK_TYPER: { noegle: string; navn: string }[] = [
  { noegle: "storkbook_besked", navn: "Beskeder" },
  { noegle: "storkbook_ros", navn: "Ros" },
  { noegle: "storkbook_svar", navn: "Svar på dine spørgsmål" },
  { noegle: "storkbook_kommentar", navn: "Kommentarer på dine opslag" },
  { noegle: "storkbook_reaktion", navn: "Reaktioner på dine opslag" },
  { noegle: "storkbook_omtale", navn: "Omtaler af dig eller dit team" },
  { noegle: "storkbook_begivenhed", navn: "Begivenheder" },
];

function StorkbookToggles() {
  const praef = useMineUdsendelsespraeferencer();
  const { user } = useAuth();
  const [lokalt, setLokalt] = useState<Record<string, boolean>>({});
  // Gem serialiseres: næste gem starter først, når forrige er afsluttet. Hvert gem håndteres for sig.
  const koe = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef<Record<string, number>>({});
  // Lokale overrides nulstilles ved brugerskift.
  const brugerRef = useRef(user?.id);
  useEffect(() => { brugerRef.current = user?.id; setLokalt({}); seq.current = {}; }, [user?.id]);
  if (praef.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Kunne ikke hente indstillinger</p>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void praef.refetch()}>Prøv igen</Button>
      </div>
    );
  }
  if (praef.isLoading) return <p className="text-sm text-muted-foreground">Henter indstillinger …</p>;
  const aktiv = (noegle: string) => {
    if (noegle in lokalt) return lokalt[noegle];
    const r = (praef.data ?? []).find((x) => x.noegle === noegle && x.kanal === "push");
    return r ? r.aktiv !== false : true;
  };
  const skift = (noegle: string, v: boolean) => {
    const mitSeq = (seq.current[noegle] ?? 0) + 1;
    seq.current[noegle] = mitSeq;
    const bruger = user?.id;
    setLokalt((p) => ({ ...p, [noegle]: v }));
    const saetFlere = praef.saetFlere;
    koe.current = koe.current.then(async () => {
      let fejl = false;
      try { await saetFlere.mutateAsync([{ noegle, kanal: "push", aktiv: v }]); } catch { fejl = true; }
      if (fejl) toast.error("Kunne ikke gemme indstillingen", { description: "Prøv igen." });
      // Rollback/oprydning kun for denne type, kun hvis intet nyere valg er lavet og samme bruger.
      // Override fjernes, så kontakten viser den gemte værdi (ved fejl: værdien før dette valg).
      if (bruger !== brugerRef.current || seq.current[noegle] !== mitSeq) return;
      setLokalt((p) => { const n = { ...p }; delete n[noegle]; return n; });
    });
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Storkbook</p>
      <ul className="divide-y">
        {STORKBOOK_TYPER.map((t) => (
          <li key={t.noegle}>
            <label className="flex min-h-11 items-center justify-between gap-3 py-1">
              <span className="text-sm">{t.navn}</span>
              <Switch checked={aktiv(t.noegle)} onCheckedChange={(v) => skift(t.noegle, v)} aria-label={t.navn} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        <StorkbookToggles />
        <p className="text-sm text-muted-foreground">Notifikationer viser aldrig beskedtekst eller kundeoplysninger – kun afsenderens fornavn og et antal.</p>
      </CardContent>
    </Card>
  );
}
