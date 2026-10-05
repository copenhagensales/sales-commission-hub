import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TdcTilbudForm } from "./TdcTilbudForm";
import { TdcOpsummeringForm } from "@/components/tdc-opsummering/TdcOpsummeringForm";
import { TdcIdriftsaettelseForm, type IdriftPrefill } from "@/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm";
import { buildPrefill } from "@/lib/tdcTilbud/prefill";
import type { Quantities } from "@/lib/tdcTilbud/calc";

const HIDDEN = "data-[state=inactive]:hidden";

export function TdcSalgTool() {
  const { toast } = useToast();
  const [tab, setTab] = useState("tilbud");
  const [products, setProducts] = useState<Quantities>({});
  const [hardware, setHardware] = useState<Quantities>({});
  const [mailPrefill, setMailPrefill] = useState<IdriftPrefill | undefined>();

  const prefill = useMemo(() => buildPrefill(products, hardware), [products, hardware]);

  const changeTab = (next: string) => {
    if (next === "mail") {
      const candidate: IdriftPrefill = {
        subscriptions: prefill.mailSubscriptions,
        subsidyAmount: Math.round(prefill.subsidy) || undefined,
        subsidyProducts: prefill.hardware,
      };
      if (JSON.stringify(candidate) !== JSON.stringify(mailPrefill)) {
        const hadPrevious = !!mailPrefill;
        setMailPrefill(candidate);
        if (hadPrevious) toast({ title: "Mailen er opdateret ud fra tilbuddet" });
      }
    }
    setTab(next);
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="tilbud">1. Tilbud</TabsTrigger>
        <TabsTrigger value="opsummering">2. Opsummering</TabsTrigger>
        <TabsTrigger value="mail">3. Idriftsættelsesmail</TabsTrigger>
      </TabsList>
      <TabsContent value="tilbud" forceMount className={HIDDEN}>
        <TdcTilbudForm products={products} hardware={hardware} onProducts={setProducts} onHardware={setHardware} />
      </TabsContent>
      <TabsContent value="opsummering" forceMount className={HIDDEN}>
        <TdcOpsummeringForm prefill={prefill} />
      </TabsContent>
      <TabsContent value="mail" forceMount className={HIDDEN}>
        <TdcIdriftsaettelseForm prefill={mailPrefill} />
      </TabsContent>
    </Tabs>
  );
}
