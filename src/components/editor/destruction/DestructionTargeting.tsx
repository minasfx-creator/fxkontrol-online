export default function DestructionTargeting() {
  return (
    <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 border-2 border-destructive/40" style={{ animation: 'destruction-border-pulse 0.5s ease-in-out infinite' }} />

      <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-56 md:h-56">
        <circle cx="100" cy="100" r="70" fill="none" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="1"
          style={{ animation: 'destruction-iris-converge 2s ease-in forwards' }} />
        <circle cx="100" cy="100" r="50" fill="none" stroke="hsl(0 85% 48% / 0.5)" strokeWidth="0.8"
          style={{ animation: 'destruction-iris-converge 2s ease-in 0.3s forwards' }} />

        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <line key={i}
              x1={100 + Math.cos(angle) * 30} y1={100 + Math.sin(angle) * 30}
              x2={100 + Math.cos(angle) * 65} y2={100 + Math.sin(angle) * 65}
              stroke="hsl(0 85% 48% / 0.2)" strokeWidth="0.5" />
          );
        })}

        <circle cx="100" cy="100" r="18" fill="hsl(0 85% 48% / 0.15)" stroke="hsl(0 85% 48% / 0.6)" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="6" fill="hsl(0 85% 48% / 0.8)" />

        <path d="M30 100 Q100 50 170 100" fill="none" stroke="hsl(0 85% 48% / 0.4)" strokeWidth="2"
          style={{ animation: 'destruction-blink 1s ease-in-out infinite' }} />
        <path d="M30 100 Q100 150 170 100" fill="none" stroke="hsl(0 85% 48% / 0.4)" strokeWidth="2"
          style={{ animation: 'destruction-blink 1s ease-in-out infinite reverse' }} />

        <line x1="100" y1="10" x2="100" y2="45" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
        <line x1="100" y1="155" x2="100" y2="190" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
        <line x1="10" y1="100" x2="45" y2="100" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
        <line x1="155" y1="100" x2="190" y2="100" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
      </svg>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-[10px] text-destructive tracking-[0.3em] animate-pulse">
        TGT ACQUIRED
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[8px] text-destructive/60 tracking-widest">
        ORDNANCE STANDBY
      </div>
    </div>
  );
}
