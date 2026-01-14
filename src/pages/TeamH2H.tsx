import { MainLayout } from "@/components/layout/MainLayout";
import { TeamH2HOverview } from "@/components/h2h/TeamH2HOverview";

export default function TeamH2H() {
  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <TeamH2HOverview />
      </div>
    </MainLayout>
  );
}
