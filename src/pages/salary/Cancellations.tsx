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
import { CancellationHistoryTable } from "@/components/cancellations/CancellationHistoryTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { Building2, AlertCircle } from "lucide-react";

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

  const selectedClientName = clients.find(c => c.id === selectedClientId)?.name;

  const manualTabs = useMemo(() => {
    const tabs = [] as { value: string; label: string }[];
    if (isOwner || canView('tab_cancellations_manual'))
      tabs.push({ value: 'manual_edit', label: 'Rediger kurv' });
    if (isOwner || canView('tab_cancellations_duplicates'))
      tabs.push({ value: 'duplicates', label: 'Dubletter' });
    return tabs;
  }, [isOwner, canView]);

  const autoTabs = useMemo(() => {
    const tabs = [] as { value: string; label: string }[];
    if (isOwner || canView('tab_cancellations_upload'))
      tabs.push({ value: 'upload', label: 'Upload' });
    if (isOwner || canView('tab_cancellations_approval'))
      tabs.push({ value: 'approval', label: 'Godkendelseskø' });
    if (isOwner || canView('tab_cancellations_approved'))
      tabs.push({ value: 'approved', label: 'Godkendte' });
    tabs.push({ value: 'history', label: 'Tidligere uploads' });
    return tabs;
  }, [isOwner, canView]);

  const hasManual = manualTabs.length > 0;
  const hasAuto = autoTabs.length > 0;
  const defaultMain = hasManual ? "manual" : hasAuto ? "automatic" : "";

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header with client selector */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Annulleringer</h1>
            <p className="text-muted-foreground mt-1">
              Administrer manuelle og bulk-annulleringer af salg
            </p>
          </div>
          <div className="space-y-1 min-w-[280px]">
            <Label className="text-xs font-medium text-muted-foreground">Kunde</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="h-11">
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

        {/* Selected client badge */}
        {selectedClientName && (
          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-primary">
            <Building2 className="h-4 w-4" />
            <span>Valgt kunde: {selectedClientName}</span>
          </div>
        )}

        {/* Guard: no client selected */}
        {!selectedClientId ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold text-muted-foreground">Vælg en kunde for at fortsætte</h2>
            <p className="text-sm text-muted-foreground/70 mt-1">Brug dropdown-menuen ovenfor til at vælge en kunde.</p>
          </div>
        ) : !hasManual && !hasAuto ? (
          <p className="text-muted-foreground">Du har ikke adgang til nogen faner på denne side.</p>
        ) : (
          <Tabs defaultValue={defaultMain} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              {hasManual && <TabsTrigger value="manual">Manuel kontrol</TabsTrigger>}
              {hasAuto && <TabsTrigger value="automatic">Automatisk kontrol</TabsTrigger>}
            </TabsList>

            {/* Manuel kontrol */}
            {hasManual && (
              <TabsContent value="manual">
                <Tabs defaultValue={manualTabs[0]?.value} className="w-full">
                  <TabsList className={`grid w-full max-w-sm grid-cols-${manualTabs.length}`}>
                    {manualTabs.map(tab => (
                      <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  {manualTabs.some(t => t.value === 'manual_edit') && (
                    <TabsContent value="manual_edit" className="mt-6">
                      <ManualCancellationsTab clientId={selectedClientId} />
                    </TabsContent>
                  )}
                  {manualTabs.some(t => t.value === 'duplicates') && (
                    <TabsContent value="duplicates" className="mt-6">
                      <DuplicatesTab clientId={selectedClientId} />
                    </TabsContent>
                  )}
                </Tabs>
              </TabsContent>
            )}

            {/* Automatisk kontrol */}
            {hasAuto && (
              <TabsContent value="automatic">
                <Tabs defaultValue={autoTabs[0]?.value} className="w-full">
                  <TabsList className={`grid w-full max-w-2xl grid-cols-${autoTabs.length}`}>
                    {autoTabs.map(tab => (
                      <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  {autoTabs.some(t => t.value === 'upload') && (
                    <TabsContent value="upload" className="mt-6">
                      <UploadCancellationsTab clientId={selectedClientId} />
                    </TabsContent>
                  )}
                  {autoTabs.some(t => t.value === 'approval') && (
                    <TabsContent value="approval" className="mt-6">
                      <ApprovalQueueTab clientId={selectedClientId} />
                    </TabsContent>
                  )}
                  {autoTabs.some(t => t.value === 'approved') && (
                    <TabsContent value="approved" className="mt-6">
                      <ApprovedTab clientId={selectedClientId} />
                    </TabsContent>
                  )}
                  {autoTabs.some(t => t.value === 'history') && (
                    <TabsContent value="history" className="mt-6">
                      <CancellationHistoryTable clientId={selectedClientId} />
                    </TabsContent>
                  )}
                </Tabs>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
