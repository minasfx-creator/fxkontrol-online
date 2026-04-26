/**
 * FXK Project Types — Pure type definitions for the project domain.
 * Extracted from useProjectStore for decoupling and tree-shaking.
 */

export interface DepthLayer {
  label: string;
  layer: 'foreground' | 'midground' | 'background';
  heightMultiplier: number;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export interface TimelineItem {
  id: string;
  effectId: string;
  startTime: number;
  trackIndex: number;
  position: { x: number; y: number; z: number };
  pan?: number;
  tilt?: number;
  spin?: number;
  chainRef?: string;
  chainGap?: number;
  chainRow?: number;
  positionName?: string;
  notes?: string;
  flightCount?: number;
  /** Per-item color override; if set, replaces the library effect color for this cue only. */
  colorOverride?: string;
  hazard?: string;
  rack?: number;
  tube?: number;
  section?: string;
  universe?: string;
  customField?: string;
  durationOverride?: number;
  positionId?: string;
  positionIds?: string[];
  cueHeading?: number;
  cuePitch?: number;
}

export type PositionType = 'pyro' | 'drone-pad' | 'light';

export interface Position {
  id: string;
  name: string;
  type: PositionType;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  color: string;
  section?: string;
}

export interface BezierHandle {
  x: number;
  y: number;
  z: number;
}

export interface Waypoint {
  id: string;
  position: { x: number; y: number; z: number };
  time: number;
  controlIn?: BezierHandle;
  controlOut?: BezierHandle;
  maxSpeed?: number;
}

export interface Trajectory {
  id: string;
  positionId: string;
  waypoints: Waypoint[];
  name: string;
}

export type EditorMode = 'select' | 'add-pyro' | 'add-drone' | 'add-waypoint' | 'adjust-angles';
export type SelectionMode = 'positions' | 'events' | 'both';

export interface DroneFormation {
  id: string;
  formationType: string;
  droneCount: number;
  height: number;
  radius: number;
  spacing: number;
  rotation: number;
  startTime: number;
  transitionDuration: number;
  holdDuration: number;
  color: string;
  endColor?: string;
  colorTransition?: 'instant' | 'linear' | 'pulse' | 'rainbow' | 'wave' | 'rgb_cycle' | 'cascade' | 'sparkle';
  points: { x: number; z: number }[];
}

export interface CueMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface CameraKeyframe {
  id: string;
  time: number;
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface WindSettings {
  enabled: boolean;
  direction: number;
  speed: number;
  gustStrength: number;
}
