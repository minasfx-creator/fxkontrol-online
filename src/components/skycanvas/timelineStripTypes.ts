export interface TimelineStripProps {
  time: number;
  duration: number;
  onSeekAbs: (t: number) => void;
  onDropEffect: (effectId: string, t: number) => void;
  peaks: Float32Array | null;
}
