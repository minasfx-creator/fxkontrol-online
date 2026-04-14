import { useState, useEffect, useCallback } from 'react';
import { Gauge, Play, Pause, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import {
  DEFAULT_PID_CONFIG,
  PID_PRESETS,
  createDronePhysics,
  stepDronePhysics,
  computePowerDraw,
  type DronePIDConfig,
  type DronePhysicsState,
} from '@/lib/pidController';

function SliderRow({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-[10px] font-mono-code text-foreground">{value.toFixed(2)}{unit || ''}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export default function PIDPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<DronePIDConfig>({ ...DEFAULT_PID_CONFIG });
  const [preset, setPreset] = useState('Custom');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testDrone, setTestDrone] = useState<DronePhysicsState | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [stats, setStats] = useState({ speed: 0, power: 0, tilt: 0 });

  const selectPreset = (name: string) => {
    setPreset(name);
    if (PID_PRESETS[name]) {
      setConfig({ ...PID_PRESETS[name] });
    }
  };

  const startTest = useCallback(() => {
    setTestDrone(createDronePhysics(0, 0, 0));
    setTestRunning(true);
  }, []);

  // Simple test simulation loop
  useEffect(() => {
    if (!testRunning || !testDrone) return;
    const target = { x: 10, y: 20, z: 5, yaw: 90 };
    let drone = testDrone;
    let animId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      drone = stepDronePhysics(drone, target, config, dt);
      setTestDrone({ ...drone });

      const speed = Math.sqrt(drone.vx ** 2 + drone.vy ** 2 + drone.vz ** 2);
      const power = computePowerDraw(speed, config.mass);
      const tilt = Math.sqrt(drone.pitch ** 2 + drone.roll ** 2);
      setStats({ speed, power, tilt });

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [testRunning, config]);

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">PID Controller</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Preset selector */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Preset do Drone</span>
          <Select value={preset} onValueChange={selectPreset}>
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PID_PRESETS).map(name => (
                <SelectItem key={name} value={name} className="text-[10px]">{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Test flight stats */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-primary font-mono-code">{stats.speed.toFixed(1)}</p>
            <p className="text-[8px] text-muted-foreground">m/s</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-electric font-mono-code">{stats.power.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">Watts</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold font-mono-code" style={{ color: stats.tilt > 20 ? 'hsl(var(--destructive))' : 'hsl(var(--success))' }}>
              {stats.tilt.toFixed(1)}°
            </p>
            <p className="text-[8px] text-muted-foreground">Tilt</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={testRunning ? 'destructive' : 'default'}
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={() => testRunning ? setTestRunning(false) : startTest()}
          >
            {testRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {testRunning ? 'Pausar' : 'Testar Voo'}
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setTestRunning(false); setTestDrone(null); setStats({ speed: 0, power: 0, tilt: 0 }); }}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {/* Position PID */}
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">PID Posição (X/Z)</p>
          <SliderRow label="Kp" value={config.position.kp} onChange={v => setConfig(c => ({ ...c, position: { ...c.position, kp: v } }))} min={0} max={10} step={0.1} />
          <SliderRow label="Ki" value={config.position.ki} onChange={v => setConfig(c => ({ ...c, position: { ...c.position, ki: v } }))} min={0} max={1} step={0.01} />
          <SliderRow label="Kd" value={config.position.kd} onChange={v => setConfig(c => ({ ...c, position: { ...c.position, kd: v } }))} min={0} max={10} step={0.1} />
        </div>

        {/* Altitude PID */}
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">PID Altitude (Y)</p>
          <SliderRow label="Kp" value={config.altitude.kp} onChange={v => setConfig(c => ({ ...c, altitude: { ...c.altitude, kp: v } }))} min={0} max={15} step={0.1} />
          <SliderRow label="Ki" value={config.altitude.ki} onChange={v => setConfig(c => ({ ...c, altitude: { ...c.altitude, ki: v } }))} min={0} max={1} step={0.01} />
          <SliderRow label="Kd" value={config.altitude.kd} onChange={v => setConfig(c => ({ ...c, altitude: { ...c.altitude, kd: v } }))} min={0} max={10} step={0.1} />
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          <Settings2 className="h-3 w-3" />
          {showAdvanced ? 'Ocultar avançado' : 'Mostrar avançado'}
        </button>

        {showAdvanced && (
          <div className="space-y-2 border-t border-border/50 pt-2">
            <SliderRow label="Massa" value={config.mass} onChange={v => setConfig(c => ({ ...c, mass: v }))} min={0.1} max={15} step={0.1} unit="kg" />
            <SliderRow label="Empuxo Máx" value={config.maxThrust} onChange={v => setConfig(c => ({ ...c, maxThrust: v }))} min={1} max={200} step={1} unit="N" />
            <SliderRow label="Drag" value={config.dragCoeff} onChange={v => setConfig(c => ({ ...c, dragCoeff: v }))} min={0} max={2} step={0.05} />
            <SliderRow label="Inclinação Máx" value={config.maxTiltAngle} onChange={v => setConfig(c => ({ ...c, maxTiltAngle: v }))} min={5} max={60} step={1} unit="°" />
            <SliderRow label="Yaw Máx" value={config.maxYawRate} onChange={v => setConfig(c => ({ ...c, maxYawRate: v }))} min={10} max={360} step={5} unit="°/s" />
          </div>
        )}

        {/* Test drone position */}
        {testDrone && (
          <div className="bg-surface-2 rounded-sm p-2 text-[9px] font-mono-code text-muted-foreground space-y-0.5">
            <p>Pos: ({testDrone.x.toFixed(1)}, {testDrone.y.toFixed(1)}, {testDrone.z.toFixed(1)})</p>
            <p>Vel: ({testDrone.vx.toFixed(2)}, {testDrone.vy.toFixed(2)}, {testDrone.vz.toFixed(2)})</p>
            <p>Tilt: R={testDrone.roll.toFixed(1)}° P={testDrone.pitch.toFixed(1)}° Y={testDrone.yaw.toFixed(1)}°</p>
          </div>
        )}

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Kp:</strong> Resposta proporcional ao erro</p>
          <p><strong>Ki:</strong> Corrige desvio acumulado (steady-state)</p>
          <p><strong>Kd:</strong> Amortece oscilações (damping)</p>
          <p className="text-primary/70">Ajuste Kp alto → resposta rápida, Kd alto → menos overshoot</p>
        </div>
      </div>
    </div>
  );
}
