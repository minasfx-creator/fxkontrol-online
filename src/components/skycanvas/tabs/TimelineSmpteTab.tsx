/**
 * TimelineSmpteTab — slim SMPTE widget for the SkyCanvas Timeline dock.
 *
 * - Big monospace HH:MM:SS:FF readout, ticks at ~30Hz from useProjectStore.
 * - Frame rate picker: 24, 25, 29.97 (DF), 30.
 * - Seek box: type/paste a timecode and jump the playhead. Accepts:
 *     "01:02:03:15"  "1:2:3:15"  "12:34"  "00:30"  "90s"  "90.5"
 * - ±1 frame / ±1s nudge buttons.
 *
 * INERT — never imports CommandBus / FieldBus / uiCommandGateway.
 * Mutates only the local timeline (useProjectStore.setCurrentTime).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, ChevronLeft, ChevronRight, RotateCcw, Crosshair } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  secondsToTimecode,
  timecodeToSeconds,
  formatTimecode,
  parseTimecode,
  type SMPTEFrameRate,
} from '@/lib/smpteEngine';
import { cn } from '@/lib/utils';

const FRAME_RATES: { value: SMPTEFrameRate; label: string; df: boolean }[] = [
  { value: 24,    label: '24 fps',           df: false },
  { value: 25,    label: '25 fps (PAL)',     df: false },
  { value: 29.97, label: '29.97 fps DF',     df: true  },
  { value: 30,    label: '30 fps NDF',       df: false },
];

/** Loose timecode parser — also accepts plain seconds and mm:ss / hh:mm:ss. */
function parseLooseTimecode(input: string, fps: SMPTEFrameRate, df: boolean): number | null {
  const s = input.trim();
  if (!s) return null;

  // Plain seconds: "90", "90.5", "90s"
  const secMatch = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(s);
  if (secMatch) {
    const v = parseFloat(secMatch[1]);
    return Number.isFinite(v) ? v : null;
  }

  // SMPTE shapes: HH:MM:SS:FF, H:M:S:F, MM:SS, HH:MM:SS
  const parts = s.split(/[:;.]/).map((p) => p.trim());
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    // mm:ss → treat as 0:mm:ss:00
    const mm = parseInt(parts[0], 10);
    const ss = parseInt(parts[1], 10);
    return mm * 60 + ss;
  }
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    // hh:mm:ss → 00 frames
    const tcStr = `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2])}:00`;
    const tc = parseTimecode(tcStr, fps, df);
    return tc ? timecodeToSeconds(tc) : null;
  }
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const tcStr = `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2])}:${pad(parts[3])}`;
    const tc = parseTimecode(tcStr, fps, df);
    return tc ? timecodeToSeconds(tc) : null;
  }

  // Try the engine's strict parser as a last resort
  const tc = parseTimecode(s, fps, df);
  return tc ? timecodeToSeconds(tc) : null;
}

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n;
}

const STORAGE_KEY = 'fxk.skycanvas.smpte.fps.v1';

export default function TimelineSmpteTab() {
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 0;
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);

  const [fps, setFps] = useState<SMPTEFrameRate>(() => {
    if (typeof localStorage === 'undefined') return 30;
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw ? parseFloat(raw) : 30;
    return ([24, 25, 29.97, 30].includes(v) ? v : 30) as SMPTEFrameRate;
  });
  const df = fps === 29.97;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(fps)); } catch { /* quota */ }
  }, [fps]);

  const tc = useMemo(() => secondsToTimecode(Math.max(0, time), fps, df), [time, fps, df]);
  const tcStr = formatTimecode(tc);
  const durTc = useMemo(() => formatTimecode(secondsToTimecode(Math.max(0, duration), fps, df)), [duration, fps, df]);

  // Seek input — "draft" buffer until commit
  const [draft, setDraft] = useState(tcStr);
  const [draftFocused, setDraftFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep draft in sync when user is NOT typing
  useEffect(() => {
    if (!draftFocused) {
      setDraft(tcStr);
      setError(null);
    }
  }, [tcStr, draftFocused]);

  const commitSeek = useCallback(() => {
    const target = parseLooseTimecode(draft, fps, df);
    if (target === null) {
      setError('Formato inválido. Use HH:MM:SS:FF, mm:ss ou segundos');
      return;
    }
    const clamped = Math.max(0, Math.min(duration || target, target));
    setCurrentTime(clamped);
    setError(null);
    setDraft(formatTimecode(secondsToTimecode(clamped, fps, df)));
  }, [draft, fps, df, duration, setCurrentTime]);

  const nudge = useCallback((deltaFrames: number, deltaSecs = 0) => {
    const dt = deltaSecs + deltaFrames / fps;
    const next = Math.max(0, Math.min(duration || (time + dt), time + dt));
    setCurrentTime(next);
  }, [time, fps, duration, setCurrentTime]);

  const goStart = useCallback(() => setCurrentTime(0), [setCurrentTime]);

  return (
    <div className="flex flex-col gap-3 p-2">
      {/* Big readout */}
      <div className="rounded-lg border border-cyan-500/15 bg-black/30 px-4 py-4 text-center">
        <div className="ds-mono text-[28px] font-bold tracking-[0.18em] text-cyan-200 tabular-nums">
          {tcStr}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2 ds-mono text-[10px] text-zinc-400">
          <span className={cn('inline-flex h-1.5 w-1.5 rounded-full',
            isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500')} />
          <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
          <span className="text-zinc-600">·</span>
          <span>{fps}{df ? ' DF' : ''}</span>
          <span className="text-zinc-600">·</span>
          <span>DUR {durTc}</span>
        </div>
        <div className="mt-1 ds-mono text-[9px] text-zinc-500">
          {time.toFixed(3)}s / {(duration || 0).toFixed(3)}s
        </div>
      </div>

      {/* Frame rate */}
      <div className="flex items-center gap-2">
        <span className="ds-mono text-[10px] uppercase tracking-wider text-zinc-500 w-14 flex-shrink-0">FPS</span>
        <Select value={String(fps)} onValueChange={(v) => setFps(parseFloat(v) as SMPTEFrameRate)}>
          <SelectTrigger className="h-7 text-[11px] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FRAME_RATES.map((fr) => (
              <SelectItem key={fr.value} value={String(fr.value)} className="text-[11px]">
                {fr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Seek input */}
      <div className="space-y-1">
        <span className="ds-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Seek (HH:MM:SS:FF)
        </span>
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onFocus={() => setDraftFocused(true)}
            onBlur={() => { setDraftFocused(false); }}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitSeek(); }
              else if (e.key === 'Escape') { e.preventDefault(); setDraft(tcStr); setError(null); }
            }}
            placeholder="00:00:00:00"
            className="h-8 ds-mono text-[12px] tracking-wider tabular-nums text-cyan-100"
            spellCheck={false}
            inputMode="numeric"
            aria-label="Seek to timecode"
            aria-invalid={!!error}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 ds-mono text-[10px] uppercase tracking-wider"
            onClick={commitSeek}
            title="Pular para o timecode (Enter)"
          >
            <Crosshair className="h-3.5 w-3.5 mr-1" /> Go
          </Button>
        </div>
        {error && (
          <div role="alert" className="ds-mono text-[10px] text-rose-300/90">
            {error}
          </div>
        )}
        <div className="ds-mono text-[9px] text-zinc-500 leading-tight">
          Aceita: HH:MM:SS:FF · mm:ss · 90 · 90.5s
        </div>
      </div>

      {/* Nudge controls */}
      <div className="grid grid-cols-5 gap-1">
        <Button variant="outline" size="sm" className="h-7 ds-mono text-[10px]" onClick={() => nudge(0, -1)}
                title="Voltar 1s">
          <ChevronLeft className="h-3 w-3" />1s
        </Button>
        <Button variant="outline" size="sm" className="h-7 ds-mono text-[10px]" onClick={() => nudge(-1)}
                title="Voltar 1 frame">
          <ChevronLeft className="h-3 w-3" />1f
        </Button>
        <Button variant="outline" size="sm" className="h-7 ds-mono text-[10px]" onClick={goStart}
                title="Início">
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 ds-mono text-[10px]" onClick={() => nudge(1)}
                title="Avançar 1 frame">
          1f<ChevronRight className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 ds-mono text-[10px]" onClick={() => nudge(0, 1)}
                title="Avançar 1s">
          1s<ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 ds-mono text-[9px] text-zinc-500/80 pt-1">
        <Clock className="h-3 w-3" />
        SkyCanvas SMPTE · local seek (não envia LTC/MTC)
      </div>
    </div>
  );
}
