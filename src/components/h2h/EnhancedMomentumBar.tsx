import { Zap, Activity, TrendingUp, TrendingDown } from "lucide-react";

interface EnhancedMomentumBarProps {
  momentum: number; // 0-100, 50 = neutral
  myName: string;
  opponentName: string;
  myRecentActivity: number;
  opponentRecentActivity: number;
}

export const EnhancedMomentumBar = ({
  momentum,
  myName,
  opponentName,
  myRecentActivity,
  opponentRecentActivity,
}: EnhancedMomentumBarProps) => {
  const isMyMomentum = momentum > 55;
  const isOpponentMomentum = momentum < 45;
  const isNeutral = !isMyMomentum && !isOpponentMomentum;

  const totalActivity = myRecentActivity + opponentRecentActivity;
  const activityIntensity = Math.min(totalActivity / 5, 1); // Normalize to 0-1

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1.5">
          {isMyMomentum && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
          <span className={`font-medium ${isMyMomentum ? 'text-emerald-400' : 'text-slate-400'}`}>
            {myName.split(" ")[0]}
          </span>
          {myRecentActivity > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              +{myRecentActivity}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
          <Activity className={`w-3 h-3 ${activityIntensity > 0.5 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Momentum</span>
        </div>

        <div className="flex items-center gap-1.5">
          {opponentRecentActivity > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
              +{opponentRecentActivity}
            </span>
          )}
          <span className={`font-medium ${isOpponentMomentum ? 'text-emerald-400' : 'text-slate-400'}`}>
            {opponentName.split(" ")[0]}
          </span>
          {isOpponentMomentum && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
      </div>

      {/* Main momentum bar */}
      <div className="relative h-4 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50">
        {/* Animated particles moving toward leader */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 rounded-full ${
                isMyMomentum ? 'bg-emerald-400' : isOpponentMomentum ? 'bg-rose-400' : 'bg-amber-400'
              }`}
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: isMyMomentum ? `${80 - i * 15}%` : isOpponentMomentum ? `${20 + i * 15}%` : `${40 + i * 5}%`,
                animation: `particle-flow-${isMyMomentum ? 'left' : 'right'} ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                opacity: activityIntensity,
              }}
            />
          ))}
        </div>

        {/* Center divider */}
        <div className="absolute left-1/2 top-0 w-1 h-full bg-slate-600/80 -translate-x-1/2 z-10 rounded-full" />

        {/* Left side gradient (my side) */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out rounded-l-full"
          style={{
            width: `${Math.max(momentum, 0)}%`,
            background: isMyMomentum
              ? 'linear-gradient(to right, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.5))'
              : 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.3))',
          }}
        />

        {/* Right side gradient (opponent side) */}
        <div
          className="absolute right-0 top-0 h-full transition-all duration-700 ease-out rounded-r-full"
          style={{
            width: `${Math.max(100 - momentum, 0)}%`,
            background: isOpponentMomentum
              ? 'linear-gradient(to left, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.5))'
              : 'linear-gradient(to left, rgba(244, 63, 94, 0.1), rgba(244, 63, 94, 0.3))',
          }}
        />

        {/* Energy ball indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out z-20"
          style={{ left: `${momentum}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className={`relative w-5 h-5 rounded-full transition-all duration-500 ${
              isMyMomentum
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                : isOpponentMomentum
                ? 'bg-gradient-to-br from-rose-400 to-rose-600'
                : 'bg-gradient-to-br from-amber-400 to-amber-600'
            }`}
            style={{
              boxShadow: `0 0 ${10 + activityIntensity * 10}px ${
                isMyMomentum
                  ? 'rgba(52, 211, 153, 0.8)'
                  : isOpponentMomentum
                  ? 'rgba(244, 63, 94, 0.8)'
                  : 'rgba(251, 191, 36, 0.8)'
              }`,
            }}
          >
            <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white" />
            
            {/* Pulsing ring when high activity */}
            {activityIntensity > 0.3 && (
              <div
                className={`absolute inset-0 rounded-full border-2 ${
                  isMyMomentum ? 'border-emerald-400' : isOpponentMomentum ? 'border-rose-400' : 'border-amber-400'
                } animate-ping`}
                style={{ animationDuration: '1.5s' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Momentum status text */}
      <div className="flex justify-center mt-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isMyMomentum 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
            : isOpponentMomentum 
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
            : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
        }`}>
          {isMyMomentum && 'Du har momentum! 🔥'}
          {isOpponentMomentum && 'Modstander har momentum'}
          {isNeutral && 'Jævn kamp'}
        </span>
      </div>

      <style>{`
        @keyframes particle-flow-left {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(-100px); opacity: 0; }
        }
        @keyframes particle-flow-right {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(100px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
