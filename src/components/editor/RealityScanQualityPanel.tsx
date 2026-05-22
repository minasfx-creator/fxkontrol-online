/**
 * RealityScan Quality Analysis Panel
 *
 * Visualizes tie-point and mesh quality (camera coverage) with the
 * RealityScan 2.0 green→red ramp and lets the operator bake the result
 * into vertex colors or a downloadable texture.
 *
 * Pure presentation + pure-module bindings. No THREE, no editor side-effects:
 * the bake actions emit data via the optional callbacks `onBakeVertexColors`
 * and `onBakeTexture`, or download a PNG when no handler is provided.
 *
 * Gated by the `realityscan_quality_analysis` feature flag.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Activity, Download, Layers, Palette } from 'lucide-react';
import { isEnabled } from '@/lib/featureFlags';
import {
  computeTiePointQuality,
  type TiePoint,
  type CameraView,
} from '@/modules/swarmgpt/advanced/quality/tiePointQuality';
import { computeMeshQuality } from '@/modules/swarmgpt/advanced/quality/meshQuality';
import {
  bakeVertexColors,
  bakeQualityTexture,
  qualityHistogram,
} from '@/modules/swarmgpt/advanced/quality/bake';
import { qualityToRgb } from '@/modules/swarmgpt/advanced/quality/qualityColorRamp';
import type { Vec3 } from '@/modules/swarmgpt/types';

interface MeshLike {
  vertices: Vec3[];
  indices: number[];
}

interface Props {
  /** Optional real mesh; falls back to a built-in demo cube. */
  mesh?: MeshLike;
  /** Optional sparse cloud; falls back to mesh vertices observed by all cameras. */
  tiePoints?: TiePoint[];
  /** Optional camera rig; falls back to a 6-camera ring. */
  cameras?: CameraView[];
  /** Receives Float32Array of RGB triplets (length = vertices*3). */
  onBakeVertexColors?: (rgb: Float32Array) => void;
  /** Receives the raw RGBA texture grid. */
  onBakeTexture?: (tex: { width: number; height: number; pixels: Uint8ClampedArray }) => void;
}

// ---------- Demo dataset ----------
function buildDemoCube(): MeshLike {
  const v: Vec3[] = [
    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },   { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },  { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },    { x: -1, y: 1, z: 1 },
  ];
  // 12 triangles (CCW outward).
  const i = [
    0,2,1, 0,3,2,  // -Z
    4,5,6, 4,6,7,  // +Z
    0,1,5, 0,5,4,  // -Y
    2,3,7, 2,7,6,  // +Y
    1,2,6, 1,6,5,  // +X
    0,4,7, 0,7,3,  // -X
  ];
  return { vertices: v, indices: i };
}

function buildDemoCameras(): CameraView[] {
  // 5 cameras heavily biased to +X/+Z hemisphere → asymmetric coverage.
  const ring: CameraView[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI; // half ring
    ring.push({ position: { x: 4 * Math.cos(a), y: 1.2, z: 4 * Math.sin(a) } });
  }
  return ring;
}

// ---------- Component ----------
export default function RealityScanQualityPanel(props: Props) {
  const enabled = isEnabled('realityscan_quality_analysis');

  const mesh = useMemo(() => props.mesh ?? buildDemoCube(), [props.mesh]);
  const cameras = useMemo(() => props.cameras ?? buildDemoCameras(), [props.cameras]);
  const tiePoints = useMemo<TiePoint[]>(() => {
    if (props.tiePoints) return props.tiePoints;
    return mesh.vertices.map((p) => ({
      position: p,
      observedBy: cameras.map((_, idx) => idx),
    }));
  }, [props.tiePoints, mesh.vertices, cameras]);

  const [maxDistance, setMaxDistance] = useState(8);
  const [saturation, setSaturation] = useState(4);
  const [tab, setTab] = useState<'tie' | 'mesh'>('tie');
  const [lastAction, setLastAction] = useState<string | null>(null);

  const tie = useMemo(
    () =>
      computeTiePointQuality(tiePoints, cameras, {
        maxDistance,
        saturationCount: saturation,
      }),
    [tiePoints, cameras, maxDistance, saturation],
  );
  const meshQ = useMemo(
    () =>
      computeMeshQuality(mesh.vertices, mesh.indices, cameras, {
        maxDistance,
        saturationCount: saturation,
      }),
    [mesh, cameras, maxDistance, saturation],
  );

  const activeScores = tab === 'tie' ? tie.scores : meshQ.triangleScores;
  const histogram = useMemo(() => qualityHistogram(activeScores, 16), [activeScores]);

  // Overlay rendered as orthographic top-down splats on a canvas — pure 2D,
  // no THREE dependency. Good enough as a quality preview.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'hsl(220 30% 6%)';
    ctx.fillRect(0, 0, W, H);

    const points: Array<{ p: Vec3; s: number }> = [];
    if (tab === 'tie') {
      for (let i = 0; i < tiePoints.length; i++) {
        points.push({ p: tiePoints[i].position, s: tie.scores[i] });
      }
    } else {
      // Triangle centroids.
      for (let t = 0; t < meshQ.triangleScores.length; t++) {
        const a = mesh.vertices[mesh.indices[t * 3]];
        const b = mesh.vertices[mesh.indices[t * 3 + 1]];
        const c2 = mesh.vertices[mesh.indices[t * 3 + 2]];
        if (!a || !b || !c2) continue;
        points.push({
          p: { x: (a.x + b.x + c2.x) / 3, y: (a.y + b.y + c2.y) / 3, z: (a.z + b.z + c2.z) / 3 },
          s: meshQ.triangleScores[t],
        });
      }
    }
    if (points.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const { p } of points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    const pad = 16;
    const sx = (W - pad * 2) / Math.max(1e-6, maxX - minX);
    const sz = (H - pad * 2) / Math.max(1e-6, maxZ - minZ);
    const s = Math.min(sx, sz);

    for (const { p, s: q } of points) {
      const [r, g, b] = qualityToRgb(q);
      ctx.fillStyle = `rgb(${(r * 255) | 0}, ${(g * 255) | 0}, ${(b * 255) | 0})`;
      const x = pad + (p.x - minX) * s;
      const y = pad + (p.z - minZ) * s;
      ctx.beginPath();
      ctx.arc(x, y, tab === 'tie' ? 3 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [tab, tie.scores, meshQ.triangleScores, mesh, tiePoints]);

  // ---------- Bake actions ----------
  function handleBakeVertexColors() {
    const rgb = bakeVertexColors(meshQ.vertexScores);
    setLastAction(`Vertex colors baked (${rgb.length / 3} vertices)`);
    props.onBakeVertexColors?.(rgb);
  }

  function handleBakeTexture() {
    const tex = bakeQualityTexture(meshQ.triangleScores);
    setLastAction(`Texture baked (${tex.width}×${tex.height})`);
    if (props.onBakeTexture) {
      props.onBakeTexture(tex);
      return;
    }
    // No handler: download a PNG.
    const off = document.createElement('canvas');
    off.width = tex.width; off.height = tex.height;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    // Copy into a fresh, ArrayBuffer-backed Uint8ClampedArray so the
    // ImageData constructor's strict typing is satisfied across TS lib targets.
    const buf = new Uint8ClampedArray(tex.pixels.length);
    buf.set(tex.pixels);
    const img = new ImageData(buf, tex.width, tex.height);
    ctx.putImageData(img, 0, 0);
    off.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quality-texture-${tex.width}x${tex.height}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  const stats = tab === 'tie' ? tie : meshQ;

  if (!enabled) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">RealityScan — Quality Analysis</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Camera coverage scored on a green→red ramp. Bake to vertex colors or texture.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'tie' | 'mesh')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="tie">Tie Point Quality</TabsTrigger>
            <TabsTrigger value="mesh">Mesh Quality</TabsTrigger>
          </TabsList>

          <TabsContent value="tie" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Sparse-cloud points colored by camera observer count and baseline angle.
            </p>
          </TabsContent>
          <TabsContent value="mesh" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Triangles colored by visible front-facing cameras within range.
            </p>
          </TabsContent>
        </Tabs>

        {/* Overlay */}
        <div className="rounded-md overflow-hidden border border-border/40 bg-background/60">
          <canvas ref={canvasRef} width={520} height={260} className="w-full h-auto block" />
        </div>

        {/* Ramp legend */}
        <div className="space-y-1">
          <div
            className="h-2 rounded-full"
            style={{
              background:
                'linear-gradient(to right, rgb(255,0,0), rgb(255,255,0), rgb(0,255,0))',
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Poor coverage</span>
            <span>Marginal</span>
            <span>Good coverage</span>
          </div>
        </div>

        {/* Histogram */}
        <div>
          <Label className="text-xs text-muted-foreground">Distribution</Label>
          <div className="mt-1 flex items-end gap-0.5 h-16">
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
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>min {stats.min.toFixed(2)}</span>
            <span>mean {stats.mean.toFixed(2)}</span>
            <span>max {stats.max.toFixed(2)}</span>
          </div>
        </div>

        {/* Tunables */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Max distance: {maxDistance.toFixed(1)}m
            </Label>
            <Slider
              min={1}
              max={50}
              step={0.5}
              value={[maxDistance]}
              onValueChange={([v]) => setMaxDistance(v)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Saturation: {saturation} cams
            </Label>
            <Slider
              min={1}
              max={16}
              step={1}
              value={[saturation]}
              onValueChange={([v]) => setSaturation(v)}
            />
          </div>
        </div>

        {/* Bake actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={handleBakeVertexColors}>
            <Palette className="h-3.5 w-3.5" />
            Bake vertex colors
          </Button>
          <Button variant="secondary" size="sm" onClick={handleBakeTexture}>
            {props.onBakeTexture ? <Layers className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            Bake texture
          </Button>
        </div>

        {lastAction && (
          <p className="text-[11px] text-muted-foreground italic">{lastAction}</p>
        )}
      </CardContent>
    </Card>
  );
}
