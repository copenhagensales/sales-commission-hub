import { Mail } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TdcIdriftsaettelseForm } from "@/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm";

export default function TdcIdriftsaettelse() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">TDC Idriftsættelsesmail</h1>
            <p className="text-muted-foreground">Generer mailen til kunden efter et TDC-salg</p>
          </div>
        </div>
        <TdcIdriftsaettelseForm />
      </div>
    </MainLayout>
  );
}
