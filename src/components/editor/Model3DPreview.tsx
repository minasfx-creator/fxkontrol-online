/**
 * Model3DPreview — Inline 3D model preview for importers
 * Displays uploaded .glb/.gltf with transform controls
 */
import { useRef, useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export interface ModelTransform {
  scale: number;
  rotationY: number;
  offsetY?: number;
}

interface Props {
  file: File;
  transform: ModelTransform;
  onTransformChange: (t: ModelTransform) => void;
}

export default function Model3DPreview({ file, transform, onTransformChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="space-y-3 p-3 rounded-lg border border-border/30 bg-muted/20">
      {/* 3D Preview placeholder */}
      <div
        ref={canvasRef}
        className="w-full h-40 rounded-md bg-background/60 border border-border/20 flex items-center justify-center text-muted-foreground text-xs"
      >
        {objectUrl ? `Modelo: ${file.name}` : 'Carregando...'}
      </div>

      {/* Scale */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Escala: {transform.scale.toFixed(2)}×</Label>
        <Slider
          min={0.01}
          max={10}
          step={0.01}
          value={[transform.scale]}
          onValueChange={([v]) => onTransformChange({ ...transform, scale: v })}
        />
      </div>

      {/* Rotation Y */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Rotação Y: {transform.rotationY}°</Label>
        <Slider
          min={0}
          max={360}
          step={1}
          value={[transform.rotationY]}
          onValueChange={([v]) => onTransformChange({ ...transform, rotationY: v })}
        />
      </div>

      {/* Offset Y */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Offset Y: {(transform.offsetY ?? 0).toFixed(2)}m
        </Label>
        <Slider
          min={-10}
          max={50}
          step={0.1}
          value={[transform.offsetY ?? 0]}
          onValueChange={([v]) => onTransformChange({ ...transform, offsetY: v })}
        />
      </div>
    </div>
  );
}
