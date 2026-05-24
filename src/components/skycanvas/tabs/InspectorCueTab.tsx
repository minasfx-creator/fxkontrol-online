import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import PropertiesPanel from '@/components/editor/PropertiesPanel';

export default function InspectorCueTab() {
  return (
    <div className="space-y-4 p-1">
      <p className="text-[11px] text-zinc-400 px-2">
        Selecione um cue na timeline ou arraste um efeito da biblioteca para editar suas propriedades.
      </p>
      <PropertiesPanel />
    </div>
  );
}

export function InspectorCueQuickIntensity() {
  const [v, setV] = useState([80]);
  return (
    <div className="px-2">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Intensity</span><span className="text-cyan-300">{v[0]}%</span>
      </div>
      <Slider value={v} onValueChange={setV} max={100} step={1} className="mt-2" />
    </div>
  );
}
