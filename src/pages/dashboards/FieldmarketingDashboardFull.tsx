import { useState } from "react";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { getClientId } from "@/utils/clientIds";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FM_TABS = [
  { value: "eesy-fm", label: "Eesy FM", clientId: getClientId("Eesy FM")! },
  { value: "yousee", label: "Yousee", clientId: getClientId("Yousee")! },
] as const;

export default function FieldmarketingDashboardFull() {
  const [activeTab, setActiveTab] = useState<string>(FM_TABS[0].value);
  const active = FM_TABS.find((t) => t.value === activeTab) ?? FM_TABS[0];

  const tabSelector = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-0">
      <TabsList className="h-auto gap-1 bg-muted/60 p-1">
        {FM_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-current opacity-40 data-[state=active]:opacity-100"
            />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );


  return (
    <ClientDashboard
      key={active.clientId}
      config={{
        slug: "fieldmarketing",
        clientId: active.clientId,
        title: `Fieldmarketing – ${active.label}`,
        features: {
          theme: "cph",
        },
        extraContent: tabSelector,

      }}
    />
  );
}
