import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  delay: number;
}

interface H2HConfettiEffectProps {
  trigger: boolean;
  type: "lead_taken" | "big_sale" | "first_blood" | "comeback";
}

const COLORS = {
  lead_taken: ["#34d399", "#10b981", "#6ee7b7", "#a7f3d0"],
  big_sale: ["#fbbf24", "#f59e0b", "#d97706", "#fcd34d"],
  first_blood: ["#f472b6", "#ec4899", "#db2777", "#f9a8d4"],
  comeback: ["#60a5fa", "#3b82f6", "#2563eb", "#93c5fd"],
};

export const H2HConfettiEffect = ({ trigger, type }: H2HConfettiEffectProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      const colors = COLORS[type];
      
      // Generate particles
      const newParticles: Particle[] = [];
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: i,
          x: 50 + (Math.random() - 0.5) * 20, // Center with spread
          y: 50,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          scale: 0.5 + Math.random() * 0.5,
          delay: Math.random() * 0.3,
        });
      }
      setParticles(newParticles);

      // Clear after animation
      setTimeout(() => {
        setParticles([]);
        setIsActive(false);
      }, 2000);
    }
  }, [trigger, type, isActive]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 animate-confetti"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
            animationDelay: `${particle.delay}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(300px) rotate(720deg) scale(0);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 1.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }
      `}</style>
    </div>
  );
};

// Sparkle burst effect for smaller celebrations
export const SparkleEffect = ({ trigger }: { trigger: boolean }) => {
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  useEffect(() => {
    if (trigger) {
      const newSparkles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 40,
        y: 50 + (Math.random() - 0.5) * 40,
        size: 4 + Math.random() * 8,
      }));
      setSparkles(newSparkles);

      setTimeout(() => setSparkles([]), 1000);
    }
  }, [trigger]);

  if (sparkles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute animate-sparkle"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-amber-400">
            <path
              d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes sparkle {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-sparkle {
          animation: sparkle 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
};
