/**
 * PageTransitionOverlay — AR-styled particle burst on route change
 * CSS-only 16 luminous dots that scale-in + fade-out in 400ms
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PARTICLE_COUNT = 16;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    y: 40 + Math.random() * 20,
    dx: (Math.random() - 0.5) * 60,
    dy: (Math.random() - 0.5) * 60,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 100,
    color: Math.random() > 0.5 ? 'hsl(var(--fxk-cyan))' : 'hsl(var(--primary))',
  }));
}

export default function PageTransitionOverlay() {
  const location = useLocation();
  const [particles, setParticles] = useState<ReturnType<typeof generateParticles> | null>(null);

  useEffect(() => {
    setParticles(generateParticles());
    const t = setTimeout(() => setParticles(null), 500);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!particles) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" style={{ mixBlendMode: 'screen' }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `ar-particle 400ms ${p.delay}ms cubic-bezier(0.16,1,0.3,1) forwards`,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes ar-particle {
          0% { opacity: 0; transform: translate(0,0) scale(0.3); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
