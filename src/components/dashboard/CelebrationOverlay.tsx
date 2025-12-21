import { useEffect, useState, useCallback } from "react";
import { PartyPopper, Sparkles, Star, Heart, Flame, Zap } from "lucide-react";

interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  effect: "fireworks" | "confetti" | "stars" | "hearts" | "flames" | "sparkles";
  duration: number;
  text: string;
  primaryColor?: string;
}

const EFFECT_ICONS = {
  fireworks: PartyPopper,
  confetti: Sparkles,
  stars: Star,
  hearts: Heart,
  flames: Flame,
  sparkles: Zap,
};

const EFFECT_COLORS = {
  fireworks: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#5f27cd"],
  confetti: ["#ff6b6b", "#feca57", "#1dd1a1", "#48dbfb", "#ff9ff3", "#54a0ff"],
  stars: ["#feca57", "#f8b500", "#ffdd59", "#fff200", "#ffd32a", "#ff9f1a"],
  hearts: ["#ff6b6b", "#ee5a5a", "#ff9ff3", "#f368e0", "#ff6b6b", "#c44569"],
  flames: ["#ff6b6b", "#ff9f43", "#feca57", "#ff6348", "#eb4d4b", "#f39c12"],
  sparkles: ["#48dbfb", "#0abde3", "#54a0ff", "#5f27cd", "#a55eea", "#8854d0"],
};

export const CelebrationOverlay = ({
  isOpen,
  onClose,
  effect,
  duration,
  text,
  primaryColor = "#8b5cf6",
}: CelebrationOverlayProps) => {
  const [showContent, setShowContent] = useState(false);
  const IconComponent = EFFECT_ICONS[effect];
  const colors = EFFECT_COLORS[effect];

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setShowContent(true);

      const timer = setTimeout(() => {
        onClose();
        setShowContent(false);
      }, duration * 1000);

      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  // Render different effects based on type
  const renderEffect = () => {
    switch (effect) {
      case "fireworks":
        return (
          <>
            {/* Firework bursts */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${15 + Math.random() * 70}%`,
                  top: `${10 + Math.random() * 40}%`,
                  animation: `firework-burst 1.5s ease-out ${i * 0.2}s infinite`,
                }}
              >
                {Array.from({ length: 12 }).map((_, j) => (
                  <div
                    key={j}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: colors[j % colors.length],
                      transform: `rotate(${j * 30}deg) translateY(-40px)`,
                      animation: `firework-particle 1.5s ease-out ${i * 0.2}s infinite`,
                      boxShadow: `0 0 10px ${colors[j % colors.length]}`,
                    }}
                  />
                ))}
              </div>
            ))}
          </>
        );

      case "confetti":
        return (
          <>
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  width: `${8 + Math.random() * 8}px`,
                  height: `${8 + Math.random() * 8}px`,
                  backgroundColor: colors[i % colors.length],
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                  animation: `confetti-fall ${3 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </>
        );

      case "stars":
        return (
          <>
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `star-twinkle 1s ease-in-out ${Math.random() * 2}s infinite alternate`,
                }}
              >
                <Star
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${16 + Math.random() * 24}px`,
                    height: `${16 + Math.random() * 24}px`,
                    filter: `drop-shadow(0 0 8px ${colors[i % colors.length]})`,
                  }}
                />
              </div>
            ))}
            {/* Shooting stars */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`shooting-${i}`}
                className="absolute w-1 h-1 rounded-full bg-yellow-300"
                style={{
                  left: `${Math.random() * 80}%`,
                  top: `${Math.random() * 30}%`,
                  boxShadow: "0 0 10px #feca57, 0 0 20px #feca57",
                  animation: `shooting-star 2s linear ${i * 0.8}s infinite`,
                }}
              />
            ))}
          </>
        );

      case "hearts":
        return (
          <>
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: `-10%`,
                  animation: `heart-float ${4 + Math.random() * 3}s ease-out ${Math.random() * 2}s infinite`,
                }}
              >
                <Heart
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${20 + Math.random() * 20}px`,
                    height: `${20 + Math.random() * 20}px`,
                    filter: `drop-shadow(0 0 6px ${colors[i % colors.length]})`,
                  }}
                />
              </div>
            ))}
          </>
        );

      case "flames":
        return (
          <>
            {/* Fire particles rising from bottom */}
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  bottom: `-5%`,
                  width: `${10 + Math.random() * 20}px`,
                  height: `${10 + Math.random() * 20}px`,
                  background: `radial-gradient(circle, ${colors[i % colors.length]} 0%, transparent 70%)`,
                  animation: `flame-rise ${2 + Math.random() * 2}s ease-out ${Math.random() * 1}s infinite`,
                  filter: `blur(2px)`,
                }}
              />
            ))}
            {/* Central flame glow */}
            <div 
              className="absolute left-1/2 bottom-0 -translate-x-1/2 w-96 h-96 rounded-full opacity-50"
              style={{
                background: `radial-gradient(circle, #ff6b6b 0%, #ff9f43 30%, transparent 70%)`,
                filter: "blur(40px)",
                animation: "flame-pulse 0.5s ease-in-out infinite alternate",
              }}
            />
          </>
        );

      case "sparkles":
        return (
          <>
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `sparkle-pop 0.8s ease-out ${Math.random() * 3}s infinite`,
                }}
              >
                <Zap
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${12 + Math.random() * 16}px`,
                    height: `${12 + Math.random() * 16}px`,
                    filter: `drop-shadow(0 0 8px ${colors[i % colors.length]})`,
                  }}
                />
              </div>
            ))}
            {/* Electric arcs */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`arc-${i}`}
                className="absolute w-0.5 rounded-full"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  top: `${20 + Math.random() * 30}%`,
                  height: `${50 + Math.random() * 100}px`,
                  background: `linear-gradient(to bottom, ${colors[i % colors.length]}, transparent)`,
                  transform: `rotate(${-30 + Math.random() * 60}deg)`,
                  animation: `electric-flash 0.3s ease-out ${Math.random() * 2}s infinite`,
                  boxShadow: `0 0 10px ${colors[i % colors.length]}`,
                }}
              />
            ))}
          </>
        );

      default:
        return null;
    }
  };


  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        style={{ animation: "fade-in 0.3s ease-out" }}
      />

      {/* Radial glow based on effect */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colors[0]}40 0%, transparent 60%)`,
        }}
      />

      {/* Effect-specific animations */}
      {renderEffect()}

      {/* Main content */}
      {showContent && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none"
          style={{ animation: "celebration-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards" }}
        >
          {/* Icon with glow */}
          <div 
            className="relative mb-6"
            style={{ animation: "celebration-bounce 0.6s ease-in-out infinite alternate" }}
          >
            <div 
              className="absolute inset-0 blur-3xl opacity-60 rounded-full scale-150"
              style={{ backgroundColor: colors[0] }}
            />
            <IconComponent 
              className="relative w-28 h-28 text-white drop-shadow-2xl"
              style={{ 
                filter: `drop-shadow(0 0 40px ${colors[0]})`,
              }}
            />
          </div>

          {/* Text */}
          <div 
            className="text-center max-w-2xl"
            style={{ animation: "celebration-slide-up 0.6s ease-out 0.2s both" }}
          >
            <p className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              {text || "🎉 Tillykke!"}
            </p>
          </div>

          {/* Click to dismiss */}
          <p 
            className="text-white/50 text-sm mt-8 pointer-events-auto"
            style={{ animation: "fade-in 1s ease-out 1s both" }}
          >
            Klik for at lukke
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes celebration-pop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes celebration-bounce {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-10px) scale(1.05); }
        }

        @keyframes celebration-slide-up {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* Fireworks */
        @keyframes firework-burst {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }

        @keyframes firework-particle {
          0% { transform: rotate(var(--rotation, 0deg)) translateY(0); opacity: 1; }
          100% { transform: rotate(var(--rotation, 0deg)) translateY(-80px); opacity: 0; }
        }

        /* Confetti */
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0.5; }
        }

        /* Stars */
        @keyframes star-twinkle {
          0% { transform: scale(0.5); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes shooting-star {
          0% { transform: translate(0, 0); opacity: 1; }
          100% { transform: translate(200px, 200px); opacity: 0; }
        }

        /* Hearts */
        @keyframes heart-float {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-50vh) scale(1.2) rotate(15deg); opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.8) rotate(-15deg); opacity: 0; }
        }

        /* Flames */
        @keyframes flame-rise {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-40vh) scale(0.8); opacity: 0.8; }
          100% { transform: translateY(-80vh) scale(0.3); opacity: 0; }
        }

        @keyframes flame-pulse {
          0% { transform: translateX(-50%) scale(1); }
          100% { transform: translateX(-50%) scale(1.1); }
        }

        /* Sparkles */
        @keyframes sparkle-pop {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.5) rotate(180deg); opacity: 1; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }

        @keyframes electric-flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
