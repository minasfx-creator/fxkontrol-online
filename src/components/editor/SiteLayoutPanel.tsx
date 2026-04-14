import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Map, Plus, Trash2, Move, RotateCw, Eye, EyeOff, Lock, Unlock, Ruler, Users, Shield, Zap, Target, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

interface SiteZone {
  id: string;
  label: string;
  type: 'audience' | 'pyro' | 'drone-launch' | 'safety-perimeter' | 'backstage' | 'vip' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  visible: boolean;
  locked: boolean;
}

const ZONE_PRESETS: { type: SiteZone['type']; label: string; icon: string; color: string }[] = [
  { type: 'audience', label: 'Audience Area', icon: '👥', color: 'hsl(210, 70%, 50%)' },
  { type: 'pyro', label: 'Pyro Zone', icon: '🎆', color: 'hsl(15, 85%, 55%)' },
  { type: 'drone-launch', label: 'Drone Launch', icon: '🚁', color: 'hsl(150, 70%, 45%)' },
  { type: 'safety-perimeter', label: 'Safety Perimeter', icon: '🛡️', color: 'hsl(45, 90%, 55%)' },
  { type: 'backstage', label: 'Backstage', icon: '🎪', color: 'hsl(270, 50%, 50%)' },
  { type: 'vip', label: 'VIP Area', icon: '⭐', color: 'hsl(50, 80%, 50%)' },
  { type: 'custom', label: 'Custom Zone', icon: '📐', color: 'hsl(0, 0%, 60%)' },
];

const GRID_SIZE = 5; // meters per grid cell
const CANVAS_SCALE = 4; // pixels per meter

export default function SiteLayoutPanel({ onClose }: { onClose: () => void }) {
  const positions = useProjectStore(s => s.positions);
  const [zones, setZones] = useState<SiteZone[]>([
    { id: 'z-safety-1', label: 'Safety Perimeter', type: 'safety-perimeter', x: 0, y: 0, width: 160, height: 160, rotation: 0, color: 'hsl(45, 90%, 55%)', visible: true, locked: false },
    { id: 'z-audience-1', label: 'Audience', type: 'audience', x: 0, y: 50, width: 100, height: 40, rotation: 0, color: 'hsl(210, 70%, 50%)', visible: true, locked: false },
  ]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [showDistances, setShowDistances] = useState(true);
  const [dragState, setDragState] = useState<{ zoneId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const addZone = (type: SiteZone['type']) => {
    const preset = ZONE_PRESETS.find(p => p.type === type)!;
    const z: SiteZone = {
      id: `z-${Date.now()}`,
      label: preset.label,
      type,
      x: 0, y: 0,
      width: type === 'safety-perimeter' ? 120 : 40,
      height: type === 'safety-perimeter' ? 120 : 30,
      rotation: 0,
      color: preset.color,
      visible: true,
      locked: false,
    };
    setZones(prev => [...prev, z]);
    setSelectedZoneId(z.id);
  };

  const updateZone = (id: string, patch: Partial<SiteZone>) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));
  };

  const deleteZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || zone.locked) return;
    e.stopPropagation();
    setSelectedZoneId(zoneId);
    setDragState({ zoneId, startX: e.clientX, startY: e.clientY, origX: zone.x, origY: zone.y });
  }, [zones]);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / CANVAS_SCALE;
      const dy = (e.clientY - dragState.startY) / CANVAS_SCALE;
      updateZone(dragState.zoneId, {
        x: Math.round((dragState.origX + dx) / GRID_SIZE) * GRID_SIZE,
        y: Math.round((dragState.origY + dy) / GRID_SIZE) * GRID_SIZE,
      });
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragState]);

  // Compute min distance from pyro zones to audience zones
  const safetyDistances = useMemo(() => {
    const pyroZones = zones.filter(z => z.type === 'pyro' && z.visible);
    const audienceZones = zones.filter(z => z.type === 'audience' && z.visible);
    const results: { from: string; to: string; dist: number }[] = [];
    for (const p of pyroZones) {
      for (const a of audienceZones) {
        const dx = Math.abs(p.x - a.x) - (p.width + a.width) / 2;
        const dy = Math.abs(p.y - a.y) - (p.height + a.height) / 2;
        const dist = Math.max(0, Math.sqrt(Math.max(0, dx) ** 2 + Math.max(0, dy) ** 2));
        results.push({ from: p.label, to: a.label, dist });
      }
    }
    return results;
  }, [zones]);

  const canvasCenter = 200; // half of 400px canvas

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Map className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Site Layout</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1.5 border-b border-border/50 flex items-center gap-1 flex-wrap">
        {ZONE_PRESETS.map(p => (
          <button
            key={p.type}
            onClick={() => addZone(p.type)}
            className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
            title={`Add ${p.label}`}
          >
            {p.icon}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="h-2.5 w-2.5 accent-primary" />
            Grid
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showPositions} onChange={e => setShowPositions(e.target.checked)} className="h-2.5 w-2.5 accent-primary" />
            Pos
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showDistances} onChange={e => setShowDistances(e.target.checked)} className="h-2.5 w-2.5 accent-primary" />
            Dist
          </label>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-2">
        <div
          ref={canvasRef}
          className="relative mx-auto bg-surface-0 rounded border border-border overflow-hidden"
          style={{ width: 400, height: 400 }}
          onClick={() => setSelectedZoneId(null)}
        >
          {/* Grid */}
          {showGrid && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
              {Array.from({ length: Math.floor(400 / (GRID_SIZE * CANVAS_SCALE)) + 1 }).map((_, i) => {
                const px = i * GRID_SIZE * CANVAS_SCALE;
                return (
                  <g key={i}>
                    <line x1={px} y1={0} x2={px} y2={400} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground" />
                    <line x1={0} y1={px} x2={400} y2={px} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground" />
                  </g>
                );
              })}
              {/* Center crosshair */}
              <line x1={canvasCenter - 8} y1={canvasCenter} x2={canvasCenter + 8} y2={canvasCenter} stroke="currentColor" strokeWidth={1} className="text-primary" opacity={0.5} />
              <line x1={canvasCenter} y1={canvasCenter - 8} x2={canvasCenter} y2={canvasCenter + 8} stroke="currentColor" strokeWidth={1} className="text-primary" opacity={0.5} />
            </svg>
          )}

          {/* Zones */}
          {zones.filter(z => z.visible).map(zone => {
            const px = canvasCenter + zone.x * CANVAS_SCALE - (zone.width * CANVAS_SCALE) / 2;
            const py = canvasCenter + zone.y * CANVAS_SCALE - (zone.height * CANVAS_SCALE) / 2;
            const isSelected = zone.id === selectedZoneId;
            const isDashed = zone.type === 'safety-perimeter';

            return (
              <div
                key={zone.id}
                className={cn(
                  "absolute cursor-move transition-shadow",
                  isSelected && "ring-2 ring-primary shadow-lg",
                  zone.locked && "cursor-not-allowed opacity-60"
                )}
                style={{
                  left: px, top: py,
                  width: zone.width * CANVAS_SCALE,
                  height: zone.height * CANVAS_SCALE,
                  backgroundColor: `${zone.color}20`,
                  border: `${isDashed ? '2px dashed' : '1.5px solid'} ${zone.color}80`,
                  borderRadius: zone.type === 'safety-perimeter' ? 8 : 4,
                  transform: `rotate(${zone.rotation}deg)`,
                }}
                onMouseDown={e => handleMouseDown(e, zone.id)}
              >
                <div className="absolute top-0.5 left-1 text-[8px] font-semibold truncate" style={{ color: zone.color }}>
                  {ZONE_PRESETS.find(p => p.type === zone.type)?.icon} {zone.label}
                </div>
                {isSelected && !zone.locked && (
                  <div
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary rounded-full cursor-se-resize border border-background"
                    onMouseDown={e => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const origW = zone.width;
                      const origH = zone.height;
                      const move = (me: MouseEvent) => {
                        const dw = (me.clientX - startX) / CANVAS_SCALE;
                        const dh = (me.clientY - startY) / CANVAS_SCALE;
                        updateZone(zone.id, {
                          width: Math.max(10, Math.round((origW + dw) / GRID_SIZE) * GRID_SIZE),
                          height: Math.max(10, Math.round((origH + dh) / GRID_SIZE) * GRID_SIZE),
                        });
                      };
                      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', move);
                      window.addEventListener('mouseup', up);
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Positions from project */}
          {showPositions && positions.map(pos => {
            const px = canvasCenter + pos.x * CANVAS_SCALE;
            const py = canvasCenter + pos.z * CANVAS_SCALE;
            const isPyro = pos.type === 'pyro';
            return (
              <div
                key={pos.id}
                className="absolute w-2.5 h-2.5 rounded-full border border-background/50 pointer-events-none"
                style={{
                  left: px - 5, top: py - 5,
                  backgroundColor: isPyro ? 'hsl(15, 85%, 55%)' : 'hsl(150, 70%, 45%)',
                }}
                title={`${pos.name} (${pos.type})`}
              />
            );
          })}

          {/* Scale bar */}
          <div className="absolute bottom-1 right-1 flex items-center gap-1 text-[7px] text-muted-foreground font-mono">
            <div className="border-b border-muted-foreground" style={{ width: GRID_SIZE * CANVAS_SCALE }} />
            {GRID_SIZE}m
          </div>
        </div>
      </div>

      {/* Safety distances */}
      {showDistances && safetyDistances.length > 0 && (
        <div className="px-2 py-1.5 border-t border-border/50 space-y-0.5">
          <span className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Safety Distances</span>
          {safetyDistances.map((sd, i) => (
            <div key={i} className={cn(
              "flex items-center gap-1.5 text-[9px] px-1.5 py-0.5 rounded",
              sd.dist < 30 ? "bg-destructive/10 text-destructive" :
              sd.dist < 60 ? "bg-yellow-500/10 text-yellow-400" :
              "bg-green-500/10 text-green-400"
            )}>
              <Ruler className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate flex-1">{sd.from} → {sd.to}</span>
              <span className="font-bold font-mono">{sd.dist.toFixed(0)}m</span>
            </div>
          ))}
        </div>
      )}

      {/* Zone properties */}
      {selectedZone && (
        <div className="px-2 py-2 border-t border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-foreground flex-1 uppercase tracking-wider">Zone Properties</span>
            <button onClick={() => updateZone(selectedZone.id, { locked: !selectedZone.locked })} className="text-muted-foreground hover:text-foreground">
              {selectedZone.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
            <button onClick={() => updateZone(selectedZone.id, { visible: !selectedZone.visible })} className="text-muted-foreground hover:text-foreground">
              {selectedZone.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
            <button onClick={() => deleteZone(selectedZone.id)} className="text-destructive/60 hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <Input
            value={selectedZone.label}
            onChange={e => updateZone(selectedZone.id, { label: e.target.value })}
            className="h-6 text-[10px] bg-surface-0 border-border"
          />
          <div className="grid grid-cols-4 gap-1">
            {[
              { k: 'x', l: 'X' }, { k: 'y', l: 'Y' }, { k: 'width', l: 'W' }, { k: 'height', l: 'H' },
            ].map(({ k, l }) => (
              <div key={k}>
                <label className="text-[7px] text-muted-foreground uppercase">{l}</label>
                <Input
                  type="number" step={GRID_SIZE}
                  value={(selectedZone as any)[k]}
                  onChange={e => updateZone(selectedZone.id, { [k]: parseFloat(e.target.value) || 0 })}
                  className="h-5 text-[9px] font-mono bg-surface-0 border-border px-1"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[7px] text-muted-foreground uppercase">Rotation°</label>
              <Input
                type="number" step={5}
                value={selectedZone.rotation}
                onChange={e => updateZone(selectedZone.id, { rotation: parseFloat(e.target.value) || 0 })}
                className="h-5 text-[9px] font-mono bg-surface-0 border-border px-1"
              />
            </div>
            <div>
              <label className="text-[7px] text-muted-foreground uppercase">Color</label>
              <input
                type="color"
                value={selectedZone.color}
                onChange={e => updateZone(selectedZone.id, { color: e.target.value })}
                className="h-5 w-full rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Zone list */}
      <div className="px-2 py-1.5 border-t border-border/50 max-h-28 overflow-auto space-y-0.5">
        {zones.map(z => (
          <div
            key={z.id}
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-colors",
              z.id === selectedZoneId ? "bg-primary/15 text-foreground" : "hover:bg-surface-2 text-muted-foreground"
            )}
            onClick={() => setSelectedZoneId(z.id)}
          >
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: z.color }} />
            <span className="flex-1 truncate">{z.label}</span>
            <span className="text-[8px] text-muted-foreground/50">{z.width}×{z.height}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}
