import { useState, useEffect, useCallback, useRef } from 'react';
import { Battery, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_BATTERY_CONFIG,
  BATTERY_PRESETS,
  createBatteryState,
  computeCurrentDraw,
  stepBattery,
  formatBatteryDisplay,
  type BatteryConfig,
  type BatteryState,
} from '@/lib/batteryModel';

function SliderRow({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-[10px] font-mono-code text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{unit || ''}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export default function BatteryPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<BatteryConfig>({ ...DEFAULT_BATTERY_CONFIG });
  const [preset, setPreset] = useState('Custom');
  const [batteryState, setBatteryState] = useState<BatteryState>(createBatteryState(DEFAULT_BATTERY_CONFIG));
  const [simRunning, setSimRunning] = useState(false);
  const [droneMass, setDroneMass] = useState(1.2);
  const [simSpeed, setSimSpeed] = useState(5.0); // m/s average
  const [windSpeed, setWindSpeed] = useState(0);
  const [ambientTemp, setAmbientTemp] = useState(20);
  const [distanceHome, setDistanceHome] = useState(50);
  const lastTime = useRef(performance.now());

  const selectPreset = (name: string) => {
    setPreset(name);
    if (BATTERY_PRESETS[name]) {
      const newConfig = { ...BATTERY_PRESETS[name] };
      setConfig(newConfig);
      setBatteryState(createBatteryState(newConfig, ambientTemp));
    }
  };

  const resetBattery = useCallback(() => {
    setBatteryState(createBatteryState(config, ambientTemp));
    setSimRunning(false);
  }, [config, ambientTemp]);

  useEffect(() => {
    if (!simRunning) return;
    lastTime.current = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - lastTime.current) / 1000, 0.1) * 10; // 10x speed
      lastTime.current = now;

      setBatteryState(prev => {
        const current = computeCurrentDraw(droneMass, simSpeed, windSpeed, 0, prev.voltage);
        return stepBattery(prev, config, current, dt, distanceHome);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [simRunning, config, droneMass, simSpeed, windSpeed, distanceHome]);

  const display = formatBatteryDisplay(batteryState);

  // Battery bar
  const barWidth = Math.max(0, Math.min(100, batteryState.percentRemaining));

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Battery className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Bateria</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Battery visual */}
        <div className="bg-surface-2 rounded-sm p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold font-mono-code" style={{ color: display.statusColor }}>
              {display.percentStr}
            </span>
            <span className="text-[10px] font-mono-code text-muted-foreground">{display.voltageStr}</span>
          </div>
          {/* Battery bar */}
          <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${barWidth}%`,
                backgroundColor: display.statusColor,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>⏱ {display.timeStr}</span>
            <span>⚡ {display.currentStr}</span>
            <span>{batteryState.remainingMah.toFixed(0)} mAh</span>
          </div>
        </div>

        {/* Alerts */}
        {batteryState.rtlRequired && (
          <div className="bg-destructive/20 border border-destructive/30 rounded-sm p-1.5 text-[9px] text-destructive font-semibold">
            ⚠️ RTL NECESSÁRIO — Energia insuficiente para retorno seguro
          </div>
        )}
        {batteryState.isCritical && !batteryState.rtlRequired && (
          <div className="bg-destructive/15 border border-destructive/20 rounded-sm p-1.5 text-[9px] text-destructive">
            🔴 Bateria CRÍTICA — Pouso imediato recomendado
          </div>
        )}
        {batteryState.isLow && !batteryState.isCritical && (
          <div className="bg-yellow-500/15 border border-yellow-500/20 rounded-sm p-1.5 text-[9px] text-yellow-500">
            🟡 Bateria baixa — Considerar retorno à base
          </div>
        )}

        {/* Preset */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Preset Bateria</span>
          <Select value={preset} onValueChange={selectPreset}>
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(BATTERY_PRESETS).map(name => (
                <SelectItem key={name} value={name} className="text-[10px]">{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={simRunning ? 'destructive' : 'default'}
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={() => setSimRunning(!simRunning)}
          >
            {simRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {simRunning ? 'Pausar' : 'Simular (10x)'}
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={resetBattery}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {/* Simulation params */}
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Condições de Voo</p>
          <SliderRow label="Massa Drone" value={droneMass} onChange={setDroneMass} min={0.1} max={10} step={0.1} unit="kg" />
          <SliderRow label="Velocidade Média" value={simSpeed} onChange={setSimSpeed} min={0} max={20} step={0.5} unit="m/s" />
          <SliderRow label="Vento" value={windSpeed} onChange={setWindSpeed} min={0} max={15} step={0.5} unit="m/s" />
          <SliderRow label="Temperatura" value={ambientTemp} onChange={v => { setAmbientTemp(v); resetBattery(); }} min={-10} max={45} step={1} unit="°C" />
          <SliderRow label="Distância Base" value={distanceHome} onChange={setDistanceHome} min={0} max={500} step={10} unit="m" />
        </div>

        {/* Battery config */}
        <div className="space-y-2 border-t border-border/50 pt-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Configuração Bateria</p>
          <SliderRow label="Capacidade" value={config.capacityMah} onChange={v => setConfig(c => ({ ...c, capacityMah: v }))} min={500} max={10000} step={100} unit="mAh" />
          <SliderRow label="Células" value={config.cellCount} onChange={v => setConfig(c => ({ ...c, cellCount: v }))} min={1} max={8} step={1} unit="S" />
        </div>

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Modelo:</strong> Descarga LiPo com derating por temperatura</p>
          <p><strong>RTL:</strong> Alerta quando energia insuficiente para retorno com 30% margem</p>
          <p className="text-primary/70">Simulação 10x mais rápida que tempo real</p>
        </div>
      </div>
    </div>
  );
}
