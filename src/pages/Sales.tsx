import { MainLayout } from "@/components/layout/MainLayout";
import SalesFeed from "@/components/sales/SalesFeed";

export default function Sales() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sales Overview</h1>
          <p className="text-muted-foreground">View all recorded sales</p>
        </div>
        <SalesFeed />
      </div>
    </MainLayout>
  );
}
