import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  fireworks: ["#ff3366", "#ff6b35", "#ffd23f", "#3bceac", "#0ead69", "#ee4266", "#540d6e", "#00b4d8"],
  confetti: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff70a6", "#70d6ff", "#ffd670"],
  stars: ["#ffd700", "#ffec8b", "#fff8dc", "#fffacd", "#f0e68c", "#ffc125", "#eec900", "#fff68f"],
  hearts: ["#ff1744", "#ff4569", "#ff6b8a", "#ff8fab", "#f06292", "#ec407a", "#e91e63", "#ff80ab"],
  flames: ["#ff4500", "#ff6347", "#ff7f50", "#ffa500", "#ffb347", "#ff8c00", "#ff5722", "#e65100"],
  sparkles: ["#00d4ff", "#00e5ff", "#18ffff", "#64ffda", "#1de9b6", "#00bcd4", "#26c6da", "#4dd0e1"],
};

// Pre-generate random values for particles
const generateParticles = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 8 + Math.random() * 16,
    rotation: Math.random() * 360,
  }));

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

  // Memoize particles to avoid regenerating on every render
  const particles = useMemo(() => ({
    main: generateParticles(100),
    secondary: generateParticles(60),
    accent: generateParticles(30),
  }), []);

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

  const renderEffect = () => {
    switch (effect) {
      case "fireworks":
        return (
          <>
            {/* Multiple firework burst points */}
            {[
              { x: 20, y: 25, delay: 0 },
              { x: 50, y: 15, delay: 0.3 },
              { x: 80, y: 20, delay: 0.6 },
              { x: 35, y: 35, delay: 0.9 },
              { x: 65, y: 30, delay: 1.2 },
              { x: 25, y: 45, delay: 1.5 },
              { x: 75, y: 40, delay: 1.8 },
            ].map((burst, burstIdx) => (
              <div
                key={burstIdx}
                className="absolute"
                style={{
                  left: `${burst.x}%`,
                  top: `${burst.y}%`,
                  animation: `firework-center-flash 0.8s ease-out ${burst.delay}s infinite`,
                }}
              >
                {/* Central flash */}
                <div
                  className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                  style={{
                    boxShadow: `0 0 30px 15px ${colors[burstIdx % colors.length]}, 0 0 60px 30px ${colors[(burstIdx + 1) % colors.length]}`,
                    animation: `firework-flash 0.8s ease-out ${burst.delay}s infinite`,
                  }}
                />
                {/* Particle trails */}
                {Array.from({ length: 24 }).map((_, j) => {
                  const angle = (j * 15) * (Math.PI / 180);
                  const distance = 80 + Math.random() * 60;
                  return (
                    <div
                      key={j}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: colors[j % colors.length],
                        boxShadow: `0 0 8px 2px ${colors[j % colors.length]}, 0 0 20px 4px ${colors[j % colors.length]}50`,
                        transform: `rotate(${j * 15}deg)`,
                        animation: `firework-particle-${j % 3} 1.2s ease-out ${burst.delay}s infinite`,
                        '--tx': `${Math.cos(angle) * distance}px`,
                        '--ty': `${Math.sin(angle) * distance}px`,
                      } as React.CSSProperties}
                    />
                  );
                })}
                {/* Sparkle trails */}
                {Array.from({ length: 16 }).map((_, j) => (
                  <div
                    key={`trail-${j}`}
                    className="absolute w-1 h-8 origin-bottom"
                    style={{
                      background: `linear-gradient(to top, ${colors[j % colors.length]}, transparent)`,
                      transform: `rotate(${j * 22.5}deg)`,
                      animation: `firework-trail 1s ease-out ${burst.delay}s infinite`,
                    }}
                  />
                ))}
              </div>
            ))}
            {/* Falling sparkles after burst */}
            {particles.secondary.map((p, i) => (
              <div
                key={`spark-${i}`}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y * 0.6}%`,
                  backgroundColor: colors[i % colors.length],
                  boxShadow: `0 0 4px ${colors[i % colors.length]}`,
                  animation: `sparkle-fall 2s ease-in ${p.delay}s infinite`,
                }}
              />
            ))}
          </>
        );

      case "confetti":
        return (
          <>
            {/* Confetti pieces with varied shapes */}
            {particles.main.map((p, i) => {
              const shapes = ['square', 'circle', 'rectangle', 'triangle'];
              const shape = shapes[i % shapes.length];
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${p.x}%`,
                    top: `-5%`,
                    width: shape === 'rectangle' ? `${p.size * 0.4}px` : `${p.size}px`,
                    height: shape === 'rectangle' ? `${p.size * 1.5}px` : `${p.size}px`,
                    backgroundColor: colors[i % colors.length],
                    borderRadius: shape === 'circle' ? '50%' : shape === 'triangle' ? '0' : '2px',
                    clipPath: shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                    animation: `confetti-fall-3d ${p.duration}s ease-out ${p.delay * 0.5}s infinite`,
                    transform: `rotate(${p.rotation}deg)`,
                    boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
                  }}
                />
              );
            })}
            {/* Ribbon streamers */}
            {particles.accent.map((p, i) => (
              <div
                key={`ribbon-${i}`}
                className="absolute"
                style={{
                  left: `${p.x}%`,
                  top: `-10%`,
                  width: '4px',
                  height: `${40 + p.size * 2}px`,
                  background: `linear-gradient(to bottom, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]}, ${colors[(i + 2) % colors.length]})`,
                  borderRadius: '2px',
                  animation: `ribbon-fall ${p.duration + 1}s ease-in-out ${p.delay}s infinite`,
                  transformOrigin: 'top center',
                }}
              />
            ))}
          </>
        );

      case "stars":
        return (
          <>
            {/* Background star field */}
            {particles.main.map((p, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                }}
              >
                <Star
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    filter: `drop-shadow(0 0 ${p.size / 2}px ${colors[i % colors.length]})`,
                    animation: `star-pulse ${1 + p.delay * 0.5}s ease-in-out ${p.delay}s infinite alternate`,
                  }}
                />
              </div>
            ))}
            {/* Spinning mega stars */}
            {[15, 40, 65, 85].map((x, i) => (
              <div
                key={`mega-${i}`}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${20 + i * 15}%`,
                  animation: `star-spin 3s linear ${i * 0.5}s infinite`,
                }}
              >
                <Star
                  className="fill-current"
                  style={{
                    color: '#ffd700',
                    width: '48px',
                    height: '48px',
                    filter: 'drop-shadow(0 0 20px #ffd700) drop-shadow(0 0 40px #ffa500)',
                  }}
                />
              </div>
            ))}
            {/* Shooting stars with trails */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`shooting-${i}`}
                className="absolute"
                style={{
                  left: `${Math.random() * 60}%`,
                  top: `${Math.random() * 30}%`,
                  animation: `shooting-star-enhanced 2.5s linear ${i * 0.4}s infinite`,
                }}
              >
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-yellow-200" 
                    style={{ boxShadow: '0 0 10px #fff, 0 0 20px #ffd700, 0 0 30px #ffa500' }} />
                  <div 
                    className="absolute top-1/2 right-0 w-24 h-0.5 -translate-y-1/2"
                    style={{ 
                      background: 'linear-gradient(to left, transparent, #ffd700, #fff)',
                      filter: 'blur(1px)',
                    }} 
                  />
                </div>
              </div>
            ))}
          </>
        );

      case "hearts":
        return (
          <>
            {/* Floating hearts from bottom */}
            {particles.main.map((p, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${p.x}%`,
                  bottom: `-10%`,
                  animation: `heart-float-3d ${p.duration + 2}s ease-out ${p.delay * 0.3}s infinite`,
                }}
              >
                <Heart
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${p.size + 10}px`,
                    height: `${p.size + 10}px`,
                    filter: `drop-shadow(0 0 ${p.size / 3}px ${colors[i % colors.length]})`,
                  }}
                />
              </div>
            ))}
            {/* Pulsing center hearts */}
            {[
              { x: 50, y: 40, size: 80, delay: 0 },
              { x: 30, y: 30, size: 50, delay: 0.3 },
              { x: 70, y: 35, size: 50, delay: 0.6 },
            ].map((heart, i) => (
              <div
                key={`center-${i}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${heart.x}%`,
                  top: `${heart.y}%`,
                  animation: `heart-beat ${0.8 + heart.delay}s ease-in-out ${heart.delay}s infinite`,
                }}
              >
                <Heart
                  className="fill-current"
                  style={{
                    color: '#ff1744',
                    width: `${heart.size}px`,
                    height: `${heart.size}px`,
                    filter: 'drop-shadow(0 0 30px #ff1744) drop-shadow(0 0 60px #ff6b8a)',
                  }}
                />
              </div>
            ))}
            {/* Heart burst particles */}
            {particles.secondary.map((p, i) => (
              <div
                key={`burst-${i}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  animation: `heart-burst 2s ease-out ${p.delay * 0.2}s infinite`,
                  '--angle': `${(i / particles.secondary.length) * 360}deg`,
                  '--distance': `${100 + p.size * 5}px`,
                } as React.CSSProperties}
              >
                <Heart
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: '16px',
                    height: '16px',
                  }}
                />
              </div>
            ))}
          </>
        );

      case "flames":
        return (
          <>
            {/* Base fire glow */}
            <div 
              className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[600px] h-[400px] opacity-60"
              style={{
                background: 'radial-gradient(ellipse at bottom, #ff4500 0%, #ff6347 20%, #ff8c00 40%, transparent 70%)',
                filter: 'blur(60px)',
                animation: 'flame-glow 0.3s ease-in-out infinite alternate',
              }}
            />
            {/* Rising fire particles */}
            {particles.main.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${25 + p.x * 0.5}%`,
                  bottom: `-5%`,
                  width: `${p.size}px`,
                  height: `${p.size * 1.5}px`,
                  background: `radial-gradient(ellipse at center, ${colors[i % colors.length]} 0%, ${colors[(i + 1) % colors.length]}80 50%, transparent 100%)`,
                  animation: `flame-rise-enhanced ${p.duration}s ease-out ${p.delay * 0.3}s infinite`,
                  filter: 'blur(2px)',
                }}
              />
            ))}
            {/* Ember sparks */}
            {particles.secondary.map((p, i) => (
              <div
                key={`ember-${i}`}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  left: `${30 + p.x * 0.4}%`,
                  bottom: `${10 + p.y * 0.3}%`,
                  backgroundColor: '#ffcc00',
                  boxShadow: '0 0 6px 2px #ff6600, 0 0 12px 4px #ff990050',
                  animation: `ember-float ${p.duration + 1}s ease-out ${p.delay}s infinite`,
                }}
              />
            ))}
            {/* Central flame tongues */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`tongue-${i}`}
                className="absolute bottom-0"
                style={{
                  left: `${35 + i * 7}%`,
                  width: '30px',
                  height: '150px',
                  background: `linear-gradient(to top, #ff4500, #ff6600, #ffcc00, transparent)`,
                  borderRadius: '50% 50% 20% 20%',
                  filter: 'blur(8px)',
                  animation: `flame-tongue ${0.3 + i * 0.1}s ease-in-out ${i * 0.05}s infinite alternate`,
                  transformOrigin: 'bottom center',
                }}
              />
            ))}
          </>
        );

      case "sparkles":
        return (
          <>
            {/* Electric background pulses */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 50% 50%, transparent 30%, #00d4ff10 50%, transparent 70%)',
                animation: 'electric-pulse 0.5s ease-in-out infinite',
              }}
            />
            {/* Zap icons scattered */}
            {particles.main.map((p, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  animation: `zap-appear ${0.6 + p.delay * 0.3}s ease-out ${p.delay * 0.2}s infinite`,
                }}
              >
                <Zap
                  className="fill-current"
                  style={{
                    color: colors[i % colors.length],
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    filter: `drop-shadow(0 0 ${p.size / 2}px ${colors[i % colors.length]})`,
                  }}
                />
              </div>
            ))}
            {/* Electric arcs */}
            {Array.from({ length: 12 }).map((_, i) => {
              const startX = 30 + Math.random() * 40;
              const startY = 20 + Math.random() * 40;
              return (
                <svg
                  key={`arc-${i}`}
                  className="absolute overflow-visible"
                  style={{
                    left: `${startX}%`,
                    top: `${startY}%`,
                    animation: `electric-arc 0.5s ease-out ${i * 0.2}s infinite`,
                  }}
                  width="100"
                  height="100"
                  viewBox="0 0 100 100"
                >
                  <path
                    d={`M 0 50 L 20 ${30 + Math.random() * 40} L 40 ${20 + Math.random() * 60} L 60 ${40 + Math.random() * 20} L 80 ${30 + Math.random() * 40} L 100 50`}
                    fill="none"
                    stroke={colors[i % colors.length]}
                    strokeWidth="2"
                    style={{
                      filter: `drop-shadow(0 0 4px ${colors[i % colors.length]})`,
                    }}
                  />
                </svg>
              );
            })}
            {/* Central energy orb */}
            <div 
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
              style={{
                background: 'radial-gradient(circle, #00ffff 0%, #00d4ff50 40%, transparent 70%)',
                boxShadow: '0 0 60px 20px #00d4ff50, 0 0 100px 40px #00ffff30',
                animation: 'orb-pulse 0.4s ease-in-out infinite alternate',
              }}
            />
          </>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer"
      onClick={handleClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop with enhanced blur */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        style={{ animation: "overlay-fade-in 0.4s ease-out" }}
      />

      {/* Radial glow based on effect */}
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${colors[0]}50 0%, ${colors[1]}30 30%, transparent 70%)`,
          animation: 'glow-pulse 2s ease-in-out infinite',
        }}
      />

      {/* Effect-specific animations */}
      {renderEffect()}

      {/* Main content */}
      {showContent && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none"
          style={{ animation: "content-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
        >
          {/* Icon with enhanced glow */}
          <div 
            className="relative mb-8"
            style={{ animation: "icon-float 1.5s ease-in-out infinite" }}
          >
            {/* Multi-layer glow */}
            <div 
              className="absolute inset-0 blur-3xl opacity-80 rounded-full scale-[2]"
              style={{ backgroundColor: colors[0] }}
            />
            <div 
              className="absolute inset-0 blur-2xl opacity-60 rounded-full scale-150"
              style={{ backgroundColor: colors[1] }}
            />
            <div 
              className="absolute inset-0 blur-xl opacity-40 rounded-full scale-125"
              style={{ backgroundColor: '#fff' }}
            />
            <IconComponent 
              className="relative w-32 h-32 text-white drop-shadow-2xl"
              style={{ 
                filter: `drop-shadow(0 0 30px ${colors[0]}) drop-shadow(0 0 60px ${colors[1]})`,
              }}
            />
          </div>

          {/* Text with gradient */}
          <div 
            className="text-center max-w-3xl"
            style={{ animation: "text-reveal 0.8s ease-out 0.3s both" }}
          >
            <p 
              className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg"
              style={{
                background: `linear-gradient(135deg, #fff 0%, ${colors[0]} 50%, ${colors[1]} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                textShadow: `0 0 40px ${colors[0]}80`,
              }}
            >
              {text || "🎉 Tillykke!"}
            </p>
          </div>

          {/* Click to dismiss */}
          <p 
            className="text-white/40 text-sm mt-10 pointer-events-auto"
            style={{ animation: "hint-fade 1.5s ease-out 1.5s both" }}
          >
            Klik for at lukke
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes overlay-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes content-entrance {
          0% { transform: scale(0.5) translateY(30px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-5px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }

        @keyframes icon-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }

        @keyframes text-reveal {
          0% { transform: translateY(40px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes hint-fade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }

        /* Fireworks */
        @keyframes firework-flash {
          0% { transform: scale(0); opacity: 1; }
          30% { transform: scale(2); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }

        @keyframes firework-particle-0 {
          0% { transform: rotate(inherit) translateY(0); opacity: 1; }
          100% { transform: rotate(inherit) translateY(-120px) translateX(30px); opacity: 0; }
        }

        @keyframes firework-particle-1 {
          0% { transform: rotate(inherit) translateY(0); opacity: 1; }
          100% { transform: rotate(inherit) translateY(-100px) translateX(-40px); opacity: 0; }
        }

        @keyframes firework-particle-2 {
          0% { transform: rotate(inherit) translateY(0); opacity: 1; }
          100% { transform: rotate(inherit) translateY(-140px) translateX(10px); opacity: 0; }
        }

        @keyframes firework-trail {
          0% { transform: rotate(inherit) scaleY(0); opacity: 1; }
          50% { transform: rotate(inherit) scaleY(1); opacity: 1; }
          100% { transform: rotate(inherit) scaleY(0); opacity: 0; }
        }

        @keyframes sparkle-fall {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }

        /* Confetti */
        @keyframes confetti-fall-3d {
          0% { 
            transform: translateY(0) rotate(0deg) rotateX(0deg) rotateY(0deg); 
            opacity: 1; 
          }
          100% { 
            transform: translateY(110vh) rotate(720deg) rotateX(360deg) rotateY(180deg); 
            opacity: 0.8; 
          }
        }

        @keyframes ribbon-fall {
          0% { 
            transform: translateY(0) rotateZ(0deg) scaleY(1); 
            opacity: 1; 
          }
          50% { 
            transform: translateY(50vh) rotateZ(180deg) scaleY(1.2); 
          }
          100% { 
            transform: translateY(110vh) rotateZ(360deg) scaleY(0.8); 
            opacity: 0.6; 
          }
        }

        /* Stars */
        @keyframes star-pulse {
          0% { transform: scale(0.6) rotate(0deg); opacity: 0.4; }
          100% { transform: scale(1.3) rotate(15deg); opacity: 1; }
        }

        @keyframes star-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @keyframes shooting-star-enhanced {
          0% { transform: translate(0, 0) rotate(-45deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate(300px, 300px) rotate(-45deg); opacity: 0; }
        }

        /* Hearts */
        @keyframes heart-float-3d {
          0% { 
            transform: translateY(0) scale(0.5) rotateY(0deg); 
            opacity: 0; 
          }
          10% { opacity: 1; }
          50% { 
            transform: translateY(-50vh) scale(1.2) rotateY(180deg); 
            opacity: 1; 
          }
          100% { 
            transform: translateY(-110vh) scale(0.8) rotateY(360deg); 
            opacity: 0; 
          }
        }

        @keyframes heart-beat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          15% { transform: translate(-50%, -50%) scale(1.3); }
          30% { transform: translate(-50%, -50%) scale(1); }
          45% { transform: translate(-50%, -50%) scale(1.2); }
        }

        @keyframes heart-burst {
          0% { 
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0); 
            opacity: 0; 
          }
          20% { opacity: 1; }
          100% { 
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(var(--distance)); 
            opacity: 0; 
          }
        }

        /* Flames */
        @keyframes flame-glow {
          0% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
          100% { opacity: 0.7; transform: translateX(-50%) scaleX(1.1); }
        }

        @keyframes flame-rise-enhanced {
          0% { 
            transform: translateY(0) scaleX(1) scaleY(1); 
            opacity: 1; 
          }
          50% { 
            transform: translateY(-50vh) scaleX(0.7) scaleY(1.3); 
            opacity: 0.8; 
          }
          100% { 
            transform: translateY(-100vh) scaleX(0.3) scaleY(0.5); 
            opacity: 0; 
          }
        }

        @keyframes ember-float {
          0% { 
            transform: translateY(0) translateX(0); 
            opacity: 1; 
          }
          100% { 
            transform: translateY(-200px) translateX(${Math.random() > 0.5 ? '' : '-'}${20 + Math.random() * 40}px); 
            opacity: 0; 
          }
        }

        @keyframes flame-tongue {
          0% { transform: scaleY(0.8) scaleX(0.9); }
          100% { transform: scaleY(1.2) scaleX(1.1); }
        }

        /* Sparkles/Electric */
        @keyframes electric-pulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }

        @keyframes zap-appear {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(15deg); opacity: 1; }
          100% { transform: scale(0) rotate(45deg); opacity: 0; }
        }

        @keyframes electric-arc {
          0%, 100% { opacity: 0; }
          20%, 30% { opacity: 1; }
          50% { opacity: 0; }
          70%, 80% { opacity: 1; }
        }

        @keyframes orb-pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};
