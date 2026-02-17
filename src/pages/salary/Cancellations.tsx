import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualCancellationsTab } from "@/components/cancellations/ManualCancellationsTab";
import { UploadCancellationsTab } from "@/components/cancellations/UploadCancellationsTab";
import { DuplicatesTab } from "@/components/cancellations/DuplicatesTab";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Cancellations() {
  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Annulleringer</h1>
          <p className="text-muted-foreground mt-2">
            Administrer manuelle og bulk-annulleringer af salg
          </p>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="manual">Rediger kurv</TabsTrigger>
            <TabsTrigger value="upload">Upload/match</TabsTrigger>
            <TabsTrigger value="duplicates">Dubletter</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-6">
            <ManualCancellationsTab />
          </TabsContent>
          <TabsContent value="upload" className="mt-6">
            <UploadCancellationsTab />
          </TabsContent>
          <TabsContent value="duplicates" className="mt-6">
            <DuplicatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
