/**
 * AI Choreography (xAI Grok) — shared types.
 * Mirror of the macro JSON returned by the `grok-choreography` edge function.
 */
export interface MacroGroup {
  group_id: number;
  num_drones: number;
  shape: 'circle' | 'sphere' | 'line' | 'grid' | 'heart' | 'spiral' | 'wave' | 'text' | 'logo' | 'custom';
  center: [number, number, number];
  radius: number;
  color: string;
}
export interface MacroFormation {
  timestamp: number;
  name: string;
  description?: string;
  groups: MacroGroup[];
}
export interface MacroTransition {
  from_timestamp: number;
  to_timestamp: number;
  easing: 'linear' | 'bezier' | 'spline' | 'ease-in-out';
  max_speed: number;
}
export interface MacroChoreography {
  metadata: {
    title: string;
    num_drones: number;
    duration_seconds: number;
    fps: number;
  };
  formations: MacroFormation[];
  transitions?: MacroTransition[];
  safety?: { min_separation_m?: number; max_speed_ms?: number };
}

export interface DroneFrame {
  t: number;       // seconds
  x: number;
  y: number;       // altitude
  z: number;
  r: number;       // 0..255
  g: number;
  b: number;
}
export interface DroneTrajectory {
  drone_id: number;
  frames: DroneFrame[];
}
export interface ExpandedShow {
  metadata: MacroChoreography['metadata'];
  drones: DroneTrajectory[];
  collisions: { t: number; a: number; b: number; dist: number }[];
  maxSpeedObserved: number;
}
