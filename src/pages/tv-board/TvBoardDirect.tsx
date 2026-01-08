import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { DASHBOARD_LIST } from "@/config/dashboards";

// Lazy load dashboard components
import CphSalesDashboard from "@/pages/dashboards/CphSalesDashboard";

// Map dashboard slugs to components - add all dashboards here
const dashboardComponents: Record<string, React.ComponentType> = {
  "cph-sales": CphSalesDashboard,
  // Add more mappings as dashboards are created
};

export default function TvBoardDirect() {
  const { code } = useParams<{ code: string }>();
  const queryClient = useQueryClient();
  const [dashboardSlugs, setDashboardSlugs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
        .select("id, dashboard_slug, dashboard_slugs, is_active, access_count")
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

      // Use dashboard_slugs array if available, otherwise fall back to single slug
      const slugs = data.dashboard_slugs && data.dashboard_slugs.length > 0
        ? data.dashboard_slugs
        : data.dashboard_slug
          ? [data.dashboard_slug]
          : [];

      if (slugs.length === 0) {
        setError("Ingen dashboards konfigureret for dette link");
        setLoading(false);
        return;
      }

      // Store in sessionStorage
      sessionStorage.setItem("tv_board_code", code.toUpperCase());
      sessionStorage.setItem("tv_board_slugs", JSON.stringify(slugs));

      setDashboardSlugs(slugs);
      setLoading(false);
    };

    verifyCode();
  }, [code]);

  // Auto-refresh queries every 30 seconds
  useEffect(() => {
    if (dashboardSlugs.length === 0) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries();
    }, 30000);

    return () => clearInterval(interval);
  }, [dashboardSlugs, queryClient]);

  // Auto-rotate dashboards every 60 seconds if multiple
  useEffect(() => {
    if (dashboardSlugs.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % dashboardSlugs.length);
    }, 60000);

    return () => clearInterval(interval);
  }, [dashboardSlugs.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + dashboardSlugs.length) % dashboardSlugs.length);
  }, [dashboardSlugs.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % dashboardSlugs.length);
  }, [dashboardSlugs.length]);

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

  const currentSlug = dashboardSlugs[currentIndex];
  const DashboardComponent = currentSlug ? dashboardComponents[currentSlug] : null;
  const currentDashboard = DASHBOARD_LIST.find(d => d.slug === currentSlug);

  if (!DashboardComponent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Dashboard ikke fundet</h1>
          <p className="text-slate-400">Dashboardet "{currentSlug}" findes ikke.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-board-wrapper min-h-screen relative">
      <style>{`
        .tv-board-wrapper {
          cursor: none;
        }
        .tv-board-wrapper:hover {
          cursor: default;
        }
        .tv-nav-button {
          opacity: 0;
          transition: opacity 0.3s;
        }
        .tv-board-wrapper:hover .tv-nav-button {
          opacity: 1;
        }
      `}</style>
      
      <DashboardComponent />
      
      {/* Navigation controls for multiple dashboards */}
      {dashboardSlugs.length > 1 && (
        <>
          {/* Left arrow */}
          <button
            onClick={goToPrevious}
            className="tv-nav-button fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          
          {/* Right arrow */}
          <button
            onClick={goToNext}
            className="tv-nav-button fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          
          {/* Indicator dots */}
          <div className="tv-nav-button fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/50 px-4 py-2 rounded-full">
            {dashboardSlugs.map((slug, index) => (
              <button
                key={slug}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentIndex ? "bg-white" : "bg-white/40 hover:bg-white/60"
                }`}
                title={DASHBOARD_LIST.find(d => d.slug === slug)?.name || slug}
              />
            ))}
          </div>
          
          {/* Current dashboard name */}
          <div className="tv-nav-button fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 px-4 py-2 rounded-full text-white text-sm">
            {currentDashboard?.name || currentSlug} ({currentIndex + 1}/{dashboardSlugs.length})
          </div>
        </>
      )}
    </div>
  );
}
