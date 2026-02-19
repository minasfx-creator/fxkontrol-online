import { useRef, useEffect, useState, useCallback } from 'react';
import { Upload, Music, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function detectBPM(audioBuffer: AudioBuffer): number {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // Simple onset detection using energy peaks
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const energies: number[] = [];
  
  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += data[j] * data[j];
    }
    energies.push(sum / windowSize);
  }
  
  // Find peaks
  const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5;
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks.push(i);
    }
  }
  
  if (peaks.length < 2) return 120; // default
  
  // Calculate average interval
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(peaks.length, 50); i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const secondsPerBeat = (avgInterval * windowSize) / sampleRate;
  let bpm = Math.round(60 / secondsPerBeat);
  
  // Normalize to reasonable range
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

export default function AudioWaveform({ pixelsPerSecond }: { pixelsPerSecond: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const { currentTime, duration, audioUrl, bpm, setAudioUrl, setBpm, snapToBeat, setSnapToBeat } = useProjectStore();
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [beats, setBeats] = useState<number[]>([]);

  // Load and decode audio
  const loadAudio = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Downsample for waveform display
      const rawData = audioBuffer.getChannelData(0);
      const samples = Math.floor(duration * pixelsPerSecond * 2);
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
      
      // BPM detection
      const detectedBpm = detectBPM(audioBuffer);
      setBpm(detectedBpm);
      setBeats(getBeats(detectedBpm, duration));
      
      toast.success(`Áudio carregado! BPM detectado: ${detectedBpm}`);
    } catch (err) {
      console.error('Failed to decode audio:', err);
      toast.error('Erro ao decodificar áudio');
    }
  }, [duration, pixelsPerSecond, setBpm]);

  useEffect(() => {
    if (audioUrl) {
      loadAudio(audioUrl);
    }
  }, [audioUrl, loadAudio]);

  // Update beats when BPM changes
  useEffect(() => {
    if (bpm) setBeats(getBeats(bpm, duration));
  }, [bpm, duration]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = duration * pixelsPerSecond;
    const height = 36;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Draw beat markers
    if (beats.length > 0) {
      ctx.strokeStyle = 'hsla(24, 95%, 53%, 0.3)';
      ctx.lineWidth = 1;
      beats.forEach((beat) => {
        const x = beat * pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
    }

    // Draw waveform
    if (waveformData) {
      const mid = height / 2;
      ctx.fillStyle = 'hsla(207, 90%, 54%, 0.5)';

      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * width;
        const barHeight = waveformData[i] * height * 0.8;
        ctx.fillRect(x, mid - barHeight / 2, 1, barHeight);
      }
    }

    // Playhead
    ctx.strokeStyle = 'hsl(207, 90%, 54%)';
    ctx.lineWidth = 2;
    const playX = currentTime * pixelsPerSecond;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }, [waveformData, beats, currentTime, duration, pixelsPerSecond]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('audio').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(path);
      
      // For private bucket, use signed URL
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

  return (
    <div className="flex border-b border-border/50">
      <div className="w-28 flex-shrink-0 flex items-center px-2 border-r border-border/50 bg-surface-1">
        <div className="flex items-center gap-1 w-full">
          <Music className="h-3 w-3 text-electric flex-shrink-0" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-1">Audio</span>
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
        {bpm && (
          <span className="text-[8px] font-mono-code text-safety ml-1">{bpm}</span>
        )}
      </div>
      <div className="flex-1 relative h-9 bg-surface-0/50 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" style={{ width: `${duration * pixelsPerSecond}px` }} />
        {!audioUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <label className="cursor-pointer flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground">
              <Upload className="h-3 w-3" />
              Upload MP3/WAV
              <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
