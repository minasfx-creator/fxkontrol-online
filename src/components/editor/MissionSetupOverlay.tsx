/**
 * ─── MissionSetupOverlay — Pre-simulation confirmation gate ─────────
 * Blocks viewport interaction until user confirms mission parameters.
 * Industrial glassmorphism aesthetic with key mission data summary.
 */

import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Shield, Play, MapPin, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MissionSetupOverlayProps {
  onConfirm: () => void;
}

export default function MissionSetupOverlay({ onConfirm }: MissionSetupOverlayProps) {
  const projectName = useProjectStore(st => st.projectName);
  const duration = useProjectStore(st => st.duration);
  const cueCount = useProjectStore(st => st.timelineItems.length);
  const posCount = useProjectStore(st => st.positions.length);
  const gpsOrigin = useProjectStore(st => st.gpsOrigin);
  const [confirming, setConfirming] = useState(false);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => onConfirm(), 600);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="rounded-2xl border border-border/20 bg-card/95 backdrop-blur-xl p-8 max-w-md w-full mx-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Mission Setup
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {projectName || 'Novo Projeto'}
          </h2>
          <p className="text-xs text-muted-foreground">
            Revise os parâmetros antes de iniciar a simulação
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Clock className="w-4 h-4 text-sky-400" />}
            label="Duração"
            value={formatDuration(duration)}
          />
          <StatCard
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            label="Cues"
            value={cueCount.toString()}
          />
          <StatCard
            icon={<MapPin className="w-4 h-4 text-emerald-400" />}
            label="Posições"
            value={posCount.toString()}
          />
          <StatCard
            icon={<MapPin className="w-4 h-4 text-primary" />}
            label="Âncora GPS"
            value={`${gpsOrigin.lat.toFixed(3)}°`}
          />
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border text-emerald-400",
            confirming
              ? "bg-emerald-400/30 border-emerald-400/50"
              : "bg-emerald-400/15 border-emerald-400/30 hover:bg-emerald-400/25"
          )}
        >
          <Play className="w-4 h-4" />
          {confirming ? 'Iniciando simulação...' : 'Confirmar e Iniciar'}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/10 bg-muted/30 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
