import { useRef, useEffect, useState, useCallback } from 'react';
import { Upload, Music, Zap, Volume2, VolumeX, GripHorizontal, Minus, Plus, Flag, Trash2, Scissors, Check, X, RotateCcw, Hand, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { useAuth } from '@/hooks/useAuth';
import { useAudioMasterClock } from '@/hooks/useAudioMasterClock';
import { playAudioWithRetry } from '@/lib/audio/playAudioWithRetry';
import { registerAudioMaster } from '@/lib/audio/audioMasterRegistry';
import { uploadAudioForProject } from '@/lib/audioUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// File-picker accept list — explicit extensions in addition to `audio/*` so
// Safari iOS and a few Android browsers (which silently filter out .flac /
// .opus / .aac under the bare MIME wildcard) still expose every supported
// format. Mirrors `SUPPORTED_AUDIO_EXTENSIONS` in `src/lib/audioUpload.ts`.
const AUDIO_FILE_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm,.opus';

function detectBPM(audioBuffer: AudioBuffer): number {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.05);
  const energies: number[] = [];

  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += data[j] * data[j];
    }
    energies.push(sum / windowSize);
  }

  const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5;
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return 120;

  const intervals: number[] = [];
  for (let i = 1; i < Math.min(peaks.length, 50); i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const secondsPerBeat = (avgInterval * windowSize) / sampleRate;
  let bpm = Math.round(60 / secondsPerBeat);

  while (bpm > 180) bpm /= 2;
  while (bpm < 60) bpm *= 2;

  return bpm;
}

function getBeats(bpm: number, duration: number): number[] {
  const interval = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t < duration; t += interval) {
    beats.push(t);
  }
  return beats;
}

const MIN_HEIGHT = 36;
const MAX_HEIGHT = 200;
const HEIGHT_STEP = 24;

const CUE_COLORS = [
  'hsl(0, 85%, 60%)',    // red
  'hsl(45, 95%, 55%)',   // amber
  'hsl(120, 70%, 50%)',  // green
  'hsl(200, 90%, 55%)',  // blue
  'hsl(280, 80%, 60%)',  // purple
  'hsl(330, 85%, 58%)',  // pink
];

export default function AudioWaveform({ pixelsPerSecond }: { pixelsPerSecond: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
    const currentTime = useProjectStore(s => s.currentTime);
  const duration = useProjectStore(s => s.duration);
  const audioUrl = useProjectStore(s => s.audioUrl);
  const audioInPoint = useProjectStore(s => s.audioInPoint);
  const audioStartOffset = useProjectStore(s => s.audioStartOffset);
  const audioOutPoint = useProjectStore(s => s.audioOutPoint);
  const audioOriginalDuration = useProjectStore(s => s.audioOriginalDuration);
  const setAudioOriginalDuration = useProjectStore(s => s.setAudioOriginalDuration);
  const applyAudioTrim = useProjectStore(s => s.applyAudioTrim);
  const resetAudioTrim = useProjectStore(s => s.resetAudioTrim);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const bpm = useProjectStore(s => s.bpm);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const playbackSpeed = useProjectStore(s => s.playbackSpeed);
  const setAudioUrl = useProjectStore(s => s.setAudioUrl);
  const setBpm = useProjectStore(s => s.setBpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const setSnapToBeat = useProjectStore(s => s.setSnapToBeat);
  const cueMarkers = useProjectStore(s => s.cueMarkers);
  const addCueMarker = useProjectStore(s => s.addCueMarker);
  const removeCueMarker = useProjectStore(s => s.removeCueMarker);

  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [uploading, setUploading] = useState(false);
  const [beats, setBeats] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [trackHeight, setTrackHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  // Trim mode: when true the operator can drag In/Out handles. Pending
  // values live here (in *original audio file* seconds) and are only
  // committed to the store on Apply. This keeps the waveform/timeline live
  // while the operator scrubs the handles without thrashing the store.
  const [trimMode, setTrimMode] = useState(false);
  const [pendingIn, setPendingIn] = useState<number>(0);
  const [pendingOut, setPendingOut] = useState<number>(0);
  const [draggingHandle, setDraggingHandle] = useState<'in' | 'out' | null>(null);
  // Audio-only horizontal zoom multiplier (1×–8×). Multiplies `pixelsPerSecond`
  // when computing the canvas/overlay widths so the operator can stretch the
  // waveform for precise trimming without affecting the rest of the timeline.
  const [audioZoom, setAudioZoom] = useState(1);
  // Live drag-select inside the waveform while in trim mode. Mirrors
  // `pendingIn`/`pendingOut` but is drawn instantly without waiting for the
  // mouseup commit — gives the operator visual feedback during the drag.
  const [selectionDrag, setSelectionDrag] = useState<{ start: number; end: number } | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playControllerRef = useRef<ReturnType<typeof playAudioWithRetry> | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);
  // Cache the decoded AudioBuffer so re-trimming only re-runs the
  // downsample (cheap), never a re-fetch + decodeAudioData (slow, network).
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Tap-tempo: rolling window of recent tap timestamps (ms). We average the
  // last N intervals to derive BPM. Window is cleared after 2s of inactivity
  // so the operator can restart cleanly between songs.
  const tapTimesRef = useRef<number[]>([]);
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapHint, setTapHint] = useState<string | null>(null);
  const [bpmDraft, setBpmDraft] = useState<string>('');

  // Keep the input draft in sync with the canonical store BPM whenever it
  // changes from outside (auto-detect, project load, tap-tempo).
  useEffect(() => {
    setBpmDraft(bpm != null ? String(bpm) : '');
  }, [bpm]);

  useEffect(() => () => {
    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
  }, []);

  const clampBpm = useCallback((v: number) => {
    if (!Number.isFinite(v)) return null;
    return Math.max(20, Math.min(300, Math.round(v)));
  }, []);

  const commitBpm = useCallback((next: number | null) => {
    if (next == null) { setBpm(null); return; }
    const clamped = clampBpm(next);
    if (clamped == null) return;
    setBpm(clamped);
  }, [setBpm, clampBpm]);

  const nudgeBpm = useCallback((delta: number) => {
    const base = bpm ?? 120;
    commitBpm(base + delta);
  }, [bpm, commitBpm]);

  const scaleBpm = useCallback((factor: number) => {
    if (!bpm) return;
    commitBpm(bpm * factor);
  }, [bpm, commitBpm]);

  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    const taps = tapTimesRef.current;
    taps.push(now);
    // Keep only the last 8 taps to stay responsive to tempo changes.
    if (taps.length > 8) taps.shift();

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const computed = clampBpm(60000 / avgMs);
      if (computed != null) {
        commitBpm(computed);
        setTapHint(`${taps.length} taps · ${computed} BPM`);
      }
    } else {
      setTapHint('tap…');
    }
    tapResetTimerRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setTapHint(null);
    }, 2000);
  }, [commitBpm, clampBpm]);

  const handleRedetect = useCallback(() => {
    const buf = audioBufferRef.current;
    if (!buf) {
      toast.info('Carregue um áudio primeiro');
      return;
    }
    const detected = detectBPM(buf);
    commitBpm(detected);
    toast.success(`BPM redetectado · ${detected}`);
  }, [commitBpm]);

  const handleBpmInputCommit = useCallback(() => {
    const parsed = parseFloat(bpmDraft);
    if (Number.isNaN(parsed)) {
      setBpmDraft(bpm != null ? String(bpm) : '');
      return;
    }
    commitBpm(parsed);
  }, [bpmDraft, bpm, commitBpm]);


  // Resize via drag handle
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartH.current = trackHeight;

    const onMove = (ev: MouseEvent) => {
      const delta = resizeStartY.current - ev.clientY; // drag up = grow
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStartH.current + delta));
      setTrackHeight(newH);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [trackHeight]);

  // +/- height buttons
  const shrink = useCallback(() => setTrackHeight(h => Math.max(MIN_HEIGHT, h - HEIGHT_STEP)), []);
  const grow = useCallback(() => setTrackHeight(h => Math.min(MAX_HEIGHT, h + HEIGHT_STEP)), []);

  // Create / configure <audio> element
  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.volume = muted ? 0 : volume;
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;

    // Expose this audio element to the global registry so the toolbar
    // "Resync timeline" button and the watchdog can re-lock the clock to
    // the audio without prop-drilling. We pass a `cancelActivePlay` thunk
    // so the registry can stop our in-flight retry controller before
    // issuing its own.
    const unregister = registerAudioMaster({
      audio,
      cancelActivePlay: () => {
        playControllerRef.current?.cancel();
        playControllerRef.current = null;
      },
    });

    return () => {
      unregister();
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Audio element drives the timeline as master clock — eliminates drift
  // between music and 3D viewport / FX spawns.
  useAudioMasterClock(audioRef, audioUrl);

  // Trim window enforcement on the <audio> element:
  //   1. When the in-point changes (or audio is freshly loaded), seek the
  //      audio element to `audioInPoint` so playback starts from the trim.
  //      Skipped while the user is actively dragging the In handle to avoid
  //      audible scrubbing on every pixel of drag.
  //   2. While playing, monitor `timeupdate` and pause/clamp the moment we
  //      cross the out-point. The store's `setPlaying(false)` is called so
  //      the lockstep / UI also see the stop, not just the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (draggingHandle !== 'in' && audio.currentTime < audioInPoint - 0.05) {
      try { audio.currentTime = audioInPoint; } catch { /* readyState too low */ }
    }
  }, [audioInPoint, audioUrl, draggingHandle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const out = audioOutPoint ?? (audioOriginalDuration ?? Infinity);
    const onTimeUpdate = () => {
      if (audio.currentTime >= out - 1e-3) {
        audio.pause();
        try { audio.currentTime = out; } catch { /* ignore */ }
        setPlaying(false);
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [audioOutPoint, audioOriginalDuration, audioUrl, setPlaying]);

  // Sync volume / mute
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Sync play / pause — robust against autoplay-policy / AbortError races.
  // Uses `playAudioWithRetry` so a temporarily blocked Play (autoplay
  // rejection, racing pause, transient decode stall) does not leave the
  // timeline frozen at 0. The retry controller is cancelled on pause /
  // unmount so we never resume audio against the operator's intent.
  // (playControllerRef is declared above near the other refs.)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Always cancel any in-flight retry before changing state.
    playControllerRef.current?.cancel();
    playControllerRef.current = null;

    if (isPlaying) {
      // Show-time → file-time conversion: the store's `currentTime` runs
      // 0..duration relative to `audioInPoint`; the audio element runs in
      // the original file's coordinate system. `audioStartOffset` shifts
      // when the file enters the show — clamp to 0 so we never seek before
      // the in-point when the playhead is in the silent prelude.
      const audioInputTime = Math.max(0, currentTime - audioStartOffset);
      const targetFileTime = audioInputTime + audioInPoint;
      if (Math.abs(audio.currentTime - targetFileTime) > 0.15) {
        audio.currentTime = targetFileTime;
      }

      let gestureToastId: string | number | undefined;
      playControllerRef.current = playAudioWithRetry(audio, {
        onSuccess: () => {
          if (gestureToastId !== undefined) toast.dismiss(gestureToastId);
        },
        onAwaitingGesture: () => {
          // Browser is blocking on the autoplay policy. Tell the operator we
          // are waiting and that any click will recover instantly. Persistent
          // until the retry succeeds or we give up.
          gestureToastId = toast.warning('Tap to start audio', {
            description: 'Browser blocked autoplay. Click anywhere to start the show.',
            duration: Infinity,
          });
        },
        onPermanentFailure: (err) => {
          if (gestureToastId !== undefined) toast.dismiss(gestureToastId);
          const name = (err as { name?: string } | null)?.name ?? '';
          const description = name === 'NotAllowedError'
            ? 'Browser kept blocking playback. Click the page and press Play again.'
            : ((err as { message?: string } | null)?.message ?? 'Audio playback failed.');
          toast.error('Audio could not start', { description });
          console.warn('[AudioWaveform] audio.play() retries exhausted:', err);
        },
      });
    } else {
      audio.pause();
    }

    return () => {
      playControllerRef.current?.cancel();
      playControllerRef.current = null;
    };
  }, [isPlaying]);

  // Sync seek (when user clicks timeline / scrubs).
  //
  // Why this MUST run while playing too:
  //   When `isPlaying === true`, `useAudioMasterClock` is the timeline driver
  //   — every RAF it copies `audio.currentTime` into the timeline. If the
  //   operator scrubs the playhead while playing, the store's `currentTime`
  //   jumps to the new target but the audio element keeps playing from the
  //   old position. On the very next RAF the audio master writes the OLD
  //   position back into the store, so the playhead visibly snaps back and
  //   the scrub is silently lost.
  //
  // The 0.15 s threshold prevents an echo-loop with the audio master: when
  // the audio is the source of `currentTime` (master pushes audio→store),
  // they are always within ~one RAF (≈16 ms) of each other, so this guard
  // is a no-op. It only fires when the user (or another driver such as
  // SMPTE chase) actually moved the playhead away from the audio position.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const audioInputTime = Math.max(0, currentTime - audioStartOffset);
    const targetFileTime = audioInputTime + audioInPoint;
    if (Math.abs(audio.currentTime - targetFileTime) > 0.15) {
      audio.currentTime = targetFileTime;
    }
  }, [currentTime, audioInPoint, audioStartOffset]);

  // Build the visible waveform from a decoded AudioBuffer, restricted to
  // the active trim window `[in..out]`. Extracted so re-trim only re-runs
  // the cheap downsample (no re-fetch / re-decode).
  const rebuildWaveform = useCallback((buf: AudioBuffer) => {
    const sr = buf.sampleRate;
    const inP = useProjectStore.getState().audioInPoint;
    const outP = useProjectStore.getState().audioOutPoint ?? buf.duration;
    const startSample = Math.max(0, Math.floor(inP * sr));
    const endSample = Math.min(buf.length, Math.floor(outP * sr));
    const windowLen = Math.max(1, endSample - startSample);
    const windowDur = Math.max(0.01, outP - inP);
    const samples = Math.max(1, Math.floor(windowDur * pixelsPerSecond * audioZoom * 2));
    const blockSize = Math.max(1, Math.floor(windowLen / samples));
    const rawData = buf.getChannelData(0);
    const downsampled = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = startSample + i * blockSize;
      const end = Math.min(endSample, start + blockSize);
      for (let j = start; j < end; j++) sum += Math.abs(rawData[j]);
      downsampled[i] = sum / Math.max(1, end - start);
    }
    setWaveformData(downsampled);
  }, [pixelsPerSecond, audioZoom]);

  // Load and decode audio for waveform + BPM
  const loadAudio = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      // Publish original duration so the trim handles know the upper bound.
      setAudioOriginalDuration(audioBuffer.duration);

      // Auto-adjust project duration to match the *trim window* if any (or
      // the full audio when no trim was previously saved).
      const inP = useProjectStore.getState().audioInPoint;
      const outP = useProjectStore.getState().audioOutPoint ?? audioBuffer.duration;
      const windowDur = Math.max(0, outP - inP);
      if (windowDur > 0) {
        const store = useProjectStore.getState();
        const maxItemEnd = store.timelineItems.reduce((max, item) => {
          const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
          return Math.max(max, item.startTime + (effect?.duration ?? 3));
        }, 0);
        const newDuration = Math.max(windowDur, maxItemEnd);
        store.setDuration(Math.ceil(newDuration));
      }

      rebuildWaveform(audioBuffer);

      const detectedBpm = detectBPM(audioBuffer);
      setBpm(detectedBpm);
      setBeats(getBeats(detectedBpm, duration));

      toast.success(`Áudio carregado · BPM: ${detectedBpm}`);
    } catch (err) {
      console.error('Failed to decode audio:', err);
      toast.error('Erro ao decodificar áudio');
    }
  }, [duration, pixelsPerSecond, setBpm, setAudioOriginalDuration, rebuildWaveform]);

  // Re-downsample whenever the trim window or zoom changes, without
  // re-fetching the audio. Skipped while the operator is mid-drag — we
  // refresh on drag end / Apply to keep dragging silky.
  useEffect(() => {
    if (audioBufferRef.current && !draggingHandle) {
      rebuildWaveform(audioBufferRef.current);
    }
  }, [audioInPoint, audioOutPoint, pixelsPerSecond, audioZoom, draggingHandle, rebuildWaveform]);

  useEffect(() => {
    if (audioUrl) loadAudio(audioUrl);
  }, [audioUrl, loadAudio]);

  useEffect(() => {
    if (bpm) setBeats(getBeats(bpm, duration));
  }, [bpm, duration]);

  // Draw waveform + beat markers + playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Audio-only horizontal zoom: stretches the waveform without affecting
    // the rest of the timeline. `audioZoom === 1` ⇒ behaves like before.
    const pps = pixelsPerSecond * audioZoom;
    const width = duration * pps;
    const height = trackHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Beat markers
    if (beats.length > 0) {
      beats.forEach((beat, idx) => {
        const x = beat * pps;
        const isMeasure = idx % 4 === 0;
        ctx.strokeStyle = isMeasure ? 'hsla(24, 95%, 53%, 0.4)' : 'hsla(24, 95%, 53%, 0.15)';
        ctx.lineWidth = isMeasure ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Measure number
        if (isMeasure && pps > 8) {
          ctx.fillStyle = 'hsla(24, 95%, 53%, 0.5)';
          ctx.font = '7px monospace';
          ctx.fillText(`${Math.floor(idx / 4) + 1}`, x + 2, 8);
        }
      });
    }

    // Waveform — drawn starting at `audioStartOffset` so the operator sees
    // the audio entering at the timestamp where they dropped it on the ruler.
    if (waveformData) {
      const mid = height / 2;
      const offsetPx = Math.max(0, audioStartOffset) * pps;
      const trimWindowSec = (audioOutPoint ?? audioOriginalDuration ?? 0) - audioInPoint;
      const waveWidth = Math.max(0, trimWindowSec * pps);
      // Gradient for waveform
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'hsla(207, 90%, 64%, 0.6)');
      grad.addColorStop(0.5, 'hsla(207, 90%, 54%, 0.8)');
      grad.addColorStop(1, 'hsla(207, 90%, 64%, 0.6)');
      ctx.fillStyle = grad;

      for (let i = 0; i < waveformData.length; i++) {
        const x = offsetPx + (i / waveformData.length) * waveWidth;
        if (x > width) break;
        const barHeight = waveformData[i] * height * 0.85;
        ctx.fillRect(x, mid - barHeight / 2, Math.max(1, waveWidth / waveformData.length - 0.5), barHeight);
      }

      // Played region overlay
      const playX = currentTime * pps;
      ctx.fillStyle = 'hsla(207, 90%, 54%, 0.12)';
      ctx.fillRect(0, 0, playX, height);
    }

    // Cue markers
    cueMarkers.forEach((cue) => {
      const cx = cue.time * pps;
      // Vertical line
      ctx.strokeStyle = cue.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Flag triangle at top
      ctx.fillStyle = cue.color;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + 8, 0);
      ctx.lineTo(cx + 8, 6);
      ctx.lineTo(cx + 2, 10);
      ctx.lineTo(cx, 10);
      ctx.closePath();
      ctx.fill();

      // Label
      if (trackHeight > 50) {
        ctx.fillStyle = cue.color;
        ctx.font = 'bold 8px monospace';
        ctx.fillText(cue.label, cx + 10, 8);
      }
    });

    // Playhead
    ctx.strokeStyle = 'hsl(207, 90%, 54%)';
    ctx.lineWidth = 2;
    const playX = currentTime * pps;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }, [waveformData, beats, currentTime, duration, pixelsPerSecond, audioZoom, trackHeight, cueMarkers, audioStartOffset, audioInPoint, audioOutPoint, audioOriginalDuration]);

  const openFilePicker = useCallback(() => {
    if (uploading) return;
    if (!user) {
      toast.error('Faça login para enviar áudio');
      return;
    }
    // Programmatic click on the hidden <input> — more reliable than the
    // <label><input/></label> pattern on iOS Safari and inside the Lovable
    // preview iframe (some browsers swallow synthetic clicks bubbled from
    // <label>).
    fileInputRef.current?.click();
  }, [uploading, user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always reset so re-selecting the same file re-fires `change`.
    e.target.value = '';
    if (!file || !user) return;

    setUploading(true);
    try {
      await uploadAudioForProject(file, user.id);
    } finally {
      setUploading(false);
    }
  };

  // Click on waveform to add cue marker (double-click)
  const handleWaveformDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    let time = x / pixelsPerSecond;

    // Snap to beat if enabled
    if (snapToBeat && bpm) {
      const beatInterval = 60 / bpm;
      time = Math.round(time / beatInterval) * beatInterval;
    }

    time = Math.max(0, Math.min(duration, time));

    const id = `cue-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const label = `C${cueMarkers.length + 1}`;
    const color = CUE_COLORS[cueMarkers.length % CUE_COLORS.length];

    addCueMarker({ id, time, label, color });
    toast.success(`Cue "${label}" @ ${time.toFixed(2)}s`);
  }, [pixelsPerSecond, snapToBeat, bpm, duration, cueMarkers.length, addCueMarker]);

  // Right-click on cue marker to remove
  const handleWaveformContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const clickTime = x / pixelsPerSecond;

    // Find nearest cue within 5px threshold
    const threshold = 5 / pixelsPerSecond;
    const nearest = cueMarkers.find(c => Math.abs(c.time - clickTime) < threshold);
    if (nearest) {
      e.preventDefault();
      removeCueMarker(nearest.id);
      toast(`Cue "${nearest.label}" removido`);
    }
  }, [pixelsPerSecond, cueMarkers, removeCueMarker]);

  // ── Trim handlers ────────────────────────────────────────────────
  const trimWindowDur = (audioOutPoint ?? audioOriginalDuration ?? 0) - audioInPoint;
  const isTrimmed = audioInPoint > 0 || (audioOutPoint != null && audioOriginalDuration != null && audioOutPoint < audioOriginalDuration);

  const handleApplyTrim = useCallback(() => {
    const r = applyAudioTrim(pendingIn, pendingOut);
    if (!r.ok) {
      toast.error(r.error ?? 'Trim inválido');
      return;
    }
    setTrimMode(false);
    toast.success(
      `Trim aplicado · ${(pendingOut - pendingIn).toFixed(2)}s` +
      ((r.removedItems ?? 0) + (r.removedCues ?? 0) > 0
        ? ` · ${r.removedItems ?? 0} cues / ${r.removedCues ?? 0} markers fora removidos`
        : ''),
    );
  }, [applyAudioTrim, pendingIn, pendingOut]);

  const handleResetTrim = useCallback(() => {
    resetAudioTrim();
    setTrimMode(false);
    toast.success('Trim removido — áudio restaurado');
  }, [resetAudioTrim]);

  // Drag start for an In/Out handle. Drag updates `pending*` only; commit
  // happens via the Apply button to keep the timeline stable while scrubbing.
  const startHandleDrag = useCallback((which: 'in' | 'out') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container || audioOriginalDuration == null) return;
    setDraggingHandle(which);
    const rect = container.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      const x = ev.clientX - rect.left + container.scrollLeft;
      // The canvas always represents `[audioInPoint .. audioOutPoint]` so
      // x=0 maps to audioInPoint, but during trim mode we want raw file-time
      // — easiest is to anchor on the *current* in/out (pre-trim) and scale.
      const showTime = x / (pixelsPerSecond * audioZoom);
      const fileTime = audioInPoint + showTime;
      const clamped = Math.max(0, Math.min(audioOriginalDuration, fileTime));
      if (which === 'in') {
        setPendingIn(Math.min(clamped, pendingOut - 0.05));
      } else {
        setPendingOut(Math.max(clamped, pendingIn + 0.05));
      }
    };
    const onUp = () => {
      setDraggingHandle(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [audioInPoint, audioOriginalDuration, pendingIn, pendingOut, pixelsPerSecond, audioZoom]);

  // Drag-to-select on the waveform: while in trim mode, mousedown on the
  // canvas (anywhere outside the handles) starts a fresh selection. The
  // selection is committed to `pendingIn`/`pendingOut` on the fly so the
  // operator can press Enter to Apply or Esc to cancel without an extra step.
  const handleSelectionDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trimMode || audioOriginalDuration == null) return;
    // Ignore clicks on handles / overlays.
    const target = e.target as HTMLElement;
    if (target.closest('[data-trim-handle]') || target.closest('[data-trim-toolbar]')) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pps = pixelsPerSecond * audioZoom;
    const toFileTime = (clientX: number) => {
      const x = clientX - rect.left + container.scrollLeft;
      const showTime = Math.max(0, x / pps);
      return Math.max(0, Math.min(audioOriginalDuration, audioInPoint + showTime));
    };
    const startT = toFileTime(e.clientX);
    setSelectionDrag({ start: startT, end: startT });
    setPendingIn(startT);
    setPendingOut(Math.min(audioOriginalDuration, startT + 0.05));
    setDraggingHandle('out'); // suppress redownsample while dragging

    const onMove = (ev: MouseEvent) => {
      const t = toFileTime(ev.clientX);
      const a = Math.min(startT, t);
      const b = Math.max(startT, t);
      setSelectionDrag({ start: a, end: b });
      setPendingIn(a);
      setPendingOut(Math.max(a + 0.05, b));
    };
    const onUp = () => {
      setDraggingHandle(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [trimMode, audioOriginalDuration, audioInPoint, pixelsPerSecond, audioZoom]);

  // Ctrl/⌘ + wheel inside the waveform = audio-only zoom (1×–8×). Anchors
  // the time under the cursor so the operator zooms *into* the spot they
  // care about, just like a vector editor.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + container.scrollLeft;
      const oldPps = pixelsPerSecond * audioZoom;
      const cursorTime = cursorX / Math.max(1e-3, oldPps);
      const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
      const nextZoom = Math.max(1, Math.min(8, audioZoom * factor));
      if (nextZoom === audioZoom) return;
      setAudioZoom(nextZoom);
      // Re-anchor scroll so the time under the cursor stays put.
      requestAnimationFrame(() => {
        const newPps = pixelsPerSecond * nextZoom;
        container.scrollLeft = cursorTime * newPps - (e.clientX - rect.left);
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [audioZoom, pixelsPerSecond]);

  // Keyboard shortcuts: I/O set pending in/out at playhead, Esc cancels.
  useEffect(() => {
    if (!trimMode) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key === 'i' || e.key === 'I') {
        const t = currentTime + audioInPoint;
        setPendingIn(Math.min(t, pendingOut - 0.05));
        e.preventDefault();
      } else if (e.key === 'o' || e.key === 'O') {
        const t = currentTime + audioInPoint;
        setPendingOut(Math.max(t, pendingIn + 0.05));
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setTrimMode(false);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        handleApplyTrim();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trimMode, currentTime, audioInPoint, pendingIn, pendingOut, handleApplyTrim]);

  // Pixel positions of the In/Out handles within the canvas (which spans
  // `[audioInPoint .. audioOutPoint]` in file-time).
  const inHandleX = (pendingIn - audioInPoint) * pixelsPerSecond * audioZoom;
  const outHandleX = (pendingOut - audioInPoint) * pixelsPerSecond * audioZoom;

  const isExpanded = trackHeight > MIN_HEIGHT;

  return (
    <div className="flex border-b border-border/50 relative">
      {/* Resize drag handle — top edge */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 group",
          "hover:bg-electric/20 transition-colors",
          isResizing && "bg-electric/30"
        )}
        onMouseDown={onResizeStart}
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripHorizontal className="h-3 w-3 text-electric/60" />
        </div>
      </div>

      <div
        className="w-28 flex-shrink-0 flex flex-col justify-center px-2 border-r border-border/50 bg-surface-1"
        style={{ height: `${trackHeight}px` }}
      >
        <div className="flex items-center gap-1 w-full">
          <Music className="h-3 w-3 text-electric flex-shrink-0" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-1">Audio</span>

          {/* Volume toggle */}
          {audioUrl && (
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setMuted(!muted)}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </button>
          )}

          <button
            type="button"
            className="text-muted-foreground hover:text-primary disabled:opacity-40"
            onClick={openFilePicker}
            disabled={uploading}
            title={uploading ? 'Enviando…' : 'Importar áudio (MP3, WAV, FLAC, OGG, M4A, AAC, OPUS)'}
            aria-label="Importar arquivo de áudio"
          >
            <Upload className="h-3 w-3" />
          </button>

          {bpm && (
            <button
              className={cn(
                "text-[8px] font-mono-code px-1 py-0.5 rounded-sm border",
                snapToBeat
                  ? "bg-safety/20 text-safety border-safety/40"
                  : "bg-surface-2 text-muted-foreground border-border hover:text-safety"
              )}
              onClick={() => setSnapToBeat(!snapToBeat)}
              title="Snap to beat"
            >
              <Zap className="h-2.5 w-2.5" />
            </button>
          )}
          {audioUrl && audioOriginalDuration != null && (
            <button
              className={cn(
                "text-[8px] font-mono-code px-1 py-0.5 rounded-sm border",
                trimMode
                  ? "bg-warning/20 text-warning border-warning/40"
                  : "bg-surface-2 text-muted-foreground border-border hover:text-warning"
              )}
              onClick={() => {
                const next = !trimMode;
                if (next) {
                  setPendingIn(audioInPoint);
                  setPendingOut(audioOutPoint ?? audioOriginalDuration);
                }
                setTrimMode(next);
              }}
              title="Trim audio (set In/Out)"
            >
              <Scissors className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* BPM controls + Height controls */}
        <div className="flex items-center gap-1 mt-1">
          {/* BPM editor — controls the timeline grid via getActiveGrid({ bpm }). */}
          <div className="flex items-center gap-0.5 rounded-sm border border-border bg-surface-2 px-1 py-0.5">
            <span className="text-[7px] font-mono-code uppercase text-muted-foreground/60">BPM</span>
            <button
              type="button"
              onClick={() => nudgeBpm(-1)}
              className="text-muted-foreground/70 hover:text-safety disabled:opacity-30"
              disabled={!bpm}
              title="−1 BPM"
              aria-label="Diminuir BPM em 1"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <input
              type="number"
              min={20}
              max={300}
              step={1}
              value={bpmDraft}
              onChange={(e) => setBpmDraft(e.target.value)}
              onBlur={handleBpmInputCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setBpmDraft(bpm != null ? String(bpm) : ''); (e.target as HTMLInputElement).blur(); }
              }}
              placeholder="—"
              className="w-9 bg-transparent text-[9px] font-mono-code text-safety text-center tabular-nums outline-none focus:text-safety focus:ring-1 focus:ring-safety/40 rounded-sm"
              title="Editar BPM (Enter para confirmar). Recalcula a grid da timeline."
              aria-label="BPM manual"
            />
            <button
              type="button"
              onClick={() => nudgeBpm(1)}
              className="text-muted-foreground/70 hover:text-safety disabled:opacity-30"
              disabled={!bpm}
              title="+1 BPM"
              aria-label="Aumentar BPM em 1"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => scaleBpm(0.5)}
              className="text-[8px] font-mono-code px-1 text-muted-foreground/70 hover:text-safety disabled:opacity-30"
              disabled={!bpm}
              title="Dividir BPM por 2 (octave down)"
              aria-label="Dividir BPM por 2"
            >
              ÷2
            </button>
            <button
              type="button"
              onClick={() => scaleBpm(2)}
              className="text-[8px] font-mono-code px-1 text-muted-foreground/70 hover:text-safety disabled:opacity-30"
              disabled={!bpm}
              title="Multiplicar BPM por 2 (octave up)"
              aria-label="Multiplicar BPM por 2"
            >
              ×2
            </button>
            <button
              type="button"
              onClick={handleTap}
              className="text-muted-foreground/70 hover:text-safety"
              title="Tap-tempo (toque no ritmo da música)"
              aria-label="Tap tempo"
            >
              <Hand className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={handleRedetect}
              className="text-muted-foreground/70 hover:text-safety disabled:opacity-30"
              disabled={!audioBufferRef.current}
              title="Redetectar BPM do áudio"
              aria-label="Redetectar BPM"
            >
              <RefreshCw className="h-2.5 w-2.5" />
            </button>
            {tapHint && (
              <span className="text-[7px] font-mono-code text-warning ml-0.5">{tapHint}</span>
            )}
          </div>

          <div className="flex-1" />
          <button
            onClick={shrink}
            disabled={trackHeight <= MIN_HEIGHT}
            className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20"
            title="Reduzir altura"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="text-[7px] font-mono-code text-muted-foreground/40 tabular-nums w-5 text-center">
            {trackHeight}
          </span>
          <button
            onClick={grow}
            disabled={trackHeight >= MAX_HEIGHT}
            className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20"
            title="Ampliar altura"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "flex-1 relative bg-surface-0/50 overflow-hidden",
          trimMode ? "cursor-crosshair" : "cursor-crosshair",
        )}
        style={{ height: `${trackHeight}px` }}
        onMouseDown={handleSelectionDragStart}
        onDoubleClick={handleWaveformDoubleClick}
        onContextMenu={handleWaveformContextMenu}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: `${duration * pixelsPerSecond * audioZoom}px`, height: `${trackHeight}px` }}
        />

        {/* Trim mode: draggable In/Out handles + dimmed regions outside the
            pending window. Commits to the store via Apply. */}
        {trimMode && audioOriginalDuration != null && (
          <>
            <div
              className="absolute top-0 bg-background/60 pointer-events-none"
              style={{ left: 0, width: `${Math.max(0, inHandleX)}px`, height: '100%' }}
            />
            <div
              className="absolute top-0 bg-background/60 pointer-events-none"
              style={{
                left: `${outHandleX}px`,
                width: `${Math.max(0, duration * pixelsPerSecond * audioZoom - outHandleX)}px`,
                height: '100%',
              }}
            />
            {/* Selection highlight band over the kept window. */}
            <div
              className="absolute top-0 pointer-events-none border-y-2 border-warning/70 bg-warning/[0.06]"
              style={{
                left: `${Math.max(0, inHandleX)}px`,
                width: `${Math.max(0, outHandleX - inHandleX)}px`,
                height: '100%',
              }}
            />
            <div
              data-trim-handle="in"
              className="absolute top-0 cursor-ew-resize bg-warning hover:bg-warning/80 z-20"
              style={{ left: `${inHandleX - 3}px`, width: '6px', height: '100%' }}
              onMouseDown={startHandleDrag('in')}
              title={`In: ${pendingIn.toFixed(2)}s (press I at playhead)`}
            />
            <div
              data-trim-handle="out"
              className="absolute top-0 cursor-ew-resize bg-warning hover:bg-warning/80 z-20"
              style={{ left: `${outHandleX - 3}px`, width: '6px', height: '100%' }}
              onMouseDown={startHandleDrag('out')}
              title={`Out: ${pendingOut.toFixed(2)}s (press O at playhead)`}
            />
            <div
              data-trim-toolbar
              className="absolute top-1 left-1 flex items-center gap-1 bg-surface-1/95 border border-warning/40 rounded px-1.5 py-0.5 z-30"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[9px] font-mono-code text-warning tabular-nums">
                {pendingIn.toFixed(2)}s → {pendingOut.toFixed(2)}s ({(pendingOut - pendingIn).toFixed(2)}s)
              </span>
              <button onClick={handleApplyTrim} className="text-safety hover:text-safety/80" title="Apply (Enter)">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={() => { setTrimMode(false); setSelectionDrag(null); }} className="text-muted-foreground hover:text-foreground" title="Cancel (Esc)">
                <X className="h-3 w-3" />
              </button>
            </div>
          </>
        )}

        {!trimMode && isTrimmed && (
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-surface-1/95 border border-warning/30 rounded px-1.5 py-0.5 z-20">
            <Scissors className="h-2.5 w-2.5 text-warning" />
            <span className="text-[9px] font-mono-code text-warning tabular-nums">
              {audioInPoint.toFixed(2)}s–{(audioOutPoint ?? audioOriginalDuration ?? 0).toFixed(2)}s
            </span>
            <button onClick={handleResetTrim} className="text-muted-foreground hover:text-foreground" title="Reset trim">
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {/* Cue marker tooltips (DOM overlay for hover) */}
        {cueMarkers.map((cue) => (
          <div
            key={cue.id}
            className="absolute top-0 group"
            style={{ left: `${cue.time * pixelsPerSecond * audioZoom}px`, width: '2px', height: '100%' }}
            title={`${cue.label} — ${cue.time.toFixed(2)}s (right-click to remove)`}
          >
            {/* Hover hitbox */}
            <div className="absolute -left-2 top-0 w-5 h-full cursor-pointer" />
          </div>
        ))}

        {!audioUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              className="cursor-pointer flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-40"
              onClick={openFilePicker}
              disabled={uploading}
              aria-label="Importar arquivo de áudio"
            >
              <Upload className="h-3 w-3" />
              {uploading ? 'Enviando…' : 'Importar áudio (MP3, WAV, FLAC, OGG, M4A…)'}
            </button>
          </div>
        )}

        {/* Single shared hidden <input>: programmatic .click() from buttons. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={AUDIO_FILE_ACCEPT}
          className="hidden"
          onChange={handleUpload}
        />

        {/* Cue count + Height indicator */}
        {isExpanded && (
          <div className="absolute right-1 top-1 flex items-center gap-2">
            {cueMarkers.length > 0 && (
              <span className="text-[7px] font-mono-code text-safety/60">
                <Flag className="h-2 w-2 inline mr-0.5" />{cueMarkers.length} cues
              </span>
            )}
            <span className="text-[7px] font-mono-code text-muted-foreground/30">
              {trackHeight}px
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
