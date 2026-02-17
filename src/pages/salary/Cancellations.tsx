import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualCancellationsTab } from "@/components/cancellations/ManualCancellationsTab";
import { UploadCancellationsTab } from "@/components/cancellations/UploadCancellationsTab";
import { DuplicatesTab } from "@/components/cancellations/DuplicatesTab";
import { MainLayout } from "@/components/layout/MainLayout";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { useMemo } from "react";

export default function Cancellations() {
  const { canView, isOwner } = useUnifiedPermissions();

  const visibleTabs = useMemo(() => {
    const tabs = [] as { value: string; label: string; key: string }[];
    if (isOwner || canView('tab_cancellations_manual'))
      tabs.push({ value: 'manual', label: 'Rediger kurv', key: 'tab_cancellations_manual' });
    if (isOwner || canView('tab_cancellations_upload'))
      tabs.push({ value: 'upload', label: 'Upload/match', key: 'tab_cancellations_upload' });
    if (isOwner || canView('tab_cancellations_duplicates'))
      tabs.push({ value: 'duplicates', label: 'Dubletter', key: 'tab_cancellations_duplicates' });
    return tabs;
  }, [isOwner, canView]);

  const defaultTab = visibleTabs[0]?.value ?? 'manual';

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Annulleringer</h1>
          <p className="text-muted-foreground mt-2">
            Administrer manuelle og bulk-annulleringer af salg
          </p>
        </div>

        {visibleTabs.length === 0 ? (
          <p className="text-muted-foreground">Du har ikke adgang til nogen faner på denne side.</p>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className={`grid w-full max-w-lg grid-cols-${visibleTabs.length}`}>
              {visibleTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {visibleTabs.some(t => t.value === 'manual') && (
              <TabsContent value="manual" className="mt-6">
                <ManualCancellationsTab />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'upload') && (
              <TabsContent value="upload" className="mt-6">
                <UploadCancellationsTab />
              </TabsContent>
            )}
            {visibleTabs.some(t => t.value === 'duplicates') && (
              <TabsContent value="duplicates" className="mt-6">
                <DuplicatesTab />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
