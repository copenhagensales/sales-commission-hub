import { FileText } from "lucide-react";
import { TdcOpsummeringForm } from "@/components/tdc-opsummering/TdcOpsummeringForm";

export default function TdcOpsummeringPublic() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="container mx-auto max-w-7xl space-y-6">
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
    </div>
  );
}
