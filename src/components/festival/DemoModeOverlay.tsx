/**
 * DemoModeOverlay — persistent corner banner that warns the operator the
 * current show is a SIMULATED demo (provenance: marketing_hypothesis).
 *
 * Always visible while mounted; aria-live="polite" announces "demo mode"
 * to screen readers. WCAG AA contrast (warm amber on Vantablack).
 */

import { useEffect, useState } from 'react';

export interface DemoModeOverlayProps {
  showId: string;
  /** PT or EN; default PT. */
  lang?: 'pt' | 'en';
  /** Optional callback to open seed source modal. */
  onShowSource?: () => void;
}

const LABELS = {
  pt: {
    chip: 'DEMO',
    msg: 'CUES SIMULADOS · NÃO É SHOW REAL',
    src: 'Ver código do seed',
    aria: 'Modo demonstração ativado. Cues são simulados.',
  },
  en: {
    chip: 'DEMO',
    msg: 'SIMULATED CUES · NOT A LIVE SHOW',
    src: 'View seed source',
    aria: 'Demo mode active. Cues are simulated.',
  },
} as const;

export function DemoModeOverlay({ showId, lang = 'pt', onShowSource }: DemoModeOverlayProps) {
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    setAnnounced(true);
  }, []);
  const t = LABELS[lang];
  return (
    <div
      role="status"
      aria-live="polite"
      data-show-id={showId}
      className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 rounded-md border border-amber-400/60 bg-[hsl(45_95%_15%/0.92)] px-3 py-2 text-amber-100 shadow-lg backdrop-blur-sm"
      style={{ pointerEvents: 'auto' }}
    >
      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
        {t.chip}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide">{t.msg}</span>
      {onShowSource && (
        <button
          onClick={onShowSource}
          className="ml-2 rounded border border-amber-300/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200 hover:bg-amber-400/10 focus:outline-none focus:ring-2 focus:ring-amber-300"
          type="button"
        >
          {t.src}
        </button>
      )}
      {announced && <span className="sr-only">{t.aria}</span>}
    </div>
  );
}
