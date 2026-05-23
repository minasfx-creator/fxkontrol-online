/**
 * ─── FWsim Cue Type Icon ──────────────────────────────────────────
 * Maps a TimelineItem cue kind to one of the FWsim Pro cue glyphs.
 * Use `variant: 'uncropped'` for tight rows where the standard glyph
 * leaks beyond its bounding box.
 */
import Camera from '@/assets/fwsim-cue-icons/cue-camera.svg';
import CameraUncropped from '@/assets/fwsim-cue-icons/cue-camera-uncropped.svg';
import Chains from '@/assets/fwsim-cue-icons/cue-chains.svg';
import Dmx from '@/assets/fwsim-cue-icons/cue-dmx.svg';
import DmxUncropped from '@/assets/fwsim-cue-icons/cue-dmx-uncropped.svg';
import Scene from '@/assets/fwsim-cue-icons/cue-scene.svg';
import SceneUncropped from '@/assets/fwsim-cue-icons/cue-scene-uncropped.svg';
import Single from '@/assets/fwsim-cue-icons/cue-single.svg';
import SingleUncropped from '@/assets/fwsim-cue-icons/cue-single-uncropped.svg';
import Stepper from '@/assets/fwsim-cue-icons/cue-stepper.svg';
import StepperUncropped from '@/assets/fwsim-cue-icons/cue-stepper-uncropped-uncropped.svg';
import StepperTestEdit from '@/assets/fwsim-cue-icons/cue-stepper-testedit-uncropped.svg';

export type CueKind =
  | 'camera' | 'chains' | 'dmx' | 'scene' | 'single' | 'stepper' | 'stepper-test';

const ICONS: Record<CueKind, { default: string; uncropped: string }> = {
  camera: { default: Camera, uncropped: CameraUncropped },
  chains: { default: Chains, uncropped: Chains },
  dmx: { default: Dmx, uncropped: DmxUncropped },
  scene: { default: Scene, uncropped: SceneUncropped },
  single: { default: Single, uncropped: SingleUncropped },
  stepper: { default: Stepper, uncropped: StepperUncropped },
  'stepper-test': { default: Stepper, uncropped: StepperTestEdit },
};

export interface CueTypeIconProps {
  kind: CueKind;
  variant?: 'default' | 'uncropped';
  className?: string;
}

export function CueTypeIcon({ kind, variant = 'default', className }: CueTypeIconProps) {
  return (
    <img
      src={ICONS[kind][variant]}
      alt={`${kind} cue`}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

export function cueTypeIconUrl(kind: CueKind, variant: 'default' | 'uncropped' = 'default'): string {
  return ICONS[kind][variant];
}
