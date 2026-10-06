import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { TdcTilbudForm } from "./TdcTilbudForm";
import { TdcOpsummeringForm, type OpsummeringMbbChoice } from "@/components/tdc-opsummering/TdcOpsummeringForm";
import { TdcIdriftsaettelseForm, type IdriftPrefill } from "@/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm";
import { buildPrefill, type SubsidyPct } from "@/lib/tdcTilbud/prefill";
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
  const [subsidyPct, setSubsidyPct] = useState<SubsidyPct | null>(null);
  const prefill = useMemo(() => buildPrefill(products, hardware, subsidyPct), [products, hardware, subsidyPct]);

  const [resetKey, setResetKey] = useState(0);
  const resetAll = () => {
    setProducts({});
    setHardware({});
    setMailPrefill(undefined);
    setMbbChoice(undefined);
    setSubsidyPct(null);
    setResetKey((k) => k + 1);
    setTab("tilbud");
    toast({ title: "Alle valg er nulstillet" });
  };
  const ResetBar = () => (
    <div className="mb-4 flex justify-end">
      <Button type="button" variant="outline" size="sm" onClick={resetAll}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Nulstil alle valg
      </Button>
    </div>
  );

  const changeTab = (next: string) => {
    if (next === "mail") {
      const candidate: IdriftPrefill = {
        subscriptions: prefill.mailSubscriptions,
        subsidyAmount: Math.round((prefill.subsidy * (subsidyPct ?? 100)) / 100) || undefined,
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
        <ResetBar />
        <TdcTilbudForm key={`t${resetKey}`} products={products} hardware={hardware} onProducts={setProducts} onHardware={setHardware} subsidyPct={subsidyPct} onSubsidyPct={setSubsidyPct} />
      </TabsContent>
      <TabsContent value="opsummering" forceMount className={HIDDEN}>
        <ResetBar />
        <TdcOpsummeringForm key={`o${resetKey}`} onlyImplementering prefill={prefill} onMbbChange={setMbbChoice} />
      </TabsContent>
      <TabsContent value="mail" forceMount className={HIDDEN}>
        <ResetBar />
        <TdcIdriftsaettelseForm key={`m${resetKey}`} prefill={mailPrefill} />
      </TabsContent>
    </Tabs>
  );
}
