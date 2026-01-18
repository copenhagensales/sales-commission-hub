import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalaryTypesTab } from "@/components/salary/SalaryTypesTab";
import { PersonnelSalaryTab } from "@/components/salary/PersonnelSalaryTab";
import { SellerSalariesTab } from "@/components/salary/SellerSalariesTab";
import { TeamExpensesTab } from "@/components/salary/TeamExpensesTab";
import { DBOverviewTab } from "@/components/salary/DBOverviewTab";
import { CombinedSalaryTab } from "@/components/salary/CombinedSalaryTab";
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
          <TabsList className="flex-wrap">
            <TabsTrigger value="salary-types">Lønarter</TabsTrigger>
            <TabsTrigger value="all-salaries">Alle lønninger</TabsTrigger>
            <TabsTrigger value="seller-salaries">Sælgerlønninger</TabsTrigger>
            <TabsTrigger value="team-expenses">Teamomkostninger</TabsTrigger>
            <TabsTrigger value="db-overview">DB Oversigt</TabsTrigger>
            <TabsTrigger value="combined">Samlet</TabsTrigger>
          </TabsList>

          <TabsContent value="salary-types" className="mt-4">
            <SalaryTypesTab />
          </TabsContent>

          <TabsContent value="all-salaries" className="mt-4">
            <PersonnelSalaryTab />
          </TabsContent>

          <TabsContent value="seller-salaries" className="mt-4">
            <SellerSalariesTab />
          </TabsContent>

          <TabsContent value="team-expenses" className="mt-4">
            <TeamExpensesTab />
          </TabsContent>

          <TabsContent value="db-overview" className="mt-4">
            <DBOverviewTab />
          </TabsContent>

          <TabsContent value="combined" className="mt-4">
            <CombinedSalaryTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
