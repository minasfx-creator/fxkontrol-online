import { useState, useCallback, useEffect } from 'react';
import { Bug, Play, Pause, RotateCcw, Settings2, Circle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/store/useProjectStore';
import { useBoidsStore } from '@/store/useBoidsStore';
import {
  initBoids,
  minPairDistance,
  type BoidsConfig,
} from '@/lib/boidsEngine';
import { exportBoidsVVIZ, downloadFile } from '@/lib/exportEngine';
import { toast } from 'sonner';

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
  const { droneFormations, projectName } = useProjectStore();
  const {
    agents, config, running, seekTarget, recording, recordedFrames,
    setAgents, setConfig, setRunning, setSeekTarget, setRecording, clearRecording,
  } = useBoidsStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minDist, setMinDist] = useState(0);

  const initFromFormations = useCallback(() => {
    if (droneFormations.length === 0) return;
    const f = droneFormations[0];
    const positions = f.points.slice(0, f.droneCount).map(p => ({
      x: p.x, y: f.height, z: p.z,
    }));
    setAgents(initBoids(positions));
    setRunning(false);
  }, [droneFormations, setAgents, setRunning]);

  useEffect(() => {
    if (agents.length === 0) initFromFormations();
  }, [initFromFormations, agents.length]);

  useEffect(() => {
    if (agents.length < 2) return;
    const interval = setInterval(() => {
      setMinDist(minPairDistance(agents));
    }, 500);
    return () => clearInterval(interval);
  }, [agents]);

  const updateConfig = (key: keyof BoidsConfig, value: number) => {
    setConfig({ [key]: value });
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      toast.success(`Gravação finalizada: ${recordedFrames.length} frames`);
    } else {
      clearRecording();
      setRecording(true);
      if (!running) setRunning(true);
      toast.info('Gravando simulação Boids...');
    }
  };

  const handleExportVVIZ = () => {
    if (recordedFrames.length === 0) {
      toast.error('Grave a simulação antes de exportar');
      return;
    }
    const vviz = exportBoidsVVIZ(projectName || 'boids_sim', recordedFrames);
    downloadFile(vviz, `${projectName || 'boids'}_swarm.vviz`, 'application/json');
    toast.success('Exportado como VVIZ!');
  };

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
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
            <p className="text-sm font-bold font-mono-code" style={{ color: running ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}>
              {running ? 'ON' : 'OFF'}
            </p>
            <p className="text-[8px] text-muted-foreground">Status</p>
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
            onClick={() => { setRunning(false); initFromFormations(); clearRecording(); }}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {/* Record & Export */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={recording ? 'destructive' : 'outline'}
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={toggleRecording}
            disabled={agents.length === 0}
          >
            <Circle className={`h-3 w-3 ${recording ? 'fill-current animate-pulse' : ''}`} />
            {recording ? `REC (${recordedFrames.length})` : 'Gravar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={handleExportVVIZ}
            disabled={recordedFrames.length === 0}
          >
            <Download className="h-3 w-3" />
            VVIZ ({recordedFrames.length})
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Buscar formação-alvo</span>
          <Switch checked={seekTarget} onCheckedChange={setSeekTarget} />
        </div>

        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Regras Boids</p>
          <SliderField label="Separação" value={config.separationWeight} onChange={v => updateConfig('separationWeight', v)} min={0} max={5} step={0.1} />
          <SliderField label="Alinhamento" value={config.alignmentWeight} onChange={v => updateConfig('alignmentWeight', v)} min={0} max={5} step={0.1} />
          <SliderField label="Coesão" value={config.cohesionWeight} onChange={v => updateConfig('cohesionWeight', v)} min={0} max={5} step={0.1} />
        </div>

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

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Separação:</strong> Evita colisão entre drones vizinhos</p>
          <p><strong>Alinhamento:</strong> Iguala velocidade com vizinhos</p>
          <p><strong>Coesão:</strong> Move em direção ao centro do grupo</p>
          <p className="text-primary/70">🔴 Grave a simulação e exporte como .vviz</p>
        </div>
      </div>
    </div>
  );
}
