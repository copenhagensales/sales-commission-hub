import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";

export default function EesyTmDashboard() {
  const hiperId = getClientId("Hiper");
  return (
    <ClientDashboard
      config={{
        slug: "eesy-tm",
        clientId: getClientId("Eesy TM"),
        title: "Eesy TM – Overblik",
        features: {
          salesPerHour: true,
          showMonth: true,
          secondaryClientIds: hiperId ? [hiperId] : undefined,
          secondaryLabel: "Hiper",
        },
      }}
    />
  );
}
