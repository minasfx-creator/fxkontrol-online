/**
 * GeneratorsDialog
 * ────────────────────────────────────────────────────────────
 * Unified UI for parametric generators:
 *   - Cake (multi-shot from one anchor pyro position)
 *   - Mortar Fan (line of new pyro mortars)
 *   - Drone Formation (Circle / Grid / Heart / Spiral / Wave)
 *
 * The dialog ONLY collects parameters and dispatches a CustomEvent
 * with the params; the plugin command handler performs the store mutation
 * and records the operation log entry (so undo/redo works).
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import {
  generateDroneFormationDetailed,
  MIN_DRONE_SEPARATION_M,
  type FormationShape,
  type FormationParams,
} from '@/features/viewport-tools/generators/droneFormationGenerator';
import {
  generateCakeDetailed,
  FIREONE_MIN_STAGGER_MS,
  type CakeParams,
  type SweepMode,
} from '@/features/viewport-tools/generators/cakeGenerator';
import {
  DRONE_FORMATION_TEMPLATES,
  CATEGORY_LABEL,
  type DroneFormationTemplate,
  type TemplateCategory,
} from '@/features/viewport-tools/generators/droneFormationTemplates';
import {
  runDigitalTwinFormation,
  summarizeTwin,
  type TwinSeverity,
} from '@/features/viewport-tools/validators/digitalTwinFormation';

const FormationPreview3D = lazy(() => import('./FormationPreview3D'));
const CakePreview2D = lazy(() => import('./CakePreview2D'));

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GeneratorsDialog({ open, onClose }: Props) {
  const positions = useProjectStore((s) => s.positions);
  const selectedIds = useProjectStore((s) => s.selectedPositionIds);

  const pyroPositions = useMemo(() => positions.filter((p) => p.type === 'pyro'), [positions]);
  const firstSelectedPyro = useMemo(
    () => pyroPositions.find((p) => selectedIds.includes(p.id)) ?? pyroPositions[0],
    [pyroPositions, selectedIds],
  );

  // ── Cake state ────────────────────────────────────────────
  const [cakeAnchorId, setCakeAnchorId] = useState<string>('');
  const [cakeEffectId, setCakeEffectId] = useState<string>('');
  const [cakeShots, setCakeShots] = useState(25);
  const [cakeStaggerMs, setCakeStaggerMs] = useState(80);
  const [cakeSpreadDeg, setCakeSpreadDeg] = useState(45);
  const [cakeStart, setCakeStart] = useState(0);
  const [cakeRows, setCakeRows] = useState(1);
  const [cakeRowGapMs, setCakeRowGapMs] = useState(250);
  const [cakeSweep, setCakeSweep] = useState<SweepMode>('linear');
  const [cakeBearing, setCakeBearing] = useState(0);
  const [cakeTilt, setCakeTilt] = useState(0);
  const [cakeCaliber, setCakeCaliber] = useState(3);
  const [cakeShowPreview, setCakeShowPreview] = useState(true);

  // ── Mortar Fan state ──────────────────────────────────────
  const [fanCount, setFanCount] = useState(8);
  const [fanSpacing, setFanSpacing] = useState(2);
  const [fanHeading, setFanHeading] = useState(0);
  const [fanStaggerMs, setFanStaggerMs] = useState(120);
  const [fanStart, setFanStart] = useState(0);
  const [fanEffectId, setFanEffectId] = useState<string>('');
  const [fanOriginX, setFanOriginX] = useState(0);
  const [fanOriginZ, setFanOriginZ] = useState(0);

  // ── Drone Formation state ─────────────────────────────────
  const [shape, setShape] = useState<FormationShape>('circle');
  const [droneCount, setDroneCount] = useState(64);
  const [droneRadius, setDroneRadius] = useState(20);
  const [droneSpacing, setDroneSpacing] = useState(2);
  const [droneHeight, setDroneHeight] = useState(30);
  const [droneStart, setDroneStart] = useState(0);
  const [droneRotation, setDroneRotation] = useState(0);
  const [droneText, setDroneText] = useState('FXK');
  const [droneStarPoints, setDroneStarPoints] = useState(5);
  const [droneColor, setDroneColor] = useState('#00e5ff');
  const [droneTransition, setDroneTransition] = useState(6);
  const [droneHold, setDroneHold] = useState(8);
  const [showPreview, setShowPreview] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | 'all'>('all');

  const droneParams: FormationParams = useMemo(() => ({
    shape,
    droneCount,
    radius: droneRadius,
    spacing: droneSpacing,
    height: droneHeight,
    rotation: droneRotation,
    startTime: droneStart,
    text: droneText,
    starPoints: droneStarPoints,
    color: droneColor,
    transitionDuration: droneTransition,
    holdDuration: droneHold,
  }), [shape, droneCount, droneRadius, droneSpacing, droneHeight, droneRotation, droneStart, droneText, droneStarPoints, droneColor, droneTransition, droneHold]);

  const droneReport = useMemo(() => generateDroneFormationDetailed(droneParams), [droneParams]);
  const twinReport = useMemo(() => runDigitalTwinFormation(droneParams), [droneParams]);

  const applyTemplate = (tpl: DroneFormationTemplate) => {
    setShape(tpl.params.shape);
    setDroneCount(tpl.params.droneCount);
    setDroneRadius(tpl.params.radius);
    setDroneSpacing(tpl.params.spacing);
    setDroneHeight(tpl.params.height);
    setDroneRotation(tpl.params.rotation ?? 0);
    setDroneText(tpl.params.text ?? 'FXK');
    setDroneStarPoints(tpl.params.starPoints ?? 5);
    setDroneColor(tpl.params.color ?? '#00e5ff');
    setDroneTransition(tpl.params.transitionDuration ?? 6);
    setDroneHold(tpl.params.holdDuration ?? 8);
    setActiveTemplateId(tpl.id);
  };

  const filteredTemplates = useMemo(
    () => templateCategory === 'all'
      ? DRONE_FORMATION_TEMPLATES
      : DRONE_FORMATION_TEMPLATES.filter((t) => t.category === templateCategory),
    [templateCategory],
  );

  // ── Cake derived params + live report ─────────────────────
  const cakeAnchorPos = useMemo(
    () => positions.find((p) => p.id === cakeAnchorId),
    [positions, cakeAnchorId],
  );
  const cakeParams: CakeParams = useMemo(() => ({
    anchorPositionId: cakeAnchorId || 'preview',
    anchor: cakeAnchorPos
      ? { x: cakeAnchorPos.x, y: cakeAnchorPos.y, z: cakeAnchorPos.z }
      : { x: 0, y: 0, z: 0 },
    effectId: cakeEffectId || 'preview',
    shots: cakeShots,
    staggerMs: cakeStaggerMs,
    spreadDeg: cakeSpreadDeg,
    startTime: cakeStart,
    rows: cakeRows,
    rowGapMs: cakeRowGapMs,
    sweep: cakeSweep,
    bearingDeg: cakeBearing,
    tilt: cakeTilt,
    caliber: cakeCaliber,
  }), [
    cakeAnchorId, cakeAnchorPos, cakeEffectId, cakeShots, cakeStaggerMs,
    cakeSpreadDeg, cakeStart, cakeRows, cakeRowGapMs, cakeSweep,
    cakeBearing, cakeTilt, cakeCaliber,
  ]);
  const cakeReport = useMemo(() => generateCakeDetailed(cakeParams).report, [cakeParams]);

  useEffect(() => {
    if (!open) return;
    if (!cakeAnchorId && firstSelectedPyro) setCakeAnchorId(firstSelectedPyro.id);
    if (!cakeEffectId && EFFECT_LIBRARY[0]) setCakeEffectId(EFFECT_LIBRARY[0].id);
    if (!fanEffectId && EFFECT_LIBRARY[0]) setFanEffectId(EFFECT_LIBRARY[0].id);
  }, [open, cakeAnchorId, cakeEffectId, fanEffectId, firstSelectedPyro]);

  const dispatch = (name: string, detail: unknown) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  const submitCake = () => {
    if (!cakeAnchorPos || !cakeEffectId) return;
    dispatch('viewport-tools:generate-cake', cakeParams);
    onClose();
  };

  const submitFan = () => {
    if (!fanEffectId) return;
    dispatch('viewport-tools:generate-mortar-fan', {
      origin: { x: fanOriginX, y: 0, z: fanOriginZ },
      headingDeg: fanHeading,
      count: fanCount,
      spacingM: fanSpacing,
      staggerMs: fanStaggerMs,
      startTime: fanStart,
      effectId: fanEffectId,
    });
    onClose();
  };

  const submitDrone = () => {
    dispatch('viewport-tools:generate-drone-formation', droneParams);
    onClose();
  };

  const inputCls = 'h-8 bg-[#0a0f1a] border-cyan-500/20 text-cyan-100 text-xs';
  const labelCls = 'text-[10px] uppercase tracking-wider text-cyan-300/70';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#050810]/95 border-cyan-500/30 max-w-2xl backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-cyan-300 font-mono text-sm tracking-wider">
            ⚙ ADVANCED GENERATORS
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Parametric generators for cakes, mortar fans and drone formations. Output is gated by safety validators.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="cake" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-[#0a0f1a] border border-cyan-500/20">
            <TabsTrigger value="cake" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              Cake
            </TabsTrigger>
            <TabsTrigger value="fan" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              Mortar Fan
            </TabsTrigger>
            <TabsTrigger value="drone" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              Drone Formation
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              Templates
            </TabsTrigger>
          </TabsList>

          {/* ── Cake ───────────────────────────────────────── */}
          <TabsContent value="cake" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={labelCls}>Anchor pyro position</Label>
                <Select value={cakeAnchorId} onValueChange={setCakeAnchorId}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050810] border-cyan-500/30 text-cyan-100">
                    {pyroPositions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className={labelCls}>Effect</Label>
                <Select value={cakeEffectId} onValueChange={setCakeEffectId}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050810] border-cyan-500/30 text-cyan-100 max-h-64">
                    {EFFECT_LIBRARY.slice(0, 80).map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls}>Shots / row (1-200)</Label>
                <Input className={inputCls} type="number" min={1} max={200} value={cakeShots} onChange={(e) => setCakeShots(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Rows (1-16)</Label>
                <Input className={inputCls} type="number" min={1} max={16} value={cakeRows} onChange={(e) => setCakeRows(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Stagger (ms)</Label>
                <Input className={inputCls} type="number" min={0} value={cakeStaggerMs} onChange={(e) => setCakeStaggerMs(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Row gap (ms)</Label>
                <Input className={inputCls} type="number" min={0} value={cakeRowGapMs} onChange={(e) => setCakeRowGapMs(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Spread (deg, 0-180)</Label>
                <Input className={inputCls} type="number" min={0} max={180} value={cakeSpreadDeg} onChange={(e) => setCakeSpreadDeg(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Bearing (deg)</Label>
                <Input className={inputCls} type="number" value={cakeBearing} onChange={(e) => setCakeBearing(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Tilt (deg)</Label>
                <Input className={inputCls} type="number" value={cakeTilt} onChange={(e) => setCakeTilt(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Caliber (in)</Label>
                <Input className={inputCls} type="number" min={1} max={12} value={cakeCaliber} onChange={(e) => setCakeCaliber(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Sweep mode</Label>
                <Select value={cakeSweep} onValueChange={(v) => setCakeSweep(v as SweepMode)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#050810] border-cyan-500/30 text-cyan-100">
                    <SelectItem value="linear" className="text-xs">Linear</SelectItem>
                    <SelectItem value="pingpong" className="text-xs">Ping-Pong</SelectItem>
                    <SelectItem value="inout" className="text-xs">Ease In-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls}>Start time (s)</Label>
                <Input className={inputCls} type="number" step={0.1} min={0} value={cakeStart} onChange={(e) => setCakeStart(+e.target.value)} />
              </div>
            </div>

            {/* Validation report */}
            <div className={`rounded border px-2 py-1.5 text-[10px] font-mono ${
              cakeReport.warnings.length === 0
                ? 'border-green-500/30 bg-green-500/5 text-green-300'
                : cakeReport.effectiveStaggerMs < FIREONE_MIN_STAGGER_MS
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>
                  {cakeReport.warnings.length === 0
                    ? '✓ CAKE OK'
                    : cakeReport.effectiveStaggerMs < FIREONE_MIN_STAGGER_MS
                      ? '⚠ STAGGER UNSAFE'
                      : '⚠ REVIEW'}
                </span>
                <span className="opacity-70">
                  {cakeReport.shotsTotal} shots · {cakeReport.rows} row(s) · {cakeReport.durationSec.toFixed(2)}s · {cakeReport.effectiveStaggerMs}ms
                </span>
              </div>
              {cakeReport.warnings.length > 0 && (
                <ul className="mt-1 space-y-0.5 opacity-90">
                  {cakeReport.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                </ul>
              )}
            </div>

            {/* Live 2D preview */}
            <div className="flex items-center justify-between">
              <Label className={labelCls}>Top-down preview</Label>
              <button
                type="button"
                onClick={() => setCakeShowPreview((v) => !v)}
                className="text-[10px] text-cyan-300/70 hover:text-cyan-200 underline"
              >
                {cakeShowPreview ? 'Hide' : 'Show'}
              </button>
            </div>
            {cakeShowPreview && (
              <Suspense fallback={<div className="h-56 rounded border border-cyan-500/10 bg-[#02040a] flex items-center justify-center text-[10px] text-cyan-300/50">loading preview…</div>}>
                <CakePreview2D params={cakeParams} />
              </Suspense>
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-cyan-300/60 font-mono">
                anchor: {cakeAnchorPos?.name ?? '—'}
              </span>
              <Button size="sm" onClick={submitCake} disabled={!cakeAnchorId || !cakeEffectId}
                className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25">
                Generate Cake
              </Button>
            </div>
          </TabsContent>

          {/* ── Mortar Fan ─────────────────────────────────── */}
          <TabsContent value="fan" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={labelCls}>Effect</Label>
                <Select value={fanEffectId} onValueChange={setFanEffectId}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#050810] border-cyan-500/30 text-cyan-100 max-h-64">
                    {EFFECT_LIBRARY.slice(0, 80).map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls}>Mortars (2-32)</Label>
                <Input className={inputCls} type="number" min={2} max={32} value={fanCount} onChange={(e) => setFanCount(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Spacing (m)</Label>
                <Input className={inputCls} type="number" step={0.5} min={0.5} value={fanSpacing} onChange={(e) => setFanSpacing(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Heading (deg)</Label>
                <Input className={inputCls} type="number" value={fanHeading} onChange={(e) => setFanHeading(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Stagger (ms)</Label>
                <Input className={inputCls} type="number" min={0} value={fanStaggerMs} onChange={(e) => setFanStaggerMs(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Origin X</Label>
                <Input className={inputCls} type="number" step={0.5} value={fanOriginX} onChange={(e) => setFanOriginX(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Origin Z</Label>
                <Input className={inputCls} type="number" step={0.5} value={fanOriginZ} onChange={(e) => setFanOriginZ(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Start time (s)</Label>
                <Input className={inputCls} type="number" step={0.1} min={0} value={fanStart} onChange={(e) => setFanStart(+e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={submitFan} disabled={!fanEffectId}
                className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25">
                Generate Mortar Fan
              </Button>
            </div>
          </TabsContent>

          {/* ── Drone Formation ────────────────────────────── */}
          <TabsContent value="drone" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={labelCls}>Shape</Label>
                <Select value={shape} onValueChange={(v) => setShape(v as FormationShape)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#050810] border-cyan-500/30 text-cyan-100 max-h-72">
                    <SelectItem value="circle" className="text-xs">Circle (2D)</SelectItem>
                    <SelectItem value="grid" className="text-xs">Grid (2D)</SelectItem>
                    <SelectItem value="heart" className="text-xs">Heart (2D)</SelectItem>
                    <SelectItem value="spiral" className="text-xs">Spiral (2D)</SelectItem>
                    <SelectItem value="wave" className="text-xs">Wave (2D)</SelectItem>
                    <SelectItem value="star" className="text-xs">Star (2D)</SelectItem>
                    <SelectItem value="sphere" className="text-xs">Sphere (3D)</SelectItem>
                    <SelectItem value="helix" className="text-xs">Helix (3D)</SelectItem>
                    <SelectItem value="cube" className="text-xs">Cube shell (3D)</SelectItem>
                    <SelectItem value="text" className="text-xs">Text (3D)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls}>Drone count</Label>
                <Input className={inputCls} type="number" min={1} max={2000} value={droneCount} onChange={(e) => setDroneCount(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Height (m)</Label>
                <Input className={inputCls} type="number" min={0} value={droneHeight} onChange={(e) => setDroneHeight(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Radius / scale (m)</Label>
                <Input className={inputCls} type="number" min={1} value={droneRadius} onChange={(e) => setDroneRadius(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Spacing (m)</Label>
                <Input className={inputCls} type="number" step={0.5} min={0.5} value={droneSpacing} onChange={(e) => setDroneSpacing(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Rotation Y (deg)</Label>
                <Input className={inputCls} type="number" value={droneRotation} onChange={(e) => setDroneRotation(+e.target.value)} />
              </div>
              <div>
                <Label className={labelCls}>Start time (s)</Label>
                <Input className={inputCls} type="number" step={0.1} min={0} value={droneStart} onChange={(e) => setDroneStart(+e.target.value)} />
              </div>
              {shape === 'star' && (
                <div className="col-span-2">
                  <Label className={labelCls}>Star points (3-12)</Label>
                  <Input className={inputCls} type="number" min={3} max={12} value={droneStarPoints} onChange={(e) => setDroneStarPoints(+e.target.value)} />
                </div>
              )}
              {shape === 'text' && (
                <div className="col-span-2">
                  <Label className={labelCls}>Text (A-Z, 0-9)</Label>
                  <Input className={inputCls} value={droneText} maxLength={12} onChange={(e) => setDroneText(e.target.value)} />
                </div>
              )}
            </div>

            {/* Collision report */}
            <div className={`rounded border px-2 py-1.5 text-[10px] font-mono ${
              droneReport.collision.ok
                ? 'border-green-500/30 bg-green-500/5 text-green-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}>
              <div className="flex items-center justify-between">
                <span>{droneReport.collision.ok ? '✓ COLLISION OK' : '⚠ COLLISION RISK'}</span>
                <span className="opacity-70">
                  min {droneReport.collision.minSpacingM.toFixed(2)}m / threshold {MIN_DRONE_SEPARATION_M}m
                </span>
              </div>
              {droneReport.collision.violations > 0 && (
                <div className="mt-0.5 opacity-90">
                  {droneReport.collision.violations} pair(s) below safety distance
                </div>
              )}
              {droneReport.warnings.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-amber-300/80">
                  {droneReport.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                </ul>
              )}
            </div>

            {/* Digital Twin report */}
            {(() => {
              const sevColor: Record<TwinSeverity, string> = {
                ok: 'text-green-300',
                info: 'text-cyan-300/80',
                warn: 'text-amber-300',
                block: 'text-red-300',
              };
              const headCls = twinReport.ready
                ? 'border-green-500/30 bg-green-500/5 text-green-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300';
              return (
                <div className={`rounded border px-2 py-1.5 text-[10px] font-mono ${headCls}`}>
                  <div className="flex items-center justify-between">
                    <span>🛰 {summarizeTwin(twinReport)}</span>
                    <span className="opacity-70">
                      ⌀{twinReport.metrics.footprintRadiusM.toFixed(0)}m · ceil {twinReport.metrics.altCeilingM}m · {Math.round(twinReport.metrics.densityPerKm3).toLocaleString()}/km³
                    </span>
                  </div>
                  {twinReport.findings.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {twinReport.findings.map((f, i) => (
                        <li key={i} className={sevColor[f.severity]}>
                          · [{f.severity.toUpperCase()}] {f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* Live preview */}
            <div className="flex items-center justify-between">
              <Label className={labelCls}>Live 3D preview</Label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-[10px] text-cyan-300/70 hover:text-cyan-200 underline"
              >
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPreview && (
              <Suspense fallback={<div className="h-56 rounded border border-cyan-500/10 bg-[#02040a] flex items-center justify-center text-[10px] text-cyan-300/50">loading preview…</div>}>
                <FormationPreview3D params={droneParams} />
              </Suspense>
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-cyan-300/60 font-mono">
                {droneReport.formation.droneCount} drones · {shape}
                {activeTemplateId && ` · tpl:${activeTemplateId}`}
              </span>
              <Button size="sm" onClick={submitDrone}
                className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25">
                Generate Formation
              </Button>
            </div>
          </TabsContent>

          {/* ── Templates ──────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-3 mt-4">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'opening', 'brand', 'finale', 'ambient', 'transition', 'demo'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors ${
                    templateCategory === cat
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-cyan-500/20 bg-[#0a0f1a] text-cyan-300/60 hover:text-cyan-200'
                  }`}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredTemplates.map((tpl) => {
                const isActive = activeTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`text-left rounded border px-2.5 py-2 transition-colors ${
                      isActive
                        ? 'border-cyan-400/60 bg-cyan-500/10'
                        : 'border-cyan-500/20 bg-[#0a0f1a] hover:border-cyan-500/40 hover:bg-cyan-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-200">{tpl.name}</span>
                      <span className="text-[9px] font-mono text-cyan-300/50">
                        {'★'.repeat(tpl.difficulty)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-cyan-300/60 leading-snug">
                      {tpl.description}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300/80">
                        {CATEGORY_LABEL[tpl.category]}
                      </span>
                      <span className="text-[9px] font-mono text-cyan-300/50">
                        {tpl.params.droneCount}🛸 · {tpl.params.height}m · {tpl.shape}
                      </span>
                    </div>
                    {tpl.safetyNote && (
                      <div className="mt-1 text-[9px] text-amber-300/70">⚠ {tpl.safetyNote}</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-cyan-500/10">
              <span className="text-[10px] text-cyan-300/60 font-mono">
                {activeTemplateId
                  ? `Loaded into Drone tab — review & generate`
                  : `Select a template to load parameters`}
              </span>
              <Button
                size="sm"
                disabled={!activeTemplateId}
                onClick={submitDrone}
                className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25 disabled:opacity-40"
              >
                Generate from Template
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
