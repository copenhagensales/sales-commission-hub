import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CphSalesDashboard from "@/pages/dashboards/CphSalesDashboard";
import { Loader2 } from "lucide-react";

// Map dashboard slugs to components
const dashboardComponents: Record<string, React.ComponentType> = {
  "cph-sales": CphSalesDashboard,
  "tdc-erhverv": CphSalesDashboard,
  "tdc-privat": CphSalesDashboard,
  "telenor": CphSalesDashboard,
};

export default function TvBoardDirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dashboardSlug, setDashboardSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyCode = async () => {
      if (!code) {
        setError("Ingen adgangskode angivet");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("tv_board_access")
        .select("id, dashboard_slug, is_active, access_count")
        .eq("access_code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (queryError || !data) {
        setError("Ugyldig eller inaktiv adgangskode");
        setLoading(false);
        return;
      }

      // Update access count and last accessed
      await supabase
        .from("tv_board_access")
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (data.access_count || 0) + 1,
        })
        .eq("id", data.id);

      // Store in sessionStorage for other components that check TV mode
      sessionStorage.setItem("tv_board_code", code.toUpperCase());
      sessionStorage.setItem("tv_board_slug", data.dashboard_slug);

      setDashboardSlug(data.dashboard_slug);
      setLoading(false);
    };

    verifyCode();
  }, [code]);

  // Auto-refresh queries every 30 seconds
  useEffect(() => {
    if (!dashboardSlug) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries();
    }, 30000);

    return () => clearInterval(interval);
  }, [dashboardSlug, queryClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400">Verificerer adgang...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Adgang nægtet</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const DashboardComponent = dashboardSlug ? dashboardComponents[dashboardSlug] : null;

  if (!DashboardComponent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Dashboard ikke fundet</h1>
          <p className="text-slate-400">Dashboardet "{dashboardSlug}" findes ikke.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-board-wrapper min-h-screen">
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
