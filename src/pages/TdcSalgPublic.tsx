import { TdcSalgTool } from "@/components/tdc-salg/TdcSalgTool";
import { TdcSalgHeader } from "@/pages/TdcSalg";

export default function TdcSalgPublic() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="container mx-auto max-w-7xl space-y-6">
        <TdcSalgHeader />
        <TdcSalgTool />
      </div>
    </div>
  );
}
