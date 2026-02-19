import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";

export default function TdcErhvervDashboard() {
  return (
    <ClientDashboard
      config={{
        slug: "tdc-erhverv",
        clientId: getClientId("TDC Erhverv"),
        title: "TDC Erhverv – Overblik",
        features: {
          salesPerHour: true,
          showMonth: true,
        },
      }}
    />
  );
}
