import { useState, useRef, useCallback } from 'react';
import { Camera, X, Upload, Grid3X3, Minus, Eye, EyeOff, Layers, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DEFAULT_AR_STATE, type AROverlayState, type ARCalibration } from '@/lib/arOverlayEngine';

export default function AROverlayPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AROverlayState>({ ...DEFAULT_AR_STATE });
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCalibration = useCallback((key: keyof ARCalibration, value: number) => {
    setState(prev => ({
      ...prev,
      calibration: { ...prev.calibration, [key]: value },
    }));
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setState(prev => ({ ...prev, venueImageUrl: url }));
      setPreview(url);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleReset = useCallback(() => {
    setState({ ...DEFAULT_AR_STATE });
    setPreview(null);
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">AR Overlay</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {/* Venue Image Upload */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Venue Photo
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {preview ? (
            <div className="relative group">
              <img
                src={preview}
                alt="Venue"
                className="w-full h-28 object-cover rounded border border-border/40"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-white hover:text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Replace
                </Button>
              </div>
              {/* Horizon line preview */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-cyan-400/60 pointer-events-none"
                style={{ top: `${state.calibration.horizonY * 100}%` }}
              />
              {/* Vanishing point */}
              <div
                className="absolute w-2 h-2 rounded-full bg-orange-500/80 border border-orange-300 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${state.calibration.vanishingPointX * 100}%`,
                  top: `${state.calibration.horizonY * 100}%`,
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-28 border-2 border-dashed border-border/60 rounded flex flex-col items-center justify-center gap-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground">
                Upload venue photo or panorama
              </span>
            </button>
          )}
        </div>

        {/* Calibration */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Perspective Calibration
          </Label>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horizon Y</span>
              <span className="font-mono-code text-foreground">{(state.calibration.horizonY * 100).toFixed(0)}%</span>
            </div>
            <Slider
              min={10}
              max={90}
              step={1}
              value={[state.calibration.horizonY * 100]}
              onValueChange={([v]) => updateCalibration('horizonY', v / 100)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vanishing Point X</span>
              <span className="font-mono-code text-foreground">{(state.calibration.vanishingPointX * 100).toFixed(0)}%</span>
            </div>
            <Slider
              min={10}
              max={90}
              step={1}
              value={[state.calibration.vanishingPointX * 100]}
              onValueChange={([v]) => updateCalibration('vanishingPointX', v / 100)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effect Scale</span>
              <span className="font-mono-code text-foreground">{state.calibration.effectScale.toFixed(2)}×</span>
            </div>
            <Slider
              min={20}
              max={300}
              step={5}
              value={[state.calibration.effectScale * 100]}
              onValueChange={([v]) => updateCalibration('effectScale', v / 100)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FOV Estimate</span>
              <span className="font-mono-code text-foreground">{state.calibration.estimatedFOV}°</span>
            </div>
            <Slider
              min={20}
              max={120}
              step={5}
              value={[state.calibration.estimatedFOV]}
              onValueChange={([v]) => updateCalibration('estimatedFOV', v)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rotation</span>
              <span className="font-mono-code text-foreground">{state.calibration.rotationOffset}°</span>
            </div>
            <Slider
              min={-180}
              max={180}
              step={1}
              value={[state.calibration.rotationOffset]}
              onValueChange={([v]) => updateCalibration('rotationOffset', v)}
            />
          </div>
        </div>

        {/* Compositing */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Compositing
          </Label>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overlay Opacity</span>
              <span className="font-mono-code text-foreground">{(state.overlayOpacity * 100).toFixed(0)}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[state.overlayOpacity * 100]}
              onValueChange={([v]) => setState(prev => ({ ...prev, overlayOpacity: v / 100 }))}
            />
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground">Blend Mode</span>
            <Select
              value={state.blendMode}
              onValueChange={(v) => setState(prev => ({ ...prev, blendMode: v as AROverlayState['blendMode'] }))}
            >
              <SelectTrigger className="h-7 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="screen">Screen (Bright)</SelectItem>
                <SelectItem value="add">Additive (Glow)</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="overlay">Overlay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overlays */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Guides
          </Label>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Minus className="w-3 h-3 text-cyan-400" />
              <span className="text-muted-foreground">Horizon Line</span>
            </div>
            <Switch
              checked={state.showHorizon}
              onCheckedChange={(v) => setState(prev => ({ ...prev, showHorizon: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Grid3X3 className="w-3 h-3 text-yellow-400" />
              <span className="text-muted-foreground">Perspective Grid</span>
            </div>
            <Switch
              checked={state.showGrid}
              onCheckedChange={(v) => setState(prev => ({ ...prev, showGrid: v }))}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[10px]"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset Calibration
          </Button>

          {preview && (
            <Button
              variant="default"
              size="sm"
              className="w-full h-7 text-[10px]"
              onClick={() => {
                // Dispatch event for the viewport to enable AR composite mode
                window.dispatchEvent(new CustomEvent('ar-overlay-update', { detail: state }));
              }}
            >
              <Layers className="w-3 h-3 mr-1" />
              Apply to Viewport
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="bg-surface-2/50 rounded p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>AR Overlay Mode</strong></p>
          <p>Upload a venue photo to composite simulated effects over the real location. Adjust horizon and vanishing point to match the photo's perspective.</p>
          <p className="text-primary/70">Tip: Use Screen blend mode for realistic firework glow over dark sky photos.</p>
        </div>
      </div>
    </div>
  );
}
