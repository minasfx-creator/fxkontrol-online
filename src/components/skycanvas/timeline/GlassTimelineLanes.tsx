/**
 * GlassTimelineLanes — compact wrapper de FiringLanesTimelineLegacy
 * adaptado pro contexto glassmorphism (transparente, sem fundo opaco).
 * Pure presentation. Reutiliza split pyro/drone do legacy.
 */
import FiringLanes from '@/components/skycanvas/legacy-2604/TransportAndLanesLegacy';
// Re-export named para clareza
import { FiringLanesTimelineLegacy } from '@/components/skycanvas/legacy-2604/TransportAndLanesLegacy';

export interface GlassTimelineLanesProps {
  duration: number;
  time: number;
  onDropEffect?: (effectId: string, t: number, lane: 'pyro' | 'drone') => void;
}

export default function GlassTimelineLanes(props: GlassTimelineLanesProps) {
  // Wrapper transparente — neutraliza bg-zinc-950/60 do legacy via CSS sibling.
  return (
    <div className="glass-timeline-lanes-host flex-1 overflow-hidden [&>div]:!bg-transparent [&>div]:!border-t-0">
      <FiringLanesTimelineLegacy {...props} />
    </div>
  );
}

// Silence unused side-effect import (default of barrel).
void FiringLanes;
