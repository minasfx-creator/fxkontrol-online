/**
 * ─── /dev/perf-bench ───────────────────────────────────────────────
 * ECS Unified Kernel benchmark harness.
 * Spawns N entities (1k / 10k / 100k), runs M steps, reports p50/p95/p99
 * step ms and effective FPS. Compares ECS (current backend) vs naive AoS.
 *
 * READ-ONLY — never touches uiCommandGateway / fieldBus / SSM.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EcsWorld, ENTITY_KIND, FLAG } from '@/ecs/World';
import { createEcsKernel } from '@/ecs/kernel';
import { publishFrameBudget, FRAME_BUDGET_TARGET_MS, FRAME_BUDGET_WARN_MS } from '@/ecs/frameBudget';

interface BenchResult {
  label: string;
  n: number;
  steps: number;
  p50: number;
  p95: number;
  p99: number;
  meanMs: number;
  effectiveFps: number;
  backend: string;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

async function runEcsBench(n: number, steps = 120): Promise<BenchResult> {
  const world = new EcsWorld(n);
  for (let i = 0; i < n; i++) {
    world.spawn({
      kind: ENTITY_KIND.PARTICLE,
      pos: [Math.random() * 200 - 100, Math.random() * 50, Math.random() * 200 - 100],
      vel: [Math.random() * 4 - 2, Math.random() * 20 + 5, Math.random() * 4 - 2],
      color: [1, 0.7, 0.2, 1],
      lifeMs: 4000 + Math.random() * 2000,
      flags: FLAG.HAS_GRAVITY,
    });
  }
  const kernel = await createEcsKernel(world);
  const samples: number[] = [];
  for (let s = 0; s < steps; s++) {
    const t0 = performance.now();
    kernel.step(1 / 60);
    samples.push(performance.now() - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = percentile(sorted, 0.95);
  publishFrameBudget({
    p95Ms: p95,
    emaMs: mean,
    liveCount: world.liveCount,
    backend: kernel.backend,
  });
  return {
    label: `ECS (${kernel.backend.toUpperCase()})`,
    n,
    steps,
    p50: percentile(sorted, 0.5),
    p95,
    p99: percentile(sorted, 0.99),
    meanMs: mean,
    effectiveFps: 1000 / mean,
    backend: kernel.backend,
  };
}

interface AosParticle {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  life: number;
  alive: boolean;
}

function runAosBench(n: number, steps = 120): BenchResult {
  const arr: AosParticle[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      pos: { x: Math.random() * 200 - 100, y: Math.random() * 50, z: Math.random() * 200 - 100 },
      vel: { x: Math.random() * 4 - 2, y: Math.random() * 20 + 5, z: Math.random() * 4 - 2 },
      life: 4000 + Math.random() * 2000,
      alive: true,
    });
  }
  const samples: number[] = [];
  const dt = 1 / 60;
  const dtMs = dt * 1000;
  for (let s = 0; s < steps; s++) {
    const t0 = performance.now();
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p.alive) continue;
      p.vel.y += -9.80665 * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
      p.life -= dtMs;
      if (p.life <= 0) p.alive = false;
    }
    samples.push(performance.now() - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    label: 'Legacy AoS',
    n,
    steps,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    meanMs: mean,
    effectiveFps: 1000 / mean,
    backend: 'aos',
  };
}

function ResultRow({ r }: { r: BenchResult }) {
  const overTarget = r.p95 >= FRAME_BUDGET_TARGET_MS;
  const overWarn = r.p95 >= FRAME_BUDGET_WARN_MS;
  const tone = overTarget ? 'ds-status-fail' : overWarn ? 'ds-status-warn' : 'ds-status-ok';
  return (
    <tr className="ds-mono text-[12px] border-b border-white/5">
      <td className="px-3 py-2">{r.label}</td>
      <td className="px-3 py-2 text-right">{r.n.toLocaleString()}</td>
      <td className="px-3 py-2 text-right">{r.p50.toFixed(2)}</td>
      <td className={`px-3 py-2 text-right font-semibold ${tone}`}>{r.p95.toFixed(2)}</td>
      <td className="px-3 py-2 text-right">{r.p99.toFixed(2)}</td>
      <td className="px-3 py-2 text-right">{r.meanMs.toFixed(2)}</td>
      <td className="px-3 py-2 text-right">{r.effectiveFps.toFixed(0)}</td>
    </tr>
  );
}

export default function PerfBench() {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const sizes = [1_000, 10_000, 100_000];
    const out: BenchResult[] = [];
    for (const n of sizes) {
      // yield to UI between runs
      await new Promise((r) => setTimeout(r, 16));
      out.push(await runEcsBench(n));
      setResults([...out]);
      await new Promise((r) => setTimeout(r, 16));
      out.push(runAosBench(n));
      setResults([...out]);
    }
    setRunning(false);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-black/95 text-white p-6 space-y-4">
      <header>
        <h1 className="ds-mono text-ds-h2">/dev/perf-bench — ECS Kernel</h1>
        <p className="text-ds-caption opacity-70 mt-1">
          Step time per frame at 1k / 10k / 100k entities. Target p95 &lt; {FRAME_BUDGET_TARGET_MS}ms.
        </p>
      </header>

      <div className="flex gap-2">
        <Button onClick={runAll} disabled={running}>
          {running ? 'Running…' : 'Run benchmarks'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="ds-mono text-[10px] uppercase opacity-60 bg-white/5">
            <tr>
              <th className="px-3 py-2">Backend</th>
              <th className="px-3 py-2 text-right">N</th>
              <th className="px-3 py-2 text-right">p50 ms</th>
              <th className="px-3 py-2 text-right">p95 ms</th>
              <th className="px-3 py-2 text-right">p99 ms</th>
              <th className="px-3 py-2 text-right">mean ms</th>
              <th className="px-3 py-2 text-right">eff FPS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => <ResultRow key={i} r={r} />)}
            {results.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center opacity-50 ds-mono text-[12px]">No samples yet — run benchmarks.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <footer className="text-ds-caption opacity-50 ds-mono">
        Bench is read-only. ECS kernel uses WASM if /wasm/fxk_ecs_kernel_bg.wasm
        is present, else TS fallback. Backend chip echoes in the SafetyBar BUDGET pill.
      </footer>
    </div>
  );
}
