import { useState, useCallback } from 'react';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * Finale 3D-style "Convert to Fan" — spread selected effects across an angle.
 */
export function ConvertToFanDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [spreadAngle, setSpreadAngle] = useState(90);
  const [axis, setAxis] = useState<'horizontal' | 'vertical'>('horizontal');
  const { selectedTimelineItemIds, timelineItems, updateTimelineItem } = useProjectStore();

  const handleApply = useCallback(() => {
    const items = selectedTimelineItemIds
      .map(id => timelineItems.find(i => i.id === id))
      .filter(Boolean) as typeof timelineItems;

    if (items.length < 2) {
      toast.error('Select at least 2 effects to create a fan');
      return;
    }

    const halfSpread = spreadAngle / 2;
    items.forEach((item, i) => {
      const angle = -halfSpread + (i / (items.length - 1)) * spreadAngle;
      const angleRad = (angle * Math.PI) / 180;

      if (axis === 'horizontal') {
        updateTimelineItem(item.id, { pan: angle });
      } else {
        updateTimelineItem(item.id, { tilt: angle });
      }
    });

    toast.success(`Fan created: ${items.length} effects spread ${spreadAngle}°`);
    setOpen(false);
  }, [selectedTimelineItemIds, timelineItems, updateTimelineItem, spreadAngle, axis]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Convert to Fan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Spread Angle (°): {spreadAngle}</Label>
            <Slider min={10} max={360} step={5} value={[spreadAngle]} onValueChange={([v]) => setSpreadAngle(v)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Axis</Label>
            <Select value={axis} onValueChange={(v) => setAxis(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center text-xs text-muted-foreground font-mono">
            {selectedTimelineItemIds.length} effects selected
          </div>
          <Button onClick={handleApply} className="w-full" disabled={selectedTimelineItemIds.length < 2}>
            Apply Fan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Finale 3D-style "Convert to Sequence" — create a timed chase across selected effects.
 */
export function ConvertToSequenceDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [totalDuration, setTotalDuration] = useState(2);
  const [pattern, setPattern] = useState<'forward' | 'reverse' | 'center-out' | 'outside-in' | 'random'>('forward');
  const { selectedTimelineItemIds, timelineItems, updateTimelineItem } = useProjectStore();

  const handleApply = useCallback(() => {
    const items = selectedTimelineItemIds
      .map(id => timelineItems.find(i => i.id === id))
      .filter(Boolean) as typeof timelineItems;

    if (items.length < 2) {
      toast.error('Select at least 2 effects to create a sequence');
      return;
    }

    const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
    const baseTime = sorted[0].startTime;
    const interval = totalDuration / (sorted.length - 1);

    let ordered: typeof sorted;
    switch (pattern) {
      case 'forward':
        ordered = sorted;
        break;
      case 'reverse':
        ordered = [...sorted].reverse();
        break;
      case 'center-out': {
        const mid = Math.floor(sorted.length / 2);
        ordered = [];
        for (let i = 0; i <= mid; i++) {
          if (mid + i < sorted.length) ordered.push(sorted[mid + i]);
          if (mid - i >= 0 && i > 0) ordered.push(sorted[mid - i]);
        }
        break;
      }
      case 'outside-in': {
        ordered = [];
        let l = 0, r = sorted.length - 1;
        while (l <= r) {
          ordered.push(sorted[l]);
          if (l !== r) ordered.push(sorted[r]);
          l++; r--;
        }
        break;
      }
      case 'random': {
        ordered = [...sorted].sort(() => Math.random() - 0.5);
        break;
      }
    }

    ordered.forEach((item, i) => {
      updateTimelineItem(item.id, { startTime: Math.round((baseTime + i * interval) * 1000) / 1000 });
    });

    toast.success(`Sequence: ${ordered.length} effects over ${totalDuration}s (${pattern})`);
    setOpen(false);
  }, [selectedTimelineItemIds, timelineItems, updateTimelineItem, totalDuration, pattern]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Convert to Sequence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Duration (s)</Label>
            <Input type="number" min={0.1} max={60} step={0.1} value={totalDuration} onChange={e => setTotalDuration(parseFloat(e.target.value) || 1)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pattern</Label>
            <Select value={pattern} onValueChange={(v) => setPattern(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="forward">Forward →</SelectItem>
                <SelectItem value="reverse">Reverse ←</SelectItem>
                <SelectItem value="center-out">Center Out ↔</SelectItem>
                <SelectItem value="outside-in">Outside In →←</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center text-xs text-muted-foreground font-mono">
            {selectedTimelineItemIds.length} effects · interval: {selectedTimelineItemIds.length > 1 ? (totalDuration / (selectedTimelineItemIds.length - 1)).toFixed(3) : 0}s
          </div>
          <Button onClick={handleApply} className="w-full" disabled={selectedTimelineItemIds.length < 2}>
            Apply Sequence
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Duplicate selected effects into fanned flights (Finale 3D style).
 */
export function DuplicateInFlightsDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shotsPerFlight, setShotsPerFlight] = useState(5);
  const [angleBetween, setAngleBetween] = useState(15);
  const { selectedTimelineItemIds, timelineItems, addTimelineItem } = useProjectStore();

  const selectedItems = selectedTimelineItemIds
    .map(id => timelineItems.find(i => i.id === id))
    .filter(Boolean) as typeof timelineItems;

  const handleApply = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.error('Select effects to duplicate');
      return;
    }

    let created = 0;
    selectedItems.forEach(item => {
      for (let s = 1; s < shotsPerFlight; s++) {
        const angle = s * angleBetween;
        const newId = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${s}`;
        addTimelineItem({
          ...item,
          id: newId,
          pan: (item.pan || 0) + angle - ((shotsPerFlight - 1) * angleBetween) / 2,
        });
        created++;
      }
    });

    toast.success(`Created ${created} duplicates in flights of ${shotsPerFlight}`);
    setOpen(false);
  }, [selectedTimelineItemIds, timelineItems, addTimelineItem, shotsPerFlight, angleBetween]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Duplicate in Flights</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Shots per Flight</Label>
            <Input type="number" min={2} max={20} value={shotsPerFlight} onChange={e => setShotsPerFlight(parseInt(e.target.value) || 2)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Angle Between (°): {angleBetween}</Label>
            <Slider min={5} max={90} step={5} value={[angleBetween]} onValueChange={([v]) => setAngleBetween(v)} />
          </div>
          <div className="bg-muted/50 rounded p-2 text-center text-xs text-muted-foreground font-mono">
            {items.length} × {shotsPerFlight} = {items.length * shotsPerFlight} total effects
          </div>
          <Button onClick={handleApply} className="w-full" disabled={selectedTimelineItemIds.length === 0}>
            Duplicate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Need items in scope for the display
  var items = selectedTimelineItemIds
    .map(id => timelineItems.find(i => i.id === id))
    .filter(Boolean);
}
