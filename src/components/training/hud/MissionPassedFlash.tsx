/**
 * Training v2.1 — MissionPassedFlash (GTA-V golden sweep).
 */

import { useEffect, useState } from 'react';

interface Props {
  active: boolean;
  durationMs?: number;
  onDone?: () => void;
}

export default function MissionPassedFlash({ active, durationMs = 1400, onDone }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) return;
    setShow(true);
    const t = setTimeout(() => { setShow(false); onDone?.(); }, durationMs);
    return () => clearTimeout(t);
  }, [active, durationMs, onDone]);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[55] overflow-hidden">
      <div
        className="absolute inset-y-0 -left-1/3 w-1/3"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(45 100% 60% / 0.55) 45%, hsl(45 100% 60% / 0.85) 55%, transparent 100%)',
          animation: `fxk-passed-sweep ${durationMs}ms ease-out forwards`,
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="text-[12px] uppercase tracking-[0.5em] font-mono text-[hsl(45_100%_60%)] drop-shadow-[0_0_18px_rgba(0,0,0,0.9)] mb-1">
          mission passed
        </p>
        <p className="text-[28px] font-extrabold text-white drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]">
          ★ ESTÁGIO CONCLUÍDO ★
        </p>
      </div>
      <style>{`
        @keyframes fxk-passed-sweep {
          0%   { transform: translateX(0%);   opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(450%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
