import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Import dashboard components
import CphSalesDashboard from "@/pages/dashboards/CphSalesDashboard";
import FieldmarketingDashboardFull from "@/pages/dashboards/FieldmarketingDashboardFull";
import EesyTmDashboard from "@/pages/EesyTmDashboard";
import TdcErhvervDashboard from "@/pages/TdcErhvervDashboard";
import RelatelDashboard from "@/pages/RelatelDashboard";
import CsTop20Dashboard from "@/pages/CsTop20Dashboard";
import UnitedDashboard from "@/pages/UnitedDashboard";
import SalesOverviewAll from "@/pages/dashboards/SalesOverviewAll";
import TvLeagueDashboard from "@/pages/tv-board/TvLeagueDashboard";
import PowerdagBoard from "@/pages/dashboards/PowerdagBoard";

const dashboardComponents: Record<string, React.ComponentType> = {
  "cph-sales": CphSalesDashboard,
  "fieldmarketing": FieldmarketingDashboardFull,
  "eesy-tm": EesyTmDashboard,
  "tdc-erhverv": TdcErhvervDashboard,
  "relatel": RelatelDashboard,
  "united": UnitedDashboard,
  "cs-top-20": CsTop20Dashboard,
  "sales-overview-all": SalesOverviewAll,
  "commission-league": TvLeagueDashboard,
  "powerdag": PowerdagBoard,
};

export default function TvBoardView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAccess = async () => {
      const storedCode = sessionStorage.getItem("tv_board_code");
      const storedSlug = sessionStorage.getItem("tv_board_slug");

      if (!storedCode || storedSlug !== slug) {
        navigate(`/tv?returnTo=${slug}`);
        return;
      }

      const { data, error } = await supabase
        .from("tv_board_access")
        .select("id, dashboard_slug, is_active")
        .eq("access_code", storedCode)
        .eq("is_active", true)
        .single();

      if (error || !data || data.dashboard_slug !== slug) {
        sessionStorage.removeItem("tv_board_code");
        sessionStorage.removeItem("tv_board_slug");
        navigate(`/tv?returnTo=${slug}`);
        return;
      }

      setIsVerified(true);
      setLoading(false);
    };

    verifyAccess();
  }, [slug, navigate]);

  // Auto-refresh queries every 30 seconds
  useEffect(() => {
    if (!isVerified) return;
    const interval = setInterval(() => queryClient.invalidateQueries(), 30000);
    return () => clearInterval(interval);
  }, [isVerified, queryClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
      </div>
    );
  }

  const DashboardComponent = slug ? dashboardComponents[slug] : null;

  if (!DashboardComponent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Dashboard ikke fundet</h1>
          <p className="text-slate-400">"{slug}" findes ikke.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-board-wrapper min-h-screen">
      <style>{`.tv-board-wrapper { cursor: none; } .tv-board-wrapper:hover { cursor: default; }`}</style>
      <DashboardComponent />
    </div>
  );
}
