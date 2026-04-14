import { useState, useCallback, useRef } from 'react';
import { Video, X, Camera, Play, Square, Type, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useProjectStore } from '@/store/useProjectStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { toast } from 'sonner';

type Resolution = '720p' | '1080p' | '4K';
const RESOLUTIONS: Record<Resolution, { w: number; h: number; label: string }> = {
  '720p': { w: 1280, h: 720, label: 'HD 720p' },
  '1080p': { w: 1920, h: 1080, label: 'Full HD 1080p' },
  '4K': { w: 3840, h: 2160, label: 'Ultra HD 4K' },
};

type BurnInPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function formatTimecodeForBurnIn(seconds: number, fps: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * fps);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export default function VideoRecorderPanel({ onClose }: { onClose: () => void }) {
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fps] = useState(30);
  const [burnIn, setBurnIn] = useState(false);
  const [burnInPos, setBurnInPos] = useState<BurnInPosition>('bottom-left');
  const [burnInOpacity, setBurnInOpacity] = useState(0.8);
  const [showProjectName, setShowProjectName] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectName = useProjectStore(s => s.projectName);

  const drawBurnIn = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const smpte = useSMPTEStore.getState();
    const project = useProjectStore.getState();
    const tc = formatTimecodeForBurnIn(project.currentTime + (smpte.startTimecodeSeconds || 0), smpte.frameRate);
    const fontSize = Math.max(16, Math.round(h / 30));
    const pad = Math.round(fontSize * 0.8);

    ctx.font = `bold ${fontSize}px "SF Mono", "Cascadia Code", "Fira Code", monospace`;
    const lines: string[] = [tc];
    if (showProjectName) lines.push(projectName);
    lines.push(`${smpte.frameRate} fps • ${RESOLUTIONS[resolution].label}`);

    const maxTextW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxTextW + pad * 2;
    const lineH = fontSize * 1.4;
    const boxH = lines.length * lineH + pad;

    let x = pad;
    let y = pad;
    if (burnInPos.includes('right')) x = w - boxW - pad;
    if (burnInPos.includes('bottom')) y = h - boxH - pad;

    ctx.globalAlpha = burnInOpacity;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      const lx = x + pad;
      const ly = y + pad * 0.4 + i * lineH;
      if (i === 0) {
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${fontSize * 1.1}px "SF Mono", "Cascadia Code", monospace`;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${fontSize * 0.75}px "SF Mono", "Cascadia Code", monospace`;
      }
      ctx.fillText(line, lx, ly);
    });
    ctx.globalAlpha = 1;
  }, [burnInPos, burnInOpacity, showProjectName, projectName, resolution]);

  const startRecording = useCallback(() => {
    const srcCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!srcCanvas) {
      toast.error('No 3D canvas found');
      return;
    }

    const res = RESOLUTIONS[resolution];
    let stream: MediaStream;

    if (burnIn) {
      // Create composite canvas for burn-in overlay
      let composite = compositeCanvasRef.current;
      if (!composite) {
        composite = document.createElement('canvas');
        compositeCanvasRef.current = composite;
      }
      composite.width = res.w;
      composite.height = res.h;
      const ctx = composite.getContext('2d')!;

      const renderFrame = () => {
        ctx.drawImage(srcCanvas, 0, 0, res.w, res.h);
        drawBurnIn(ctx, res.w, res.h);
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();
      stream = composite.captureStream(fps);
    } else {
      stream = srcCanvas.captureStream(fps);
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: resolution === '4K' ? 20_000_000 : resolution === '1080p' ? 8_000_000 : 4_000_000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cancelAnimationFrame(animFrameRef.current);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName.replace(/\s+/g, '_')}_sim_${resolution}${burnIn ? '_TC' : ''}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecording(false);
        setProgress(0);
        toast.success('Video saved!');
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setRecording(true);

      useProjectStore.getState().setCurrentTime(0);
      useProjectStore.getState().setPlaying(true);

      const duration = useProjectStore.getState().duration;
      intervalRef.current = setInterval(() => {
        const t = useProjectStore.getState().currentTime;
        setProgress(Math.min(100, (t / duration) * 100));
        if (t >= duration) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          stopRecording();
        }
      }, 200);
    } catch (err) {
      toast.error('Failed to start recording');
    }
  }, [resolution, fps, projectName, burnIn, drawBurnIn]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      useProjectStore.getState().setPlaying(false);
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const takeScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) { toast.error('No 3D canvas'); return; }

    if (burnIn) {
      const composite = document.createElement('canvas');
      composite.width = canvas.width;
      composite.height = canvas.height;
      const ctx = composite.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0);
      drawBurnIn(ctx, composite.width, composite.height);
      const link = document.createElement('a');
      link.download = `${projectName.replace(/\s+/g, '_')}_screenshot_TC.png`;
      link.href = composite.toDataURL('image/png');
      link.click();
    } else {
      const link = document.createElement('a');
      link.download = `${projectName.replace(/\s+/g, '_')}_screenshot.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
    toast.success('Screenshot saved!');
  }, [projectName, burnIn, drawBurnIn]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Video / Screenshot</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* Resolution */}
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

        {/* Timecode Burn-In */}
        <div className="border border-border/30 rounded p-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-semibold text-foreground uppercase">TC Burn-In</span>
            </div>
            <Switch checked={burnIn} onCheckedChange={setBurnIn} className="scale-75" />
          </div>

          {burnIn && (
            <div className="space-y-2 pl-1">
              <div>
                <label className="text-[8px] text-muted-foreground">Position</label>
                <Select value={burnInPos} onValueChange={(v) => setBurnInPos(v as BurnInPosition)}>
                  <SelectTrigger className="h-6 text-[9px] bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left" className="text-[9px]">↖ Top Left</SelectItem>
                    <SelectItem value="top-right" className="text-[9px]">↗ Top Right</SelectItem>
                    <SelectItem value="bottom-left" className="text-[9px]">↙ Bottom Left</SelectItem>
                    <SelectItem value="bottom-right" className="text-[9px]">↘ Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[8px] text-muted-foreground">Opacity</span>
                  <span className="text-[8px] text-primary font-mono">{Math.round(burnInOpacity * 100)}%</span>
                </div>
                <Slider value={[burnInOpacity]} onValueChange={([v]) => setBurnInOpacity(v)} min={0.3} max={1} step={0.05} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[8px] text-muted-foreground">Show Project Name</span>
                <Switch checked={showProjectName} onCheckedChange={setShowProjectName} className="scale-75" />
              </div>

              {/* Preview */}
              <div className="bg-black/80 rounded p-1.5 font-mono text-center">
                <span className="text-[11px] text-red-400 font-bold">01:00:00:00</span>
                {showProjectName && <div className="text-[8px] text-white/60">{projectName}</div>}
                <div className="text-[7px] text-white/40">{fps} fps • {RESOLUTIONS[resolution].label}</div>
              </div>
            </div>
          )}
        </div>

        {/* Record / Screenshot */}
        {recording ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-[10px] text-destructive font-mono-code">RECORDING</span>
              {burnIn && <span className="text-[8px] text-primary font-mono-code">+TC</span>}
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-destructive transition-all" style={{ width: `${progress}%` }} />
            </div>
            <Button size="sm" variant="destructive" className="w-full h-7 text-[10px]" onClick={stopRecording}>
              <Square className="w-3 h-3 mr-1" /> Stop Recording
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="sm" className="w-full h-8 text-xs" onClick={startRecording}>
              <Play className="w-3 h-3 mr-1.5" /> Record Simulation {burnIn ? '+ TC' : ''}
            </Button>
            <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={takeScreenshot}>
              <Camera className="w-3 h-3 mr-1" /> Screenshot {burnIn ? '+ TC' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
