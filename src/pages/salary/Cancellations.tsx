import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualCancellationsTab } from "@/components/cancellations/ManualCancellationsTab";
import { UploadCancellationsTab } from "@/components/cancellations/UploadCancellationsTab";

export default function Cancellations() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Annulleringer</h1>
        <p className="text-muted-foreground mt-2">
          Administrer manuelle og bulk-annulleringer af salg
        </p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="manual">Manuelle annulleringer</TabsTrigger>
          <TabsTrigger value="upload">Upload/match annulleringer</TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="mt-6">
          <ManualCancellationsTab />
        </TabsContent>
        <TabsContent value="upload" className="mt-6">
          <UploadCancellationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
