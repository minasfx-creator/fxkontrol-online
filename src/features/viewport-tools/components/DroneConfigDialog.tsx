/**
 * DroneConfigDialog — DRONES position + formation editor.
 *
 * Two tabs:
 *   • Position  — edits the selected drone-pad Position (x/y/z, heading,
 *                 pitch, roll, name, color).
 *   • Formation — edits the most recent DroneFormation, OR creates a new
 *                 one anchored on the pad if none exists yet.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import type { Position, DroneFormation } from '@/types/projectTypes';
import { operationLog } from '../command-dispatcher';

interface Props {
  open: boolean;
  onClose: () => void;
  positionId: string | null;
}

const FORMATION_TYPES = [
  'circle',
  'grid',
  'line',
  'sphere',
  'helix',
  'wave',
  'custom',
];

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

export default function DroneConfigDialog({ open, onClose, positionId }: Props) {
  const position = useProjectStore((s) =>
    positionId ? s.positions.find((p) => p.id === positionId) : undefined
  );
  const formations = useProjectStore((s) => s.droneFormations);
  const updatePosition = useProjectStore((s) => s.updatePosition);
  const updateDroneFormation = useProjectStore((s) => s.updateDroneFormation);
  const addDroneFormation = useProjectStore((s) => s.addDroneFormation);
  const removeDroneFormation = useProjectStore((s) => s.removeDroneFormation);

  // Heuristic: pick latest formation; fall back to first.
  const targetFormation = useMemo<DroneFormation | undefined>(() => {
    if (formations.length === 0) return undefined;
    return formations[formations.length - 1];
  }, [formations]);

  // Position fields
  const [px, setPx] = useState('0');
  const [py, setPy] = useState('0');
  const [pz, setPz] = useState('0');
  const [pHeading, setPHeading] = useState('0');
  const [pPitch, setPPitch] = useState('0');
  const [pRoll, setPRoll] = useState('0');
  const [pName, setPName] = useState('');
  const [pColor, setPColor] = useState('#00ffff');

  // Formation fields
  const [fType, setFType] = useState('circle');
  const [fCount, setFCount] = useState('50');
  const [fHeight, setFHeight] = useState('30');
  const [fRadius, setFRadius] = useState('20');
  const [fSpacing, setFSpacing] = useState('1');
  const [fRotation, setFRotation] = useState('0');
  const [fColor, setFColor] = useState('#00ffff');
  const [fTransition, setFTransition] = useState('5');
  const [fHold, setFHold] = useState('5');

  useEffect(() => {
    if (!open) return;
    if (position) {
      setPx(position.x.toString());
      setPy(position.y.toString());
      setPz(position.z.toString());
      setPHeading(position.heading.toString());
      setPPitch(position.pitch.toString());
      setPRoll(position.roll.toString());
      setPName(position.name);
      setPColor(position.color);
    }
    if (targetFormation) {
      setFType(targetFormation.formationType);
      setFCount(targetFormation.droneCount.toString());
      setFHeight(targetFormation.height.toString());
      setFRadius(targetFormation.radius.toString());
      setFSpacing(targetFormation.spacing.toString());
      setFRotation(targetFormation.rotation.toString());
      setFColor(targetFormation.color);
      setFTransition(targetFormation.transitionDuration.toString());
      setFHold(targetFormation.holdDuration.toString());
    }
  }, [open, position?.id, targetFormation?.id]);

  if (!position) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No drone pad selected</DialogTitle>
            <DialogDescription>
              Select a drone pad in the viewport to configure it.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const applyPosition = () => {
    const before: Position = { ...position };
    const updates: Partial<Omit<Position, 'id'>> = {
      x: num(px, 0),
      y: num(py, 0),
      z: num(pz, 0),
      heading: clamp(num(pHeading, 0), -360, 360),
      pitch: clamp(num(pPitch, 0), -90, 90),
      roll: clamp(num(pRoll, 0), -180, 180),
      name: pName || position.name,
      color: pColor || position.color,
    };
    updatePosition(position.id, updates);

    operationLog.push({
      id: uid('op'),
      segment: 'DRONES',
      command: 'DRONES_UPDATE_POSITION',
      timestamp: Date.now(),
      before: { position: before },
      after: { positionId: position.id },
      description: `Updated drone pad ${position.name}.`,
    });

    onClose();
  };

  const applyFormation = () => {
    const updates: Partial<Omit<DroneFormation, 'id'>> = {
      formationType: fType,
      droneCount: clamp(Math.round(num(fCount, 50)), 1, 500),
      height: clamp(num(fHeight, 30), 1, 200),
      radius: clamp(num(fRadius, 20), 1, 500),
      spacing: clamp(num(fSpacing, 1), 0.1, 50),
      rotation: clamp(num(fRotation, 0), -360, 360),
      color: fColor,
      transitionDuration: clamp(num(fTransition, 5), 0.1, 120),
      holdDuration: clamp(num(fHold, 5), 0, 600),
    };

    if (targetFormation) {
      const before: DroneFormation = { ...targetFormation };
      updateDroneFormation(targetFormation.id, updates);
      operationLog.push({
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_UPDATE_FORMATION',
        timestamp: Date.now(),
        before: { formation: before },
        after: { formationId: targetFormation.id },
        description: `Updated formation ${targetFormation.formationType}.`,
      });
    } else {
      const newId = uid('formation');
      const newFormation: DroneFormation = {
        id: newId,
        formationType: fType,
        droneCount: updates.droneCount!,
        height: updates.height!,
        radius: updates.radius!,
        spacing: updates.spacing!,
        rotation: updates.rotation!,
        startTime: 0,
        transitionDuration: updates.transitionDuration!,
        holdDuration: updates.holdDuration!,
        color: updates.color!,
        points: [{ x: position.x, z: position.z }],
      };
      addDroneFormation(newFormation);
      operationLog.push({
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_CREATE_FORMATION',
        timestamp: Date.now(),
        before: null,
        after: { formationId: newId },
        description: `Created formation ${fType}.`,
      });
    }

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border border-cyan-500/25">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">Drone Pad: {position.name}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {position.id} · type: {position.type}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="position" className="w-full">
          <TabsList className="bg-background/60">
            <TabsTrigger value="position">Position</TabsTrigger>
            <TabsTrigger value="formation">
              Formation {targetFormation ? `(${targetFormation.formationType})` : '(new)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="position" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Name</Label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">X (m)</Label>
                <Input type="number" step="0.1" value={px} onChange={(e) => setPx(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Y (m)</Label>
                <Input type="number" step="0.1" value={py} onChange={(e) => setPy(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Z (m)</Label>
                <Input type="number" step="0.1" value={pz} onChange={(e) => setPz(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input type="color" value={pColor} onChange={(e) => setPColor(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Heading (°)</Label>
                <Input type="number" value={pHeading} onChange={(e) => setPHeading(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Pitch (°)</Label>
                <Input type="number" value={pPitch} onChange={(e) => setPPitch(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Roll (°)</Label>
                <Input type="number" value={pRoll} onChange={(e) => setPRoll(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={applyPosition}
                className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/60"
              >
                Apply Position
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="formation" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input type="color" value={fColor} onChange={(e) => setFColor(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Drone count</Label>
                <Input type="number" value={fCount} onChange={(e) => setFCount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Height (m)</Label>
                <Input type="number" value={fHeight} onChange={(e) => setFHeight(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Radius (m)</Label>
                <Input type="number" value={fRadius} onChange={(e) => setFRadius(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Spacing (m)</Label>
                <Input type="number" step="0.1" value={fSpacing} onChange={(e) => setFSpacing(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Rotation (°)</Label>
                <Input type="number" value={fRotation} onChange={(e) => setFRotation(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Transition (s)</Label>
                <Input type="number" step="0.1" value={fTransition} onChange={(e) => setFTransition(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hold (s)</Label>
                <Input type="number" step="0.1" value={fHold} onChange={(e) => setFHold(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={applyFormation}
                className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/60"
              >
                {targetFormation ? 'Apply Formation' : 'Create Formation'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
