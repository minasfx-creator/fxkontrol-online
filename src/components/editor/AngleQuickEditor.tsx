/**
 * AngleQuickEditor — Inline heading/pitch angle editor
 */
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface Props {
  heading: number;
  pitch: number;
  onHeadingChange?: (v: number) => void;
  onPitchChange?: (v: number) => void;
  [key: string]: any;
}

export default function AngleQuickEditor({ heading, pitch, onHeadingChange, onPitchChange }: Props) {
  return (
    <div className="space-y-2 p-2 rounded border border-border/20 bg-muted/10">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Heading: {heading}°</Label>
        <Slider min={0} max={360} step={1} value={[heading]} onValueChange={([v]) => onHeadingChange?.(v)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Pitch: {pitch}°</Label>
        <Slider min={-90} max={90} step={1} value={[pitch]} onValueChange={([v]) => onPitchChange?.(v)} />
      </div>
    </div>
  );
}
