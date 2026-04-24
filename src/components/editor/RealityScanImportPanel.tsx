/**
 * RealityScan PLY Import Panel
 *
 * Drag-and-drop a `.ply` file (ASCII or binary little-endian). Shows point
 * count, bounding box, a quick green→red density histogram, and a
 * "Generate Formation" button that runs `planFormationFromAsset` against
 * the parsed point cloud and emits the result via `onFormationReady`.
 *
 * Self-contained — no editor side-effects beyond the optional callback.
 * Gated by the `realityscan_import_ui` feature flag.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { UploadCloud, Sparkles, FileWarning } from 'lucide-react';
import { isEnabled } from '@/lib/featureFlags';
import { parsePly } from '@/modules/swarmgpt/advanced/realityscan/parsers/plyParser';
import { qualityHistogram } from '@/modules/swarmgpt/advanced/quality/bake';
import { qualityToRgb } from '@/modules/swarmgpt/advanced/quality/qualityColorRamp';
import { planFormationFromAsset, type FormationPlan } from '@/modules/swarmgpt/core/pipeline/planFormationFromAsset';
import type { Vec3 } from '@/modules/swarmgpt/types';
import type { MotionStyle } from '@/modules/swarmgpt/physics';

const MOTION_STYLES: MotionStyle[] = ['cinematic', 'fast', 'soft', 'snap', 'organic'];

interface ParsedFile {
  name: string;
  vertices: Vec3[];
  bbox: { min: Vec3; max: Vec3 };
  format: string;
}

interface Props {
  /** Receives the FormationPlan after a successful "Generate Formation" run. */
  onFormationReady?: (plan: FormationPlan, source: { fileName: string; count: number }) => void;
  /** Optional log sink; defaults to no-op. */
  onLog?: (msg: string, level?: 'info' | 'ok' | 'warn') => void;
}

function computeBBox(points: Vec3[]): { min: Vec3; max: Vec3 } {
  if (points.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  let mnx = Infinity, mny = Infinity, mnz = Infinity;
  let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (const p of points) {
    if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
    if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
    if (p.z < mnz) mnz = p.z; if (p.z > mxz) mxz = p.z;
  }
  return { min: { x: mnx, y: mny, z: mnz }, max: { x: mxx, y: mxy, z: mxz } };
}

/**
 * Density score: for each point, count neighbors within a coarse grid cell.
 * Pure local-density proxy — fast, no kd-tree, just for the histogram preview.
 */
function densityScores(points: Vec3[], bbox: { min: Vec3; max: Vec3 }): Float32Array {
  const n = points.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  const ext = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z) || 1;
  const cellSize = ext / 24;
  const grid = new Map<string, number>();
  const keyFor = (p: Vec3) =>
    `${Math.floor((p.x - bbox.min.x) / cellSize)}|${Math.floor((p.y - bbox.min.y) / cellSize)}|${Math.floor((p.z - bbox.min.z) / cellSize)}`;
  for (const p of points) {
    const k = keyFor(p);
    grid.set(k, (grid.get(k) ?? 0) + 1);
  }
  let maxCell = 1;
  for (const v of grid.values()) if (v > maxCell) maxCell = v;
  for (let i = 0; i < n; i++) {
    out[i] = (grid.get(keyFor(points[i])) ?? 0) / maxCell;
  }
  return out;
}

export default function RealityScanImportPanel(props: Props) {
  const enabled = isEnabled('realityscan_import_ui');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [droneCount, setDroneCount] = useState(200);
  const [minDistance, setMinDistance] = useState(2);
  const [samplingStrategy, setSamplingStrategy] = useState<'weighted' | 'poisson+fps'>('poisson+fps');
  const [usePhysicsRepair, setUsePhysicsRepair] = useState(true);
  const [motionStyle, setMotionStyle] = useState<MotionStyle>('cinematic');

  const histogram = useMemo(() => {
    if (!parsed) return [];
    const scores = densityScores(parsed.vertices, parsed.bbox);
    return qualityHistogram(scores, 16);
  }, [parsed]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!/\.ply$/i.test(f.name)) {
      setError(`Unsupported file: ${f.name} (only .ply for now)`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const result = parsePly(buf);
      const bbox = computeBBox(result.vertices);
      setParsed({ name: f.name, vertices: result.vertices, bbox, format: result.format });
      props.onLog?.(`[PLY] Loaded ${f.name}: ${result.vertices.length} verts (${result.format})`, 'ok');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      props.onLog?.(`[PLY] Parse failed: ${msg}`, 'warn');
    } finally {
      setBusy(false);
    }
  }, [props]);

  function handleGenerate() {
    if (!parsed) return;
    setBusy(true);
    try {
      const plan = planFormationFromAsset(
        { type: 'point_cloud', points: parsed.vertices },
        [], // no previous formation — first cue
        {
          droneCount,
          minDistance,
          maxSpeed: 8,
          duration: 4,
          cueTime: 0,
          samplingStrategy,
          usePhysicsRepair,
          motionStyle,
        },
      );
      props.onFormationReady?.(plan, { fileName: parsed.name, count: parsed.vertices.length });
      const phys = plan.physics
        ? ` | physics: ${plan.physics.ok ? 'ok' : 'repaired'} (issues=${plan.physics.issues.length}, minSep=${plan.physics.metrics.minDistanceObserved.toFixed(2)}m)`
        : '';
      props.onLog?.(
        `[PLY] Formation: ${plan.formation.points.length}/${droneCount} drones via ${samplingStrategy}, fidelity ${plan.fidelity.score.toFixed(2)}${phys}`,
        plan.validation.valid && (!plan.physics || plan.physics.ok) ? 'ok' : 'warn',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      props.onLog?.(`[PLY] Generate failed: ${msg}`, 'warn');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  if (!enabled) return null;

  const dim = parsed
    ? {
        x: (parsed.bbox.max.x - parsed.bbox.min.x).toFixed(2),
        y: (parsed.bbox.max.y - parsed.bbox.min.y).toFixed(2),
        z: (parsed.bbox.max.z - parsed.bbox.min.z).toFixed(2),
      }
    : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">RealityScan — PLY Import</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Drop a .ply (ASCII or binary LE). Generates a drone formation via Poisson + FPS.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-dashed border-border/60 bg-background/40 hover:bg-background/60 transition-colors cursor-pointer p-4 text-center"
        >
          <UploadCloud className="h-5 w-5 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground mt-2">
            {parsed ? `${parsed.name} • ${parsed.format}` : 'Drag .ply here or click to browse'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".ply"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
            <FileWarning className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-[11px] text-destructive break-all">{error}</p>
          </div>
        )}

        {parsed && dim && (
          <>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-md border border-border/40 bg-background/40 p-2">
                <div className="text-muted-foreground">Points</div>
                <div className="font-mono">{parsed.vertices.length.toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-border/40 bg-background/40 p-2">
                <div className="text-muted-foreground">Bounds</div>
                <div className="font-mono">{dim.x}×{dim.y}×{dim.z}</div>
              </div>
              <div className="rounded-md border border-border/40 bg-background/40 p-2">
                <div className="text-muted-foreground">Format</div>
                <div className="font-mono truncate">{parsed.format}</div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Density distribution</Label>
              <div className="mt-1 flex items-end gap-0.5 h-12">
                {histogram.map((h, i) => {
                  const t = (i + 0.5) / histogram.length;
                  const [r, g, b] = qualityToRgb(t);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${Math.max(2, h * 100)}%`,
                        backgroundColor: `rgb(${(r * 255) | 0}, ${(g * 255) | 0}, ${(b * 255) | 0})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Drones: {droneCount}
                </Label>
                <Slider
                  min={20}
                  max={2000}
                  step={10}
                  value={[droneCount]}
                  onValueChange={([v]) => setDroneCount(v)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Min distance: {minDistance.toFixed(1)}m
                </Label>
                <Slider
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={[minDistance]}
                  onValueChange={([v]) => setMinDistance(v)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sampling strategy</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSamplingStrategy('poisson+fps')}
                  className={`text-[11px] rounded-md border px-2 py-1.5 transition-colors ${
                    samplingStrategy === 'poisson+fps'
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:bg-background/60'
                  }`}
                >
                  Poisson + FPS
                  <div className="text-[9px] opacity-70">exact count</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSamplingStrategy('weighted')}
                  className={`text-[11px] rounded-md border px-2 py-1.5 transition-colors ${
                    samplingStrategy === 'weighted'
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:bg-background/60'
                  }`}
                >
                  Weighted
                  <div className="text-[9px] opacity-70">density-aware</div>
                </button>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full"
              onClick={handleGenerate}
              disabled={busy || parsed.vertices.length === 0}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {busy ? 'Working…' : 'Generate Formation'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
