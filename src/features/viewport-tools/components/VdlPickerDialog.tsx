/**
 * VdlPickerDialog — quick swatch picker that writes a colorOverride
 * onto the targeted TimelineItem and logs a PYRO_VDL_PICK operation
 * for undo/redo.
 *
 * Triggered by the PYRO segment plugin via the
 * 'viewport-tools:open-vdl-picker' CustomEvent.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import VdlColorPicker, { type VdlSwatch } from './VdlColorPicker';
import { operationLog } from '../command-dispatcher';
import type { TimelineItem } from '@/types/projectTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  timelineItemId: string | null;
}

function uid(p: string): string {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function VdlPickerDialog({ open, onClose, timelineItemId }: Props) {
  const items = useProjectStore((s) => s.timelineItems);
  const item = timelineItemId ? items.find((t) => t.id === timelineItemId) : null;
  const [pending, setPending] = useState<VdlSwatch | null>(null);

  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  if (!item) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>VDL Color Picker</DialogTitle>
            <DialogDescription>
              No cue selected. Select a PYRO cue on the timeline first.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const apply = () => {
    if (!pending) return;
    const before: TimelineItem = { ...item };
    const after = { ...item, colorOverride: pending.hex };
    useProjectStore.setState({
      timelineItems: items.map((t) => (t.id === item.id ? after : t)),
    });
    operationLog.push({
      id: uid('op'),
      segment: 'PYRO',
      command: 'PYRO_VDL_PICK',
      timestamp: Date.now(),
      before: { item: before },
      after: { itemId: item.id, hex: pending.hex, name: pending.name },
      description: `VDL color "${pending.name}" applied to cue ${item.id}.`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[#050810] border-cyan-500/20">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">VDL Color Picker</DialogTitle>
          <DialogDescription>
            Cue <code className="text-cyan-400">{item.id}</code> — pick one of
            the 25 canonical Finale 3D VDL colors.
          </DialogDescription>
        </DialogHeader>
        <VdlColorPicker
          selectedHex={pending?.hex ?? item.colorOverride}
          onPick={setPending}
        />
        {pending && (
          <div className="rounded border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs">
            Selected: <span className="font-semibold text-cyan-300">{pending.name}</span>{' '}
            <span className="text-muted-foreground">({pending.hex})</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!pending} onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
