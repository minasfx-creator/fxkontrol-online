import { useState, useRef, useCallback, useEffect } from 'react';
import { Bug, Play, Pause, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/store/useProjectStore';
import {
  initBoids,
  stepBoids,
  minPairDistance,
  DEFAULT_BOIDS_CONFIG,
  type BoidAgent,
  type BoidsConfig,
} from '@/lib/boidsEngine';

function SliderField({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-[10px] font-mono-code text-foreground">{value.toFixed(1)}{unit || ''}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export default function BoidsPanel({ onClose }: { onClose: () => void }) {
  const { droneFormations, currentTime } = useProjectStore();
  const [config, setConfig] = useState<BoidsConfig>({ ...DEFAULT_BOIDS_CONFIG });
  const [running, setRunning] = useState(false);
  const [seekTarget, setSeekTarget] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [agents, setAgents] = useState<BoidAgent[]>([]);
  const [minDist, setMinDist] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  // Initialize from current formation
  const initFromFormations = useCallback(() => {
    if (droneFormations.length === 0) return;
    const f = droneFormations[0];
    const positions = f.points.slice(0, f.droneCount).map(p => ({
      x: p.x, y: f.height, z: p.z,
    }));
    setAgents(initBoids(positions));
    setStepCount(0);
  }, [droneFormations]);

  useEffect(() => {
    initFromFormations();
  }, [initFromFormations]);

  // Animation loop
  useEffect(() => {
    if (!running || agents.length === 0) return;

    lastTimeRef.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      setAgents(prev => {
        // Get target positions from current formation
        let targets: { x: number; y: number; z: number }[] | undefined;
        if (seekTarget && droneFormations.length > 0) {
          // Find active formation at current time
          for (const f of droneFormations) {
            const transEnd = f.startTime + f.transitionDuration;
            const holdEnd = transEnd + f.holdDuration;
            if (currentTime >= f.startTime && currentTime <= holdEnd) {
              targets = f.points.slice(0, f.droneCount).map(p => ({
                x: p.x, y: f.height, z: p.z,
              }));
              break;
            }
          }
        }

        const next = stepBoids(prev, dt, config, targets);
        setMinDist(minPairDistance(next));
        setStepCount(s => s + 1);
        return next;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [running, config, seekTarget, droneFormations, currentTime]);

  const updateConfig = (key: keyof BoidsConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Boids Swarm</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Status */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-primary font-mono-code">{agents.length}</p>
            <p className="text-[8px] text-muted-foreground">Agentes</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-electric font-mono-code">{minDist.toFixed(1)}m</p>
            <p className="text-[8px] text-muted-foreground">Dist Mín</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-safety font-mono-code">{stepCount}</p>
            <p className="text-[8px] text-muted-foreground">Steps</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={running ? 'destructive' : 'default'}
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={() => setRunning(!running)}
            disabled={agents.length === 0}
          >
            {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {running ? 'Pausar' : 'Simular'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1"
            onClick={() => { setRunning(false); initFromFormations(); }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>

        {/* Target seeking toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Buscar formação-alvo</span>
          <Switch checked={seekTarget} onCheckedChange={setSeekTarget} />
        </div>

        {/* Core parameters */}
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Regras Boids</p>
          <SliderField label="Separação" value={config.separationWeight} onChange={v => updateConfig('separationWeight', v)} min={0} max={5} step={0.1} />
          <SliderField label="Alinhamento" value={config.alignmentWeight} onChange={v => updateConfig('alignmentWeight', v)} min={0} max={5} step={0.1} />
          <SliderField label="Coesão" value={config.cohesionWeight} onChange={v => updateConfig('cohesionWeight', v)} min={0} max={5} step={0.1} />
        </div>

        {/* Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-3 w-3" />
          {showAdvanced ? 'Ocultar avançado' : 'Mostrar avançado'}
        </button>

        {showAdvanced && (
          <div className="space-y-2 border-t border-border/50 pt-2">
            <SliderField label="Raio Separação" value={config.separationRadius} onChange={v => updateConfig('separationRadius', v)} min={1} max={10} step={0.5} unit="m" />
            <SliderField label="Raio Vizinhança" value={config.neighborRadius} onChange={v => updateConfig('neighborRadius', v)} min={3} max={30} step={1} unit="m" />
            <SliderField label="Vel. Máxima" value={config.maxSpeed} onChange={v => updateConfig('maxSpeed', v)} min={1} max={15} step={0.5} unit="m/s" />
            <SliderField label="Força Máxima" value={config.maxForce} onChange={v => updateConfig('maxForce', v)} min={0.1} max={3} step={0.1} />
            <SliderField label="Peso Alvo" value={config.targetWeight} onChange={v => updateConfig('targetWeight', v)} min={0} max={3} step={0.1} />
            <SliderField label="Raio Limite" value={config.boundaryRadius} onChange={v => updateConfig('boundaryRadius', v)} min={10} max={100} step={5} unit="m" />
          </div>
        )}

        {/* Info */}
        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Separação:</strong> Evita colisão entre drones vizinhos</p>
          <p><strong>Alinhamento:</strong> Iguala velocidade com vizinhos</p>
          <p><strong>Coesão:</strong> Move em direção ao centro do grupo</p>
          <p className="text-primary/70">Baseado no modelo Boids de Craig Reynolds</p>
        </div>
      </div>
    </div>
  );
}
