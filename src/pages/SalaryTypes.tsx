import { MainLayout } from "@/components/layout/MainLayout";
import { SalaryDashboardKPIs } from "@/components/salary/SalaryDashboardKPIs";
import { CategoryTabs } from "@/components/salary/CategoryTabs";
import { Receipt } from "lucide-react";
import { SuperadminGate } from "@/components/auth/SuperadminGate";

export default function SalaryTypes() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm ring-1 ring-foreground/5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Lønstyring</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Administrer lønarter og personalelønninger</p>
          </div>
        </div>

        {/* KPI Dashboard — lønsummer er kun for superadmins */}
        <SuperadminGate message="Løn-KPI'er er forbeholdt superadmins.">
          <SalaryDashboardKPIs />
        </SuperadminGate>

        {/* Categorized Tabs */}
        <CategoryTabs />
      </div>
    </MainLayout>
  );
}
