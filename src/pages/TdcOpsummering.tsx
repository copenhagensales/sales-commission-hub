import { FileText } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TdcOpsummeringForm } from "@/components/tdc-opsummering/TdcOpsummeringForm";

export default function TdcOpsummering() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">TDC Opsummering</h1>
            <p className="text-muted-foreground">
              Generer en struktureret opsummeringstekst efter et TDC-salg
            </p>
          </div>
        </div>

        <TdcOpsummeringForm />
      </div>
    </MainLayout>
  );
}
