/**
 * TimelineCuesTab — wraps the existing TimelineStrip cue lane as a dock tab.
 * The host (SkyCanvas) injects props via a tiny context so we keep TabbedDockPanel
 * generic (its tabs receive no props).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { TimelineStripProps } from '../timelineStripTypes';
import TimelineStripView from '@/components/skycanvas/TimelineStripView';

const Ctx = createContext<TimelineStripProps | null>(null);

export function TimelineCuesProvider({ value, children }: { value: TimelineStripProps; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export default function TimelineCuesTab() {
  const v = useContext(Ctx);
  if (!v) {
    return <div className="p-3 ds-mono text-[10px] text-zinc-500">Timeline indisponível</div>;
  }
  return <TimelineStripView {...v} />;
}
