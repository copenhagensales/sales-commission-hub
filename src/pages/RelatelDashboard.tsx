import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";

export default function RelatelDashboard() {
  return (
    <ClientDashboard
      config={{
        slug: "relatel",
        clientId: getClientId("Relatel"),
        title: "Relatel – Overblik",
        features: {
          salesPerHour: true,
          showMonth: true,
          crossSales: true,
          liveMode: true,
        },
      }}
    />
  );
}
