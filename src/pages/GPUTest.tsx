/**
 * GPU Diagnostic Test Page — /gpu-test
 * Checks WebGPU availability, reports device limits, and runs
 * FXKGPUEngine through its lifecycle to validate the volumetric pipeline.
 */
import { useEffect, useRef, useState } from 'react';

interface DiagLine {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'fail' | 'info';
}

export default function GPUTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<DiagLine[]>([]);
  const [running, setRunning] = useState(false);

  const log = (label: string, value: string, status: DiagLine['status'] = 'info') =>
    setLines(prev => [...prev, { label, value, status }]);

  useEffect(() => {
    let disposed = false;
    runDiagnostics();

    async function runDiagnostics() {
      // 1. navigator.gpu
      if (!navigator.gpu) {
        log('WebGPU API', 'NOT AVAILABLE — fallback mode', 'fail');
        log('Fallback', 'Engine will use existing WebGL renderer', 'warn');
        return;
      }
      log('WebGPU API', 'Present ✓', 'ok');

      // 2. requestAdapter
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        log('GPU Adapter', 'No adapter found — fallback mode', 'fail');
        return;
      }
      log('GPU Adapter', `${(adapter as any).name ?? 'Unknown'}`, 'ok');

      // 3. Limits
      const limits = adapter.limits;
      log('maxComputeWorkgroupSizeX', String(limits.maxComputeWorkgroupSizeX), 'info');
      log('maxStorageBuffersPerShaderStage', String(limits.maxStorageBuffersPerShaderStage), 'info');
      log('maxBufferSize', `${(limits.maxBufferSize / (1024 * 1024)).toFixed(0)} MB`, 'info');

      // 4. Request device
      let device: GPUDevice;
      try {
        device = await adapter.requestDevice();
      } catch {
        log('GPU Device', 'requestDevice() failed', 'fail');
        return;
      }
      log('GPU Device', 'Created ✓', 'ok');
      log('Preferred Format', navigator.gpu.getPreferredCanvasFormat(), 'info');

      // 5. Canvas context
      const canvas = canvasRef.current;
      if (!canvas || disposed) { device.destroy(); return; }
      const ctx = canvas.getContext('webgpu');
      if (!ctx) {
        log('Canvas Context', 'getContext("webgpu") failed', 'fail');
        device.destroy();
        return;
      }
      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: 'opaque' });
      log('Canvas', `${canvas.width}×${canvas.height} configured ✓`, 'ok');

      // 6. Import and init FXKGPUEngine
      log('FXKGPUEngine', 'Importing module…', 'info');
      let FXKGPUEngine: any;
      try {
        const mod = await import('@/render_ultra/gpgpu/fxk-gpu');
        FXKGPUEngine = mod.FXKGPUEngine;
      } catch (e: any) {
        log('FXKGPUEngine', `Import failed: ${e.message}`, 'fail');
        device.destroy();
        return;
      }
      log('FXKGPUEngine', 'Module loaded ✓', 'ok');

      // Minimal WGSL stubs for pipeline creation test
      const stubCompute = `@group(0) @binding(0) var<uniform> u: vec4<f32>;
@group(0) @binding(1) var<storage, read_write> particles: array<vec4<f32>>;
@compute @workgroup_size(256)
fn cs_update(@builtin(global_invocation_id) id: vec3<u32>) {}`;

      const stubSort = `@group(0) @binding(0) var<uniform> u: vec4<u32>;
@group(0) @binding(1) var<storage, read_write> data: array<vec4<f32>>;
@compute @workgroup_size(256)
fn cs_sort(@builtin(global_invocation_id) id: vec3<u32>) {}`;

      try {
        const engine = new FXKGPUEngine({ computeWGSL: stubCompute, sortWGSL: stubSort, maxParticles: 1024 });
        log('Engine State', engine.state, 'info');

        const ready = await engine.init(canvas);
        log('Engine Init', ready ? 'Ready ✓' : 'Fallback', ready ? 'ok' : 'warn');
        log('Engine State', engine.state, 'info');

        if (ready) {
          // Run 60 test frames
          setRunning(true);
          const identity = new Float32Array(16);
          identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[15] = 1;
          const cam = { viewProj: identity, right: [1, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number] };
          const wind = { x: 0.1, y: 0, z: 0 };

          engine.updateCamera(cam);
          const start = performance.now();
          for (let i = 0; i < 60; i++) {
            if (disposed) break;
            engine.frame(1 / 60, i / 60, wind);
          }
          const elapsed = performance.now() - start;
          log('60-Frame Test', `${elapsed.toFixed(1)} ms (${(elapsed / 60).toFixed(2)} ms/frame)`, elapsed / 60 < 16 ? 'ok' : 'warn');
          setRunning(false);
        }

        engine.dispose();
        log('Engine Dispose', 'Clean ✓', 'ok');
        log('Engine State', engine.state, 'info');
      } catch (e: any) {
        log('Engine Error', e.message, 'fail');
      }
    }

    return () => { disposed = true; };
  }, []);

  const statusColor: Record<DiagLine['status'], string> = {
    ok: 'text-green-400',
    warn: 'text-amber-400',
    fail: 'text-red-400',
    info: 'text-foreground/70',
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-mono text-sm">
      <h1 className="text-xl font-bold mb-1 text-primary">FXK GPU Engine — Diagnostic</h1>
      <p className="text-muted-foreground mb-4 text-xs">
        Pipeline: Compute → Smoke → Sort → Fire → Smoke → Light Scatter → Present
      </p>

      <div className="flex gap-6 flex-wrap">
        {/* Canvas */}
        <div className="border border-border rounded overflow-hidden">
          <canvas ref={canvasRef} width={320} height={240} className="bg-black block" />
          {running && <div className="text-center text-xs text-amber-400 py-1">Running…</div>}
        </div>

        {/* Log */}
        <div className="flex-1 min-w-[300px]">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-1 pr-4 text-muted-foreground whitespace-nowrap">{l.label}</td>
                  <td className={`py-1 ${statusColor[l.status]}`}>{l.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && <p className="text-muted-foreground">Running diagnostics…</p>}
        </div>
      </div>
    </div>
  );
}
