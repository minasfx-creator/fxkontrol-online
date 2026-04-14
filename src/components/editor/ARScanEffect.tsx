/**
 * ARScanEffect — Horizontal sweeping scanline with Electric Cyan glow
 * Activates temporarily on AR mode entry
 */
import { useState, useEffect } from 'react';
import { useSceneStore } from '@/store/useSceneStore';

export default function ARScanEffect() {
  const arMode = useSceneStore(s => s.environment.arMode);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (arMode) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2400);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [arMode]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[36] pointer-events-none overflow-hidden">
      <div className="absolute left-0 right-0 h-[2px] ar-scan-line" />
      <style>{`
        .ar-scan-line {
          background: linear-gradient(90deg,
            transparent 0%,
            hsl(var(--fxk-cyan) / 0.1) 20%,
            hsl(var(--fxk-cyan) / 0.6) 50%,
            hsl(var(--fxk-cyan) / 0.1) 80%,
            transparent 100%
          );
          box-shadow: 0 0 20px hsl(var(--fxk-cyan) / 0.4), 0 0 60px hsl(var(--fxk-cyan) / 0.15);
          animation: ar-scan-sweep 2s ease-in-out forwards;
        }
        @keyframes ar-scan-sweep {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
