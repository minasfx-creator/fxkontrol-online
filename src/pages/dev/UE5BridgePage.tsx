/**
 * /dev/ue5-bridge — Inspetor dos catálogos Unreal Engine 5.7 importados.
 *
 *  - 838 fixtures GDTF do DMXLib_v4.mvr
 *  - 3 presets Niagara (Ns_Firework Blue/Yellow/Pink)
 *  - Defaults MovieRenderPipeline (WBP_RenderSettings)
 *
 * Toggle de FixturesLayer + visualização ao vivo no SkyCanvas 2.0.
 * Presentation only — não toca safety/hardware.
 */
import { useState } from 'react';
import { SkyCanvas2 } from '@/components/show3d/v2';
import { getMvrSummary, getNiagaraPresets, getRenderSettings } from '@/lib/ue5Bridge';

export default function UE5BridgePage() {
  const [showFixtures, setShowFixtures] = useState(true);
  const mvr = getMvrSummary();
  const presets = getNiagaraPresets();
  const render = getRenderSettings();

  return (
    <div className="relative w-screen h-screen bg-[#050810] text-white">
      <SkyCanvas2 showFixtures={showFixtures} />

      <div className="absolute top-3 left-3 z-10 max-w-md p-3 rounded-md bg-black/70 backdrop-blur border border-cyan-500/30 text-xs font-mono space-y-3 max-h-[90vh] overflow-y-auto">
        <div>
          <div className="text-cyan-300 text-sm">UE5 Bridge · Read-only</div>
          <div className="opacity-60">Presentation layer — FXKONTROL voo real continua exclusivo via uiCommandGateway.</div>
        </div>

        <button
          type="button"
          onClick={() => setShowFixtures((v) => !v)}
          className={`px-3 py-1.5 rounded border ${showFixtures ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-white/20 text-white/70'}`}
        >
          MVR Fixtures: {showFixtures ? 'ON' : 'OFF'} ({mvr.count})
        </button>

        <section>
          <div className="text-cyan-300/80 mb-1">MVR · {mvr.source}</div>
          <ul className="grid grid-cols-2 gap-x-3">
            {Object.entries(mvr.byKind).map(([k, n]) => (
              <li key={k} className="flex justify-between"><span className="opacity-70">{k}</span><span>{n}</span></li>
            ))}
          </ul>
        </section>

        <section>
          <div className="text-cyan-300/80 mb-1">Niagara Presets</div>
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: p.color }} />
                <span className="opacity-80">{p.label}</span>
                <span className="opacity-50">· {p.particleCount}p · {p.lifetimeSec}s</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="text-cyan-300/80 mb-1">MovieRenderPipeline Defaults</div>
          <ul className="grid grid-cols-2 gap-x-3">
            {Object.entries({ ...render.extracted, ...render.defaultsApplied }).map(([k, v]) => (
              <li key={k} className="flex justify-between"><span className="opacity-70">{k}</span><span>{String(v)}</span></li>
            ))}
          </ul>
          <div className="opacity-50 mt-1">{render.usage}</div>
        </section>
      </div>
    </div>
  );
}
