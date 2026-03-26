import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PowerdagSettings } from "@/components/powerdag/PowerdagSettings";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PowerdagAdmin() {
  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboards/powerdag">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">Powerdag Admin</h1>
        </div>
        <PowerdagSettings />
      </div>
    </DashboardShell>
  );
}
