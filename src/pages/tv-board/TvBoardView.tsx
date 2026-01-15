import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Import dashboard components
import CphSalesDashboard from "@/pages/dashboards/CphSalesDashboard";
import FieldmarketingDashboardFull from "@/pages/dashboards/FieldmarketingDashboardFull";
import TeamDashboard from "@/pages/dashboards/TeamDashboard";
import TdcErhvervGoalsDashboard from "@/pages/dashboards/TdcErhvervGoalsDashboard";
import FieldmarketingGoalsDashboard from "@/pages/dashboards/FieldmarketingGoalsDashboard";
import EesyTmDashboard from "@/pages/EesyTmDashboard";
import TdcErhvervDashboard from "@/pages/TdcErhvervDashboard";
import RelatelDashboard from "@/pages/RelatelDashboard";
import CsTop20Dashboard from "@/pages/CsTop20Dashboard";
import { Loader2 } from "lucide-react";

// Map dashboard slugs to components
const dashboardComponents: Record<string, React.ComponentType> = {
  "cph-sales": CphSalesDashboard,
  "fieldmarketing": FieldmarketingDashboardFull,
  "team": TeamDashboard,
  "eesy-tm": EesyTmDashboard,
  "tdc-erhverv": TdcErhvervDashboard,
  "relatel": RelatelDashboard,
  "tryg": TeamDashboard,
  "ase": TeamDashboard,
  "united": TeamDashboard,
  "tdc-erhverv-goals": TdcErhvervGoalsDashboard,
  "fieldmarketing-goals": FieldmarketingGoalsDashboard,
  "cs-top-20": CsTop20Dashboard,
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

      // Check if user has valid session for this dashboard
      if (!storedCode || storedSlug !== slug) {
        navigate(`/tv?returnTo=${slug}`);
        return;
      }

      // Verify the code is still valid
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

  // Auto-refresh queries every 30 seconds (instead of full page reload)
  useEffect(() => {
    if (!isVerified) return;

    const interval = setInterval(() => {
      // Invalidate all queries to trigger fresh data fetch
      queryClient.invalidateQueries();
    }, 30000);

    return () => clearInterval(interval);
  }, [isVerified, queryClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400">Indlæser dashboard...</p>
        </div>
      </div>
    );
  }

  const DashboardComponent = slug ? dashboardComponents[slug] : null;

  if (!DashboardComponent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Dashboard ikke fundet</h1>
          <p className="text-slate-400">Dashboardet "{slug}" findes ikke.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-board-wrapper min-h-screen">
      {/* Hide cursor after inactivity for cleaner TV display */}
      <style>{`
        .tv-board-wrapper {
          cursor: none;
        }
        .tv-board-wrapper:hover {
          cursor: default;
        }
      `}</style>
      <DashboardComponent />
    </div>
  );
}
