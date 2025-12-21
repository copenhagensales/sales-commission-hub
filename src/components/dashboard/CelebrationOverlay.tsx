import { useEffect, useState } from "react";
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

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  delay: number;
  type: "circle" | "square" | "star" | "heart";
}

const generateParticles = (effect: string, count: number = 50): Particle[] => {
  const colors = EFFECT_COLORS[effect as keyof typeof EFFECT_COLORS] || EFFECT_COLORS.confetti;
  const types: Particle["type"][] = 
    effect === "hearts" ? ["heart"] :
    effect === "stars" ? ["star"] :
    effect === "flames" ? ["circle"] :
    ["circle", "square", "star"];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 8 + Math.random() * 16,
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 4,
    velocityY: 2 + Math.random() * 4,
    delay: Math.random() * 2,
    type: types[Math.floor(Math.random() * types.length)],
  }));
};

const ParticleShape = ({ type, color, size }: { type: Particle["type"]; color: string; size: number }) => {
  if (type === "heart") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  if (type === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }
  if (type === "square") {
    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          backgroundColor: color,
          borderRadius: 2,
        }} 
      />
    );
  }
  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: color,
        borderRadius: "50%",
      }} 
    />
  );
};

export const CelebrationOverlay = ({
  isOpen,
  onClose,
  effect,
  duration,
  text,
  primaryColor = "#8b5cf6",
}: CelebrationOverlayProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showContent, setShowContent] = useState(false);
  const IconComponent = EFFECT_ICONS[effect];

  useEffect(() => {
    if (isOpen) {
      setParticles(generateParticles(effect, 60));
      setShowContent(true);

      const timer = setTimeout(() => {
        onClose();
        setShowContent(false);
      }, duration * 1000);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
      setShowContent(false);
    }
  }, [isOpen, effect, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        style={{ animationDuration: "0.3s" }}
      />

      {/* Radial glow */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${primaryColor}40 0%, transparent 60%)`,
        }}
      />

      {/* Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute pointer-events-none"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `rotate(${particle.rotation}deg)`,
            animation: `celebration-fall ${4 + Math.random() * 2}s ease-in-out ${particle.delay}s infinite`,
          }}
        >
          <ParticleShape 
            type={particle.type} 
            color={particle.color} 
            size={particle.size} 
          />
        </div>
      ))}

      {/* Burst effect from center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              animation: `celebration-burst 1s ease-out ${i * 0.05}s forwards`,
              transform: `rotate(${i * 30}deg)`,
            }}
          >
            <div
              className="w-2 h-8 rounded-full"
              style={{
                background: `linear-gradient(to bottom, ${EFFECT_COLORS[effect][i % 6]}, transparent)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Main content */}
      {showContent && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-8"
          style={{ animation: "celebration-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards" }}
        >
          {/* Icon with glow */}
          <div 
            className="relative mb-6"
            style={{ animation: "celebration-bounce 0.6s ease-in-out infinite alternate" }}
          >
            <div 
              className="absolute inset-0 blur-2xl opacity-50 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            <IconComponent 
              className="relative w-24 h-24 text-white drop-shadow-2xl"
              style={{ 
                filter: `drop-shadow(0 0 30px ${primaryColor})`,
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
            className="text-white/50 text-sm mt-8"
            style={{ animation: "fade-in 1s ease-out 1s both" }}
          >
            Klik for at lukke
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes celebration-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes celebration-burst {
          0% {
            transform: rotate(var(--rotation)) translateY(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation)) translateY(-150px);
            opacity: 0;
          }
        }

        @keyframes celebration-pop {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes celebration-bounce {
          0% {
            transform: translateY(0) scale(1);
          }
          100% {
            transform: translateY(-10px) scale(1.05);
          }
        }

        @keyframes celebration-slide-up {
          0% {
            transform: translateY(30px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
