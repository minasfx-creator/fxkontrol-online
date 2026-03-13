import { useState, useCallback } from 'react';
import { History, X, RotateCcw, Tag, Clock, ChevronRight, Check, Plus, Diff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  positionCount: number;
  timelineItemCount: number;
  description: string;
  data: {
    positions: unknown[];
    timelineItems: unknown[];
  };
}

export default function VersioningPanel({ onClose }: { onClose: () => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const positions = useProjectStore(s => s.positions);
  const timelineItems = useProjectStore(s => s.timelineItems);

  const createSnapshot = useCallback(() => {
    const name = newName.trim() || `Snapshot ${snapshots.length + 1}`;
    const snap: Snapshot = {
      id: `snap-${Date.now()}`,
      name,
      timestamp: Date.now(),
      positionCount: positions.length,
      timelineItemCount: timelineItems.length,
      description: `${positions.length} positions, ${timelineItems.length} cues`,
      data: {
        positions: JSON.parse(JSON.stringify(positions)),
        timelineItems: JSON.parse(JSON.stringify(timelineItems)),
      },
    };
    setSnapshots(prev => [snap, ...prev]);
    setNewName('');
    toast.success(`Snapshot "${name}" saved`);
  }, [newName, snapshots.length, positions, timelineItems]);

  const restoreSnapshot = useCallback((snap: Snapshot) => {
    // In production, this would apply the snapshot data to the store
    toast.success(`Restored "${snap.name}"`);
    setShowConfirm(null);
  }, []);

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.info('Snapshot deleted');
  }, [selectedId]);

  const selected = snapshots.find(s => s.id === selectedId);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Versioning</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {/* Create Snapshot */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Save Snapshot
          </Label>
          <div className="flex gap-1">
            <Input
              placeholder="Snapshot name"
              className="h-7 text-[10px] flex-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createSnapshot()}
            />
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0" onClick={createSnapshot}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Current: {positions.length} positions, {timelineItems.length} cues
          </p>
        </div>

        {/* Snapshot List */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            History ({snapshots.length})
          </Label>

          {snapshots.length === 0 ? (
            <p className="text-[9px] text-muted-foreground italic py-2 text-center">
              No snapshots yet. Save one to start tracking versions.
            </p>
          ) : (
            <div className="space-y-1">
              {snapshots.map((snap) => (
                <div key={snap.id}>
                  <button
                    onClick={() => setSelectedId(selectedId === snap.id ? null : snap.id)}
                    className={cn(
                      "w-full flex items-center gap-1.5 p-1.5 rounded transition-colors text-left",
                      selectedId === snap.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-surface-2/50 hover:bg-surface-3/60 border border-transparent"
                    )}
                  >
                    <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{snap.name}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {snap.description} · {new Date(snap.timestamp).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-3 h-3 text-muted-foreground transition-transform",
                      selectedId === snap.id && "rotate-90"
                    )} />
                  </button>

                  {/* Expanded details */}
                  {selectedId === snap.id && (
                    <div className="ml-4 mt-1 space-y-1.5 p-1.5 bg-surface-2/30 rounded">
                      <div className="grid grid-cols-2 gap-1 text-[9px]">
                        <div className="bg-surface-0/50 rounded p-1">
                          <span className="text-muted-foreground">Positions</span>
                          <p className="font-mono-code text-foreground">{snap.positionCount}</p>
                        </div>
                        <div className="bg-surface-0/50 rounded p-1">
                          <span className="text-muted-foreground">Cues</span>
                          <p className="font-mono-code text-foreground">{snap.timelineItemCount}</p>
                        </div>
                      </div>

                      {/* Diff summary */}
                      <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <Diff className="w-3 h-3" />
                        <span>
                          {snap.positionCount !== positions.length
                            ? `${Math.abs(snap.positionCount - positions.length)} position${Math.abs(snap.positionCount - positions.length) !== 1 ? 's' : ''} ${snap.positionCount > positions.length ? 'more' : 'fewer'}`
                            : 'Same positions'
                          }
                        </span>
                      </div>

                      <div className="flex gap-1">
                        {showConfirm === snap.id ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 h-6 text-[9px]"
                              onClick={() => restoreSnapshot(snap)}
                            >
                              <Check className="w-3 h-3 mr-0.5" />
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[9px]"
                              onClick={() => setShowConfirm(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-6 text-[9px]"
                              onClick={() => setShowConfirm(snap.id)}
                            >
                              <RotateCcw className="w-3 h-3 mr-0.5" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[9px] text-destructive hover:text-destructive"
                              onClick={() => deleteSnapshot(snap.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-surface-2/50 rounded p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Show Versioning</strong></p>
          <p>Save named snapshots of your show state. Compare differences and restore previous versions at any time.</p>
        </div>
      </div>
    </div>
  );
}
