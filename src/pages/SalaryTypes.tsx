import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalaryTypesTab } from "@/components/salary/SalaryTypesTab";
import { PersonnelSalaryTab } from "@/components/salary/PersonnelSalaryTab";
import { Receipt } from "lucide-react";

export default function SalaryTypes() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Lønstyring</h1>
            <p className="text-muted-foreground">Administrer lønarter og personalelønninger</p>
          </div>
        </div>

        <Tabs defaultValue="salary-types">
          <TabsList>
            <TabsTrigger value="salary-types">Lønarter</TabsTrigger>
            <TabsTrigger value="personnel-salary">Personalelønninger</TabsTrigger>
          </TabsList>

          <TabsContent value="salary-types" className="mt-4">
            <SalaryTypesTab />
          </TabsContent>

          <TabsContent value="personnel-salary" className="mt-4">
            <PersonnelSalaryTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
