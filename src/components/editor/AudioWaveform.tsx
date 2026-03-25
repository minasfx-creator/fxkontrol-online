import { useRef, useEffect, useState, useCallback } from 'react';
import { Upload, Music, Zap, Volume2, VolumeX, GripHorizontal, Minus, Plus, Flag, Trash2 } from 'lucide-react';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const {
    currentTime, duration, audioUrl, bpm, isPlaying, playbackSpeed,
    setAudioUrl, setBpm, snapToBeat, setSnapToBeat,
    cueMarkers, addCueMarker, removeCueMarker,
  } = useProjectStore();

  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [uploading, setUploading] = useState(false);
  const [beats, setBeats] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [trackHeight, setTrackHeight] = useState(MIN_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

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

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Sync volume / mute
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Sync play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (Math.abs(audio.currentTime - currentTime) > 0.15) {
        audio.currentTime = currentTime;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync seek (when user clicks timeline)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.15) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isPlaying]);

  // Load and decode audio for waveform + BPM
  const loadAudio = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Auto-adjust project duration to match audio length
      const audioDuration = audioBuffer.duration;
      if (audioDuration > 0) {
        const store = useProjectStore.getState();
        // Only extend — never shrink below current items
        const maxItemEnd = store.timelineItems.reduce((max, item) => {
          const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
          return Math.max(max, item.startTime + (effect?.duration ?? 3));
        }, 0);
        const newDuration = Math.max(audioDuration, maxItemEnd);
        store.setDuration(Math.ceil(newDuration));
      }

      const rawData = audioBuffer.getChannelData(0);
      const effectiveDuration = audioDuration > 0 ? Math.ceil(audioDuration) : duration;
      const samples = Math.floor(effectiveDuration * pixelsPerSecond * 2);
      const blockSize = Math.floor(rawData.length / samples);
      const downsampled = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize && start + j < rawData.length; j++) {
          sum += Math.abs(rawData[start + j]);
        }
        downsampled[i] = sum / blockSize;
      }

      setWaveformData(downsampled);

      const detectedBpm = detectBPM(audioBuffer);
      setBpm(detectedBpm);
      setBeats(getBeats(detectedBpm, duration));

      toast.success(`Áudio carregado · BPM: ${detectedBpm}`);
    } catch (err) {
      console.error('Failed to decode audio:', err);
      toast.error('Erro ao decodificar áudio');
    }
  }, [duration, pixelsPerSecond, setBpm]);

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

    const width = duration * pixelsPerSecond;
    const height = trackHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Beat markers
    if (beats.length > 0) {
      beats.forEach((beat, idx) => {
        const x = beat * pixelsPerSecond;
        const isMeasure = idx % 4 === 0;
        ctx.strokeStyle = isMeasure ? 'hsla(24, 95%, 53%, 0.4)' : 'hsla(24, 95%, 53%, 0.15)';
        ctx.lineWidth = isMeasure ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Measure number
        if (isMeasure && pixelsPerSecond > 8) {
          ctx.fillStyle = 'hsla(24, 95%, 53%, 0.5)';
          ctx.font = '7px monospace';
          ctx.fillText(`${Math.floor(idx / 4) + 1}`, x + 2, 8);
        }
      });
    }

    // Waveform
    if (waveformData) {
      const mid = height / 2;
      // Gradient for waveform
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'hsla(207, 90%, 64%, 0.6)');
      grad.addColorStop(0.5, 'hsla(207, 90%, 54%, 0.8)');
      grad.addColorStop(1, 'hsla(207, 90%, 64%, 0.6)');
      ctx.fillStyle = grad;

      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * width;
        const barHeight = waveformData[i] * height * 0.85;
        ctx.fillRect(x, mid - barHeight / 2, Math.max(1, width / waveformData.length - 0.5), barHeight);
      }

      // Played region overlay
      const playX = currentTime * pixelsPerSecond;
      ctx.fillStyle = 'hsla(207, 90%, 54%, 0.12)';
      ctx.fillRect(0, 0, playX, height);
    }

    // Cue markers
    cueMarkers.forEach((cue) => {
      const cx = cue.time * pixelsPerSecond;
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
    const playX = currentTime * pixelsPerSecond;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }, [waveformData, beats, currentTime, duration, pixelsPerSecond, trackHeight, cueMarkers]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('audio').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: signedData, error: signError } = await supabase.storage
        .from('audio')
        .createSignedUrl(path, 3600);

      if (signError) throw signError;

      setAudioUrl(signedData.signedUrl);
      toast.success('Áudio enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
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

          <label className="cursor-pointer">
            <Upload className="h-3 w-3 text-muted-foreground hover:text-primary" />
            <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

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
        </div>

        {/* Height controls + BPM */}
        <div className="flex items-center gap-1 mt-1">
          {bpm && (
            <span className="text-[8px] font-mono-code text-safety">{bpm}</span>
          )}
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
        className="flex-1 relative bg-surface-0/50 overflow-hidden cursor-crosshair"
        style={{ height: `${trackHeight}px` }}
        onDoubleClick={handleWaveformDoubleClick}
        onContextMenu={handleWaveformContextMenu}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: `${duration * pixelsPerSecond}px`, height: `${trackHeight}px` }}
        />

        {/* Cue marker tooltips (DOM overlay for hover) */}
        {cueMarkers.map((cue) => (
          <div
            key={cue.id}
            className="absolute top-0 group"
            style={{ left: `${cue.time * pixelsPerSecond}px`, width: '2px', height: '100%' }}
            title={`${cue.label} — ${cue.time.toFixed(2)}s (right-click to remove)`}
          >
            {/* Hover hitbox */}
            <div className="absolute -left-2 top-0 w-5 h-full cursor-pointer" />
          </div>
        ))}

        {!audioUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <label className="cursor-pointer flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground">
              <Upload className="h-3 w-3" />
              Upload MP3/WAV
              <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        )}

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
