import { useState, useRef, useCallback } from 'react';
import { Image, X, Upload, Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface BgImage {
  id: string;
  name: string;
  url: string;
  opacity: number;
  position: 'horizon' | 'skybox' | 'ground';
}

export default function BackgroundPanel({ onClose }: { onClose: () => void }) {
  const [images, setImages] = useState<BgImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImages(prev => [...prev, {
      id: `bg-${Date.now()}`,
      name: file.name,
      url,
      opacity: 0.8,
      position: 'horizon',
    }]);
    toast.success(`Background: ${file.name}`);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Background</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-3 space-y-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImport} className="hidden" />
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1.5" /> Import Background Image
        </Button>
        <div className="text-[9px] text-muted-foreground">
          Panoramic images, skyline photos, venue shots
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
        {images.length === 0 ? (
          <div className="text-center py-8">
            <Image className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground">No backgrounds</p>
          </div>
        ) : images.map(img => (
          <div key={img.id} className="p-2 bg-surface-1/50 rounded border border-border/20 space-y-2">
            <div className="flex items-center gap-2">
              <img src={img.url} alt={img.name} className="w-10 h-6 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-foreground truncate">{img.name}</div>
                <div className="text-[8px] text-muted-foreground">{img.position}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}>
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground">Opacity</label>
              <Slider
                value={[img.opacity * 100]}
                onValueChange={([v]) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, opacity: v / 100 } : i))}
                min={0} max={100} step={5}
                className="mt-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
