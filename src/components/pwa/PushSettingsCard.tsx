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
  // Senest BEKRÆFTEDE serverværdi pr. type (RPC-værdi eller lykket gem) – rollback går hertil.
  const bekraeftet = useRef<Record<string, boolean>>({});
  const brugerRef = useRef(user?.id);
  // Brugerskift: nulstil alt; køelementer bundet til den gamle bruger annulleres (tjekkes før kald).
  useEffect(() => { brugerRef.current = user?.id; setLokalt({}); seq.current = {}; bekraeftet.current = {}; }, [user?.id]);
  // Kun Storkbook-typer, som RPC'en faktisk returnerer for push.
  const raekker = (praef.data ?? []).filter((x) => x.kanal === "push");
  // Følger altid seneste RPC-værdi; et ventende valg ligger i `lokalt` og overskrives ikke herfra.
  for (const r of raekker) bekraeftet.current[r.noegle] = r.aktiv !== false;
  if (praef.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Kunne ikke hente indstillinger</p>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void praef.refetch()}>Prøv igen</Button>
      </div>
    );
  }
  if (praef.isLoading) return <p className="text-sm text-muted-foreground">Henter indstillinger …</p>;
  const synlige = STORKBOOK_TYPER.flatMap((t) => {
    const r = raekker.find((x) => x.noegle === t.noegle);
    return r ? [{ ...t, server: r.aktiv !== false }] : [];
  });
  if (!synlige.length) return null;
  const skift = (noegle: string, v: boolean) => {
    const bruger = user?.id;
    if (!bruger) return;
    const mitSeq = (seq.current[noegle] ?? 0) + 1;
    seq.current[noegle] = mitSeq;
    setLokalt((p) => ({ ...p, [noegle]: v }));
    const saetFlere = praef.saetFlere;
    koe.current = koe.current.then(async () => {
      // Elementet er bundet til brugeren ved oprettelse; skiftet bruger → annulleret, intet skrives.
      if (bruger !== brugerRef.current) return;
      let fejl = false;
      try { await saetFlere.mutateAsync([{ noegle, kanal: "push", aktiv: v }]); } catch { fejl = true; }
      if (bruger !== brugerRef.current) return;
      if (!fejl) bekraeftet.current[noegle] = v;
      else toast.error("Kunne ikke gemme indstillingen", { description: "Prøv igen." });
      // Kun hvis intet nyere valg er lavet for typen.
      if (seq.current[noegle] !== mitSeq) return;
      if (!fejl) {
        // Succes: fjern override, så friske RPC-værdier vises (listen er gen-hentet i onSuccess).
        setLokalt((p) => { const n = { ...p }; delete n[noegle]; return n; });
      } else {
        // Fejl: fjern override og hent igen, så den friske serverværdi vises.
        setLokalt((p) => { const n = { ...p }; delete n[noegle]; return n; });
        void praef.refetch();
      }
    });
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Storkbook</p>
      <ul className="divide-y">
        {synlige.map((t) => (
          <li key={t.noegle}>
            <label className="flex min-h-11 items-center justify-between gap-3 py-1">
              <span className="text-sm">{t.navn}</span>
              <Switch checked={t.noegle in lokalt ? lokalt[t.noegle] : t.server} onCheckedChange={(v) => skift(t.noegle, v)} aria-label={t.navn} />
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
