import { Calculator } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TdcSalgTool } from "@/components/tdc-salg/TdcSalgTool";

export function TdcSalgHeader() {
  return (
    <div className="flex items-center gap-3">
      <Calculator className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-2xl font-bold">TDC Salgsværktøj</h1>
        <p className="text-muted-foreground">Tilbud, opsummering og idriftsættelsesmail samlet ét sted</p>
      </div>
    </div>
  );
}

export default function TdcSalg() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        <TdcSalgHeader />
        <TdcSalgTool />
      </div>
    </MainLayout>
  );
}
