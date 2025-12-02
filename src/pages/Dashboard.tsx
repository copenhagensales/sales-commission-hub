import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { TopAgentsTable } from "@/components/dashboard/TopAgentsTable";
import { Phone, ShoppingCart, TrendingUp, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Mock data - will be replaced with real data from Supabase
const mockTopAgents = [
  { id: "1", name: "Anders Jensen", sales: 45, commission: 22500 },
  { id: "2", name: "Maria Nielsen", sales: 38, commission: 19000 },
  { id: "3", name: "Peter Hansen", sales: 32, commission: 16000 },
  { id: "4", name: "Sofia Andersen", sales: 28, commission: 14000 },
  { id: "5", name: "Lars Pedersen", sales: 25, commission: 12500 },
];

export default function Dashboard() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    // TODO: Implement Adversus sync
    setTimeout(() => setIsSyncing(false), 2000);
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Oversigt over salg og provision
            </p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Synkroniser Adversus
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Opkald i dag"
            value={1247}
            icon={Phone}
            trend={{ value: 12, label: "vs. i går" }}
          />
          <KPICard
            title="Salg i dag"
            value={168}
            icon={ShoppingCart}
            variant="success"
            trend={{ value: 8, label: "vs. i går" }}
          />
          <KPICard
            title="Conversion rate"
            value="13.5%"
            icon={TrendingUp}
            trend={{ value: 2.3, label: "vs. forrige uge" }}
          />
          <KPICard
            title="Total provision"
            value="84.000 kr"
            icon={Wallet}
            variant="success"
            subtitle="Denne måned"
          />
        </div>

        {/* Second row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopAgentsTable agents={mockTopAgents} />
          
          {/* Commission breakdown */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Provisionsoversigt</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-success/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Optjent provision</p>
                  <p className="text-2xl font-bold text-success">92.500 kr</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
              
              <div className="flex items-center justify-between rounded-lg bg-warning/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Afventer (i clawback-vindue)</p>
                  <p className="text-2xl font-bold text-warning">12.000 kr</p>
                </div>
                <div className="text-xs text-muted-foreground">15 salg</div>
              </div>
              
              <div className="flex items-center justify-between rounded-lg bg-danger/10 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Modregnet (clawback)</p>
                  <p className="text-2xl font-bold text-danger">-8.500 kr</p>
                </div>
                <div className="text-xs text-muted-foreground">7 annulleringer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
