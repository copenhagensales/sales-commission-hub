import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ManualCancellationsTab } from "@/components/cancellations/ManualCancellationsTab";
import { UploadCancellationsTab } from "@/components/cancellations/UploadCancellationsTab";
import { DuplicatesTab } from "@/components/cancellations/DuplicatesTab";
import { ApprovalQueueTab } from "@/components/cancellations/ApprovalQueueTab";
import { ApprovedTab } from "@/components/cancellations/ApprovedTab";

import { MainLayout } from "@/components/layout/MainLayout";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";

export default function Cancellations() {
  const { canView, isOwner } = useUnifiedPermissions();
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-cancellations-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const visibleTabs = useMemo(() => {
    const tabs = [] as { value: string; label: string }[];
    if (isOwner || canView('tab_cancellations_manual'))
      tabs.push({ value: 'manual', label: 'Rediger kurv' });
    if (isOwner || canView('tab_cancellations_upload'))
      tabs.push({ value: 'upload', label: 'Upload/match' });
    if (isOwner || canView('tab_cancellations_duplicates'))
      tabs.push({ value: 'duplicates', label: 'Dubletter' });
    if (isOwner || canView('tab_cancellations_approval'))
      tabs.push({ value: 'approval', label: 'Godkendelseskø' });
    if (isOwner || canView('tab_cancellations_approved'))
      tabs.push({ value: 'approved', label: 'Godkendte' });
    return tabs;
  }, [isOwner, canView]);

  const defaultTab = visibleTabs[0]?.value ?? 'manual';

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Annulleringer</h1>
            <p className="text-muted-foreground mt-2">
              Administrer manuelle og bulk-annulleringer af salg
            </p>
          </div>
          <div className="space-y-1 min-w-[250px]">
            <Label>Kunde</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kunde..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visibleTabs.length === 0 ? (
          <p className="text-muted-foreground">Du har ikke adgang til nogen faner på denne side.</p>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className={`grid w-full max-w-2xl grid-cols-${visibleTabs.length}`}>
              {visibleTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {visibleTabs.some(t => t.value === 'manual') && (
              <TabsContent value="manual" className="mt-6">
                <ManualCancellationsTab clientId={selectedClientId} />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'upload') && (
              <TabsContent value="upload" className="mt-6">
                <UploadCancellationsTab clientId={selectedClientId} />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'duplicates') && (
              <TabsContent value="duplicates" className="mt-6">
                <DuplicatesTab clientId={selectedClientId} />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'approval') && (
              <TabsContent value="approval" className="mt-6">
                <ApprovalQueueTab clientId={selectedClientId} />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'approved') && (
              <TabsContent value="approved" className="mt-6">
                <ApprovedTab clientId={selectedClientId} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
