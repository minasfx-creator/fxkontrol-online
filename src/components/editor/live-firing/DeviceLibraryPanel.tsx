/**
 * Device Library Panel — LIB_SHOWVEN + LIB_USER
 * Matches FXcommander Add Device interface with device selection, effects, safety channels
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Save, Upload, Download, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { DeviceLibEntry, DeviceEffect, SFXChannel } from './types';
import { SHOWVEN_LIBRARY, SFX_TYPES } from './constants';

interface DeviceLibraryPanelProps {
  fs: boolean;
  channels: SFXChannel[];
  onAddDevice: (entry: DeviceLibEntry, startAddress: number, count: number) => void;
  onBack: () => void;
}

export default function DeviceLibraryPanel({ fs, channels, onAddDevice, onBack }: DeviceLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<'showven' | 'user'>('showven');
  const [userLib, setUserLib] = useState<DeviceLibEntry[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceLibEntry | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<DeviceEffect | null>(null);
  const [startAddress, setStartAddress] = useState(1);
  const [deviceCount, setDeviceCount] = useState(1);

  // Editing
  const [editName, setEditName] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editChannels, setEditChannels] = useState(2);
  const [editEffectName, setEditEffectName] = useState('');
  const [editEffectDesc, setEditEffectDesc] = useState('');
  const [editEffectDuration, setEditEffectDuration] = useState(0);
  const [editSafetyChannel, setEditSafetyChannel] = useState(0);
  const [editSafetyValue, setEditSafetyValue] = useState(255);

  const library = activeTab === 'showven' ? SHOWVEN_LIBRARY : userLib;

  const autoAddress = useCallback(() => {
    const maxUsed = channels.reduce((max, ch) => Math.max(max, ch.dmxAddress + ch.dmxChannels - 1), 0);
    setStartAddress(maxUsed + 1);
  }, [channels]);

  const handleAdd = useCallback(() => {
    if (!selectedDevice) return;
    onAddDevice(selectedDevice, startAddress, deviceCount);
    toast.success(`Added ${deviceCount}× ${selectedDevice.name} at DMX ${startAddress}`);
  }, [selectedDevice, startAddress, deviceCount, onAddDevice]);

  const handleCreateDevice = useCallback(() => {
    const newDev: DeviceLibEntry = {
      id: `user-${Date.now()}`,
      name: editName || 'New Device',
      manufacturer: editManufacturer,
      dmxChannels: editChannels,
      effects: [{ id: `eff-${Date.now()}`, name: 'new_effect_1', description: 'None', duration: 0, channelValues: [] }],
      safetyChannel: editSafetyChannel || undefined,
      safetyValue: editSafetyValue,
      category: 'user',
    };
    setUserLib(prev => [...prev, newDev]);
    setSelectedDevice(newDev);
    toast.success('Device created');
  }, [editName, editManufacturer, editChannels, editSafetyChannel, editSafetyValue]);

  const labelCn = cn("font-bold text-muted-foreground/40 uppercase tracking-wider", fs ? "text-[9px]" : "text-[6px]");
  const inputCn = cn("bg-transparent border-border/15 font-mono", fs ? "h-7 text-xs" : "h-5 text-[8px]");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("flex items-center gap-2 border-b border-border/15", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 10% 8%)' }}>
        <button onClick={onBack} className="text-muted-foreground/40 hover:text-foreground transition-colors">
          <ArrowLeft className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
        </button>
        <span className={cn("font-bold text-foreground/60 uppercase tracking-wider", fs ? "text-xs" : "text-[8px]")}>Add Device</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Library list */}
        <div className={cn("border-r border-border/15 flex flex-col", fs ? "w-52" : "w-36")}>
          {/* Tab */}
          <div className="flex border-b border-border/15">
            {(['showven', 'user'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSelectedDevice(null); }}
                className={cn(
                  "flex-1 font-bold uppercase tracking-wider transition-all border-b-2",
                  fs ? "py-2 text-[9px]" : "py-1.5 text-[6px]",
                  activeTab === tab ? "text-primary border-primary" : "text-muted-foreground/30 border-transparent"
                )}>
                LIB_{tab === 'showven' ? 'SHOWVEN' : 'USER'}
              </button>
            ))}
          </div>

          {/* Device list */}
          <ScrollArea className="flex-1">
            {library.map(dev => (
              <button key={dev.id} onClick={() => { setSelectedDevice(dev); setSelectedEffect(dev.effects[0] || null); setEditName(dev.name); setEditManufacturer(dev.manufacturer); setEditChannels(dev.dmxChannels); }}
                className={cn(
                  "w-full text-left border-b border-border/5 transition-all",
                  fs ? "px-3 py-2 text-[10px]" : "px-2 py-1 text-[7px]",
                  selectedDevice?.id === dev.id ? "bg-primary/10 text-primary" : "text-foreground/60 hover:bg-surface-2/30"
                )}>
                <div className="font-bold truncate">{dev.name}</div>
                {dev.manufacturer && <div className={cn("text-muted-foreground/30", fs ? "text-[8px]" : "text-[5px]")}>{dev.manufacturer}</div>}
              </button>
            ))}
          </ScrollArea>

          {/* Device option buttons */}
          <div className={cn("flex gap-1 border-t border-border/15", fs ? "p-2" : "p-1")}>
            {activeTab === 'user' && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCreateDevice} className={cn(fs ? "text-[8px] h-6" : "text-[6px] h-4")}>
                  <Plus className="w-2.5 h-2.5 mr-0.5" /> Create
                </Button>
                <Button variant="ghost" size="sm" className={cn(fs ? "text-[8px] h-6" : "text-[6px] h-4")}>
                  <Trash2 className="w-2.5 h-2.5 mr-0.5" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Right — Device details + effects */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {selectedDevice ? (
            <>
              {/* Edit device */}
              <div className={cn("border-b border-border/15 space-y-1.5", fs ? "p-4" : "p-2")} style={{ background: 'hsl(220 12% 7%)' }}>
                <span className={labelCn}>Edit Device</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className={cn("text-muted-foreground/30 block", fs ? "text-[8px]" : "text-[5px]")}>ProductName *</span>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className={inputCn} readOnly={activeTab === 'showven'} />
                  </div>
                  <div>
                    <span className={cn("text-muted-foreground/30 block", fs ? "text-[8px]" : "text-[5px]")}>Manufacturer</span>
                    <Input value={editManufacturer} onChange={e => setEditManufacturer(e.target.value)} className={inputCn} readOnly={activeTab === 'showven'} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-muted-foreground/30", fs ? "text-[8px]" : "text-[5px]")}>DMX Channels:</span>
                  <span className={cn("font-mono font-bold text-foreground/60", fs ? "text-xs" : "text-[8px]")}>{selectedDevice.dmxChannels}</span>
                </div>
              </div>

              {/* Safety channel */}
              <div className={cn("border-b border-border/15 space-y-1", fs ? "p-4" : "p-2")} style={{ background: 'hsl(220 10% 8%)' }}>
                <span className={labelCn}>SafeChannel Setting</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className={cn("text-muted-foreground/30 block", fs ? "text-[8px]" : "text-[5px]")}>Channel</span>
                    <Input type="number" value={selectedDevice.safetyChannel || ''} className={inputCn} readOnly={activeTab === 'showven'} />
                  </div>
                  <div>
                    <span className={cn("text-muted-foreground/30 block", fs ? "text-[8px]" : "text-[5px]")}>Value</span>
                    <Input type="number" value={selectedDevice.safetyValue || 255} className={inputCn} readOnly={activeTab === 'showven'} />
                  </div>
                </div>
              </div>

              {/* Effect list */}
              <div className={cn("border-b border-border/15 space-y-1", fs ? "p-4" : "p-2")} style={{ background: 'hsl(220 12% 7%)' }}>
                <span className={labelCn}>Effect Option</span>
                <ScrollArea className={cn(fs ? "max-h-32" : "max-h-20")}>
                  {selectedDevice.effects.map(eff => (
                    <button key={eff.id} onClick={() => setSelectedEffect(eff)}
                      className={cn(
                        "w-full text-left rounded transition-all",
                        fs ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[7px]",
                        selectedEffect?.id === eff.id ? "bg-primary/10 text-primary" : "text-foreground/50 hover:bg-surface-2/20"
                      )}>
                      {eff.name}
                    </button>
                  ))}
                </ScrollArea>
              </div>

              {/* Start DMX address + count */}
              <div className={cn("border-b border-border/15 space-y-1.5", fs ? "p-4" : "p-2")} style={{ background: 'hsl(220 10% 8%)' }}>
                <span className={labelCn}>Start DMX Address</span>
                <div className="flex items-center gap-2">
                  <Input type="number" value={startAddress} onChange={e => setStartAddress(Number(e.target.value))} className={cn(inputCn, "flex-1")} min={1} max={512} />
                  <button onClick={autoAddress} className={cn("rounded bg-primary/15 text-primary font-bold border border-primary/30", fs ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[7px]")}>AUTO</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-muted-foreground/30", fs ? "text-[9px]" : "text-[6px]")}>Device count:</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDeviceCount(Math.max(1, deviceCount - 1))} className={cn("rounded bg-surface-2/40 text-foreground/50 font-bold", fs ? "w-6 h-6 text-sm" : "w-4 h-4 text-[10px]")}>-</button>
                    <span className={cn("font-mono font-bold text-foreground/60 w-6 text-center", fs ? "text-sm" : "text-[9px]")}>{deviceCount}</span>
                    <button onClick={() => setDeviceCount(deviceCount + 1)} className={cn("rounded bg-surface-2/40 text-foreground/50 font-bold", fs ? "w-6 h-6 text-sm" : "w-4 h-4 text-[10px]")}>+</button>
                  </div>
                </div>
                <Button size="sm" onClick={handleAdd} className={cn("w-full font-bold uppercase tracking-wider", fs ? "h-9 text-xs" : "h-6 text-[8px]")}>
                  <Plus className={cn(fs ? "w-4 h-4" : "w-3 h-3", "mr-1")} /> Add
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className={cn("text-muted-foreground/20", fs ? "text-sm" : "text-[9px]")}>Select a device from the library</span>
            </div>
          )}
        </div>
      </div>

      {/* Import/Export */}
      <div className={cn("flex gap-1 border-t border-border/20", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 12% 6%)' }}>
        <Button variant="ghost" size="sm" className={cn("flex-1", fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
          <Upload className="w-2.5 h-2.5 mr-1" /> Import
        </Button>
        <Button variant="ghost" size="sm" className={cn("flex-1", fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
          <Download className="w-2.5 h-2.5 mr-1" /> Export
        </Button>
      </div>
    </div>
  );
}
