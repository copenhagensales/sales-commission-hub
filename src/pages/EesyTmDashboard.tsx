import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";

export default function EesyTmDashboard() {
  return (
    <ClientDashboard
      config={{
        slug: "eesy-tm",
        clientId: getClientId("Eesy TM"),
        title: "Eesy TM – Overblik",
        features: {
          salesPerHour: true,
          showMonth: true,
        },
      }}
    />
  );
}
