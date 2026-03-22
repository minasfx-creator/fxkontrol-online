import { useState, useMemo } from 'react';
import { Cpu, Lock, Unlock, Zap, Plus, Trash2, ArrowUpDown, Box, Cable, Wifi, Usb, RefreshCw, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAddressingStore, DEFAULT_MODULE_SPECS, type AddressSortMode } from '@/store/useAddressingStore';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRackStore } from '@/store/useRackStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function getRssiColor(rssi?: number): string {
  if (rssi === undefined) return 'text-muted-foreground';
  if (rssi > -60) return 'text-green-400';
  if (rssi > -75) return 'text-yellow-400';
  return 'text-red-400';
}

export default function AddressingPanel({ onClose }: { onClose: () => void }) {
  const {
    addresses, moduleSpecs, activeModuleSpecId, splitterBoxes, firingSystems, sortMode,
    setActiveModuleSpec, autoAssign, clearAddresses, toggleLock, setAddress, removeAddress,
    setSortMode, addSplitterBox, removeSplitterBox, addFiringSystem, removeFiringSystem,
  } = useAddressingStore();

  const { timelineItems, positions } = useProjectStore();
  const { racks } = useRackStore();
  const hardware = useFireOneHardware();
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

  const handleSyncFromHardware = () => {
    if (!hardware.isConnected || hardware.modules.size === 0) {
      toast.error('Conecte ao hardware FireOne primeiro');
      return;
    }
    // Switch to IFMx-i32Q spec
    setActiveModuleSpec('fireone-i32q');
    // Auto-assign using discovered module count
    const ids = sortedItems.map(s => s.item.id);
    autoAssign(ids);
    toast.success(`Sync: ${hardware.modules.size} módulos IFMx-i32Q mapeados`);
  };

  const handleRackAssign = () => {
    if (racks.length === 0) return;
    const ids = sortedItems.map(s => s.item.id);
    autoAssign(ids);
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

  // Get hardware module info for an address
  const getHwModule = (addr?: { module: number }) => {
    if (!addr || !hardware.isConnected) return null;
    return hardware.modules.get(addr.module) || null;
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Addressing</h2>
        {hardware.isConnected && (
          <Badge variant="outline" className="text-[7px] px-1.5 py-0 border-green-500/40 text-green-400">
            <Signal className="h-2 w-2 mr-0.5" /> LIVE
          </Badge>
        )}
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

              {/* FireOne Hardware Sync */}
              {hardware.isConnected && (
                <Button
                  size="sm" variant="outline"
                  className="h-6 text-[9px] gap-1 w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={handleSyncFromHardware}
                >
                  <RefreshCw className="h-3 w-3" /> Sync from Hardware ({hardware.modules.size} modules)
                </Button>
              )}

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
              {hardware.isConnected && (
                <div className="flex items-center gap-2 text-[8px]">
                  <span className="text-green-400">
                    <Wifi className="h-2.5 w-2.5 inline mr-0.5" />{hardware.wirelessModuleCount} wireless
                  </span>
                  <span className="text-blue-400">
                    <Usb className="h-2.5 w-2.5 inline mr-0.5" />{hardware.wiredModuleCount} wired
                  </span>
                  {hardware.worstRssi !== null && (
                    <span className={getRssiColor(hardware.worstRssi)}>
                      RSSI: {hardware.worstRssi}dBm
                    </span>
                  )}
                </div>
              )}
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
                  <th className="px-1 py-0.5 text-left text-muted-foreground">Pos</th>
                  {hardware.isConnected && <th className="px-1 py-0.5 text-left text-muted-foreground">Link</th>}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(({ item, effect, addr }) => {
                  const hwMod = getHwModule(addr);
                  return (
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
                      {hardware.isConnected && (
                        <td className="px-1 py-0.5">
                          {hwMod ? (
                            <span className={cn("text-[7px]", hwMod.connectionMode === 'wireless' ? 'text-cyan-400' : hwMod.connectionMode === 'fallback' ? 'text-yellow-400 animate-pulse' : 'text-green-400')}>
                              {hwMod.connectionMode === 'wireless' ? <Wifi className="h-2 w-2 inline" /> : <Usb className="h-2 w-2 inline" />}
                            </span>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
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

            {/* Hardware discovered modules */}
            {hardware.isConnected && hardware.modules.size > 0 && (
              <div className="mb-3">
                <p className="text-[9px] text-green-400 font-semibold uppercase tracking-wider mb-1">
                  🟢 Discovered Hardware ({hardware.modules.size})
                </p>
                {Array.from(hardware.modules.entries()).map(([addr, mod]) => (
                  <div key={addr} className="bg-green-500/5 border border-green-500/20 rounded p-2 mb-1">
                    <div className="flex items-center gap-2 mb-1">
                      {mod.connectionMode === 'wireless' ? (
                        <Wifi className="h-3 w-3 text-cyan-400" />
                      ) : mod.connectionMode === 'fallback' ? (
                        <Wifi className="h-3 w-3 text-yellow-400 animate-pulse" />
                      ) : (
                        <Usb className="h-3 w-3 text-green-400" />
                      )}
                      <span className="text-[10px] font-semibold text-foreground flex-1">
                        IFMx-i32Q #{addr}
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[7px] px-1 py-0",
                        mod.connectionMode === 'wireless' ? 'border-cyan-500/40 text-cyan-400' :
                        mod.connectionMode === 'fallback' ? 'border-yellow-500/40 text-yellow-400' :
                        'border-green-500/40 text-green-400'
                      )}>
                        {(mod.connectionMode || 'wired').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[8px] text-muted-foreground">
                      <span>32 pins</span>
                      <span>Bat: {mod.batteryVoltage?.toFixed(1) ?? '—'}V</span>
                      {mod.rssiDbm !== undefined && (
                        <span className={getRssiColor(mod.rssiDbm)}>
                          RSSI: {mod.rssiDbm}dBm
                        </span>
                      )}
                    </div>
                    {mod.serialNumber && (
                      <div className="text-[7px] text-muted-foreground/60 mt-0.5">
                        S/N: {mod.serialNumber} {mod.firmwareVersion ? `• FW: ${mod.firmwareVersion}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {moduleSpecs.map(spec => (
              <div key={spec.id} className={cn(
                "bg-surface-2 rounded border border-border p-2",
                spec.id === 'fireone-i32q' && "border-primary/30 bg-primary/5"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Cable className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-foreground flex-1">{spec.name}</span>
                  {spec.id === 'fireone-i32q' && (
                    <Badge variant="outline" className="text-[7px] px-1 py-0 border-primary/40 text-primary">IFMx</Badge>
                  )}
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
