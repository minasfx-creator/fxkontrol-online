import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Camera, Sun } from 'lucide-react';
import LightProgramPanel from '@/components/editor/LightProgramPanel';

export default function InspectorSceneTab() {
  const [exposure, setExposure] = useState([60]);
  const [fov, setFov] = useState([55]);
  return (
    <div className="space-y-5 p-2">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
          <Sun className="h-3 w-3" /> Exposure <span className="ml-auto text-cyan-300">{exposure[0]}</span>
        </label>
        <Slider value={exposure} onValueChange={setExposure} max={100} step={1} className="mt-2" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
          <Camera className="h-3 w-3" /> FOV <span className="ml-auto text-cyan-300">{fov[0]}°</span>
        </label>
        <Slider value={fov} onValueChange={setFov} min={20} max={120} step={1} className="mt-2" />
      </div>
      <div className="glass-section-divider" />
      <LightProgramPanel />
    </div>
  );
}
