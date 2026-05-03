/**
 * Training v2.1 — XPPopupLayer.
 *
 * Floating "+100 XP — perfect snap" labels that fade up and out.
 */

import { useEffect, useState } from 'react';

export interface XPPopup {
  id: string;
  amount: number;
  label: string;
  variant?: 'speed' | 'safety' | 'precision' | 'penalty';
}

interface Props {
  popups: XPPopup[];
  onConsumed: (id: string) => void;
}

const COLOR: Record<NonNullable<XPPopup['variant']>, string> = {
  speed:     'text-emerald-400',
  safety:    'text-cyan-300',
  precision: 'text-[hsl(28_100%_65%)]',
  penalty:   'text-destructive',
};

export default function XPPopupLayer({ popups, onConsumed }: Props) {
  return (
    <div className="pointer-events-none absolute right-3 top-16 z-40 flex flex-col items-end gap-1">
      {popups.map((p) => (
        <XPItem key={p.id} popup={p} onDone={() => onConsumed(p.id)} />
      ))}
    </div>
  );
}

function XPItem({ popup, onDone }: { popup: XPPopup; onDone: () => void }) {
  const [stage, setStage] = useState<'in' | 'out'>('in');
  useEffect(() => {
    const t1 = setTimeout(() => setStage('out'), 900);
    const t2 = setTimeout(onDone, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div
      className={`font-mono text-sm font-extrabold transition-all duration-500 ${COLOR[popup.variant ?? 'speed']}`}
      style={{
        opacity: stage === 'in' ? 1 : 0,
        transform: stage === 'in' ? 'translateY(0)' : 'translateY(-18px)',
        textShadow: '0 0 8px rgba(0,0,0,0.8)',
      }}
    >
      {popup.amount > 0 ? '+' : ''}{popup.amount} XP — {popup.label}
    </div>
  );
}
