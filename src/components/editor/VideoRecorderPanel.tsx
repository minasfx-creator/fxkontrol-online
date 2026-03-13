import { useState, useCallback, useRef } from 'react';
import { Video, X, Camera, Play, Square, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

type Resolution = '720p' | '1080p' | '4K';
const RESOLUTIONS: Record<Resolution, { w: number; h: number; label: string }> = {
  '720p': { w: 1280, h: 720, label: 'HD 720p' },
  '1080p': { w: 1920, h: 1080, label: 'Full HD 1080p' },
  '4K': { w: 3840, h: 2160, label: 'Ultra HD 4K' },
};

export default function VideoRecorderPanel({ onClose }: { onClose: () => void }) {
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fps] = useState(30);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const projectName = useProjectStore(s => s.projectName);

  const startRecording = useCallback(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      toast.error('No 3D canvas found');
      return;
    }

    try {
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: resolution === '4K' ? 20_000_000 : resolution === '1080p' ? 8_000_000 : 4_000_000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName.replace(/\s+/g, '_')}_sim_${resolution}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecording(false);
        setProgress(0);
        toast.success('Video saved!');
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setRecording(true);

      // Auto-play the show
      useProjectStore.getState().setCurrentTime(0);
      useProjectStore.getState().setPlaying(true);

      // Track progress
      const duration = useProjectStore.getState().duration;
      const interval = setInterval(() => {
        const t = useProjectStore.getState().currentTime;
        setProgress(Math.min(100, (t / duration) * 100));
        if (t >= duration) {
          clearInterval(interval);
          stopRecording();
        }
      }, 200);
    } catch (err) {
      toast.error('Failed to start recording');
    }
  }, [resolution, fps, projectName]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      useProjectStore.getState().setPlaying(false);
    }
  }, []);

  const takeScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) { toast.error('No 3D canvas'); return; }
    const link = document.createElement('a');
    link.download = `${projectName.replace(/\s+/g, '_')}_screenshot.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Screenshot saved!');
  }, [projectName]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Video / Screenshot</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <label className="text-[9px] text-muted-foreground uppercase">Resolution</label>
          <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
            <SelectTrigger className="h-7 text-xs bg-surface-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RESOLUTIONS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label} ({v.w}×{v.h})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-[9px] text-muted-foreground font-mono-code bg-surface-1/50 p-2 rounded border border-border/20">
          <div>FPS: {fps} • Codec: VP9/WebM</div>
          <div>Bitrate: {resolution === '4K' ? '20' : resolution === '1080p' ? '8' : '4'} Mbps</div>
        </div>

        {recording ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-red-400 font-mono-code">RECORDING</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <Button size="sm" variant="destructive" className="w-full h-7 text-[10px]" onClick={stopRecording}>
              <Square className="w-3 h-3 mr-1" /> Stop Recording
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="sm" className="w-full h-8 text-xs" onClick={startRecording}>
              <Play className="w-3 h-3 mr-1.5" /> Record Simulation
            </Button>
            <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={takeScreenshot}>
              <Camera className="w-3 h-3 mr-1" /> Take Screenshot
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
