import { MainLayout } from "@/components/layout/MainLayout";
import { SalaryDashboardKPIs } from "@/components/salary/SalaryDashboardKPIs";
import { CategoryTabs } from "@/components/salary/CategoryTabs";
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

        {/* KPI Dashboard */}
        <SalaryDashboardKPIs />

        {/* Categorized Tabs */}
        <CategoryTabs />
      </div>
    </MainLayout>
  );
}
