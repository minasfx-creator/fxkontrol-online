interface Props {
  countdown: number;
}

export default function DestructionIncoming({ countdown }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 border-4 border-destructive/60" style={{ animation: 'destruction-border-pulse 0.3s ease-in-out infinite' }} />

      <svg className="absolute inset-0 w-full h-full">
        {[
          { x1: '0%', y1: '0%' },
          { x1: '100%', y1: '0%' },
          { x1: '0%', y1: '100%' },
          { x1: '100%', y1: '100%' },
        ].map((trail, i) => (
          <line key={i}
            x1={trail.x1} y1={trail.y1} x2="50%" y2="50%"
            stroke="hsl(0 85% 48% / 0.5)" strokeWidth="2"
            strokeDasharray="8 12"
            style={{ animation: `destruction-missile-trail 1s linear ${i * 0.2}s infinite` }} />
        ))}
      </svg>

      <div className="relative z-10 font-mono text-6xl md:text-8xl font-black text-destructive"
        style={{ animation: 'destruction-countdown-pulse 1s ease-in-out infinite', textShadow: '0 0 30px hsl(0 85% 48% / 0.5)' }}>
        {countdown}
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-[11px] text-destructive tracking-[0.4em]"
        style={{ animation: 'destruction-border-pulse 0.3s ease-in-out infinite' }}>
        IMPACT T-{countdown}
      </div>
    </div>
  );
}
