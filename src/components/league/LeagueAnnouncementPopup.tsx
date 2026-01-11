import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, Flame, ArrowRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useActiveSeason, useMyEnrollment } from "@/hooks/useLeagueData";

const STORAGE_KEY = "league-popup-shown";

export function LeagueAnnouncementPopup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: season, isLoading: seasonLoading } = useActiveSeason();
  const { data: enrollment, isLoading: enrollmentLoading } = useMyEnrollment(season?.id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Don't show if:
    // - No user logged in
    // - Still loading
    // - Already shown before
    // - Already enrolled
    // - No active season
    if (!user || seasonLoading || enrollmentLoading) return;
    if (!season) return;
    if (enrollment) return; // Already enrolled, don't bother

    const hasShown = localStorage.getItem(STORAGE_KEY);
    if (!hasShown) {
      // Small delay to not appear immediately on page load
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, season, enrollment, seasonLoading, enrollmentLoading]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const handleViewMore = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    navigate("/commission-league");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
    }}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Gradient background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <DialogHeader className="relative z-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Cph Sales Ligaen er åben! 🏆
          </DialogTitle>
          <DialogDescription className="text-base">
            Konkurrér mod dine kolleger og kæmp dig op gennem divisionerne!
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 py-4 space-y-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Medal className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Premier League-format</p>
                <p className="text-xs text-muted-foreground">Rykker op, rykker ned og playoff - ligesom rigtig fodbold!</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Flame className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Vis din formkurve</p>
                <p className="text-xs text-muted-foreground">Track din performance og kæmp for at nå toppen!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-2">
          <Button 
            onClick={handleViewMore}
            className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold"
          >
            Læs mere & tilmeld
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleClose}
            className="w-full text-muted-foreground"
          >
            Måske senere
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
