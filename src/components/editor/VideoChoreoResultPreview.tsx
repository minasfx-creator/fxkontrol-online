/**
 * VideoChoreoResultPreview — Visual preview of depth layers + regional colors
 * Shows 4x4 color grid, depth layer distribution, and mini 3D drone map.
 */
import { useMemo, useRef, useEffect } from 'react';
import { Layers, Palette, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChoreoKeyframe } from '@/lib/videoChoreoEngine';
import type { RegionalColorMap } from '@/lib/videoTrackingAdvanced';

interface Props {
  keyframe: ChoreoKeyframe;
  radius: number;
}

// Depth layer classification based on Y height
function classifyDepthLayer(y: number, baseHeight: number): {
  layer: 'foreground' | 'midground' | 'background';
  color: string;
  label: string;
} {
  const ratio = y / Math.max(baseHeight, 1);
  if (ratio < 0.7) return { layer: 'foreground', color: '#ef4444', label: 'FG' };
  if (ratio < 1.3) return { layer: 'midground', color: '#eab308', label: 'MG' };
  return { layer: 'background', color: '#3b82f6', label: 'BG' };
}

export default function VideoChoreoResultPreview({ keyframe, radius }: Props) {
  const miniMapRef = useRef<HTMLCanvasElement>(null);

  // Compute depth layer stats
  const depthStats = useMemo(() => {
    const points = keyframe.points;
    if (points.length === 0) return null;

    const avgY = points.reduce((s, p) => s + p.y, 0) / points.length;
    let fg = 0, mg = 0, bg = 0;

    for (const p of points) {
      const { layer } = classifyDepthLayer(p.y, avgY);
      if (layer === 'foreground') fg++;
      else if (layer === 'midground') mg++;
      else bg++;
    }

    return { fg, mg, bg, total: points.length, avgY };
  }, [keyframe.points]);

  // Render mini 3D map with depth-colored drones
  useEffect(() => {
    const canvas = miniMapRef.current;
    if (!canvas || keyframe.points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const points = keyframe.points;
    const avgY = depthStats?.avgY ?? 30;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'hsl(220 12% 6%)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'hsl(220 8% 14%)';
    ctx.lineWidth = 0.5;
    const step = w / 8;
    for (let x = step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Scale
    let maxDist = 1;
    for (const p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.z));
    const scale = Math.min(w, h) * 0.42 / maxDist;

    // Draw drones colored by depth layer
    for (const p of points) {
      const px = w / 2 + p.x * scale;
      const py = h / 2 - p.z * scale;
      const { color } = classifyDepthLayer(p.y, avgY);

      // Glow
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Dot
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Legend
    const legends = [
      { label: 'FG', color: '#ef4444', count: depthStats?.fg ?? 0 },
      { label: 'MG', color: '#eab308', count: depthStats?.mg ?? 0 },
      { label: 'BG', color: '#3b82f6', count: depthStats?.bg ?? 0 },
    ];
    let lx = 4;
    ctx.font = '8px monospace';
    for (const l of legends) {
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, h - 12, 6, 6);
      ctx.fillStyle = 'hsl(220 5% 60%)';
      ctx.textAlign = 'left';
      ctx.fillText(`${l.label}:${l.count}`, lx + 8, h - 6);
      lx += 48;
    }
  }, [keyframe.points, depthStats]);

  const rcMap = keyframe.regionalColors;

  return (
    <div className="space-y-2">
      {/* Depth Layers Mini Map */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-primary" />
          <span className="text-[8px] font-bold text-foreground uppercase">Depth Layers</span>
        </div>
        <canvas
          ref={miniMapRef}
          width={280}
          height={160}
          className="w-full rounded-md border border-border/30"
        />
        {depthStats && (
          <div className="flex gap-1">
            <DepthBar label="Foreground" count={depthStats.fg} total={depthStats.total} color="bg-red-500" />
            <DepthBar label="Midground" count={depthStats.mg} total={depthStats.total} color="bg-yellow-500" />
            <DepthBar label="Background" count={depthStats.bg} total={depthStats.total} color="bg-blue-500" />
          </div>
        )}
      </div>

      {/* Regional Colors Grid (4x4) */}
      {rcMap && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Grid3x3 className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-bold text-foreground uppercase">Cores Regionais 4×4</span>
          </div>
          <div className="grid grid-cols-4 gap-[3px] p-1.5 rounded-lg border border-border/30 bg-surface-1/50">
            {rcMap.grid.flat().map((c, i) => (
              <div key={i} className="relative group">
                <div
                  className="aspect-square rounded-sm border border-border/20 transition-transform group-hover:scale-110 group-hover:z-10"
                  style={{ backgroundColor: c.color }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-[6px] font-mono-code text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {c.color}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Palette strip */}
          {rcMap.palette.length > 0 && (
            <div className="flex items-center gap-1">
              <Palette className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[7px] text-muted-foreground">Paleta:</span>
              <div className="flex gap-[3px]">
                {rcMap.palette.map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-border/30 shadow-sm"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DepthBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1 space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[6px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-[7px] font-mono-code text-foreground">{count}</span>
      </div>
      <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
