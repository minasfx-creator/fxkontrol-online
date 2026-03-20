import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { parseVDL, vdlToEffect, getVDLColors, getVDLTypes } from '@/lib/vdlParser';
import { getNiagaraPreset } from '@/lib/niagaraColorPresets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Plus, RotateCcw, Palette, Zap, Wind, Target } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

// ── Mini burst for preview ──
const PREVIEW_STAR_COUNT = 80;
const GRAVITY = -9.8;

function PreviewBurst({ color, secondaryColor, colorTransition, progress, pattern }: {
  color: string; secondaryColor?: string; colorTransition?: string;
  progress: number; pattern: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const secColor = useMemo(() => secondaryColor ? new THREE.Color(secondaryColor) : null, [secondaryColor]);

  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PREVIEW_STAR_COUNT * 3);
    const l = new Float32Array(PREVIEW_STAR_COUNT);
    for (let i = 0; i < PREVIEW_STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3 + Math.random() * 5;
      v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.9 + 0.5;
      v[i * 3 + 2] = Math.cos(phi) * speed;
      l[i] = 0.5 + Math.random() * 0.5;
    }
    return { velocities: v, lifetimes: l };
  }, [pattern]);

  useFrame(() => {
    if (!pointsRef.current || progress <= 0 || progress >= 1) return;
    const geo = pointsRef.current.geometry;
    const pos = new Float32Array(PREVIEW_STAR_COUNT * 3);
    const cols = new Float32Array(PREVIEW_STAR_COUNT * 3);
    const t = progress * 3;

    for (let i = 0; i < PREVIEW_STAR_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const starAge = Math.min(1, progress / lifetimes[i]);
      const fade = Math.max(0, 1 - starAge) ** 2;

      pos[i * 3] = vx * t * 0.5;
      pos[i * 3 + 1] = vy * t * 0.5 + 0.5 * GRAVITY * t * t * 0.08;
      pos[i * 3 + 2] = vz * t * 0.5;

      let cr = baseColor.r, cg = baseColor.g, cb = baseColor.b;
      if (secColor && colorTransition === 'to') {
        cr = THREE.MathUtils.lerp(baseColor.r, secColor.r, starAge);
        cg = THREE.MathUtils.lerp(baseColor.g, secColor.g, starAge);
        cb = THREE.MathUtils.lerp(baseColor.b, secColor.b, starAge);
      } else if (secColor && colorTransition === 'changing') {
        const pp = Math.sin(starAge * Math.PI);
        cr = THREE.MathUtils.lerp(baseColor.r, secColor.r, pp);
        cg = THREE.MathUtils.lerp(baseColor.g, secColor.g, pp);
        cb = THREE.MathUtils.lerp(baseColor.b, secColor.b, pp);
      } else if (secColor && colorTransition === 'alternating' && i % 2 === 1) {
        cr = secColor.r; cg = secColor.g; cb = secColor.b;
      }

      cols[i * 3] = cr * fade;
      cols[i * 3 + 1] = cg * fade;
      cols[i * 3 + 2] = cb * fade;
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) { (posAttr.array as Float32Array).set(pos); posAttr.needsUpdate = true; }
    if (colAttr) { (colAttr.array as Float32Array).set(cols); colAttr.needsUpdate = true; }
  });

  if (progress <= 0 || progress >= 1) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(PREVIEW_STAR_COUNT * 3), 3]} />
        <bufferAttribute attach="attributes-color" args={[new Float32Array(PREVIEW_STAR_COUNT * 3), 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.2} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function PreviewScene({ vdlText }: { vdlText: string }) {
  const [progress, setProgress] = useState(0);
  const parsed = useMemo(() => parseVDL(vdlText), [vdlText]);

  useFrame((_, delta) => {
    setProgress(p => {
      const next = p + delta * 0.4;
      return next > 1.2 ? 0 : next;
    });
  });

  if (!parsed.valid) return null;

  return (
    <PreviewBurst
      color={parsed.colors[0] || '#FFD700'}
      secondaryColor={parsed.colors[1]}
      colorTransition={parsed.colorTransition}
      progress={Math.min(1, Math.max(0, progress))}
      pattern={parsed.type}
    />
  );
}

const QUICK_PRESETS = [
  '4in Red Peony',
  '6in Gold Kamuro',
  '3in Blue Chrysanthemum',
  '5in Red To Blue Willow',
  '4in Silver Brocade Crown',
  '3in Green & Pink Dahlia',
  '8in Gold Palm w/ Red Pistil',
  '200mm Purple Crossette Very Big',
];

export default function VDLPreviewPanel() {
  const [vdlText, setVdlText] = useState('4in Red Peony');
  const parsed = useMemo(() => parseVDL(vdlText), [vdlText]);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);

  const handleAddToTimeline = useCallback(() => {
    if (!parsed.valid) {
      toast.error('VDL inválido — verifique a descrição');
      return;
    }
    const effect = vdlToEffect(parsed);
    // Add as timeline item with the VDL effect embedded as effectId
    const item = {
      id: `vdl-tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: effect.id,
      startTime: 0,
      trackIndex: 0,
      position: { x: 0, y: 0, z: 0 } as { x: number; y: number; z: number },
    };
    addTimelineItem(item);
    toast.success(`Efeito adicionado: ${effect.name}`);
  }, [parsed, addTimelineItem]);

  const niagaraPreset = parsed.niagaraPreset ? getNiagaraPreset(parsed.niagaraPreset) : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold tracking-wide text-foreground">SuperVDL Preview</span>
        {parsed.valid && (
          <Badge variant="outline" className="ml-auto text-[9px] border-primary/30 text-primary">
            VALID
          </Badge>
        )}
        {!parsed.valid && vdlText.trim() && (
          <Badge variant="destructive" className="ml-auto text-[9px]">
            INVALID
          </Badge>
        )}
      </div>

      {/* 3D Preview */}
      <div className="h-40 bg-black/90 border-b border-border relative">
        <Canvas
          camera={{ position: [0, 2, 12], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.1} />
          <PreviewScene vdlText={vdlText} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
        {!parsed.valid && vdlText.trim() && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[10px] text-destructive/70 font-mono">Nenhum efeito reconhecido</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* VDL Input */}
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1 block">
              Descrição VDL
            </label>
            <Textarea
              value={vdlText}
              onChange={e => setVdlText(e.target.value)}
              placeholder="Ex: 4in Red Peony w/ Gold Pistil"
              className="text-xs font-mono min-h-[60px] bg-muted/20 border-border/50 resize-none"
              rows={2}
            />
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">
              Presets Rápidos
            </label>
            <div className="flex flex-wrap gap-1">
              {QUICK_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => setVdlText(preset)}
                  className="px-1.5 py-0.5 text-[9px] rounded bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors border border-border/30"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Badges */}
          {parsed.valid && (
            <div>
              <label className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">
                Parâmetros Detectados
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[9px] gap-1">
                  <Target className="h-2.5 w-2.5" />
                  {parsed.caliber}" ({parsed.caliberMM}mm)
                </Badge>
                <Badge variant="outline" className="text-[9px] gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  {parsed.typeName}
                </Badge>
                {parsed.colorNames.map((cn, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: parsed.colors[i] }} />
                    {cn}
                  </Badge>
                ))}
                {parsed.trailType !== 'none' && (
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <Wind className="h-2.5 w-2.5" />
                    trail: {parsed.trailType}
                  </Badge>
                )}
                {parsed.angleOffset !== 0 && (
                  <Badge variant="outline" className="text-[9px]">
                    {parsed.angleOffset > 0 ? `R${parsed.angleOffset}°` : `L${Math.abs(parsed.angleOffset)}°`}
                  </Badge>
                )}
                {parsed.colorTransition !== 'none' && (
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <Palette className="h-2.5 w-2.5" />
                    {parsed.colorTransition}
                  </Badge>
                )}
                {parsed.hasPistil && (
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: parsed.pistilColor }} />
                    pistil
                  </Badge>
                )}
                {parsed.firingPattern && (
                  <Badge variant="outline" className="text-[9px]">
                    pattern: {parsed.firingPattern}
                  </Badge>
                )}
                {parsed.shotCount > 0 && (
                  <Badge variant="outline" className="text-[9px]">
                    {parsed.shotCount} shots
                  </Badge>
                )}
                {parsed.adjustments.length > 0 && parsed.adjustments.map((adj, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px]">
                    {adj}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Niagara Profile */}
          {niagaraPreset && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold text-primary">Niagara Profile</span>
                <Badge variant="outline" className="text-[8px] ml-auto border-primary/30 text-primary">
                  {niagaraPreset.id}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground">
                <span>Stars: <b className="text-foreground">{niagaraPreset.particleProfile.starCount}</b></span>
                <span>Life: <b className="text-foreground">{niagaraPreset.particleProfile.lifetime}s</b></span>
                <span>Vel: <b className="text-foreground">{niagaraPreset.particleProfile.velocity}</b></span>
                <span>Drag: <b className="text-foreground">{niagaraPreset.particleProfile.drag}</b></span>
                <span>Grav: <b className="text-foreground">{niagaraPreset.particleProfile.gravityScale}x</b></span>
                <span>Glow: <b className="text-foreground">{niagaraPreset.shaderUniforms.uGlowIntensity}</b></span>
              </div>
              {/* Color gradient preview */}
              <div className="mt-1.5 flex gap-0.5 h-2 rounded overflow-hidden">
                {niagaraPreset.gradient.map((g, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: g }} />
                ))}
              </div>
              <span className="text-[8px] text-muted-foreground/50 mt-0.5 block">
                fade: {niagaraPreset.shaderUniforms.uFadeProfile} • sparkle: {niagaraPreset.particleProfile.sparkleRate}
              </span>
            </div>
          )}

          {/* Physics Summary */}
          {parsed.valid && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
              <span>Altura: <b className="text-foreground">{parsed.height}m</b></span>
              <span>Duração: <b className="text-foreground">{parsed.duration}s</b></span>
              <span>Spread: <b className="text-foreground">{parsed.spread}°</b></span>
              <span>Estrelas: <b className="text-foreground">{parsed.starCount}</b></span>
              <span>Break: <b className="text-foreground">{parsed.breakSpeed} m/s</b></span>
              <span>Prefire: <b className="text-foreground">{parsed.prefire}s</b></span>
              <span>Segurança: <b className="text-foreground">{parsed.safetyDistance}m</b></span>
              <span>Custo: <b className="text-foreground">${parsed.cost}</b></span>
            </div>
          )}

          {/* Action */}
          <Button
            onClick={handleAddToTimeline}
            disabled={!parsed.valid}
            size="sm"
            className="w-full gap-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar ao Timeline
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
