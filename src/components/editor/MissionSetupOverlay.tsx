/**
 * ─── MissionSetupOverlay — Pre-simulation confirmation gate ─────────
 * Blocks viewport interaction until user confirms mission parameters.
 * Industrial glassmorphism aesthetic with key mission data summary.
 */

import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Shield, Play, MapPin, Clock, Zap } from 'lucide-react';

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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="rounded-2xl border p-8 max-w-md w-full mx-4 space-y-6"
        style={{
          background: 'hsla(240, 10%, 6%, 0.85)',
          backdropFilter: 'blur(32px)',
          borderColor: 'hsla(0, 0%, 100%, 0.1)',
        }}
      >
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border"
          style={{
            background: confirming
              ? 'hsla(142, 70%, 45%, 0.3)'
              : 'hsla(142, 70%, 45%, 0.15)',
            borderColor: confirming
              ? 'hsla(142, 70%, 45%, 0.5)'
              : 'hsla(142, 70%, 45%, 0.3)',
            color: 'hsl(142, 70%, 65%)',
          }}
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
    <div
      className="rounded-lg border px-3 py-2.5 space-y-1"
      style={{
        background: 'hsla(240, 10%, 8%, 0.6)',
        borderColor: 'hsla(0, 0%, 100%, 0.06)',
      }}
    >
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
