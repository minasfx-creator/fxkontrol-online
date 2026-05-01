/**
 * /dev/skycanvas-smoke — Public dev route to mount SkyCanvas in isolation
 * for E2E QA without auth.
 *
 * Refactored: agora usa o `SkyCanvasMount` unificado (mesmo componente
 * adotado em produção pelo editor oficial). Mantém o overlay de tick
 * para o operador conferir que o React loop está vivo.
 *
 * Not linked from any nav. Safe to ship — no hardware, no ARM, no FIRE.
 */
import { useEffect, useState } from 'react';
import SkyCanvasMount from '@/components/editor/SkyCanvasMount';

export default function SkyCanvasSmoke() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050810] text-cyan-200 font-mono">
      <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded border border-cyan-500/30 bg-black/60 text-[11px]">
        SKYCANVAS · SMOKE · t={tick}s · open devtools for diagnostics
      </div>
      <SkyCanvasMount
        instanceKey="smoke"
        area="3D viewport (smoke)"
        loaderLabel="Booting SkyCanvas…"
      />
    </div>
  );
}
