import { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus, Trash2, MousePointer } from 'lucide-react';
import { toast } from 'sonner';

interface PositionGroup {
  id: string;
  name: string;
  positionIds: string[];
}

// Stored in component state (could be persisted later)
let savedGroups: PositionGroup[] = [];

export default function PositionGroupsPanel({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<PositionGroup[]>(savedGroups);
  const [newName, setNewName] = useState('');
  const { selectedPositionIds, selectMultiplePositions, positions } = useProjectStore();

  const saveGroup = useCallback(() => {
    if (selectedPositionIds.length === 0) {
      toast.error('Select positions first');
      return;
    }
    const name = newName.trim() || `Group ${groups.length + 1}`;
    const group: PositionGroup = {
      id: `grp-${Date.now()}`,
      name,
      positionIds: [...selectedPositionIds],
    };
    const updated = [...groups, group];
    setGroups(updated);
    savedGroups = updated;
    setNewName('');
    toast.success(`Saved "${name}" with ${selectedPositionIds.length} positions`);
  }, [selectedPositionIds, groups, newName]);

  const recallGroup = useCallback((group: PositionGroup) => {
    const validIds = group.positionIds.filter(id => positions.some(p => p.id === id));
    if (validIds.length === 0) {
      toast.error('No positions found in this group');
      return;
    }
    selectMultiplePositions(validIds);
    toast.success(`Selected ${validIds.length} positions from "${group.name}"`);
  }, [positions, selectMultiplePositions]);

  const deleteGroup = useCallback((id: string) => {
    const updated = groups.filter(g => g.id !== id);
    setGroups(updated);
    savedGroups = updated;
  }, [groups]);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          Position Groups
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Save new group */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-1.5">
          <Input
            placeholder="Group name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-7 text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && saveGroup()}
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveGroup}>
            <Plus className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground font-mono">
          {selectedPositionIds.length} positions selected
        </p>
      </div>

      {/* Group list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {groups.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              Select positions and save as a group for quick recall
            </p>
          )}
          {groups.map(group => {
            const validCount = group.positionIds.filter(id => positions.some(p => p.id === id)).length;
            return (
              <div
                key={group.id}
                className="flex items-center gap-2 p-2 rounded bg-surface-2/50 hover:bg-surface-2 border border-border/30 transition-colors group"
              >
                <button
                  onClick={() => recallGroup(group)}
                  className="flex-1 flex items-center gap-2 text-left"
                >
                  <MousePointer className="w-3 h-3 text-primary" />
                  <div>
                    <div className="text-[10px] font-bold text-foreground">{group.name}</div>
                    <div className="text-[9px] text-muted-foreground font-mono">{validCount} positions</div>
                  </div>
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
