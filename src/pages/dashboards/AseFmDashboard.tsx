import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";

const ASE_FM_CLIENT_ID = getClientId("ASE FM")!;

export default function AseFmDashboard() {
  return (
    <ClientDashboard
      config={{
        slug: "ase-fm",
        clientId: ASE_FM_CLIENT_ID,
        title: "Fieldmarketing – ASE FM",
        features: {
          theme: "cph",
        },
      }}
    />
  );
}
