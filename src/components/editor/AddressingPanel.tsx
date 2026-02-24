import { useState, useMemo } from 'react';
import { Cpu, Lock, Unlock, Zap, Plus, Trash2, ArrowUpDown, Box, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddressingStore, DEFAULT_MODULE_SPECS, type AddressSortMode } from '@/store/useAddressingStore';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRackStore } from '@/store/useRackStore';
import { cn } from '@/lib/utils';

export default function AddressingPanel({ onClose }: { onClose: () => void }) {
  const {
    addresses, moduleSpecs, activeModuleSpecId, splitterBoxes, firingSystems, sortMode,
    setActiveModuleSpec, autoAssign, clearAddresses, toggleLock, setAddress, removeAddress,
    setSortMode, addSplitterBox, removeSplitterBox, addFiringSystem, removeFiringSystem,
  } = useAddressingStore();

  const { timelineItems, positions } = useProjectStore();
  const { racks } = useRackStore();
  const [tab, setTab] = useState<'addresses' | 'modules' | 'splitters' | 'systems'>('addresses');

  const activeSpec = moduleSpecs.find(m => m.id === activeModuleSpecId);

  // Build sorted address list
  const sortedItems = useMemo(() => {
    const pyroItems = timelineItems
      .filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework')
      .sort((a, b) => a.startTime - b.startTime);

    const addrMap = new Map(addresses.map(a => [a.timelineItemId, a]));

    const items = pyroItems.map(item => ({
      item,
      effect: EFFECT_LIBRARY.find(e => e.id === item.effectId)!,
      addr: addrMap.get(item.id),
    }));

    if (sortMode === 'module') {
      items.sort((a, b) => {
        if (!a.addr && !b.addr) return 0;
        if (!a.addr) return 1;
        if (!b.addr) return -1;
        return (a.addr.module * 10000 + a.addr.slat * 100 + a.addr.pin) -
               (b.addr.module * 10000 + b.addr.slat * 100 + b.addr.pin);
      });
    }

    return items;
  }, [timelineItems, addresses, sortMode]);

  const handleAutoAssign = () => {
    const ids = sortedItems.map(s => s.item.id);
    autoAssign(ids);
  };

  const handleRackAssign = () => {
    // Assign addresses based on rack tube order
    if (racks.length === 0) return;
    const ids = sortedItems.map(s => s.item.id);
    autoAssign(ids);
    // Tag with rack IDs
    for (const rack of racks) {
      for (let i = 0; i < rack.tubes.length && i < ids.length; i++) {
        const existing = addresses.find(a => a.timelineItemId === ids[i]);
        if (existing) {
          setAddress({ ...existing, rackId: rack.id });
        }
      }
    }
  };

  const totalPins = activeSpec ? activeSpec.slatCount * activeSpec.pinsPerSlat : 0;
  const assignedCount = addresses.length;
  const lockedCount = addresses.filter(a => a.locked).length;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Addressing</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['addresses', 'modules', 'splitters', 'systems'] as const).map(t => (
          <button
            key={t}
            className={cn(
              "flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(t)}
          >
            {t === 'addresses' ? 'Addr' : t === 'modules' ? 'Modules' : t === 'splitters' ? 'Split' : 'Sys'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {tab === 'addresses' && (
          <div>
            {/* Controls */}
            <div className="p-2 border-b border-border space-y-1.5">
              <div className="flex gap-1">
                <Select value={activeModuleSpecId} onValueChange={setActiveModuleSpec}>
                  <SelectTrigger className="h-6 text-[9px] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleSpecs.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-[10px]">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[9px] gap-1 flex-1" onClick={handleAutoAssign}>
                  <Zap className="h-3 w-3" /> Auto-Assign
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={clearAddresses}>
                  Clear
                </Button>
              </div>
              {racks.length > 0 && (
                <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1 w-full" onClick={handleRackAssign}>
                  <Box className="h-3 w-3" /> Rack-Based Assign
                </Button>
              )}
              <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                <span>{assignedCount}/{sortedItems.length} assigned</span>
                <span>🔒 {lockedCount} locked</span>
                <span>{activeSpec?.name}: {totalPins} pins/module</span>
              </div>
              <div className="flex gap-1">
                <span className="text-[8px] text-muted-foreground leading-6">Sort:</span>
                {(['time', 'module', 'position', 'rack'] as AddressSortMode[]).map(m => (
                  <button
                    key={m}
                    className={cn("text-[8px] px-1.5 py-0.5 rounded", sortMode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                    onClick={() => setSortMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Address list */}
            <table className="w-full text-[8px] font-mono-code border-collapse">
              <thead className="sticky top-0 bg-surface-1">
                <tr className="border-b border-border">
                  <th className="px-1 py-0.5 text-left text-muted-foreground">🔒</th>
                  <th className="px-1 py-0.5 text-left text-muted-foreground">M</th>
                  <th className="px-1 py-0.5 text-left text-muted-foreground">S</th>
                  <th className="px-1 py-0.5 text-left text-muted-foreground">P</th>
                  <th className="px-1 py-0.5 text-left text-muted-foreground">Time</th>
                  <th className="px-1 py-0.5 text-left text-muted-foreground">Effect</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(({ item, effect, addr }) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/20 hover:bg-surface-2/30",
                      addr?.locked && "bg-warning/5"
                    )}
                  >
                    <td className="px-1 py-0.5">
                      {addr && (
                        <button onClick={() => toggleLock(item.id)} className="text-muted-foreground hover:text-foreground">
                          {addr.locked ? <Lock className="h-2.5 w-2.5 text-warning" /> : <Unlock className="h-2.5 w-2.5" />}
                        </button>
                      )}
                    </td>
                    <td className="px-1 py-0.5 text-primary">{addr?.module ?? '—'}</td>
                    <td className="px-1 py-0.5">{addr?.slat ?? '—'}</td>
                    <td className="px-1 py-0.5">{addr?.pin ?? '—'}</td>
                    <td className="px-1 py-0.5 text-muted-foreground">{item.startTime.toFixed(2)}s</td>
                    <td className="px-1 py-0.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: effect.color }} />
                        <span className="truncate max-w-[80px]">{effect.name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sortedItems.length === 0 && (
              <div className="px-2 py-6 text-center">
                <Cpu className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[9px] text-muted-foreground/60">Add pyro effects to the timeline first</p>
              </div>
            )}
          </div>
        )}

        {tab === 'modules' && (
          <div className="p-2 space-y-2">
            <p className="text-[9px] text-muted-foreground mb-2">Module specifications define slat/pin layout per firing system module.</p>
            {moduleSpecs.map(spec => (
              <div key={spec.id} className="bg-surface-2 rounded border border-border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Cable className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-foreground flex-1">{spec.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[8px] text-muted-foreground">
                  <span>Slats: {spec.slatCount}</span>
                  <span>Pins/Slat: {spec.pinsPerSlat}</span>
                  <span>Total: {spec.slatCount * spec.pinsPerSlat}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'splitters' && (
          <div className="p-2 space-y-2">
            <p className="text-[9px] text-muted-foreground mb-2">Splitter boxes create virtual slats from a single physical pin, enabling more cues per module.</p>
            <Button
              size="sm" className="h-6 text-[9px] gap-1 w-full"
              onClick={() => addSplitterBox({
                id: `split-${Date.now()}`,
                name: `Splitter ${splitterBoxes.length + 1}`,
                parentModule: 1,
                parentSlat: 1,
                parentPin: 1,
                virtualPinCount: 8,
              })}
            >
              <Plus className="h-3 w-3" /> Add Splitter Box
            </Button>
            {splitterBoxes.map(box => (
              <div key={box.id} className="bg-surface-2 rounded border border-border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Box className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-semibold flex-1">{box.name}</span>
                  <button onClick={() => removeSplitterBox(box.id)} className="text-destructive/40 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[8px] text-muted-foreground">
                  Parent: M{box.parentModule} S{box.parentSlat} P{box.parentPin} → {box.virtualPinCount} virtual pins
                </div>
              </div>
            ))}
            {splitterBoxes.length === 0 && (
              <p className="text-[9px] text-muted-foreground/60 text-center py-4">No splitter boxes configured</p>
            )}
          </div>
        )}

        {tab === 'systems' && (
          <div className="p-2 space-y-2">
            <p className="text-[9px] text-muted-foreground mb-2">Multiple firing systems / universes allow independent addressing for different controller networks.</p>
            <Button
              size="sm" className="h-6 text-[9px] gap-1 w-full"
              onClick={() => addFiringSystem({
                id: `fs-${Date.now()}`,
                name: `System ${firingSystems.length + 1}`,
                moduleSpec: activeModuleSpecId,
              })}
            >
              <Plus className="h-3 w-3" /> Add Firing System
            </Button>
            {firingSystems.map(fs => (
              <div key={fs.id} className="bg-surface-2 rounded border border-border p-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-warning" />
                  <span className="text-[10px] font-semibold flex-1">{fs.name}</span>
                  {fs.id !== 'default' && (
                    <button onClick={() => removeFiringSystem(fs.id)} className="text-destructive/40 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-[8px] text-muted-foreground mt-0.5">
                  Module: {moduleSpecs.find(m => m.id === fs.moduleSpec)?.name || '?'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
