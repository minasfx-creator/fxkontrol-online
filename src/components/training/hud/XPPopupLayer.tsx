/**
 * Training v2.1 — XPPopupLayer.
 *
 * Floating "+100 XP — perfect snap" labels that fade up and out.
 * Caps simultaneous popups (oldest auto-consumed) and applies a
 * subtle lane-stacking offset so multiple events don't collide
 * (GTA V style ticker stack).
 */

import { useEffect, useRef, useState } from 'react';

export interface XPPopup {
  id: string;
  amount: number;
  label: string;
  variant?: 'speed' | 'safety' | 'precision' | 'penalty';
}

interface Props {
  popups: XPPopup[];
  onConsumed: (id: string) => void;
  /** Hard cap — overflow auto-consumes oldest. Default 5. */
  maxVisible?: number;
}

const COLOR: Record<NonNullable<XPPopup['variant']>, string> = {
  speed:     'text-emerald-400',
  safety:    'text-cyan-300',
  precision: 'text-[hsl(28_100%_65%)]',
  penalty:   'text-destructive',
};

const ICON: Record<NonNullable<XPPopup['variant']>, string> = {
  speed:     '⚡',
  safety:    '🛡',
  precision: '◎',
  penalty:   '⚠',
};

export default function XPPopupLayer({ popups, onConsumed, maxVisible = 5 }: Props) {
  const consumedRef = useRef(onConsumed);
  consumedRef.current = onConsumed;

  // Auto-evict overflow (oldest first).
  useEffect(() => {
    if (popups.length <= maxVisible) return;
    const overflow = popups.slice(0, popups.length - maxVisible);
    overflow.forEach((p) => consumedRef.current(p.id));
  }, [popups, maxVisible]);

  const visible = popups.slice(-maxVisible);

  return (
    <div className="pointer-events-none absolute right-3 top-16 z-40 flex flex-col items-end gap-1">
      {visible.map((p, i) => (
        <XPItem
          key={p.id}
          popup={p}
          lane={i}
          onDone={() => consumedRef.current(p.id)}
        />
      ))}
    </div>
  );
}

function XPItem({ popup, lane, onDone }: { popup: XPPopup; lane: number; onDone: () => void }) {
  const [stage, setStage] = useState<'in' | 'out'>('in');
  useEffect(() => {
    const t1 = setTimeout(() => setStage('out'), 900);
    const t2 = setTimeout(onDone, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  const variant = popup.variant ?? 'speed';
  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-sm font-extrabold transition-all duration-500 ${COLOR[variant]}`}
      style={{
        opacity: stage === 'in' ? 1 : 0,
        transform: stage === 'in' ? `translateY(${lane * 2}px)` : 'translateY(-22px)',
        textShadow: '0 0 8px rgba(0,0,0,0.85)',
      }}
    >
      <span className="text-[11px] opacity-80">{ICON[variant]}</span>
      <span>{popup.amount > 0 ? '+' : ''}{popup.amount} XP</span>
      <span className="text-[11px] font-semibold opacity-85">— {popup.label}</span>
    </div>
  );
}
