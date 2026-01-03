import { useState, useEffect } from "react";
import { Clock, Flame, AlertTriangle, Zap } from "lucide-react";

interface MatchCountdownTimerProps {
  endTime: Date;
  periodLabel: string;
  percentComplete: number;
}

export const MatchCountdownTimer = ({
  endTime,
  periodLabel,
  percentComplete,
}: MatchCountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isFinalCountdown, setIsFinalCountdown] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = endTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Tid udløbet!");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Determine urgency levels
      setIsUrgent(hours < 2);
      setIsFinalCountdown(hours < 1);

      if (hours > 0) {
        setTimeRemaining(`${hours}t ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className={`relative overflow-hidden rounded-xl transition-all duration-500 ${
      isFinalCountdown 
        ? 'bg-gradient-to-r from-rose-900/50 via-rose-800/50 to-rose-900/50 border-2 border-rose-500/50' 
        : isUrgent 
        ? 'bg-gradient-to-r from-amber-900/30 via-amber-800/30 to-amber-900/30 border border-amber-500/40' 
        : 'bg-slate-800/60 border border-slate-700/50'
    }`}>
      {/* Animated urgency background */}
      {isFinalCountdown && (
        <div className="absolute inset-0 bg-rose-500/10 animate-pulse" />
      )}

      <div className="relative p-3 flex items-center justify-between gap-4">
        {/* Period label */}
        <div className="flex items-center gap-2">
          {isFinalCountdown ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
          ) : isUrgent ? (
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
          <span className={`text-xs font-medium ${
            isFinalCountdown ? 'text-rose-400' : isUrgent ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {periodLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 mx-4">
          <div className="relative h-2 rounded-full bg-slate-700/50 overflow-hidden">
            {/* Progress fill */}
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                isFinalCountdown
                  ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                  : isUrgent
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-400'
              }`}
              style={{ width: `${percentComplete}%` }}
            />
            
            {/* Pulsing indicator at edge */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-500 ${
                isFinalCountdown
                  ? 'bg-rose-400 shadow-rose-400/50'
                  : isUrgent
                  ? 'bg-amber-400 shadow-amber-400/50'
                  : 'bg-blue-400 shadow-blue-400/50'
              }`}
              style={{ 
                left: `${percentComplete}%`, 
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 10px currentColor`,
              }}
            >
              {isFinalCountdown && (
                <div className="absolute inset-0 rounded-full bg-rose-400 animate-ping" />
              )}
            </div>
          </div>
        </div>

        {/* Time remaining */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono transition-all ${
            isFinalCountdown
              ? 'bg-rose-500/30 border border-rose-500/50 text-rose-300 animate-pulse'
              : isUrgent
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-slate-700/50 border border-slate-600/50 text-slate-300'
          }`}>
            {isFinalCountdown && <Zap className="w-3 h-3 animate-bounce" />}
            <span className="text-sm font-bold tabular-nums">{timeRemaining}</span>
          </div>
          
          {/* Percent complete */}
          <span className={`text-xs font-medium ${
            isFinalCountdown ? 'text-rose-400' : isUrgent ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {percentComplete}%
          </span>
        </div>
      </div>

      {/* Final countdown banner */}
      {isFinalCountdown && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
            <Flame className="w-3 h-3 text-rose-400" />
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              Sidste chance! Final countdown!
            </span>
            <Flame className="w-3 h-3 text-rose-400" />
          </div>
        </div>
      )}
    </div>
  );
};
