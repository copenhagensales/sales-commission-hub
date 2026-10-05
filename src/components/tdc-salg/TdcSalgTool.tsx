import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TdcTilbudForm } from "./TdcTilbudForm";
import { TdcOpsummeringForm, type OpsummeringMbbChoice } from "@/components/tdc-opsummering/TdcOpsummeringForm";
import { TdcIdriftsaettelseForm, type IdriftPrefill } from "@/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm";
import { buildPrefill } from "@/lib/tdcTilbud/prefill";
import type { Quantities } from "@/lib/tdcTilbud/calc";

const TRIGGER =
  "h-12 rounded-lg border-2 border-border bg-card text-base font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md";
const HIDDEN = "data-[state=inactive]:hidden";

export function TdcSalgTool() {
  const { toast } = useToast();
  const [tab, setTab] = useState("tilbud");
  const [products, setProducts] = useState<Quantities>({});
  const [hardware, setHardware] = useState<Quantities>({});
  const [mailPrefill, setMailPrefill] = useState<IdriftPrefill | undefined>();

  const [mbbChoice, setMbbChoice] = useState<OpsummeringMbbChoice | undefined>();
  const prefill = useMemo(() => buildPrefill(products, hardware), [products, hardware]);

  const changeTab = (next: string) => {
    if (next === "mail") {
      const candidate: IdriftPrefill = {
        subscriptions: prefill.mailSubscriptions,
        subsidyAmount: Math.round(prefill.subsidy) || undefined,
        subsidyProducts: prefill.hardware,
        fiveG: Object.entries(products).some(([id, n]) => id.startsWith("mbb-") && n > 0),
        ...(mbbChoice && (mbbChoice.noMbb || mbbChoice.mbbType)
          ? {
              mbb: mbbChoice.noMbb ? "none" : mbbChoice.mbbType === "datadelingskort" ? "datadeling" : "mobilevoice",
              noRouter: mbbChoice.noMbb ? true : mbbChoice.withoutRouter,
            }
          : {}),
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
      <TabsList className="h-auto w-full grid grid-cols-3 gap-2 bg-transparent p-0">
        <TabsTrigger className={TRIGGER} value="tilbud">1. Tilbud</TabsTrigger>
        <TabsTrigger className={TRIGGER} value="opsummering">2. Opsummering</TabsTrigger>
        <TabsTrigger className={TRIGGER} value="mail">3. Idriftsættelsesmail</TabsTrigger>
      </TabsList>
      <TabsContent value="tilbud" forceMount className={HIDDEN}>
        <TdcTilbudForm products={products} hardware={hardware} onProducts={setProducts} onHardware={setHardware} />
      </TabsContent>
      <TabsContent value="opsummering" forceMount className={HIDDEN}>
        <TdcOpsummeringForm prefill={prefill} onMbbChange={setMbbChoice} />
      </TabsContent>
      <TabsContent value="mail" forceMount className={HIDDEN}>
        <TdcIdriftsaettelseForm prefill={mailPrefill} />
      </TabsContent>
    </Tabs>
  );
}
