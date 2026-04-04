import React from 'react';

export default function DestructionNuclearAftermath() {
  return (
    <div className="absolute inset-0">
      {/* Shockwave ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full border-2 border-destructive/60"
          style={{
            width: 40,
            height: 40,
            animation: 'destruction-shockwave 1.5s ease-out forwards',
            boxShadow: '0 0 40px 10px hsl(0 85% 48% / 0.2)',
          }}
        />
      </div>

      {/* Heat distortion overlay */}
      <div
        className="absolute inset-0"
        style={{
          animation: 'destruction-heat-pulse 3s ease-out forwards',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Mushroom cloud SVG */}
      <div className="absolute inset-0 flex items-end justify-center pb-[20%]">
        <svg viewBox="0 0 200 300" className="w-32 h-48 md:w-48 md:h-64"
          style={{ animation: 'destruction-mushroom-rise 2s ease-out forwards' }}>
          {/* Stem */}
          <rect x="85" y="120" width="30" height="180" rx="4" fill="hsl(0 30% 30% / 0.4)" />
          <rect x="90" y="130" width="20" height="170" rx="3" fill="hsl(20 60% 40% / 0.3)" />
          {/* Cap */}
          <ellipse cx="100" cy="100" rx="80" ry="50" fill="hsl(0 60% 35% / 0.35)" />
          <ellipse cx="100" cy="90" rx="65" ry="40" fill="hsl(15 70% 45% / 0.3)" />
          <ellipse cx="100" cy="82" rx="45" ry="28" fill="hsl(30 80% 50% / 0.25)" />
          {/* Inner glow */}
          <ellipse cx="100" cy="95" rx="30" ry="18" fill="hsl(35 100% 60% / 0.2)" />
        </svg>
      </div>

      {/* Radiation scan lines */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={`scan-${i}`}
          className="absolute left-0 right-0 h-px bg-destructive/15"
          style={{
            top: `${(i + 1) * 12}%`,
            animation: `destruction-scanline 2s linear ${i * 0.25}s infinite`,
          }}
        />
      ))}

      {/* Fallout particles — falling down */}
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={`fallout-${i}`}
          className="absolute w-0.5 h-0.5 rounded-full bg-destructive/40"
          style={{
            left: `${5 + Math.random() * 90}%`,
            top: '-2%',
            animation: `destruction-fallout ${2 + Math.random() * 3}s linear ${i * 0.15}s forwards`,
            '--fallout-drift': `${(Math.random() - 0.5) * 40}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Static noise */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          animation: 'destruction-static 0.1s steps(5) infinite',
        }}
      />

      {/* Signal lost label */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] text-destructive/40 tracking-[0.5em]"
        style={{ animation: 'destruction-fade-in 1.5s ease-out forwards' }}>
        SIGNAL LOST
      </div>
    </div>
  );
}
