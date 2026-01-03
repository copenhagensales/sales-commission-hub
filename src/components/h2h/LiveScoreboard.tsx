import { useEffect, useState } from "react";
import { DollarSign, Flame, TrendingUp, Crown } from "lucide-react";

interface LiveScoreboardProps {
  myCommission: number;
  opponentCommission: number;
  myName: string;
  opponentName: string;
  isLeading: boolean;
  isLosing: boolean;
  isTied: boolean;
}

export const LiveScoreboard = ({
  myCommission,
  opponentCommission,
  myName,
  opponentName,
  isLeading,
  isLosing,
  isTied,
}: LiveScoreboardProps) => {
  const [displayedMy, setDisplayedMy] = useState(myCommission);
  const [displayedOpp, setDisplayedOpp] = useState(opponentCommission);
  const [animateMy, setAnimateMy] = useState(false);
  const [animateOpp, setAnimateOpp] = useState(false);

  // Animate counter when values change
  useEffect(() => {
    if (myCommission !== displayedMy) {
      setAnimateMy(true);
      const diff = myCommission - displayedMy;
      const steps = 20;
      const stepSize = diff / steps;
      let current = displayedMy;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        current += stepSize;
        setDisplayedMy(Math.round(current));
        if (step >= steps) {
          clearInterval(interval);
          setDisplayedMy(myCommission);
          setTimeout(() => setAnimateMy(false), 500);
        }
      }, 30);
      
      return () => clearInterval(interval);
    }
  }, [myCommission]);

  useEffect(() => {
    if (opponentCommission !== displayedOpp) {
      setAnimateOpp(true);
      const diff = opponentCommission - displayedOpp;
      const steps = 20;
      const stepSize = diff / steps;
      let current = displayedOpp;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        current += stepSize;
        setDisplayedOpp(Math.round(current));
        if (step >= steps) {
          clearInterval(interval);
          setDisplayedOpp(opponentCommission);
          setTimeout(() => setAnimateOpp(false), 500);
        }
      }, 30);
      
      return () => clearInterval(interval);
    }
  }, [opponentCommission]);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(num);
  };

  const commissionDiff = Math.abs(myCommission - opponentCommission);

  return (
    <div className="relative">
      {/* Glow background based on leader */}
      <div className={`absolute inset-0 rounded-2xl blur-2xl transition-all duration-1000 ${
        isLeading ? 'bg-emerald-500/20' : isLosing ? 'bg-rose-500/20' : 'bg-amber-500/10'
      }`} />
      
      {/* Main scoreboard */}
      <div className="relative bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Provision</span>
          <DollarSign className="w-4 h-4 text-amber-400" />
        </div>

        {/* Score display */}
        <div className="flex items-center justify-between gap-4">
          {/* My score */}
          <div className={`flex-1 text-center relative ${animateMy ? 'animate-score-pulse' : ''}`}>
            {isLeading && (
              <Crown 
                className="absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 animate-bounce" 
              />
            )}
            <div className={`relative inline-block ${isLeading ? 'scale-110' : ''} transition-transform duration-500`}>
              <div className={`absolute inset-0 rounded-xl blur-lg transition-all duration-500 ${
                isLeading ? 'bg-emerald-500/40' : 'bg-blue-500/20'
              }`} />
              <div className={`relative px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
                isLeading 
                  ? 'border-emerald-400/60 bg-emerald-500/10' 
                  : 'border-slate-600/50 bg-slate-800/50'
              }`}>
                <p className="text-xs text-slate-400 mb-1 truncate max-w-[80px]">
                  {myName.split(" ")[0]}
                </p>
                <p className={`text-2xl font-black tabular-nums transition-all duration-300 ${
                  isLeading ? 'text-emerald-400' : 'text-white'
                } ${animateMy ? 'scale-110' : ''}`}>
                  {formatCurrency(displayedMy)}
                </p>
                <p className="text-[10px] text-slate-500">DKK</p>
              </div>
            </div>
          </div>

          {/* VS / Difference */}
          <div className="flex flex-col items-center gap-1">
            {isTied ? (
              <div className="px-3 py-2 rounded-full bg-amber-500/20 border border-amber-500/40">
                <span className="text-sm font-bold text-amber-400">LIGE</span>
              </div>
            ) : (
              <div className={`px-3 py-2 rounded-full border transition-all duration-500 ${
                isLeading 
                  ? 'bg-emerald-500/20 border-emerald-500/40' 
                  : 'bg-rose-500/20 border-rose-500/40'
              }`}>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-3 h-3 ${isLeading ? 'text-emerald-400' : 'text-rose-400 rotate-180'}`} />
                  <span className={`text-sm font-bold ${isLeading ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(commissionDiff)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Opponent score */}
          <div className={`flex-1 text-center relative ${animateOpp ? 'animate-score-pulse' : ''}`}>
            {isLosing && (
              <Crown 
                className="absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-400 animate-bounce" 
              />
            )}
            <div className={`relative inline-block ${isLosing ? 'scale-110' : ''} transition-transform duration-500`}>
              <div className={`absolute inset-0 rounded-xl blur-lg transition-all duration-500 ${
                isLosing ? 'bg-emerald-500/40' : 'bg-rose-500/20'
              }`} />
              <div className={`relative px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
                isLosing 
                  ? 'border-emerald-400/60 bg-emerald-500/10' 
                  : 'border-slate-600/50 bg-slate-800/50'
              }`}>
                <p className="text-xs text-slate-400 mb-1 truncate max-w-[80px]">
                  {opponentName.split(" ")[0]}
                </p>
                <p className={`text-2xl font-black tabular-nums transition-all duration-300 ${
                  isLosing ? 'text-emerald-400' : 'text-white'
                } ${animateOpp ? 'scale-110' : ''}`}>
                  {formatCurrency(displayedOpp)}
                </p>
                <p className="text-[10px] text-slate-500">DKK</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hot streak indicator if big lead */}
        {commissionDiff > 1000 && (
          <div className={`mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto w-fit ${
            isLeading ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-rose-500/20 border border-rose-500/30'
          }`}>
            <Flame className={`w-4 h-4 ${isLeading ? 'text-emerald-400' : 'text-rose-400'} animate-pulse`} />
            <span className={`text-xs font-bold ${isLeading ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isLeading ? 'Du dominerer!' : 'Indhent dem!'}
            </span>
            <Flame className={`w-4 h-4 ${isLeading ? 'text-emerald-400' : 'text-rose-400'} animate-pulse`} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes score-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-score-pulse {
          animation: score-pulse 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};
