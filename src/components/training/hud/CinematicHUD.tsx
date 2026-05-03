/**
 * Training v2 — HUD components (GTA V style).
 *
 * Letterbox, MissionTriangle, DialogueSubtitle, ScorePopup, StarRating.
 * Pure presentation. No game logic.
 */

import { useEffect, useState } from 'react';
import { Star, Triangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
export function CinematicLetterbox({ active }: { active: boolean }) {
  return (
    <>
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-40 bg-black transition-all duration-700 ease-out"
        style={{ height: active ? '12vh' : '0vh' }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0 z-40 bg-black transition-all duration-700 ease-out"
        style={{ height: active ? '12vh' : '0vh' }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
interface MissionTriangleProps {
  missionTitle: string;
  chapter: string;
  stageTitle: string;
  stageIndex: number;
  totalStages: number;
}
export function MissionTriangle({
  missionTitle,
  chapter,
  stageTitle,
  stageIndex,
  totalStages,
}: MissionTriangleProps) {
  return (
    <div className="absolute left-3 top-3 z-30 max-w-[260px]">
      <div className="rounded-md bg-gradient-to-br from-black/90 to-black/60 backdrop-blur-md border border-[hsl(28_100%_50%/0.3)] px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Triangle className="h-3 w-3 text-[hsl(28_100%_60%)] fill-[hsl(28_100%_60%)]" />
          <span className="text-[9px] uppercase tracking-widest font-mono text-[hsl(28_100%_60%)]">
            {chapter}
          </span>
        </div>
        <p className="text-sm font-bold text-foreground leading-tight">{missionTitle}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            ESTÁGIO {stageIndex + 1}/{totalStages}
          </span>
          <span className="text-[10px] text-foreground/80">·</span>
          <span className="text-[10px] text-foreground/80 truncate">{stageTitle}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
interface DialogueSubtitleProps {
  speakerName: string;
  speakerColor: string;
  text: string;
  /** ms */
  duration?: number;
  /** "1 / 3" indicator when used inside a queue. */
  position?: { index: number; total: number };
  onSkip?: () => void;
  onComplete?: () => void;
  /** Disable global key handler (queue owns it). */
  disableKey?: boolean;
}
export function DialogueSubtitle({
  speakerName,
  speakerColor,
  text,
  duration,
  position,
  onSkip,
  onComplete,
  disableKey = false,
}: DialogueSubtitleProps) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 22);
    const ms = duration ?? Math.max(2200, text.length * 55);
    const tt = setTimeout(() => onComplete?.(), ms);
    return () => {
      clearInterval(interval);
      clearTimeout(tt);
    };
  }, [text, duration, onComplete]);

  useEffect(() => {
    if (disableKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShown(text);
        onSkip?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [text, onSkip, disableKey]);

  return (
    <div className="absolute bottom-[14vh] left-1/2 z-50 -translate-x-1/2 max-w-[80vw]">
      <div className="rounded-lg bg-black/85 backdrop-blur-md border border-white/15 px-4 py-2.5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: speakerColor }}>
            {speakerName}
          </p>
          {position && (
            <span className="text-[9px] font-mono text-white/45">
              {position.index + 1} / {position.total}
            </span>
          )}
        </div>
        <p className="text-sm text-white leading-snug font-medium">{shown}</p>
        <p className="text-[9px] text-white/40 mt-1.5 font-mono">
          [ESPAÇO] {position && position.index < position.total - 1 ? 'próxima' : 'pular'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
export interface QueuedSubtitle {
  id: string;
  speakerName: string;
  speakerColor: string;
  text: string;
  durationMs?: number;
}
interface QueueProps {
  queue: QueuedSubtitle[];
  onComplete?: (id: string) => void;
  onDrained?: () => void;
}
/**
 * Plays subtitles sequentially. SPACE skips to the next; if last,
 * fires onDrained. Safe with rapid prop changes (resets to head).
 */
export function DialogueSubtitleQueue({ queue, onComplete, onDrained }: QueueProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [queue]);

  const advance = () => {
    const current = queue[idx];
    if (current) onComplete?.(current.id);
    if (idx + 1 >= queue.length) {
      onDrained?.();
      setIdx(queue.length); // move past last (component renders nothing)
    } else {
      setIdx(idx + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue]);

  if (queue.length === 0 || idx >= queue.length) return null;
  const cur = queue[idx];
  return (
    <DialogueSubtitle
      key={cur.id}
      speakerName={cur.speakerName}
      speakerColor={cur.speakerColor}
      text={cur.text}
      duration={cur.durationMs}
      position={{ index: idx, total: queue.length }}
      disableKey
      onComplete={advance}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
interface ScorePopupProps {
  amount: number;
  label: string;
  variant?: 'speed' | 'safety' | 'precision' | 'penalty';
}
export function ScorePopup({ amount, label, variant = 'speed' }: ScorePopupProps) {
  const colorMap = {
    speed: 'text-emerald-400',
    safety: 'text-cyan-300',
    precision: 'text-[hsl(28_100%_65%)]',
    penalty: 'text-destructive',
  };
  return (
    <div className={`pointer-events-none animate-fade-in font-mono text-base font-extrabold ${colorMap[variant]}`}>
      {amount > 0 ? '+' : ''}{amount} {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
export function StarRating({ stars, max = 5 }: { stars: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-7 w-7 transition-all ${
            i < stars
              ? 'text-[hsl(45_100%_60%)] fill-[hsl(45_100%_60%)] drop-shadow-[0_0_8px_hsl(45_100%_60%/0.6)]'
              : 'text-muted-foreground/30'
          }`}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
