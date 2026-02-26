import { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onStart: (fleetSize: number, pyroPositions: number) => void;
}

export default function SplashScreen({ onStart }: SplashScreenProps) {
  const [fleetSize, setFleetSize] = useState(500);
  const [pyroPositions, setPyroPositions] = useState(24);
  const [phase, setPhase] = useState<'intro' | 'ready' | 'exit'>('intro');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('ready'), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setPhase('exit');
    setTimeout(() => onStart(fleetSize, pyroPositions), 600);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500",
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
      style={{ background: 'radial-gradient(ellipse at center, hsl(var(--surface-2)), hsl(var(--surface-0)))' }}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--electric) / 0.3) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--electric) / 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(var(--electric) / 0.08), transparent 70%)' }}
        />
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center gap-8 transition-all duration-700",
          phase === 'intro' ? 'opacity-0 translate-y-6 scale-95' : 'opacity-100 translate-y-0 scale-100'
        )}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-electric to-safety flex items-center justify-center shadow-[0_0_40px_hsl(var(--electric)/0.3)]">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.25em] uppercase text-foreground font-mono-code">
            NEXUS GENESIS
          </h1>
          <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">
            Zenith Absolute Workstation
          </p>
        </div>

        {/* Config inputs */}
        <div className="flex flex-col items-center gap-5 w-80">
          {/* Fleet size */}
          <div className="w-full space-y-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
              Fleet Size (Max 10k Agents)
            </label>
            <Input
              type="number"
              min={1}
              max={10000}
              value={fleetSize}
              onChange={(e) => setFleetSize(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))}
              className="h-10 text-center text-lg font-mono-code bg-surface-1 border-border focus:border-electric text-foreground"
            />
            <input
              type="range"
              min={10}
              max={10000}
              step={10}
              value={fleetSize}
              onChange={(e) => setFleetSize(parseInt(e.target.value))}
              className="w-full h-1.5 accent-primary bg-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_hsl(207_90%_54%/0.5)]"
            />
          </div>

          {/* Pyro positions */}
          <div className="w-full space-y-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
              Ground Pyro Positions
            </label>
            <Input
              type="number"
              min={0}
              max={500}
              value={pyroPositions}
              onChange={(e) => setPyroPositions(Math.min(500, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-10 text-center text-lg font-mono-code bg-surface-1 border-border focus:border-electric text-foreground"
            />
          </div>
        </div>

        {/* Start button */}
        <Button
          onClick={handleStart}
          className="px-10 py-3 h-auto text-sm font-bold tracking-[0.18em] uppercase bg-gradient-to-r from-electric to-electric-glow hover:shadow-[0_0_24px_hsl(var(--electric)/0.4)] transition-all duration-300"
        >
          Start Engineering
        </Button>

        <p className="text-[9px] text-muted-foreground/50 font-mono-code tracking-wider">
          v3.0.0 · ZENITH ENGINE
        </p>
      </div>
    </div>
  );
}
