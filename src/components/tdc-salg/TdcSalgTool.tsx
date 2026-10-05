import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TdcTilbudForm } from "./TdcTilbudForm";
import { TdcOpsummeringForm } from "@/components/tdc-opsummering/TdcOpsummeringForm";
import { TdcIdriftsaettelseForm } from "@/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm";
import { buildPrefill, type TilbudPrefill } from "@/lib/tdcTilbud/prefill";
import type { Quantities } from "@/lib/tdcTilbud/calc";

const HIDDEN = "data-[state=inactive]:hidden";

export function TdcSalgTool() {
  const { toast } = useToast();
  const [tab, setTab] = useState("tilbud");
  const [products, setProducts] = useState<Quantities>({});
  const [hardware, setHardware] = useState<Quantities>({});
  const [transferred, setTransferred] = useState<TilbudPrefill | undefined>();
  const [mailKey, setMailKey] = useState(0);

  const mailPrefill = useMemo(
    () =>
      transferred && {
        subscriptions: transferred.mailSubscriptions,
        subsidyAmount: Math.round(transferred.subsidy) || undefined,
        subsidyProducts: transferred.hardware,
      },
    [transferred]
  );

  const transfer = () => {
    setTransferred(buildPrefill(products, hardware));
    setMailKey((k) => k + 1);
    setTab("opsummering");
    toast({ title: "Overført", description: "Tilbuddet er sat ind i opsummering og mail. Mailen er nulstillet med de nye linjer." });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="tilbud">1. Tilbud</TabsTrigger>
        <TabsTrigger value="opsummering">2. Opsummering</TabsTrigger>
        <TabsTrigger value="mail">3. Idriftsættelsesmail</TabsTrigger>
      </TabsList>
      <TabsContent value="tilbud" forceMount className={HIDDEN}>
        <TdcTilbudForm products={products} hardware={hardware} onProducts={setProducts} onHardware={setHardware} onTransfer={transfer} />
      </TabsContent>
      <TabsContent value="opsummering" forceMount className={HIDDEN}>
        <TdcOpsummeringForm prefill={transferred} />
      </TabsContent>
      <TabsContent value="mail" forceMount className={HIDDEN}>
        <TdcIdriftsaettelseForm key={mailKey} prefill={mailPrefill} />
      </TabsContent>
    </Tabs>
  );
}
