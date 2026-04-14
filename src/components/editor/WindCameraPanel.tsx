import { useProjectStore, CameraKeyframe } from '@/store/useProjectStore';
import { Wind, Camera, Plus, Trash2, Film, Eye, EyeOff } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function WindCameraPanel() {
  const wind = useProjectStore((s) => s.wind);
  const setWind = useProjectStore((s) => s.setWind);
  const keyframes = useProjectStore((s) => s.cameraKeyframes);
  const addKf = useProjectStore((s) => s.addCameraKeyframe);
  const removeKf = useProjectStore((s) => s.removeCameraKeyframe);
  const camEnabled = useProjectStore((s) => s.cameraAnimationEnabled);
  const setCamEnabled = useProjectStore((s) => s.setCameraAnimationEnabled);
  const currentTime = useProjectStore((s) => s.currentTime);

  const handleAddKeyframe = () => {
    const kf: CameraKeyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: currentTime,
      position: [0, 8, 25],
      lookAt: [0, 5, 0],
      fov: 60,
    };
    addKf(kf);
  };

  const directionLabel = (deg: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Wind Section */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Wind Simulation</span>
          </div>
          <Switch
            checked={wind.enabled}
            onCheckedChange={(v) => setWind({ enabled: v })}
            className="scale-75"
          />
        </div>

        <div className={cn("space-y-3 transition-opacity", !wind.enabled && "opacity-40 pointer-events-none")}>
          {/* Direction */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Direction</span>
              <span className="text-[10px] font-mono-code text-foreground">{Math.round(wind.direction)}° {directionLabel(wind.direction)}</span>
            </div>
            <Slider
              value={[wind.direction]}
              onValueChange={([v]) => setWind({ direction: v })}
              min={0} max={360} step={5}
              className="h-4"
            />
          </div>

          {/* Speed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Speed</span>
              <span className="text-[10px] font-mono-code text-foreground">{wind.speed.toFixed(1)} m/s</span>
            </div>
            <Slider
              value={[wind.speed]}
              onValueChange={([v]) => setWind({ speed: v })}
              min={0} max={15} step={0.5}
              className="h-4"
            />
          </div>

          {/* Gust */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Gusts</span>
              <span className="text-[10px] font-mono-code text-foreground">{Math.round(wind.gustStrength * 100)}%</span>
            </div>
            <Slider
              value={[wind.gustStrength]}
              onValueChange={([v]) => setWind({ gustStrength: v })}
              min={0} max={1} step={0.05}
              className="h-4"
            />
          </div>
        </div>
      </div>

      {/* Camera Animation Section */}
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Camera Animation</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title={camEnabled ? 'Disable camera path' : 'Enable camera path'}
              onClick={() => setCamEnabled(!camEnabled)}
            >
              {camEnabled ? <Eye className="w-3 h-3 text-primary" /> : <EyeOff className="w-3 h-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Add keyframe at current time"
              onClick={handleAddKeyframe}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {keyframes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Camera className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-[10px]">No keyframes yet</p>
              <p className="text-[10px] opacity-60">Add keyframes to animate the camera during playback</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {keyframes.map((kf, i) => (
                <div
                  key={kf.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-surface-2/60 border border-border/30 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-code text-primary w-5">K{i + 1}</span>
                    <span className="text-[10px] font-mono-code text-foreground">{formatTime(kf.time)}</span>
                    <span className="text-[9px] text-muted-foreground">
                      FOV {kf.fov}°
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeKf(kf.id)}
                  >
                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="pt-2 mt-auto border-t border-border/30">
          <p className="text-[9px] text-muted-foreground">
            {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''} · 
            {camEnabled ? ' Path active' : ' Path disabled'}
          </p>
        </div>
      </div>
    </div>
  );
}
