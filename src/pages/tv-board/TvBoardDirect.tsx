import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { TvBoardProvider } from "@/contexts/TvBoardContext";
import { CelebrationOverlay } from "@/components/dashboard/CelebrationOverlay";
import { useCelebrationData, replaceCelebrationVariables } from "@/hooks/useCelebrationData";
import { Button } from "@/components/ui/button";

// Import dashboard components
import CphSalesDashboard from "@/pages/dashboards/CphSalesDashboard";
import FieldmarketingDashboardFull from "@/pages/dashboards/FieldmarketingDashboardFull";
import TeamDashboard from "@/pages/dashboards/TeamDashboard";
import TdcErhvervGoalsDashboard from "@/pages/dashboards/TdcErhvervGoalsDashboard";
import FieldmarketingGoalsDashboard from "@/pages/dashboards/FieldmarketingGoalsDashboard";

// Map dashboard slugs to components
const dashboardComponents: Record<string, React.ComponentType> = {
  "cph-sales": CphSalesDashboard,
  "fieldmarketing": FieldmarketingDashboardFull,
  "team": TeamDashboard,
  "eesy-tm": TeamDashboard,
  "tdc-erhverv": TeamDashboard,
  "relatel": TeamDashboard,
  "tryg": TeamDashboard,
  "ase": TeamDashboard,
  "united": TeamDashboard,
  "tdc-erhverv-goals": TdcErhvervGoalsDashboard,
  "fieldmarketing-goals": FieldmarketingGoalsDashboard,
};

interface CelebrationSettings {
  enabled: boolean;
  effect: "fireworks" | "confetti" | "stars" | "hearts" | "flames" | "sparkles";
  duration: number;
  triggerCondition: string;
  text: string;
  metric: string;
  sourceDashboard: string | null;
}

interface TvBoardData {
  id: string;
  dashboard_slug: string;
  dashboard_slugs: string[] | null;
  is_active: boolean;
  access_count: number | null;
  auto_rotate: boolean | null;
  rotate_interval_seconds: number | null;
  rotate_intervals_per_dashboard: Record<string, number> | null;
  celebration_enabled: boolean | null;
  celebration_effect: string | null;
  celebration_duration: number | null;
  celebration_trigger_condition: string | null;
  celebration_text: string | null;
  celebration_metric: string | null;
  celebration_source_dashboard: string | null;
  start_fullscreen: boolean | null;
}

export default function TvBoardDirect() {
  const { code } = useParams<{ code: string }>();
  const queryClient = useQueryClient();
  const [dashboardSlugs, setDashboardSlugs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auto-rotation state
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateIntervals, setRotateIntervals] = useState<Record<string, number>>({});
  const [defaultRotateInterval, setDefaultRotateInterval] = useState(60);
  
  // Celebration state
  const [celebrationSettings, setCelebrationSettings] = useState<CelebrationSettings | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevMetricValueRef = useRef<number | null>(null);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasAutoFullscreened = useRef(false);

  // Celebration data - fetch from source dashboard
  const celebrationSourceSlug = celebrationSettings?.sourceDashboard || dashboardSlugs[0] || null;
  const { data: celebrationData, refetch: refetchCelebration } = useCelebrationData({
    dashboardSlug: celebrationSourceSlug,
    metric: celebrationSettings?.metric || "sales_today",
    enabled: !!celebrationSettings?.enabled && dashboardSlugs.length > 0,
  });

  useEffect(() => {
    const verifyCode = async () => {
      if (!code) {
        setError("Ingen adgangskode angivet");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("tv_board_access")
        .select(`
          id, 
          dashboard_slug, 
          dashboard_slugs, 
          is_active, 
          access_count,
          auto_rotate,
          rotate_interval_seconds,
          rotate_intervals_per_dashboard,
          celebration_enabled,
          celebration_effect,
          celebration_duration,
          celebration_trigger_condition,
          celebration_text,
          celebration_metric,
          celebration_source_dashboard,
          start_fullscreen
        `)
        .eq("access_code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (queryError || !data) {
        setError("Ugyldig eller inaktiv adgangskode");
        setLoading(false);
        return;
      }

      const tvData = data as TvBoardData;

      // Update access count and last accessed
      await supabase
        .from("tv_board_access")
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (tvData.access_count || 0) + 1,
        })
        .eq("id", tvData.id);

      // Use dashboard_slugs array if available, otherwise fall back to single slug
      const slugs = tvData.dashboard_slugs && tvData.dashboard_slugs.length > 0
        ? tvData.dashboard_slugs
        : tvData.dashboard_slug
          ? [tvData.dashboard_slug]
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
      
      // Set auto-rotation settings
      if (tvData.auto_rotate && slugs.length > 1) {
        setAutoRotate(true);
        if (tvData.rotate_intervals_per_dashboard) {
          setRotateIntervals(tvData.rotate_intervals_per_dashboard);
        }
        if (tvData.rotate_interval_seconds) {
          setDefaultRotateInterval(tvData.rotate_interval_seconds);
        }
      }
      
      // Set celebration settings
      if (tvData.celebration_enabled) {
        setCelebrationSettings({
          enabled: true,
          effect: (tvData.celebration_effect as CelebrationSettings['effect']) || 'confetti',
          duration: tvData.celebration_duration || 3,
          triggerCondition: tvData.celebration_trigger_condition || 'any_update',
          text: tvData.celebration_text || '🎉 Tillykke!',
          metric: tvData.celebration_metric || 'sales_today',
          sourceDashboard: tvData.celebration_source_dashboard || null,
        });
      }
      
      setLoading(false);
    };

    verifyCode();
  }, [code]);

  // Auto-rotation effect
  useEffect(() => {
    if (!autoRotate || dashboardSlugs.length <= 1) return;

    const currentSlug = dashboardSlugs[currentIndex];
    const interval = rotateIntervals[currentSlug] || defaultRotateInterval;
    
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % dashboardSlugs.length);
    }, interval * 1000);

    return () => clearTimeout(timer);
  }, [autoRotate, currentIndex, dashboardSlugs, rotateIntervals, defaultRotateInterval]);

  // Check for celebration triggers when data changes
  useEffect(() => {
    if (!celebrationSettings?.enabled || !celebrationData) return;

    const currentValue = celebrationData.metricValue;
    const prevValue = prevMetricValueRef.current;

    // Determine if we should trigger celebration
    let shouldCelebrate = false;

    if (prevValue !== null) {
      switch (celebrationSettings.triggerCondition) {
        case "any_update":
          // Trigger if value changed
          shouldCelebrate = currentValue !== prevValue;
          break;
        case "increase":
          // Trigger only if value increased
          shouldCelebrate = currentValue > prevValue;
          break;
        case "reaches_goal":
          // Trigger if we crossed 100% goal
          if (celebrationSettings.metric === "goal_progress") {
            shouldCelebrate = prevValue < 100 && currentValue >= 100;
          } else {
            // For other metrics, treat as increase
            shouldCelebrate = currentValue > prevValue;
          }
          break;
      }
    }

    prevMetricValueRef.current = currentValue;

    if (shouldCelebrate) {
      setShowCelebration(true);
    }
  }, [celebrationData, celebrationSettings]);

  // Auto-refresh queries every 30 seconds
  useEffect(() => {
    if (dashboardSlugs.length === 0) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries();
      refetchCelebration();
    }, 30000);

    return () => clearInterval(interval);
  }, [dashboardSlugs, queryClient, refetchCelebration]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + dashboardSlugs.length) % dashboardSlugs.length);
  }, [dashboardSlugs.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % dashboardSlugs.length);
  }, [dashboardSlugs.length]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'c' && celebrationSettings?.enabled) {
        setShowCelebration(true); // Manual trigger with 'c' key
      }
      if (e.key === 'f') {
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, celebrationSettings, toggleFullscreen]);

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
    <div className="tv-board-wrapper min-h-screen h-screen max-h-screen overflow-hidden relative">
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100vh !important;
          max-height: 100vh !important;
        }
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
        .tv-board-wrapper > [data-tv-dashboard] {
          height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
        }
      `}</style>
      
      <div data-tv-dashboard className="h-screen max-h-screen overflow-hidden">
        <TvBoardProvider slug={currentSlug}>
          <DashboardComponent />
        </TvBoardProvider>
      </div>
      
      {/* Celebration Overlay */}
      {celebrationSettings?.enabled && (
        <CelebrationOverlay
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          effect={celebrationSettings.effect}
          duration={celebrationSettings.duration}
          text={replaceCelebrationVariables(celebrationSettings.text, celebrationData)}
        />
      )}
      
      {/* Fullscreen button - always visible on hover */}
      <Button
        onClick={toggleFullscreen}
        className="tv-nav-button fixed top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white"
        size="icon"
        variant="ghost"
      >
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </Button>
      
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
          
          {/* Current dashboard name with auto-rotate indicator */}
          <div className="tv-nav-button fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 px-4 py-2 rounded-full text-white text-sm flex items-center gap-2">
            <span>{currentDashboard?.name || currentSlug} ({currentIndex + 1}/{dashboardSlugs.length})</span>
            {autoRotate && (
              <span className="text-xs text-green-400">● Auto</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
