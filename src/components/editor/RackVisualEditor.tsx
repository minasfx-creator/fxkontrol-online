import { useState, useCallback, useRef } from 'react';
import { useRackStore, RACK_TYPE_INFO, type Rack, type RackTube } from '@/store/useRackStore';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCw, Trash2, Copy, Lock, Unlock, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Status colors
const STATUS_COLORS: Record<RackTube['status'], { fill: string; stroke: string }> = {
  empty: { fill: 'hsl(240 4% 18%)', stroke: 'hsl(240 4% 30%)' },
  loaded: { fill: 'hsl(207 90% 40%)', stroke: 'hsl(207 100% 55%)' },
  fired: { fill: 'hsl(24 90% 35%)', stroke: 'hsl(24 95% 50%)' },
  dud: { fill: 'hsl(0 70% 35%)', stroke: 'hsl(0 80% 50%)' },
};

const CALIBER_RADIUS: Record<number, number> = {
  1: 6, 2: 8, 3: 10, 4: 13, 5: 16, 6: 19, 8: 24, 10: 28, 12: 32,
};

function getTubeRadius(caliber: number) {
  return CALIBER_RADIUS[caliber] || Math.max(6, caliber * 3);
}

interface TubePosition {
  tube: RackTube;
  x: number;
  y: number;
}

function computeTubePositions(rack: Rack, width: number, height: number): TubePosition[] {
  const cx = width / 2;
  const cy = height / 2;
  const tubes = rack.tubes;

  if (rack.type === 'circle') {
    const radius = Math.min(width, height) * 0.35;
    return tubes.map((tube, i) => {
      const angle = ((360 / tubes.length) * i - 90) * Math.PI / 180;
      return { tube, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  }

  if (rack.type === 'fan') {
    const startAngle = (rack.fanAngleStart ?? -45) * Math.PI / 180;
    const endAngle = (rack.fanAngleEnd ?? 45) * Math.PI / 180;
    const radius = Math.min(width, height) * 0.38;
    const originY = height * 0.85;

    return tubes.map((tube, i) => {
      const t = tubes.length > 1 ? i / (tubes.length - 1) : 0.5;
      const angle = startAngle + (endAngle - startAngle) * t - Math.PI / 2;
      return { tube, x: cx + Math.cos(angle) * radius, y: originY + Math.sin(angle) * radius };
    });
  }

  // Grid layout for all others
  const rows = rack.rows || 1;
  const cols = rack.cols || tubes.length;
  const padX = 30;
  const padY = 30;
  const spacingX = cols > 1 ? (width - padX * 2) / (cols - 1) : 0;
  const spacingY = rows > 1 ? (height - padY * 2) / (rows - 1) : 0;
  const startX = cols > 1 ? padX : cx;
  const startY = rows > 1 ? padY : cy;

  return tubes.map((tube) => ({
    tube,
    x: startX + tube.col * spacingX,
    y: startY + tube.row * spacingY,
  }));
}

export default function RackVisualEditor({ rackId }: { rackId: string }) {
  const rack = useRackStore(s => s.racks.find(r => r.id === rackId));
  const { updateTube, updateRack, selectTube, selectedTubeId, duplicateRack, removeRack, clearAllEffects, setAllTubesCaliber, setAllTubesAngle } = useRackStore();
  const [hoveredTube, setHoveredTube] = useState<string | null>(null);
  const [bulkCaliber, setBulkCaliber] = useState(3);
  const [bulkAngle, setBulkAngle] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!rack) return null;

  const W = 360;
  const H = 280;
  const positions = computeTubePositions(rack, W, H);
  const selectedTube = rack.tubes.find(t => t.id === selectedTubeId);

  const handleTubeClick = (tubeId: string) => {
    selectTube(selectedTubeId === tubeId ? null : tubeId);
  };

  const cycleStatus = (tubeId: string) => {
    const tube = rack.tubes.find(t => t.id === tubeId);
    if (!tube) return;
    const order: RackTube['status'][] = ['empty', 'loaded', 'fired', 'dud'];
    const next = order[(order.indexOf(tube.status) + 1) % order.length];
    updateTube(rack.id, tubeId, { status: next });
  };

  const stats = {
    total: rack.tubes.length,
    loaded: rack.tubes.filter(t => t.status === 'loaded').length,
    fired: rack.tubes.filter(t => t.status === 'fired').length,
    duds: rack.tubes.filter(t => t.status === 'dud').length,
    assigned: rack.tubes.filter(t => !!t.effectId).length,
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm">{RACK_TYPE_INFO[rack.type].icon}</span>
        <Input
          value={rack.name}
          onChange={e => updateRack(rack.id, { name: e.target.value })}
          className="h-6 text-[10px] font-bold bg-transparent border-none flex-1 px-1"
        />
        <div className="flex gap-0.5">
          <button onClick={() => duplicateRack(rack.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={() => updateRack(rack.id, { locked: !rack.locked })} className="p-1 text-muted-foreground hover:text-foreground" title="Lock">
            {rack.locked ? <Lock className="h-3 w-3 text-primary" /> : <Unlock className="h-3 w-3" />}
          </button>
          <button onClick={() => { removeRack(rack.id); toast.info('Rack removido'); }} className="p-1 text-destructive/50 hover:text-destructive" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Visual SVG Editor */}
      <div className="bg-background/50 rounded border border-border/30 overflow-hidden">
        <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block">
          {/* Background grid */}
          <defs>
            <pattern id="rackGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(240 4% 12%)" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#rackGrid)" />

          {/* Rack outline */}
          <rect x={8} y={8} width={W - 16} height={H - 16} rx={6} fill="none" stroke={rack.color} strokeWidth={1.5} opacity={0.3} strokeDasharray="4 2" />

          {/* Fan arc guide */}
          {rack.type === 'fan' && (
            <path
              d={(() => {
                const startA = (rack.fanAngleStart ?? -45) - 90;
                const endA = (rack.fanAngleEnd ?? 45) - 90;
                const r = Math.min(W, H) * 0.38;
                const ox = W / 2;
                const oy = H * 0.85;
                const x1 = ox + Math.cos(startA * Math.PI / 180) * r;
                const y1 = oy + Math.sin(startA * Math.PI / 180) * r;
                const x2 = ox + Math.cos(endA * Math.PI / 180) * r;
                const y2 = oy + Math.sin(endA * Math.PI / 180) * r;
                return `M ${ox} ${oy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
              })()}
              fill={rack.color}
              opacity={0.05}
              stroke={rack.color}
              strokeWidth={0.5}
            />
          )}

          {/* Tubes */}
          {positions.map(({ tube, x, y }) => {
            const r = getTubeRadius(tube.caliber);
            const isSelected = selectedTubeId === tube.id;
            const isHovered = hoveredTube === tube.id;
            const colors = STATUS_COLORS[tube.status];
            const hasEffect = !!tube.effectId;

            return (
              <g
                key={tube.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleTubeClick(tube.id)}
                onDoubleClick={() => cycleStatus(tube.id)}
                onMouseEnter={() => setHoveredTube(tube.id)}
                onMouseLeave={() => setHoveredTube(null)}
              >
                {/* Selection ring */}
                {(isSelected || isHovered) && (
                  <circle cx={x} cy={y} r={r + 4} fill="none" stroke={isSelected ? 'hsl(207 100% 60%)' : 'hsl(240 5% 50%)'} strokeWidth={1.5} strokeDasharray={isSelected ? 'none' : '2 2'} />
                )}

                {/* Tube body */}
                <circle
                  cx={x} cy={y} r={r}
                  fill={hasEffect ? 'hsl(207 80% 35%)' : colors.fill}
                  stroke={hasEffect ? 'hsl(207 100% 55%)' : colors.stroke}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Inner circle for depth */}
                <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={0.5} />

                {/* Tilt indicator arrow */}
                {tube.angle > 0 && (
                  <line
                    x1={x} y1={y}
                    x2={x + Math.sin(tube.heading * Math.PI / 180) * (r + 6)}
                    y2={y - Math.cos(tube.heading * Math.PI / 180) * (r + 6)}
                    stroke="hsl(24 95% 53%)"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowHead)"
                  />
                )}

                {/* Caliber text */}
                <text x={x} y={y - 1} textAnchor="middle" dominantBaseline="middle" fill="hsl(0 0% 93%)" fontSize={r > 12 ? 9 : 7} fontFamily="monospace" fontWeight="bold">
                  {tube.caliber}"
                </text>

                {/* Label */}
                <text x={x} y={y + r + 8} textAnchor="middle" fill="hsl(240 5% 45%)" fontSize={6} fontFamily="monospace">
                  {tube.label}
                </text>

                {/* Status dot */}
                {tube.status !== 'empty' && (
                  <circle cx={x + r - 2} cy={y - r + 2} r={3} fill={
                    tube.status === 'loaded' ? 'hsl(142 71% 45%)' :
                    tube.status === 'fired' ? 'hsl(24 95% 53%)' : 'hsl(0 84% 60%)'
                  } stroke="hsl(0 0% 0%)" strokeWidth={0.5} />
                )}
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrowHead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="hsl(24 95% 53%)" />
            </marker>
          </defs>

          {/* Type label */}
          <text x={W / 2} y={H - 6} textAnchor="middle" fill="hsl(240 5% 40%)" fontSize={8} fontFamily="monospace">
            {RACK_TYPE_INFO[rack.type].label} • {rack.rows}×{rack.cols} • {rack.tubes.length} tubes
          </text>
        </svg>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 px-1 text-[8px] font-mono">
        <span className="text-muted-foreground">Total: <span className="text-foreground">{stats.total}</span></span>
        <span className="text-primary">Loaded: {stats.loaded}</span>
        <span className="text-orange-400">Fired: {stats.fired}</span>
        {stats.duds > 0 && <span className="text-destructive">Duds: {stats.duds}</span>}
        <span className="text-muted-foreground">Assigned: {stats.assigned}</span>
      </div>

      {/* Selected tube editor */}
      {selectedTube && (
        <div className="border border-primary/20 rounded bg-primary/5 p-2 space-y-2">
          <div className="text-[9px] font-bold text-primary">Tube {selectedTube.label}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-muted-foreground">Caliber (in)</label>
              <Input
                type="number" min={1} max={12} value={selectedTube.caliber}
                onChange={e => updateTube(rack.id, selectedTube.id, { caliber: parseInt(e.target.value) || 3 })}
                className="h-5 text-[9px]"
              />
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground">Status</label>
              <select
                value={selectedTube.status}
                onChange={e => updateTube(rack.id, selectedTube.id, { status: e.target.value as RackTube['status'] })}
                className="w-full h-5 text-[9px] bg-background border border-border rounded px-1"
              >
                <option value="empty">Empty</option>
                <option value="loaded">Loaded</option>
                <option value="fired">Fired</option>
                <option value="dud">Dud</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[8px] text-muted-foreground">Tilt Angle: {selectedTube.angle}°</label>
            <Slider
              value={[selectedTube.angle]}
              onValueChange={([v]) => updateTube(rack.id, selectedTube.id, { angle: v })}
              min={0} max={75} step={1}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[8px] text-muted-foreground">Heading: {selectedTube.heading.toFixed(0)}°</label>
            <Slider
              value={[selectedTube.heading]}
              onValueChange={([v]) => updateTube(rack.id, selectedTube.id, { heading: v })}
              min={-180} max={180} step={1}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Bulk actions */}
      <div className="space-y-1.5 px-1">
        <div className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Bulk Actions</div>
        <div className="flex gap-1 items-center">
          <Input type="number" min={1} max={12} value={bulkCaliber}
            onChange={e => setBulkCaliber(parseInt(e.target.value) || 3)}
            className="h-5 text-[9px] w-12"
          />
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={() => setAllTubesCaliber(rack.id, bulkCaliber)}>
            Set All Calibers
          </Button>
        </div>
        <div className="flex gap-1 items-center">
          <Input type="number" min={0} max={75} value={bulkAngle}
            onChange={e => setBulkAngle(parseInt(e.target.value) || 0)}
            className="h-5 text-[9px] w-12"
          />
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={() => setAllTubesAngle(rack.id, bulkAngle)}>
            Set All Angles
          </Button>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1 gap-1" onClick={() => clearAllEffects(rack.id)}>
            <Zap className="h-2.5 w-2.5" /> Clear Effects
          </Button>
          <Button size="sm" variant="outline" className="h-5 text-[8px] gap-1" onClick={() => updateRack(rack.id, { rotation: (rack.rotation + 45) % 360 })}>
            <RotateCw className="h-2.5 w-2.5" /> {rack.rotation}°
          </Button>
        </div>
      </div>
    </div>
  );
}
