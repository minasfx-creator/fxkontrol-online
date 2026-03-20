import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Upload, Box, RotateCw, Maximize2, Check } from 'lucide-react';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';

interface SceneObjectImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SceneObjectImporter({ open, onOpenChange }: SceneObjectImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scale, setScale] = useState(1);
  const [rotY, setRotY] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const addSiteModel = useSceneStore((s) => s.addSiteModel);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.(glb|gltf|fbx|obj)$/i, ''));
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(f));
  }, [objectUrl]);

  const handleImport = useCallback(() => {
    if (!file || !objectUrl) return;
    addSiteModel({
      id: `obj-${Date.now()}`,
      name: name || file.name,
      url: objectUrl,
      position: [0, 0, 0],
      rotation: [0, rotY, 0],
      scale,
      visible: true,
      source: 'local',
    });
    toast.success(`"${name || file.name}" adicionado à cena`);
    onOpenChange(false);
    setFile(null);
    // Don't revoke objectUrl here — the scene store still references it for rendering
    setObjectUrl(null);
    setName('');
    setScale(1);
    setRotY(0);
  }, [file, objectUrl, name, scale, rotY, addSiteModel, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Box className="w-4 h-4 text-primary" />
            Importar Objeto 3D
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".glb,.gltf,.fbx,.obj"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {file ? file.name : 'Clique para selecionar GLB, glTF, FBX ou OBJ'}
            </p>
            {file && (
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          {file && (
            <>
              {/* Name */}
              <div>
                <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1 block">Nome</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-8 text-xs bg-background border-border/20"
                  placeholder="Nome do objeto"
                />
              </div>

              {/* Scale */}
              <div>
                <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> Escala: {scale.toFixed(2)}x
                </label>
                <Slider
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  min={0.01}
                  max={10}
                  step={0.01}
                />
              </div>

              {/* Rotation Y */}
              <div>
                <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <RotateCw className="w-3 h-3" /> Rotação Y: {rotY}°
                </label>
                <Slider
                  value={[rotY]}
                  onValueChange={([v]) => setRotY(v)}
                  min={0}
                  max={360}
                  step={15}
                />
              </div>

              {/* Import Button */}
              <Button onClick={handleImport} className="w-full h-9 text-xs font-semibold">
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Adicionar à Cena
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
