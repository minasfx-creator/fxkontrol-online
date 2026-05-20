/**
 * /dev/effects-e2e — visual E2E harness for the full effects library.
 *
 * Iterates the merged catalog (Curated + FWsim + Finale) firing ONE effect at
 * a time in an isolated R3F canvas, animating progress 0→1 over dwellMs, then
 * snapshots canvas.toDataURL() at 256×144 and scores the frame by mean
 * luminance (proxy for "actually rendered something on screen").
 *
 * Results are kept in-memory and can be saved/compared against a baseline
 * stored in localStorage (key `fxk.e2e.effects.baseline.v1`). Visual diff
 * uses pixel-L2 distance per cell.
 *
 * IMPORTANT: needs a real GPU — the sandbox preview has no WebGL adapter,
 * so the user must run this in their browser. Pipeline-level coverage is
 * already enforced offline by src/__tests__/effectsLibraryE2E.spec.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { getMergedEffectsCatalog } from '@/data/effectsLibraries/registry';
import { resolveEffectColorHex } from '@/data/effectsLibraries/colorResolver';
import { routeEffect, type RendererKind } from '@/lib/effectRouter';
import type { Effect } from '@/data/effectLibrary';
import {
  CometEffect, FanEffect, MineEffect, RomanCandleEffect, WaterfallEffect,
  GerbEffect, FlameEffect, CryoJetEffect, LaserEffect, CakeEffect,
  ConfettiEffect, MovingHeadEffect, MultiBurstEffect, FogMachineEffect,
  HazeMachineEffect, SnowMachineEffect, BubbleMachineEffect, GirandolaEffect,
  RocketEffect,
} from '@/components/editor/effects';
import { FireworkBurst } from '@/components/editor/skycanvas/FireworkRenderer';

const DWELL_MS = 1500;
const CAPTURE_AT = 0.65;           // progress fraction at which we capture
const THUMB_W = 256;
const THUMB_H = 144;
const BASELINE_KEY = 'fxk.e2e.effects.baseline.v1';

interface RunResult {
  id: string;
  name: string;
  kind: RendererKind;
  thumb?: string;             // data:image/jpeg;base64,...
  meanLum: number;            // 0..1 — proxy for "rendered"
  passed: boolean;            // meanLum > THRESHOLD or non-empty for non-emissive
  error?: string;
}

type Status = 'idle' | 'running' | 'done' | 'cancelled';

/* ── single-effect stage ─────────────────────────────────────────────── */
const POS: [number, number, number] = [0, 4, 0];

function Stage({ effect, progress }: { effect: Effect; progress: number }) {
  const decision = useMemo(() => routeEffect(effect), [effect]);
  const color = resolveEffectColorHex(effect.color);
  const caliber = effect.caliber ?? 4;

  switch (decision.kind) {
    case 'mine':
      return <MineEffect position={POS} color={color} progress={progress} caliber={caliber} angleOffset={0} heightMeters={effect.heightMeters} launchHeading={0} launchPitch={85} />;
    case 'candle':
      return <RomanCandleEffect position={POS} color={color} progress={progress} shotCount={effect.shotCount ?? 8} caliber={caliber} angleOffset={0} launchHeading={0} launchPitch={85} />;
    case 'waterfall':
      return <WaterfallEffect position={POS} color={color} progress={progress} width={20} caliber={caliber} />;
    case 'gerb':
      return <GerbEffect position={POS} color={color} progress={progress} height={8} caliber={caliber} />;
    case 'flame':
      return <FlameEffect position={POS} color={color} progress={progress} height={8} />;
    case 'girandola':
      return <GirandolaEffect position={POS} color={color} progress={progress} caliber={caliber} />;
    case 'cake':
      return <CakeEffect position={POS} color={color} progress={progress} shotCount={effect.shotCount ?? 25} pattern={effect.firingPattern} caliber={caliber} launchHeading={0} launchPitch={85} />;
    case 'laser':
      return <LaserEffect position={POS} color={color} progress={progress} pattern={effect.laserPattern || 'fan'} beamCount={effect.beamCount || 8} />;
    case 'moving-head':
      return <MovingHeadEffect position={POS} color={color} progress={progress} beamType={effect.beamType || 'beam'} />;
    case 'cryo-jet':
      return <CryoJetEffect position={POS} color={color} progress={progress} height={6} />;
    case 'confetti':
      return <ConfettiEffect position={POS} color={color} progress={progress} />;
    case 'fog':
      return <FogMachineEffect position={POS} color={color} progress={progress} spread={10} />;
    case 'haze':
      return <HazeMachineEffect position={POS} color={color} progress={progress} radius={16} />;
    case 'snow':
      return <SnowMachineEffect position={POS} progress={progress} width={8} height={10} />;
    case 'bubble':
      return <BubbleMachineEffect position={POS} color={color} progress={progress} spread={8} />;
    case 'comet':
      return <CometEffect position={POS} color={color} progress={progress} direction="up" caliber={caliber} angleOffset={0} launchHeading={0} launchPitch={85} />;
    case 'multi-burst':
      return <MultiBurstEffect position={[POS[0], POS[1] + 40, POS[2]]} color={color} progress={progress} burstCount={3} caliber={caliber} />;
    case 'fan':
      return <FanEffect position={POS} color={color} progress={progress} spreadAngle={90} caliber={caliber} launchHeading={0} launchPitch={85} />;
    case 'rocket':
      return <RocketEffect position={POS} color={color} progress={progress} caliber={caliber} />;
    case 'firework-burst':
      return <FireworkBurst position={[POS[0], 60, POS[2]]} color={color} progress={progress} caliber={caliber} pattern={effect.pattern || 'peony'} />;
    default:
      return null;
  }
}

/* ── snapshot helper ─────────────────────────────────────────────────── */
function snapshotCanvas(src: HTMLCanvasElement): { dataUrl: string; meanLum: number } {
  const c = document.createElement('canvas');
  c.width = THUMB_W;
  c.height = THUMB_H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, THUMB_W, THUMB_H);
  const img = ctx.getImageData(0, 0, THUMB_W, THUMB_H);
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    sum += (img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114);
  }
  const meanLum = sum / (img.data.length / 4) / 255;
  return { dataUrl: c.toDataURL('image/jpeg', 0.6), meanLum };
}

function pixelL2(a: string, b: string): Promise<number> {
  return new Promise((resolve) => {
    const ia = new Image();
    const ib = new Image();
    let loaded = 0;
    const done = () => {
      if (++loaded < 2) return;
      const ca = document.createElement('canvas'); ca.width = THUMB_W; ca.height = THUMB_H;
      const cb = document.createElement('canvas'); cb.width = THUMB_W; cb.height = THUMB_H;
      ca.getContext('2d')!.drawImage(ia, 0, 0, THUMB_W, THUMB_H);
      cb.getContext('2d')!.drawImage(ib, 0, 0, THUMB_W, THUMB_H);
      const da = ca.getContext('2d')!.getImageData(0, 0, THUMB_W, THUMB_H).data;
      const db = cb.getContext('2d')!.getImageData(0, 0, THUMB_W, THUMB_H).data;
      let acc = 0;
      for (let i = 0; i < da.length; i += 4) {
        const dr = da[i] - db[i], dg = da[i + 1] - db[i + 1], dbl = da[i + 2] - db[i + 2];
        acc += dr * dr + dg * dg + dbl * dbl;
      }
      resolve(Math.sqrt(acc / (da.length / 4)) / 255);
    };
    ia.onload = done; ib.onload = done;
    ia.src = a; ib.src = b;
  });
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function EffectsE2EHarness() {
  const catalog = useMemo(() => getMergedEffectsCatalog(), []);
  const entries = catalog.entries;
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<RunResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<RendererKind | 'all'>('all');
  const [diffs, setDiffs] = useState<Record<string, number>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const capturedRef = useRef(false);
  const cancelRef = useRef(false);

  const visibleEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => routeEffect(e.effect).kind === filter);
  }, [entries, filter]);

  const current = visibleEntries[idx]?.effect;

  /* sequential player loop */
  useEffect(() => {
    if (status !== 'running' || !current) return;
    capturedRef.current = false;
    setProgress(0);
    startRef.current = performance.now();

    const tick = () => {
      if (cancelRef.current) return;
      const t = (performance.now() - startRef.current) / DWELL_MS;
      const p = Math.min(1, t);
      setProgress(p);
      if (!capturedRef.current && p >= CAPTURE_AT) {
        capturedRef.current = true;
        // capture next frame after r3f renders
        requestAnimationFrame(() => {
          const cv = canvasRef.current;
          let snap = { dataUrl: '', meanLum: 0 };
          let err: string | undefined;
          try {
            if (cv) snap = snapshotCanvas(cv); else err = 'canvas-missing';
          } catch (e: any) { err = String(e?.message ?? e); }
          const decision = routeEffect(current);
          const passed = !err && (snap.meanLum > 0.012 || decision.kind === 'fog' || decision.kind === 'haze');
          setResults((r) => [...r, {
            id: current.id, name: current.name, kind: decision.kind,
            thumb: snap.dataUrl, meanLum: snap.meanLum, passed, error: err,
          }]);
        });
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // advance
        if (idx + 1 < visibleEntries.length) {
          setIdx((i) => i + 1);
        } else {
          setStatus('done');
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, idx, current, visibleEntries.length]);

  const startRun = useCallback(() => {
    cancelRef.current = false;
    setResults([]); setDiffs({}); setIdx(0); setStatus('running');
  }, []);
  const cancelRun = useCallback(() => {
    cancelRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStatus('cancelled');
  }, []);

  const saveBaseline = useCallback(() => {
    try {
      const baseline: Record<string, string> = {};
      for (const r of results) if (r.thumb) baseline[r.id] = r.thumb;
      localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
      alert(`Baseline saved (${Object.keys(baseline).length} effects)`);
    } catch (e: any) {
      alert('Failed to save baseline: ' + e.message + ' (quota?)');
    }
  }, [results]);

  const compareBaseline = useCallback(async () => {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) { alert('No baseline saved.'); return; }
    const base: Record<string, string> = JSON.parse(raw);
    const out: Record<string, number> = {};
    for (const r of results) {
      if (!r.thumb || !base[r.id]) continue;
      out[r.id] = await pixelL2(r.thumb, base[r.id]);
    }
    setDiffs(out);
  }, [results]);

  const exportReport = useCallback(() => {
    const blob = new Blob([JSON.stringify({
      generatedAt: new Date().toISOString(),
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results: results.map(r => ({ ...r, thumb: undefined })),
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `effects-e2e-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [results]);

  const kinds: RendererKind[] = ['firework-burst', 'cake', 'mine', 'candle', 'comet', 'fan', 'mburst' as any, 'gerb', 'flame', 'girandola', 'waterfall', 'laser', 'moving-head', 'cryo-jet', 'confetti', 'fog', 'haze', 'snow', 'bubble', 'rocket'];

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const pct = visibleEntries.length ? Math.round((results.length / visibleEntries.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050810] text-foreground p-4 space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-ds-h3 font-mono">Effects Library — Visual E2E</h1>
        <span className="text-ds-caption opacity-70">{visibleEntries.length} effects · dwell {DWELL_MS}ms</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="bg-black/40 border border-white/10 px-2 py-1 text-ds-caption rounded"
            value={filter}
            onChange={(e) => { setFilter(e.target.value as any); setIdx(0); setResults([]); }}
            disabled={status === 'running'}
          >
            <option value="all">all kinds</option>
            {kinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {status !== 'running' ? (
            <button onClick={startRun} className="bg-cyan-600/30 border border-cyan-400/50 px-3 py-1 rounded text-ds-label">▶ Run All</button>
          ) : (
            <button onClick={cancelRun} className="bg-red-600/30 border border-red-400/50 px-3 py-1 rounded text-ds-label">■ Cancel</button>
          )}
          <button onClick={saveBaseline} disabled={!results.length} className="border border-white/15 px-3 py-1 rounded text-ds-label disabled:opacity-40">Save Baseline</button>
          <button onClick={compareBaseline} disabled={!results.length} className="border border-white/15 px-3 py-1 rounded text-ds-label disabled:opacity-40">Compare</button>
          <button onClick={exportReport} disabled={!results.length} className="border border-white/15 px-3 py-1 rounded text-ds-label disabled:opacity-40">Export JSON</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* preview canvas */}
        <div className="relative bg-black rounded border border-white/10 aspect-video overflow-hidden">
          <Canvas
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
            camera={{ position: [25, 18, 25], fov: 50 }}
            onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
          >
            <color attach="background" args={['#020308']} />
            <ambientLight intensity={0.15} />
            <directionalLight position={[10, 20, 10]} intensity={0.3} />
            <Suspense fallback={null}>
              {current && <Stage key={current.id + '-' + idx} effect={current} progress={progress} />}
            </Suspense>
            {/* ground reference */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <meshStandardMaterial color="#0a0d18" roughness={0.9} />
            </mesh>
          </Canvas>
          <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-ds-caption font-mono">
            {current ? `[${idx + 1}/${visibleEntries.length}] ${current.name}` : 'idle'}
            {current && <span className="ml-2 opacity-60">· {routeEffect(current).kind}</span>}
          </div>
          {status === 'running' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div className="h-full bg-cyan-400" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>

        {/* status panel */}
        <aside className="bg-black/40 border border-white/10 rounded p-3 space-y-3 text-ds-caption font-mono">
          <div>Status: <span className="text-cyan-400">{status}</span> · {pct}%</div>
          <div>Passed: <span className="text-emerald-400">{passed}</span></div>
          <div>Failed: <span className="text-red-400">{failed}</span></div>
          <hr className="border-white/10" />
          <div className="opacity-70">L2 baseline diff is reported per cell after Compare (0=identical, ~1=opposite).</div>
        </aside>
      </div>

      {/* results grid */}
      <section className="bg-black/30 border border-white/10 rounded p-3">
        <div className="text-ds-label font-mono mb-2 opacity-70">Results ({results.length})</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {results.map((r) => {
            const d = diffs[r.id];
            return (
              <div key={r.id} className={`border rounded overflow-hidden ${r.passed ? 'border-emerald-500/40' : 'border-red-500/60'}`}>
                {r.thumb
                  ? <img src={r.thumb} alt={r.name} className="w-full h-auto block" />
                  : <div className="aspect-video bg-black/60 flex items-center justify-center text-red-400">{r.error || 'no-thumb'}</div>
                }
                <div className="p-1 text-[10px] leading-tight font-mono">
                  <div className="truncate" title={r.name}>{r.name}</div>
                  <div className="opacity-60 flex justify-between">
                    <span>{r.kind}</span>
                    <span>lum {(r.meanLum * 100).toFixed(1)}</span>
                  </div>
                  {d !== undefined && (
                    <div className={d < 0.05 ? 'text-emerald-400' : d < 0.15 ? 'text-amber-400' : 'text-red-400'}>
                      Δ {(d * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
