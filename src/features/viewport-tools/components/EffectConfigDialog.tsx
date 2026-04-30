/**
 * EffectConfigDialog — PYRO effect parameter editor.
 *
 * Two tabs:
 *   • This Cue       — overrides applied to a single TimelineItem
 *                      (colorOverride, cueHeading, cuePitch, pan, tilt,
 *                       spin, durationOverride, flightCount, notes, hazard).
 *   • Save as Variant — fork the base Effect into a runtime variant
 *                       (effectVariantStore). EFFECT_LIBRARY is never mutated.
 *
 * Apply pushes a ViewportOperation onto operationLog so the toolbar's
 * Undo button can revert the change.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore } from '@/store/useProjectStore';
import type { TimelineItem } from '@/types/projectTypes';
import { resolveEffect, effectVariantStore, deriveVariantId } from '../effectVariants';
import { operationLog } from '../command-dispatcher';
import type { Effect } from '@/data/effectLibrary';

interface Props {
  open: boolean;
  onClose: () => void;
  effectId: string | null;
  /** Optional — when present, "This Cue" tab is enabled. */
  targetTimelineItemId?: string | null;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function num(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function EffectConfigDialog({
  open,
  onClose,
  effectId,
  targetTimelineItemId,
}: Props) {
  const baseEffect = useMemo(() => resolveEffect(effectId), [effectId, open]);
  const targetItem: TimelineItem | undefined = useProjectStore((s) =>
    targetTimelineItemId
      ? s.timelineItems.find((it) => it.id === targetTimelineItemId)
      : undefined
  );

  // ── Override (per-cue) state ────────────────────────────────
  const [colorOverride, setColorOverride] = useState('');
  const [cueHeading, setCueHeading] = useState<string>('');
  const [cuePitch, setCuePitch] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [tilt, setTilt] = useState<string>('');
  const [spin, setSpin] = useState<string>('');
  const [durationOverride, setDurationOverride] = useState<string>('');
  const [flightCount, setFlightCount] = useState<string>('');
  const [hazard, setHazard] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // ── Variant state ───────────────────────────────────────────
  const [vName, setVName] = useState('');
  const [vColor, setVColor] = useState('#FFD700');
  const [vCaliber, setVCaliber] = useState<string>('');
  const [vHeight, setVHeight] = useState<string>('');
  const [vPrefire, setVPrefire] = useState<string>('');
  const [vFuse, setVFuse] = useState<string>('');
  const [vSafety, setVSafety] = useState<string>('');
  const [vVdl, setVVdl] = useState<string>('');
  const [vDuration, setVDuration] = useState<string>('');
  const [vCost, setVCost] = useState<string>('');
  const [vShotCount, setVShotCount] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    // Reset overrides from current item
    setColorOverride(targetItem?.colorOverride ?? baseEffect?.color ?? '');
    setCueHeading(targetItem?.cueHeading?.toString() ?? '');
    setCuePitch(targetItem?.cuePitch?.toString() ?? '');
    setPan(targetItem?.pan?.toString() ?? '');
    setTilt(targetItem?.tilt?.toString() ?? '');
    setSpin(targetItem?.spin?.toString() ?? '');
    setDurationOverride(targetItem?.durationOverride?.toString() ?? '');
    setFlightCount(targetItem?.flightCount?.toString() ?? '');
    setHazard(targetItem?.hazard ?? '');
    setNotes(targetItem?.notes ?? '');

    // Reset variant fields from base
    if (baseEffect) {
      setVName(`${baseEffect.name} (variant)`);
      setVColor(baseEffect.color);
      setVCaliber(baseEffect.caliber?.toString() ?? '');
      setVHeight(baseEffect.heightMeters?.toString() ?? '');
      setVPrefire(baseEffect.prefire?.toString() ?? '');
      setVFuse(baseEffect.fuseDelay?.toString() ?? '');
      setVSafety(baseEffect.safetyDistance?.toString() ?? '');
      setVVdl(baseEffect.vdl ?? '');
      setVDuration(baseEffect.duration?.toString() ?? '');
      setVCost(baseEffect.cost?.toString() ?? '');
      setVShotCount(baseEffect.shotCount?.toString() ?? '');
    }
  }, [open, baseEffect?.id, targetItem?.id]);

  if (!baseEffect) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effect not found</DialogTitle>
            <DialogDescription>
              The selected effect id could not be resolved.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const applyOverride = () => {
    if (!targetItem) return;
    const before: TimelineItem = { ...targetItem };
    const after: TimelineItem = {
      ...targetItem,
      colorOverride: colorOverride || undefined,
      cueHeading: cueHeading === '' ? undefined : clamp(num(cueHeading, 0), -360, 360),
      cuePitch: cuePitch === '' ? undefined : clamp(num(cuePitch, 0), -90, 90),
      pan: pan === '' ? undefined : clamp(num(pan, 0), -180, 180),
      tilt: tilt === '' ? undefined : clamp(num(tilt, 0), -90, 90),
      spin: spin === '' ? undefined : clamp(num(spin, 0), -360, 360),
      durationOverride:
        durationOverride === '' ? undefined : clamp(num(durationOverride, 0), 0.05, 60),
      flightCount: flightCount === '' ? undefined : clamp(Math.round(num(flightCount, 1)), 1, 500),
      hazard: hazard || undefined,
      notes: notes || undefined,
    };

    useProjectStore.setState((s) => ({
      timelineItems: s.timelineItems.map((it) => (it.id === targetItem.id ? after : it)),
    }));

    operationLog.push({
      id: uid('op'),
      segment: 'PYRO',
      command: 'PYRO_OVERRIDE_CUE',
      timestamp: Date.now(),
      before: { item: before },
      after: { itemId: targetItem.id },
      description: `Override applied to cue ${targetItem.id}.`,
    });

    onClose();
  };

  const applyVariant = () => {
    const variantId = deriveVariantId(baseEffect.id);
    const variant: Effect = {
      ...baseEffect,
      id: variantId,
      name: vName || `${baseEffect.name} (variant)`,
      color: vColor || baseEffect.color,
      caliber: vCaliber === '' ? baseEffect.caliber : clamp(num(vCaliber, 3), 1, 12),
      heightMeters:
        vHeight === '' ? baseEffect.heightMeters : clamp(num(vHeight, 60), 1, 500),
      prefire: vPrefire === '' ? baseEffect.prefire : clamp(num(vPrefire, 0), 0, 10),
      fuseDelay: vFuse === '' ? baseEffect.fuseDelay : clamp(num(vFuse, 0), 0, 10),
      safetyDistance:
        vSafety === '' ? baseEffect.safetyDistance : clamp(num(vSafety, 70), 1, 1000),
      vdl: vVdl || baseEffect.vdl,
      duration:
        vDuration === '' ? baseEffect.duration : clamp(num(vDuration, 1), 0.05, 60),
      cost: vCost === '' ? baseEffect.cost : clamp(num(vCost, 0), 0, 100000),
      shotCount:
        vShotCount === '' ? baseEffect.shotCount : clamp(Math.round(num(vShotCount, 1)), 1, 5000),
    };

    effectVariantStore.upsert(variant);

    operationLog.push({
      id: uid('op'),
      segment: 'PYRO',
      command: 'PYRO_VARIANT_SAVE',
      timestamp: Date.now(),
      before: null,
      after: { variantId },
      description: `Saved variant "${variant.name}" (${variantId}).`,
    });

    onClose();
  };

  const overrideTabDisabled = !targetItem;
  const [tab, setTab] = useState<'cue' | 'variant'>(overrideTabDisabled ? 'variant' : 'cue');
  useEffect(() => {
    if (open) setTab(overrideTabDisabled ? 'variant' : 'cue');
  }, [open, overrideTabDisabled]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border border-cyan-500/25">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">
            {baseEffect.icon} {baseEffect.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {baseEffect.id} · {baseEffect.category} · {baseEffect.type}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'cue' | 'variant')} className="w-full">
          <TabsList className="bg-background/60">
            <TabsTrigger value="cue" disabled={overrideTabDisabled}>
              This Cue
            </TabsTrigger>
            <TabsTrigger value="variant">Save as Variant</TabsTrigger>
          </TabsList>

          <TabsContent value="cue" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Color override</Label>
                <Input
                  type="color"
                  value={colorOverride || '#FFD700'}
                  onChange={(e) => setColorOverride(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Hazard tag</Label>
                <Input value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder="e.g. T1, T2..." />
              </div>
              <div>
                <Label className="text-xs">Cue Heading (°)</Label>
                <Input type="number" value={cueHeading} onChange={(e) => setCueHeading(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cue Pitch (°)</Label>
                <Input type="number" value={cuePitch} onChange={(e) => setCuePitch(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Pan (°)</Label>
                <Input type="number" value={pan} onChange={(e) => setPan(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tilt (°)</Label>
                <Input type="number" value={tilt} onChange={(e) => setTilt(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Spin (°)</Label>
                <Input type="number" value={spin} onChange={(e) => setSpin(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Duration override (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={durationOverride}
                  onChange={(e) => setDurationOverride(e.target.value)}
                  placeholder={baseEffect.duration.toString()}
                />
              </div>
              <div>
                <Label className="text-xs">Flight count</Label>
                <Input type="number" value={flightCount} onChange={(e) => setFlightCount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </TabsContent>

          <TabsContent value="variant" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Variant name</Label>
                <Input value={vName} onChange={(e) => setVName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input type="color" value={vColor} onChange={(e) => setVColor(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">VDL</Label>
                <Input value={vVdl} onChange={(e) => setVVdl(e.target.value)} placeholder="e.g. RED+GLITTER" />
              </div>
              <div>
                <Label className="text-xs">Caliber (in)</Label>
                <Input type="number" value={vCaliber} onChange={(e) => setVCaliber(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Height (m)</Label>
                <Input type="number" value={vHeight} onChange={(e) => setVHeight(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Prefire (s)</Label>
                <Input type="number" step="0.1" value={vPrefire} onChange={(e) => setVPrefire(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fuse delay (s)</Label>
                <Input type="number" step="0.05" value={vFuse} onChange={(e) => setVFuse(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Safety dist (m)</Label>
                <Input type="number" value={vSafety} onChange={(e) => setVSafety(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Duration (s)</Label>
                <Input type="number" step="0.1" value={vDuration} onChange={(e) => setVDuration(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cost</Label>
                <Input type="number" value={vCost} onChange={(e) => setVCost(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Shot count</Label>
                <Input type="number" value={vShotCount} onChange={(e) => setVShotCount(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Variants are stored locally and resolve before the canonical library.
              The catalog ({baseEffect.id}) is never modified.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Tabs defaultValue={overrideTabDisabled ? 'variant' : 'cue'}>
            {/* mirror tab state via two buttons */}
          </Tabs>
          <Button
            onClick={overrideTabDisabled ? applyVariant : applyOverride}
            className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/60"
          >
            {overrideTabDisabled ? 'Save Variant' : 'Apply to Cue'}
          </Button>
          {!overrideTabDisabled && (
            <Button
              variant="outline"
              onClick={applyVariant}
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            >
              Save Variant
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
