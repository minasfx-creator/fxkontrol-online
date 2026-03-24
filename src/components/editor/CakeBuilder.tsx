/**
 * CakeBuilder — Professional Cake/Battery pattern generator
 * Generates individual timeline cues from cake parameters using 3D vector math.
 * Patterns: Straight, Fan, V-Shape, W-Shape, Z-Sweep, Fan-Sweep
 */
import { useState, useMemo, useCallback } from 'react';
import { useProjectStore, EFFECT_LIBRARY, type TimelineItem } from '@/store/useProjectStore';
import * as THREE from 'three';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Cake, ChevronDown, ChevronUp, Sparkles, Plus, Type } from 'lucide-react';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';

export type CakePattern = 'straight' | 'fan' | 'v-shape' | 'w-shape' | 'z-sweep' | 'fan-sweep';

interface CakeConfig {
  name: string;
  caliber: number;
  shotCount: number;
  durationMs: number;
  pattern: CakePattern;
  maxAngle: number; // degrees
  effectId: string;
  positionId: string | null;
}

const PATTERNS: { id: CakePattern; label: string; desc: string }[] = [
  { id: 'straight', label: 'Straight', desc: 'Todos os tiros verticais' },
  { id: 'fan', label: 'Fan', desc: 'Leque simétrico' },
  { id: 'v-shape', label: 'V-Shape', desc: 'Formato V aberto' },
  { id: 'w-shape', label: 'W-Shape', desc: 'Formato W ondulado' },
  { id: 'z-sweep', label: 'Z-Sweep', desc: 'Varredura sequencial Z' },
  { id: 'fan-sweep', label: 'Fan-Sweep', desc: 'Leque com varredura temporal' },
];

const CALIBERS = [1, 1.5, 2, 2.5, 3, 4, 5];

/**
 * Core vector math: compute per-shot angle offsets based on pattern.
 * Returns array of { heading, pitch, delay } for each shot.
 */
function computeCakeShots(
  shotCount: number,
  pattern: CakePattern,
  maxAngle: number,
  durationMs: number,
): { heading: number; pitch: number; delay: number }[] {
  const shots: { heading: number; pitch: number; delay: number }[] = [];
  const halfAngle = maxAngle / 2;
  const interval = shotCount > 1 ? durationMs / (shotCount - 1) : 0;

  for (let i = 0; i < shotCount; i++) {
    const t = shotCount > 1 ? i / (shotCount - 1) : 0.5; // 0..1
    let heading = 0;
    let pitch = 0;
    let delay = 0;

    switch (pattern) {
      case 'straight':
        heading = 0;
        pitch = 0;
        delay = i * interval;
        break;

      case 'fan':
        // All fire simultaneously, spread evenly across angle
        heading = -halfAngle + t * maxAngle;
        pitch = 0;
        delay = 0;
        break;

      case 'v-shape': {
        // V pattern: center shots go outward
        const half = Math.floor(shotCount / 2);
        if (i < half) {
          heading = -halfAngle + (i / Math.max(half - 1, 1)) * halfAngle;
        } else {
          heading = (i - half) / Math.max(shotCount - half - 1, 1) * halfAngle;
        }
        pitch = 0;
        delay = 0;
        break;
      }

      case 'w-shape': {
        // W pattern: sinusoidal angle distribution
        const phase = (i / (shotCount - 1)) * Math.PI * 2;
        heading = Math.sin(phase) * halfAngle;
        pitch = 0;
        delay = 0;
        break;
      }

      case 'z-sweep':
        // Sequential with linear angle interpolation
        heading = -halfAngle + t * maxAngle;
        pitch = 0;
        delay = i * interval;
        break;

      case 'fan-sweep':
        // Fan with sequential timing
        heading = -halfAngle + t * maxAngle;
        pitch = 0;
        delay = i * interval;
        break;
    }

    shots.push({ heading, pitch, delay });
  }

  return shots;
}

/**
 * Generate timeline cues from cake config.
 * Uses THREE.Vector3.applyAxisAngle for accurate 3D rotation.
 */
function generateCakeCues(
  config: CakeConfig,
  baseTime: number,
  basePosition: { x: number; y: number; z: number },
): TimelineItem[] {
  const shots = computeCakeShots(config.shotCount, config.pattern, config.maxAngle, config.durationMs);
  const cues: TimelineItem[] = [];

  // Verify launch direction using THREE quaternion math
  const upAxis = new THREE.Vector3(0, 1, 0);
  const rightAxis = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];

    // Apply heading rotation around Y axis, pitch around X axis
    const launchDir = new THREE.Vector3(0, 1, 0);
    launchDir.applyAxisAngle(rightAxis, THREE.MathUtils.degToRad(shot.pitch));
    launchDir.applyAxisAngle(upAxis, THREE.MathUtils.degToRad(shot.heading));

    const cueId = `cake-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;

    cues.push({
      id: cueId,
      effectId: config.effectId,
      startTime: baseTime + shot.delay / 1000,
      trackIndex: 0,
      position: { ...basePosition },
      positionId: config.positionId || undefined,
      cueHeading: shot.heading,
      cuePitch: shot.pitch,
      notes: `${config.name} shot ${i + 1}/${config.shotCount} [${config.pattern}]`,
    });
  }

  return cues;
}

export default function CakeBuilder() {
  const currentTime = useProjectStore(s => s.currentTime);
  const positions = useProjectStore(s => s.positions);
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);

  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<CakeConfig>({
    name: 'Custom Cake',
    caliber: 2,
    shotCount: 25,
    durationMs: 5000,
    pattern: 'z-sweep',
    maxAngle: 45,
    effectId: 'cake-01',
    positionId: null,
  });

  // Get pyro effects for selector
  const pyroEffects = useMemo(() =>
    EFFECT_LIBRARY.filter(e => e.type === 'firework' && (e.partType === 'shell' || e.partType === 'cake')),
    []
  );

  const selectedEffect = useMemo(() =>
    EFFECT_LIBRARY.find(e => e.id === config.effectId),
    [config.effectId]
  );

  const selectedPosition = useMemo(() =>
    positions.find(p => p.id === (config.positionId || selectedPositionId)),
    [positions, config.positionId, selectedPositionId]
  );

  // Preview shot angles
  const previewShots = useMemo(() =>
    computeCakeShots(config.shotCount, config.pattern, config.maxAngle, config.durationMs),
    [config.shotCount, config.pattern, config.maxAngle, config.durationMs]
  );

  const handleGenerate = useCallback(() => {
    const pos = selectedPosition || { x: 0, y: 0, z: 0 };
    const basePos = selectedPosition
      ? { x: pos.x, y: (pos as any).y ?? 0, z: (pos as any).z ?? 0 }
      : { x: 0, y: 0, z: 0 };

    const cues = generateCakeCues(config, currentTime, basePos);
    cues.forEach(cue => addTimelineItem(cue));

    toast.success(`🎂 ${config.name}: ${cues.length} cues geradas (${config.pattern})`);
  }, [config, currentTime, selectedPosition, addTimelineItem]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-card/80 border border-border/20 text-muted-foreground hover:text-foreground hover:bg-card/90 transition-all text-xs font-medium"
      >
        <Cake className="w-4 h-4 text-primary/70" />
        Cake Builder
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border/25 bg-card/90 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/20 transition-all"
      >
        <Cake className="w-4 h-4 text-primary" />
        Cake Builder
        <ChevronUp className="w-3 h-3 ml-auto" />
      </button>

      <div className="px-3 pb-3 space-y-2.5">
        {/* Name */}
        <input
          value={config.name}
          onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
          className="w-full bg-muted/30 border border-border/20 rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50"
          placeholder="Nome do Cake..."
        />

        {/* Caliber + Shot Count */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Calibre</label>
            <select
              value={config.caliber}
              onChange={e => setConfig(c => ({ ...c, caliber: Number(e.target.value) }))}
              className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground"
            >
              {CALIBERS.map(c => (
                <option key={c} value={c}>{c}"</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Tiros</label>
            <input
              type="number"
              value={config.shotCount}
              onChange={e => setConfig(c => ({ ...c, shotCount: Math.max(1, Number(e.target.value)) }))}
              className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground"
              min={1}
              max={200}
            />
          </div>
        </div>

        {/* Duration + Max Angle */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Duração (ms)</label>
            <input
              type="number"
              value={config.durationMs}
              onChange={e => setConfig(c => ({ ...c, durationMs: Math.max(100, Number(e.target.value)) }))}
              className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground"
              min={100}
              step={100}
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Ângulo Max (°)</label>
            <input
              type="number"
              value={config.maxAngle}
              onChange={e => setConfig(c => ({ ...c, maxAngle: Math.max(0, Math.min(180, Number(e.target.value))) }))}
              className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground"
              min={0}
              max={180}
            />
          </div>
        </div>

        {/* Pattern */}
        <div>
          <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Padrão</label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {PATTERNS.map(p => (
              <button
                key={p.id}
                onClick={() => setConfig(c => ({ ...c, pattern: p.id }))}
                className={cn(
                  "px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border",
                  config.pattern === p.id
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-muted/20 text-muted-foreground border-border/15 hover:bg-muted/40"
                )}
                title={p.desc}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Effect selector */}
        <div>
          <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Efeito Base</label>
          <select
            value={config.effectId}
            onChange={e => setConfig(c => ({ ...c, effectId: e.target.value }))}
            className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground mt-0.5"
          >
            {pyroEffects.map(e => (
              <option key={e.id} value={e.id}>{e.icon} {e.name}</option>
            ))}
          </select>
        </div>

        {/* Position selector */}
        <div>
          <label className="text-[9px] text-muted-foreground/60 font-mono uppercase">Posição</label>
          <select
            value={config.positionId || selectedPositionId || ''}
            onChange={e => setConfig(c => ({ ...c, positionId: e.target.value || null }))}
            className="w-full bg-muted/30 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground mt-0.5"
          >
            <option value="">Origem (0,0,0)</option>
            {positions.filter(p => p.type === 'pyro').map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.x.toFixed(0)}, {p.z.toFixed(0)})</option>
            ))}
          </select>
        </div>

        {/* Preview mini-diagram */}
        <div className="bg-muted/15 rounded-lg p-2 border border-border/10">
          <div className="text-[8px] text-muted-foreground/50 font-mono uppercase mb-1">Preview — {config.shotCount} shots</div>
          <svg viewBox="-60 -5 120 65" className="w-full h-14">
            {/* Ground line */}
            <line x1="-55" y1="60" x2="55" y2="60" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
            {/* Center vertical */}
            <line x1="0" y1="60" x2="0" y2="5" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.2" />
            {/* Shot lines */}
            {previewShots.slice(0, 60).map((shot, i) => {
              const rad = THREE.MathUtils.degToRad(-shot.heading);
              const len = 50;
              const x2 = Math.sin(rad) * len;
              const y2 = 60 - Math.cos(rad) * len;
              const opacity = 0.3 + (shot.delay / Math.max(config.durationMs, 1)) * 0.7;
              return (
                <line
                  key={i}
                  x1="0" y1="60"
                  x2={x2} y2={y2}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.6"
                  opacity={opacity}
                />
              );
            })}
            {/* Origin dot */}
            <circle cx="0" cy="60" r="1.5" fill="hsl(var(--primary))" />
          </svg>
        </div>

        {/* Generate */}
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary font-semibold text-xs transition-all border border-primary/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gerar {config.shotCount} Cues na Timeline
        </button>
      </div>
    </div>
  );
}

export { computeCakeShots, generateCakeCues };
