import { useState, useCallback, useRef } from 'react';
import { Box, X, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Model3D {
  id: string;
  name: string;
  url: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export default function ModelImportPanel({ onClose }: { onClose: () => void }) {
  const [models, setModels] = useState<Model3D[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['obj', 'gltf', 'glb', 'fbx'].includes(ext || '')) {
      toast.error('Supported: .OBJ, .GLTF, .GLB, .FBX');
      return;
    }

    const url = URL.createObjectURL(file);
    const model: Model3D = {
      id: `model-${Date.now()}`,
      name: file.name,
      url,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };

    setModels(prev => [...prev, model]);
    toast.success(`Imported: ${file.name}`);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const removeModel = useCallback((id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">3D Models</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-3 space-y-2">
        <input ref={fileRef} type="file" accept=".obj,.gltf,.glb,.fbx" onChange={handleImport} className="hidden" />
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1.5" /> Import 3D Model
        </Button>
        <div className="text-[9px] text-muted-foreground">
          Formats: .OBJ, .GLTF, .GLB, .FBX
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
        {models.length === 0 ? (
          <div className="text-center py-8">
            <Box className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground">No models imported</p>
            <p className="text-[9px] text-muted-foreground/60">Import stages, buildings, towers</p>
          </div>
        ) : models.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 bg-surface-1/50 rounded border border-border/20">
            <Box className="w-3 h-3 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-foreground truncate">{m.name}</div>
              <div className="text-[8px] text-muted-foreground font-mono-code">
                pos: ({m.position.x}, {m.position.y}, {m.position.z}) • scale: {m.scale}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeModel(m.id)}>
              <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
