import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

const TestDashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Test Dashboard"
        subtitle="Test af data hentning"
      />
      
      <main className="p-6">
        {/* Dashboard indhold tilføjes her */}
      </main>
    </div>
  );
};

export default TestDashboard;
