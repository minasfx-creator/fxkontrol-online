/**
 * DMX Bézier Curve Editor — Native cubic Bézier interpolation for DMX channels.
 * Eliminates discrete intensity steps; provides smooth fades, pan/tilt, and chase curves.
 * Inspired by Depence R3 / grandMA3 curve editors.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Spline, Plus, Trash2, Copy, Download, Layers } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { getMA3Node } from '@/lib/grandMA3Node';

// ═══ Types ═══
export interface BezierPoint {
  time: number;   // 0–1 normalized
  value: number;  // 0–255 DMX value
  cpIn: { time: number; value: number };  // control point in
  cpOut: { time: number; value: number }; // control point out
}

export interface DMXCurve {
  id: string;
  label: string;
  channel: number;
  universe: number;
  color: string;
  points: BezierPoint[];
}

type CurvePreset = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 's-curve' | 'snap' | 'bounce';

const CURVE_PRESETS: Record<CurvePreset, { cp1: [number, number]; cp2: [number, number] }> = {
  'linear':      { cp1: [0.33, 0.33], cp2: [0.67, 0.67] },
  'ease-in':     { cp1: [0.42, 0],    cp2: [1, 1] },
  'ease-out':    { cp1: [0, 0],       cp2: [0.58, 1] },
  'ease-in-out': { cp1: [0.42, 0],    cp2: [0.58, 1] },
  's-curve':     { cp1: [0.25, 0.1],  cp2: [0.75, 0.9] },
  'snap':        { cp1: [0.9, 0],     cp2: [0.1, 1] },
  'bounce':      { cp1: [0.6, -0.28], cp2: [0.735, 0.045] },
};

// ═══ Bézier Math (GPU-free, pre-allocatable) ═══
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

export function evaluateCurve(curve: DMXCurve, normalizedTime: number): number {
  const pts = curve.points;
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].value;
  if (normalizedTime <= pts[0].time) return pts[0].value;
  if (normalizedTime >= pts[pts.length - 1].time) return pts[pts.length - 1].value;

  // Find segment
  let i = 0;
  for (; i < pts.length - 1; i++) {
    if (normalizedTime >= pts[i].time && normalizedTime <= pts[i + 1].time) break;
  }
  const a = pts[i], b = pts[i + 1];
  const segT = (normalizedTime - a.time) / (b.time - a.time || 0.001);

  return cubicBezier(segT, a.value, a.cpOut.value, b.cpIn.value, b.value);
}

/** Generate a full 512-byte DMX frame from multiple curves at a given time */
export function renderDMXFrame(curves: DMXCurve[], normalizedTime: number): Uint8Array {
  const frame = new Uint8Array(512);
  for (const curve of curves) {
    const val = Math.round(Math.max(0, Math.min(255, evaluateCurve(curve, normalizedTime))));
    if (curve.channel >= 1 && curve.channel <= 512) {
      frame[curve.channel - 1] = val;
    }
  }
  return frame;
}

// ═══ Default curve factory ═══
function createDefaultCurve(channel: number, universe: number): DMXCurve {
  const hue = (channel * 37) % 360;
  return {
    id: `dmx-${universe}-${channel}-${Date.now()}`,
    label: `Ch ${channel}`,
    channel,
    universe,
    color: `hsl(${hue}, 70%, 55%)`,
    points: [
      { time: 0, value: 0, cpIn: { time: -0.1, value: 0 }, cpOut: { time: 0.15, value: 0 } },
      { time: 0.3, value: 255, cpIn: { time: 0.15, value: 255 }, cpOut: { time: 0.45, value: 255 } },
      { time: 0.7, value: 255, cpIn: { time: 0.55, value: 255 }, cpOut: { time: 0.85, value: 255 } },
      { time: 1, value: 0, cpIn: { time: 0.85, value: 0 }, cpOut: { time: 1.1, value: 0 } },
    ],
  };
}

// ═══ SVG Canvas Curve Renderer ═══
function CurveCanvas({
  curves,
  activeCurveId,
  playheadTime,
  onSelectCurve,
  onPointMove,
  width = 600,
  height = 200,
}: {
  curves: DMXCurve[];
  activeCurveId: string | null;
  playheadTime: number;
  onSelectCurve: (id: string) => void;
  onPointMove: (curveId: string, pointIdx: number, time: number, value: number) => void;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ curveId: string; pointIdx: number } | null>(null);

  const toSVG = useCallback((t: number, v: number) => ({
    x: t * width,
    y: height - (v / 255) * height,
  }), [width, height]);

  const fromSVG = useCallback((x: number, y: number) => ({
    time: Math.max(0, Math.min(1, x / width)),
    value: Math.max(0, Math.min(255, (1 - y / height) * 255)),
  }), [width, height]);

  const handleMouseDown = (curveId: string, pointIdx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging({ curveId, pointIdx });
    onSelectCurve(curveId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const { time, value } = fromSVG(e.clientX - rect.left, e.clientY - rect.top);
    onPointMove(dragging.curveId, dragging.pointIdx, time, value);
  }, [dragging, fromSVG, onPointMove]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    // Horizontal (value)
    for (let v = 0; v <= 255; v += 51) {
      const y = height - (v / 255) * height;
      lines.push(
        <line key={`h-${v}`} x1={0} y1={y} x2={width} y2={y}
          stroke="hsl(220, 10%, 15%)" strokeWidth={v === 0 || v === 255 ? 1 : 0.5} />
      );
      lines.push(
        <text key={`ht-${v}`} x={4} y={y - 2} fill="hsl(220, 10%, 30%)" fontSize={7} fontFamily="monospace">{v}</text>
      );
    }
    // Vertical (time)
    for (let t = 0; t <= 1; t += 0.1) {
      const x = t * width;
      lines.push(
        <line key={`v-${t}`} x1={x} y1={0} x2={x} y2={height}
          stroke="hsl(220, 10%, 15%)" strokeWidth={0.5} />
      );
    }
    return lines;
  }, [width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-[hsl(220,12%,4%)] rounded border border-border/20 cursor-crosshair select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {gridLines}

      {/* Curves */}
      {curves.map(curve => {
        const isActive = curve.id === activeCurveId;
        const opacity = isActive ? 1 : 0.35;
        const pts = curve.points;
        if (pts.length < 2) return null;

        // Build path
        let d = '';
        for (let i = 0; i < pts.length - 1; i++) {
          const a = toSVG(pts[i].time, pts[i].value);
          const cp1 = toSVG(pts[i].cpOut.time, pts[i].cpOut.value);
          const cp2 = toSVG(pts[i + 1].cpIn.time, pts[i + 1].cpIn.value);
          const b = toSVG(pts[i + 1].time, pts[i + 1].value);
          if (i === 0) d += `M ${a.x} ${a.y} `;
          d += `C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${b.x} ${b.y} `;
        }

        return (
          <g key={curve.id} opacity={opacity} onClick={() => onSelectCurve(curve.id)} className="cursor-pointer">
            {/* Curve path */}
            <path d={d} fill="none" stroke={curve.color} strokeWidth={isActive ? 2.5 : 1.5} />

            {/* Points */}
            {isActive && pts.map((pt, idx) => {
              const pos = toSVG(pt.time, pt.value);
              const cpI = toSVG(pt.cpIn.time, pt.cpIn.value);
              const cpO = toSVG(pt.cpOut.time, pt.cpOut.value);
              return (
                <g key={idx}>
                  {/* Control handles */}
                  <line x1={pos.x} y1={pos.y} x2={cpI.x} y2={cpI.y} stroke={curve.color} strokeWidth={0.5} strokeDasharray="2 2" />
                  <line x1={pos.x} y1={pos.y} x2={cpO.x} y2={cpO.y} stroke={curve.color} strokeWidth={0.5} strokeDasharray="2 2" />
                  <circle cx={cpI.x} cy={cpI.y} r={3} fill="none" stroke={curve.color} strokeWidth={1} className="cursor-grab" />
                  <circle cx={cpO.x} cy={cpO.y} r={3} fill="none" stroke={curve.color} strokeWidth={1} className="cursor-grab" />
                  {/* Main point */}
                  <circle cx={pos.x} cy={pos.y} r={5} fill={curve.color} stroke="white" strokeWidth={1.5}
                    onMouseDown={handleMouseDown(curve.id, idx)} className="cursor-grab" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Playhead */}
      <line x1={playheadTime * width} y1={0} x2={playheadTime * width} y2={height}
        stroke="hsl(32, 100%, 50%)" strokeWidth={1.5} strokeDasharray="4 2" />
      <circle cx={playheadTime * width} cy={4} r={4} fill="hsl(32, 100%, 50%)" />
    </svg>
  );
}

// ═══ Main DMX Bézier Editor Component ═══
export default function DMXBezierEditor({ fs = false }: { fs?: boolean }) {
  const [curves, setCurves] = useState<DMXCurve[]>([
    createDefaultCurve(1, 0),
    createDefaultCurve(2, 0),
  ]);
  const [activeCurveId, setActiveCurveId] = useState<string | null>(curves[0]?.id ?? null);
  const [selectedPreset, setSelectedPreset] = useState<CurvePreset>('ease-in-out');
  const [sequenceDuration] = useState(10); // seconds — base loop duration

  // Master Clock sync — consume global playhead
  const currentTime = useProjectStore(s => s.currentTime);
  const duration = useProjectStore(s => s.duration);
  const isPlaying = useProjectStore(s => s.isPlaying);

  // Normalize global time to 0–1 range using sequence duration (looping)
  const playheadTime = useMemo(() => {
    const effectiveDuration = Math.min(sequenceDuration, duration || sequenceDuration);
    return (currentTime % effectiveDuration) / effectiveDuration;
  }, [currentTime, sequenceDuration, duration]);

  const handlePointMove = useCallback((curveId: string, pointIdx: number, time: number, value: number) => {
    setCurves(prev => prev.map(c => {
      if (c.id !== curveId) return c;
      const pts = [...c.points];
      pts[pointIdx] = { ...pts[pointIdx], time, value };
      return { ...c, points: pts };
    }));
  }, []);

  const addCurve = useCallback(() => {
    const ch = curves.length + 1;
    const c = createDefaultCurve(ch, 0);
    setCurves(prev => [...prev, c]);
    setActiveCurveId(c.id);
  }, [curves.length]);

  const removeCurve = useCallback(() => {
    if (!activeCurveId) return;
    setCurves(prev => prev.filter(c => c.id !== activeCurveId));
    setActiveCurveId(null);
  }, [activeCurveId]);

  const applyPreset = useCallback((preset: CurvePreset) => {
    if (!activeCurveId) return;
    const { cp1, cp2 } = CURVE_PRESETS[preset];
    setCurves(prev => prev.map(c => {
      if (c.id !== activeCurveId) return c;
      const pts = c.points;
      if (pts.length < 2) return c;
      const newPts = pts.map((p, i) => {
        if (i === 0) return { ...p, cpOut: { time: p.time + cp1[0] * 0.3, value: p.value + cp1[1] * (pts[1].value - p.value) } };
        if (i === pts.length - 1) return { ...p, cpIn: { time: p.time - (1 - cp2[0]) * 0.3, value: pts[i - 1].value + cp2[1] * (p.value - pts[i - 1].value) } };
        return p;
      });
      return { ...c, points: newPts };
    }));
    setSelectedPreset(preset);
  }, [activeCurveId]);

  // Current DMX output preview
  const currentValues = useMemo(() => {
    return curves.map(c => ({
      label: c.label,
      channel: c.channel,
      color: c.color,
      value: Math.round(Math.max(0, Math.min(255, evaluateCurve(c, playheadTime)))),
    }));
  }, [curves, playheadTime]);

  // ═══ DMX Signal Routing → MA3 Node ═══
  useEffect(() => {
    if (!isPlaying || curves.length === 0) return;

    const node = getMA3Node();
    const nodeState = node.getState();

    // Group curves by universe
    const universeMap = new Map<number, { channel: number; value: number }[]>();
    for (const c of curves) {
      const val = Math.round(Math.max(0, Math.min(255, evaluateCurve(c, playheadTime))));
      if (!universeMap.has(c.universe)) universeMap.set(c.universe, []);
      universeMap.get(c.universe)!.push({ channel: c.channel, value: val });
    }

    // Send DMX per universe
    universeMap.forEach((channels, universeIdx) => {
      // Get existing buffer or create scratch
      const existing = node.getUniverseBuffer(universeIdx);
      const buffer = existing ? new Uint8Array(existing) : new Uint8Array(512);

      for (const ch of channels) {
        if (ch.channel >= 1 && ch.channel <= 512) {
          buffer[ch.channel - 1] = ch.value;
        }
      }

      // Transmit if node is connected
      if (nodeState.connected) {
        node.sendDMX(universeIdx, buffer);
      }
    });
  }, [curves, playheadTime, isPlaying]);

  const activeCurve = curves.find(c => c.id === activeCurveId);

  return (
    <div className={cn("flex flex-col h-full", fs && "absolute inset-0 z-50 bg-background")}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/20"
        style={{ background: 'hsl(220 12% 5%)' }}>
        <Spline className="w-3.5 h-3.5 text-[hsl(270,60%,55%)]" />
        <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[hsl(270,60%,55%)]">
          DMX BÉZIER EDITOR
        </span>
        <div className="flex-1" />
        {/* Master clock indicator */}
        <span className={cn(
          "text-[6px] font-mono tracking-wider px-1.5 py-0.5 rounded",
          isPlaying
            ? "bg-green-500/10 text-green-400"
            : "bg-muted/10 text-muted-foreground/40"
        )}>
          {isPlaying ? '● SYNC' : '○ IDLE'}
        </span>
        <button onClick={addCurve}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground/60 hover:text-foreground transition-colors">
          <Plus className="w-3 h-3" />
        </button>
        <button onClick={removeCurve}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground/60 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Curve list */}
      <div className="shrink-0 flex gap-1 px-2 py-1.5 border-b border-border/10 overflow-x-auto"
        style={{ background: 'hsl(220 12% 5%)' }}>
        {curves.map(c => (
          <button key={c.id} onClick={() => setActiveCurveId(c.id)}
            className={cn(
              "px-2 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider transition-all",
              c.id === activeCurveId
                ? "ring-1 ring-[hsl(32,100%,50%/0.5)] text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground/70"
            )}
            style={{ backgroundColor: c.id === activeCurveId ? `${c.color}20` : 'transparent', borderLeft: `2px solid ${c.color}` }}>
            U{c.universe}·{c.label}
          </button>
        ))}
      </div>

      {/* Preset bar */}
      <div className="shrink-0 flex gap-1 px-2 py-1 border-b border-border/10"
        style={{ background: 'hsl(220 12% 6%)' }}>
        <span className="text-[6px] font-mono text-muted-foreground/30 self-center mr-1">PRESET</span>
        {(Object.keys(CURVE_PRESETS) as CurvePreset[]).map(p => (
          <button key={p} onClick={() => applyPreset(p)}
            className={cn(
              "px-1.5 py-0.5 rounded text-[6px] font-mono uppercase tracking-wider transition-all",
              selectedPreset === p
                ? "bg-[hsl(270,60%,50%/0.15)] text-[hsl(270,60%,55%)]"
                : "text-muted-foreground/30 hover:text-muted-foreground/60"
            )}>
            {p}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden p-2">
        <CurveCanvas
          curves={curves}
          activeCurveId={activeCurveId}
          playheadTime={playheadTime}
          onSelectCurve={setActiveCurveId}
          onPointMove={handlePointMove}
          width={fs ? 900 : 560}
          height={fs ? 300 : 180}
        />
      </div>

      {/* Live DMX output bar */}
      <div className="shrink-0 flex gap-2 px-3 py-1.5 border-t border-border/20"
        style={{ background: 'hsl(220 12% 4%)' }}>
        <span className="text-[6px] font-mono text-muted-foreground/25 self-center">LIVE OUT</span>
        {currentValues.map(v => (
          <div key={v.channel} className="flex items-center gap-1">
            <div className="w-1.5 h-4 rounded-sm overflow-hidden" style={{ background: 'hsl(220, 10%, 10%)' }}>
              <div className="w-full transition-all" style={{
                height: `${(v.value / 255) * 100}%`,
                backgroundColor: v.color,
                marginTop: `${100 - (v.value / 255) * 100}%`,
              }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[5px] font-mono text-muted-foreground/40">{v.label}</span>
              <span className="text-[7px] font-mono font-bold" style={{ color: v.color }}>{v.value}</span>
            </div>
          </div>
        ))}
        <div className="flex-1" />
        <span className="text-[7px] font-mono text-muted-foreground/30 self-center">
          T: {currentTime.toFixed(1)}s · {(playheadTime * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
