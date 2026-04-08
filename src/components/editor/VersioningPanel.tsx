import { useState, useCallback, useRef } from 'react';
import { History, X, RotateCcw, Tag, ChevronRight, Check, Plus, Diff, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { snapshotManager, type Snapshot } from '@/core/state/SnapshotManager';
import { commandBus } from '@/core/command/CommandBus';
import { commandLog } from '@/core/command/CommandLog';
import { lockstep } from '@/core/reliability/lockstepEngine';
import TimelineScrubber from './TimelineScrubber';

/** Hook to poll snapshot list every 2s. */
function useSnapshots(): readonly Snapshot[] {
  const [snapshots, setSnapshots] = useState<readonly Snapshot[]>(snapshotManager.getAll());
  useState(() => {
    const id = setInterval(() => setSnapshots([...snapshotManager.getAll()]), 2000);
    return () => clearInterval(id);
  });
  return snapshots;
}

export default function VersioningPanel({ onClose }: { onClose: () => void }) {
  const snapshots = useSnapshots();
  const [newName, setNewName] = useState('');
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState<number | null>(null);
  const positions = useProjectStore(s => s.positions);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createManualSnapshot = useCallback(() => {
    const tick = lockstep.getTickCount();
    snapshotManager.capture(tick);
    toast.success(`Snapshot saved at tick ${tick}`);
    setNewName('');
  }, []);

  const handleRollback = useCallback((tick: number) => {
    commandBus.dispatch({ type: 'ROLLBACK', targetTick: tick });
    toast.success(`Rolled back to tick ${tick}`);
    setShowConfirm(null);
  }, []);

  const handleExport = useCallback(() => {
    commandBus.dispatch({ type: 'EXPORT_LOG', format: 'json' });
    toast.success('Session exported');
  }, []);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      commandBus.dispatch({ type: 'IMPORT_LOG', json });
      toast.success(`Imported ${file.name}`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const selected = snapshots.find(s => s.tick === selectedTick);

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
        {/* Manual Snapshot */}
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
              onKeyDown={(e) => e.key === 'Enter' && createManualSnapshot()}
            />
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0" onClick={createManualSnapshot}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Current: {positions.length} positions, {timelineItems.length} cues · Tick {lockstep.getTickCount()} · Log: {commandLog.length} cmds
          </p>
        </div>

        {/* Export / Import */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Session Data
          </Label>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1 h-6 text-[9px]" onClick={handleExport}>
              <Download className="w-3 h-3 mr-0.5" />
              Export Log
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-6 text-[9px]" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-0.5" />
              Import Log
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Timeline Scrubber
          </Label>
          <TimelineScrubber snapshots={snapshots} />
        </div>

        {/* Snapshot List */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            History ({snapshots.length})
          </Label>

          {snapshots.length === 0 ? (
            <p className="text-[9px] text-muted-foreground italic py-2 text-center">
              Snapshots auto-capture every ~5s. Save one manually above.
            </p>
          ) : (
            <div className="space-y-1">
              {[...snapshots].reverse().map((snap) => (
                <div key={snap.tick}>
                  <button
                    onClick={() => setSelectedTick(selectedTick === snap.tick ? null : snap.tick)}
                    className={cn(
                      "w-full flex items-center gap-1.5 p-1.5 rounded transition-colors text-left",
                      selectedTick === snap.tick
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-surface-2/50 hover:bg-surface-3/60 border border-transparent"
                    )}
                  >
                    <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">Tick {snap.tick}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {snap.positionCount} pos, {snap.timelineItemCount} cues · {new Date(snap.ts).toLocaleString([], {
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-3 h-3 text-muted-foreground transition-transform",
                      selectedTick === snap.tick && "rotate-90"
                    )} />
                  </button>

                  {selectedTick === snap.tick && (
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
                        {showConfirm === snap.tick ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 h-6 text-[9px]"
                              onClick={() => handleRollback(snap.tick)}
                            >
                              <Check className="w-3 h-3 mr-0.5" />
                              Confirm Rollback
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-6 text-[9px]"
                            onClick={() => setShowConfirm(snap.tick)}
                          >
                            <RotateCcw className="w-3 h-3 mr-0.5" />
                            Rollback to here
                          </Button>
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
          <p><strong>Deterministic Versioning</strong></p>
          <p>Auto-snapshots every ~5s persisted to IndexedDB. Export/import sessions as JSON. Drag the scrubber to rollback visually.</p>
        </div>
      </div>
    </div>
  );
}
