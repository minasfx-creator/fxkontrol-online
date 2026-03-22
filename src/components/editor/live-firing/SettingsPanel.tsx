/**
 * FXcommander™ Settings Panel — Global configuration
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { FXCSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { useDisplayStore } from '@/store/useDisplayStore';

interface SettingsPanelProps {
  fs: boolean;
  settings: FXCSettings;
  onSettingsChange: (s: FXCSettings) => void;
  relayConnected?: boolean;
  relayUrl?: string;
  onRelayUrlChange?: (url: string) => void;
  onConnectRelay?: () => void;
  onDisconnectRelay?: () => void;
}

export default function SettingsPanel({ fs, settings, onSettingsChange, relayConnected, relayUrl, onRelayUrlChange, onConnectRelay, onDisconnectRelay }: SettingsPanelProps) {
  const [local, setLocal] = useState<FXCSettings>({ ...settings });

  const update = (patch: Partial<FXCSettings>) => setLocal(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSettingsChange(local);
    toast.success('Settings saved');
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_SETTINGS });
    toast.info('Settings reset to defaults');
  };

  const labelCn = cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[8px]");
  const valueCn = cn("font-mono bg-transparent border-border/15", fs ? "h-8 text-xs" : "h-5 text-[8px]");
  const sectionCn = cn("border-b border-border/15", fs ? "px-4 py-3" : "px-2 py-2");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Language */}
      <div className={sectionCn} style={{ background: 'hsl(220 10% 8%)' }}>
        <span className={labelCn}>Language</span>
        <div className={cn("flex gap-1 mt-1.5")}>
          {['English', 'Deutsch', '中文', 'Español'].map(lang => (
            <button key={lang} onClick={() => update({ language: lang.toLowerCase().slice(0, 2) })}
              className={cn(
                "rounded border font-bold transition-all",
                fs ? "px-3 py-1.5 text-[10px]" : "px-2 py-1 text-[8px]",
                local.language === lang.toLowerCase().slice(0, 2)
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-surface-2/30 border-border/10 text-muted-foreground/30"
              )}>
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Wireless DMX */}
      <div className={sectionCn} style={{ background: 'hsl(220 12% 7%)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCn}>Wireless DMX</span>
          <Switch checked={local.wirelessDmxEnabled} onCheckedChange={v => update({ wirelessDmxEnabled: v })} />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-muted-foreground/40", fs ? "text-[9px]" : "text-[8px]")}>DMX ID:</span>
          <Input type="number" value={local.wirelessDmxId} onChange={e => update({ wirelessDmxId: Number(e.target.value) })}
            className={cn(valueCn, "w-16")} min={1} max={64} />
        </div>
      </div>

      {/* Global Safety Channel */}
      <div className={sectionCn} style={{ background: 'hsl(220 10% 8%)' }}>
        <span className={labelCn}>Global Safety Channel</span>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div>
            <span className={cn("text-muted-foreground/30 block mb-0.5", fs ? "text-[8px]" : "text-[8px]")}>Channel</span>
            <Input type="number" value={local.globalSafetyChannel} onChange={e => update({ globalSafetyChannel: Number(e.target.value) })}
              className={valueCn} min={1} max={512} />
          </div>
          <div>
            <span className={cn("text-muted-foreground/30 block mb-0.5", fs ? "text-[8px]" : "text-[8px]")}>Value</span>
            <Input type="number" value={local.globalSafetyValue} onChange={e => update({ globalSafetyValue: Number(e.target.value) })}
              className={valueCn} min={0} max={255} />
          </div>
        </div>
      </div>

      {/* Network */}
      <div className={sectionCn} style={{ background: 'hsl(220 12% 7%)' }}>
        <span className={labelCn}>Network</span>
        <div className="space-y-1.5 mt-1.5">
          {[
            { label: 'Art-Net IP', value: local.artNetIp, key: 'artNetIp' as const },
            { label: 'Art-Net Port', value: local.artNetPort, key: 'artNetPort' as const },
            { label: 'IP', value: local.networkIp, key: 'networkIp' as const },
            { label: 'Netmask', value: local.networkMask, key: 'networkMask' as const },
            { label: 'Gateway', value: local.networkGateway, key: 'networkGateway' as const },
            { label: 'TCP Port', value: local.tcpPort, key: 'tcpPort' as const },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-2">
              <span className={cn("text-muted-foreground/40 w-20 text-right shrink-0", fs ? "text-[9px]" : "text-[8px]")}>{f.label}:</span>
              <Input value={f.value} onChange={e => update({ [f.key]: typeof f.value === 'number' ? Number(e.target.value) : e.target.value })}
                className={cn(valueCn, "flex-1")} />
            </div>
          ))}
        </div>
      </div>

      {/* UDP Relay */}
      <div className={sectionCn} style={{ background: 'hsl(200 15% 7%)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCn}>UDP Relay (Art-Net Local)</span>
          <div className="flex items-center gap-1">
            <div className={cn("rounded-full", relayConnected ? "bg-cyan-400" : "bg-muted-foreground/20", "w-2 h-2")} style={relayConnected ? { boxShadow: '0 0 6px rgba(0,220,255,0.5)' } : undefined} />
            <span className={cn("font-mono", relayConnected ? "text-cyan-400/70" : "text-muted-foreground/30", fs ? "text-[9px]" : "text-[8px]")}>
              {relayConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Input value={relayUrl || 'ws://localhost:9001'} onChange={e => onRelayUrlChange?.(e.target.value)}
            className={cn(valueCn, "flex-1")} placeholder="ws://localhost:9001" />
          <Button size="sm" variant={relayConnected ? "destructive" : "default"}
            onClick={() => relayConnected ? onDisconnectRelay?.() : onConnectRelay?.()}
            className={cn(fs ? "h-8 text-[10px] px-3" : "h-5 text-[8px] px-2")}>
            {relayConnected ? 'Desconectar' : 'Conectar'}
          </Button>
        </div>
        <p className={cn("text-muted-foreground/30 mt-1", fs ? "text-[8px]" : "text-[8px]")}>
          Rode <code className="text-cyan-400/50">node artnet-relay.js --target {local.artNetIp}</code> no PC local
        </p>
      </div>

      {/* Safety */}
      <div className={sectionCn} style={{ background: 'hsl(220 10% 8%)' }}>
        <span className={labelCn}>Safety</span>
        <div className="space-y-2 mt-1.5">
          <div className="flex items-center justify-between">
            <span className={cn("text-muted-foreground/40", fs ? "text-[9px]" : "text-[8px]")}>Pyro ARM required for manual fire</span>
            <Switch checked={local.pyroArmRequired} onCheckedChange={v => update({ pyroArmRequired: v })} />
          </div>
          <div className="flex items-center justify-between">
            <span className={cn("text-muted-foreground/40", fs ? "text-[9px]" : "text-[8px]")}>Delete DEV and CUE need confirm</span>
            <Switch checked={local.deleteConfirm} onCheckedChange={v => update({ deleteConfirm: v })} />
          </div>
        </div>
      </div>

      {/* Backlight */}
      <div className={sectionCn} style={{ background: 'hsl(220 12% 7%)' }}>
        <div className="flex items-center justify-between">
          <span className={labelCn}>Backlight</span>
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[8px]")}>{local.backlight}%</span>
        </div>
        <Slider value={[local.backlight]} min={10} max={100} step={5} onValueChange={([v]) => update({ backlight: v })} className="mt-1.5" />
      </div>

      {/* Action buttons */}
      <div className={cn("flex gap-2 mt-auto border-t border-border/20", fs ? "px-4 py-3" : "px-2 py-2")} style={{ background: 'hsl(220 12% 6%)' }}>
        <Button variant="ghost" size="sm" onClick={handleReset} className={cn("flex-1", fs ? "h-9 text-xs" : "h-6 text-[8px]")}>
          <RotateCcw className={cn(fs ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "mr-1")} /> Reset
        </Button>
        <Button size="sm" onClick={handleSave} className={cn("flex-1", fs ? "h-9 text-xs" : "h-6 text-[8px]")}>
          <Save className={cn(fs ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "mr-1")} /> Save
        </Button>
      </div>
    </div>
  );
}
