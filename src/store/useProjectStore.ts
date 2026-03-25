import { create } from 'zustand';
import { materializeFormation as materialize } from '@/lib/formationMaterializer';
import type { VideoChoreoResult } from '@/lib/videoChoreoEngine';

export interface DepthLayer {
  label: string;
  layer: 'foreground' | 'midground' | 'background';
  heightMultiplier: number;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export type PartType = 'shell' | 'comet' | 'mine' | 'cake' | 'candle' | 'fan' | 'gerb' | 'flame' | 'sfx' | 'light' | 'laser' | 'drone' | 'formation' | 'single_shot' | 'ground' | 'rocket' | 'waterfall' | 'strobe' | 'set_piece';

export interface Effect {
  id: string;
  name: string;
  category: string;
  type: 'firework' | 'drone' | 'sfx' | 'laser' | 'light';
  color: string;
  duration: number;
  cost: number;
  icon: string;
  // ── Finale 3D compatible fields ──────────────────────────────
  partType?: PartType;          // Physical device type (from Finale manual)
  caliber?: number;             // Size in inches (e.g., 3, 4, 5, 6, 8)
  heightMeters?: number;        // Break/effect height in meters
  prefire?: number;             // Lift time in seconds (shell rise time)
  fuseDelay?: number;           // Fuse delay before ignition
  numDevices?: number;          // Chain device count (1 for single)
  safetyDistance?: number;      // NFPA 1123 safety distance (meters)
  vdl?: string;                 // Visual Description Language string
  pattern?: string;             // Burst pattern: peony, willow, palm, kamuro, crossette
  shotCount?: number;           // For cakes/roman candles: number of shots
  laserPattern?: 'fan' | 'harp' | 'tunnel' | 'cone' | 'single' | 'wave' | 'grid'; // For lasers
  beamType?: 'spot' | 'wash' | 'beam'; // For moving heads
  beamCount?: number;                  // Number of beams (lasers)
  lockoutDefault?: string;      // Risk group for lockout system (e.g. "A", "B", "C", "D")
  // ── VDL rendering metadata ──────────────────────────────────
  angleOffset?: number;         // R45, L30 etc. in degrees (+ = right)
  trailType?: string;           // none, comet, glitter, brocade, charcoal, smoke
  noTrail?: boolean;            // "No Trail" modifier
  hasPistil?: boolean;          // w/ Pistil
  pistilColor?: string;         // Pistil color hex
  colorTransition?: string;     // none, to, changing, alternating
  secondaryColor?: string;      // Secondary color from VDL (& or w/)
  firingPattern?: string;       // Z-Shape, Fan, X-Shape, W-Shape, etc.
  impliesTrail?: boolean;       // Color implies trail (Silver, Gold, Charcoal)
  // ── Niagara particle profile (SuperVDL fusion) ──
  niagaraProfile?: {
    starCount: number;
    lifetime: number;
    velocity: number;
    drag: number;
    gravityScale: number;
    sparkleRate: number;
    glowIntensity: number;
    fadeProfile: 'linear' | 'exponential' | 'ember';
  };
  niagaraPresetId?: string;     // matched Niagara preset ID
  formulationId?: string;       // Chemical formulation ID for realistic rendering
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
  hazard?: string;
  rack?: number;
  tube?: number;
  section?: string;
  universe?: string;
  customField?: string;
  durationOverride?: number;  // Manual duration override from timeline resize
  // ── Finale 3D position linking ──
  positionId?: string;
  positionIds?: string[];
  // ── Per-cue launch angle overrides (Finale 3D) ──
  // When set, these override the position's base heading/pitch for this specific cue.
  // New cues inherit position defaults. Gizmo edits go here, not on position.
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
  section?: string;      // Show section for semi-auto firing segmentation (Finale 3D)
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
  time: number;       // seconds
  label: string;
  color: string;      // HSL string
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

export interface ProjectState {
  projectName: string;
  activeLockouts: string[];  // Risk groups currently locked out from firing
  setActiveLockouts: (lockouts: string[]) => void;
  toggleLockout: (riskGroup: string) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  timelineItems: TimelineItem[];
  selectedEffectId: string | null;
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[]; // Multi-select
  positions: Position[];
  selectedPositionId: string | null;
  selectedPositionIds: string[];
  editorMode: EditorMode;
  selectionMode: SelectionMode;
  linkedTimelineItemIds: string[]; // Timeline items highlighted via position selection
  trajectories: Trajectory[];
  selectedTrajectoryId: string | null;
  selectedWaypointId: string | null;
  showTrajectories: boolean;
  drawHeight: number;
  waypointUndoStack: { trajectoryId: string; waypoint: Waypoint }[];
  audioUrl: string | null;
  bpm: number | null;
  snapToBeat: boolean;
  playbackSpeed: number;
  projectId: string | null;
  cameraKeyframes: CameraKeyframe[];
  cameraAnimationEnabled: boolean;
  wind: WindSettings;
  droneFormations: DroneFormation[];
  selectedFormationId: string | null;
  selectedTrajectoryIds: string[];
  showFormations: boolean;
  cueMarkers: CueMarker[];
  videoChoreoResult: VideoChoreoResult | null;
  depthLayers: DepthLayer[];
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number };
  locationName: string | null;
  timeZoneId: string | null;
  timeZoneOffset: number | null;   // total offset in seconds from UTC
  terrainElevation: number | null; // meters
  staticMapUrl: string | null;
  setGpsOrigin: (origin: { lat: number; lng: number; heading: number; altitude: number }) => void;
  setGeoIntelligence: (data: {
    locationName?: string | null;
    timeZoneId?: string | null;
    timeZoneOffset?: number | null;
    terrainElevation?: number | null;
    staticMapUrl?: string | null;
  }) => void;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addTimelineItem: (item: TimelineItem) => void;
  removeTimelineItem: (id: string) => void;
  removeMultipleTimelineItems: (ids: string[]) => void;
  updateTimelineItem: (id: string, updates: Partial<Omit<TimelineItem, 'id'>>) => void;
  selectEffect: (id: string | null) => void;
  selectTimelineItem: (id: string | null) => void;
  toggleTimelineItemSelection: (id: string) => void;
  clearTimelineItemSelection: () => void;
  duplicateTimelineItems: (ids: string[]) => void;
  setProjectName: (name: string) => void;
  addPosition: (pos: Position) => void;
  updatePosition: (id: string, updates: Partial<Omit<Position, 'id'>>) => void;
  removePosition: (id: string) => void;
  selectPosition: (id: string | null) => void;
  togglePositionSelection: (id: string) => void;
  selectMultiplePositions: (ids: string[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  selectPositionAndLinkedEvents: (positionId: string) => void;
  selectMultiplePositionsAndLinkedEvents: (ids: string[]) => void;
  selectTimelineItemAndLinkedPosition: (itemId: string) => void;
  addTrajectory: (traj: Trajectory) => void;
  batchImportVVIZ: (positions: Position[], trajectories: Trajectory[], projectName?: string, duration?: number) => void;
  updateTrajectory: (id: string, updates: Partial<Omit<Trajectory, 'id'>>) => void;
  removeTrajectory: (id: string) => void;
  selectTrajectory: (id: string | null) => void;
  selectWaypoint: (id: string | null) => void;
  addWaypoint: (trajectoryId: string, waypoint: Waypoint) => void;
  updateWaypoint: (trajectoryId: string, waypointId: string, updates: Partial<Omit<Waypoint, 'id'>>) => void;
  removeWaypoint: (trajectoryId: string, waypointId: string) => void;
  setShowTrajectories: (show: boolean) => void;
  setDrawHeight: (h: number) => void;
  undoLastWaypoint: () => void;
  setAudioUrl: (url: string | null) => void;
  setBpm: (bpm: number | null) => void;
  setSnapToBeat: (snap: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setProjectId: (id: string | null) => void;
  combineAsChain: (itemIds: string[], gap?: number) => void;
  breakChain: (chainRef: string) => void;
  addCameraKeyframe: (kf: CameraKeyframe) => void;
  updateCameraKeyframe: (id: string, updates: Partial<Omit<CameraKeyframe, 'id'>>) => void;
  removeCameraKeyframe: (id: string) => void;
  setCameraAnimationEnabled: (enabled: boolean) => void;
  setWind: (updates: Partial<WindSettings>) => void;
  addDroneFormation: (formation: DroneFormation) => void;
  updateDroneFormation: (id: string, updates: Partial<Omit<DroneFormation, 'id'>>) => void;
  removeDroneFormation: (id: string) => void;
  selectFormation: (id: string | null) => void;
  materializeFormation: (formation: DroneFormation) => void;
  toggleTrajectorySelection: (id: string) => void;
  selectAllFormationTrajectories: (formationIndex: number) => void;
  clearTrajectorySelection: () => void;
  batchOffsetWaypoints: (trajectoryIds: string[], offset: { x: number; y: number; z: number }) => void;
  batchScaleWaypoints: (trajectoryIds: string[], scale: number) => void;
  setShowFormations: (show: boolean) => void;
  reorderDroneFormation: (fromIndex: number, toIndex: number) => void;
  duplicateDroneFormation: (id: string) => void;
  clearAllFormations: () => void;
  recalculateFormationTimings: () => void;
  addCueMarker: (marker: CueMarker) => void;
  removeCueMarker: (id: string) => void;
  updateCueMarker: (id: string, updates: Partial<Omit<CueMarker, 'id'>>) => void;
  clearCueMarkers: () => void;
  setVideoChoreoResult: (result: VideoChoreoResult | null) => void;
  setDepthLayers: (layers: DepthLayer[]) => void;
}

export const EFFECT_LIBRARY: Effect[] = [
  // ── Morteiros (Shells) — with Finale 3D physics ──────────────
  { id: 'mort-01', name: 'Chrysanthemum 3"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 2.5, cost: 12, icon: '💥', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'chrysanthemum', safetyDistance: 70 },
  { id: 'mort-02', name: 'Willow 4"', category: 'morteiros', type: 'firework', color: '#FFA500', duration: 3.5, cost: 18, icon: '🎆', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'willow', safetyDistance: 100 },
  { id: 'mort-03', name: 'Brocade Crown 5"', category: 'morteiros', type: 'firework', color: '#FFE4B5', duration: 4, cost: 25, icon: '👑', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5, pattern: 'kamuro', safetyDistance: 140 },
  { id: 'mort-04', name: 'Coconut Palm 6"', category: 'morteiros', type: 'firework', color: '#FF6347', duration: 5, cost: 35, icon: '🌴', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'palm', safetyDistance: 175 },
  { id: 'shell-01', name: 'Titanium Shell 4"', category: 'morteiros', type: 'firework', color: '#E8E8E8', duration: 3, cost: 20, icon: '💫', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'peony', safetyDistance: 100 },
  { id: 'shell-02', name: 'Color Shell 6"', category: 'morteiros', type: 'firework', color: '#FF1493', duration: 4.5, cost: 30, icon: '🎇', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'peony', safetyDistance: 175 },
  { id: 'shell-03', name: 'Kamuro 5"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 5, cost: 28, icon: '🌟', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5, pattern: 'kamuro', safetyDistance: 140 },
  { id: 'shell-04', name: 'Crossette 4"', category: 'morteiros', type: 'firework', color: '#FF4500', duration: 3, cost: 22, icon: '✖️', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'crossette', safetyDistance: 100 },
  { id: 'shell-05', name: 'Horsetail 6"', category: 'morteiros', type: 'firework', color: '#FFB347', duration: 6, cost: 38, icon: '🐴', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'willow', safetyDistance: 175 },
  { id: 'shell-06', name: 'Spider 5"', category: 'morteiros', type: 'firework', color: '#00FF7F', duration: 3.5, cost: 26, icon: '🕸️', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5, pattern: 'crossette', safetyDistance: 140 },
  { id: 'shell-07', name: 'Ring Shell 4"', category: 'morteiros', type: 'firework', color: '#00BFFF', duration: 3, cost: 24, icon: '💍', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'ring', safetyDistance: 100 },
  { id: 'shell-08', name: 'Nishiki Kamuro 8"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 7, cost: 65, icon: '🏆', partType: 'shell', caliber: 8, heightMeters: 160, prefire: 4.0, pattern: 'kamuro', safetyDistance: 210 },
  // ── Large caliber shells (8", 10", 12") ──
  { id: 'shell-09', name: 'Peony 8"', category: 'morteiros', type: 'firework', color: '#FF0000', duration: 6, cost: 55, icon: '🔴', partType: 'shell', caliber: 8, heightMeters: 160, prefire: 4.0, pattern: 'peony', safetyDistance: 210 },
  { id: 'shell-10', name: 'Chrysanthemum 10"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 8, cost: 120, icon: '🌟', partType: 'shell', caliber: 10, heightMeters: 200, prefire: 5.0, pattern: 'chrysanthemum', safetyDistance: 280 },
  { id: 'shell-11', name: 'Willow 10"', category: 'morteiros', type: 'firework', color: '#FFA500', duration: 10, cost: 130, icon: '🌾', partType: 'shell', caliber: 10, heightMeters: 200, prefire: 5.0, pattern: 'willow', safetyDistance: 280 },
  { id: 'shell-12', name: 'Grand Peony 12"', category: 'morteiros', type: 'firework', color: '#FF1493', duration: 9, cost: 200, icon: '💎', partType: 'shell', caliber: 12, heightMeters: 250, prefire: 6.0, pattern: 'peony', safetyDistance: 350 },
  { id: 'shell-13', name: 'Kamuro 12"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 12, cost: 220, icon: '👑', partType: 'shell', caliber: 12, heightMeters: 250, prefire: 6.0, pattern: 'kamuro', safetyDistance: 350 },
  { id: 'shell-14', name: 'Palm 8"', category: 'morteiros', type: 'firework', color: '#FF6347', duration: 6.5, cost: 60, icon: '🌴', partType: 'shell', caliber: 8, heightMeters: 160, prefire: 4.0, pattern: 'palm', safetyDistance: 210 },
  // ── Specialty burst patterns ──
  { id: 'shell-15', name: 'Heart Shell 4"', category: 'morteiros', type: 'firework', color: '#FF69B4', duration: 3, cost: 30, icon: '❤️', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'heart', safetyDistance: 100 },
  { id: 'shell-16', name: 'Smiley Shell 5"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 3.5, cost: 35, icon: '😊', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5, pattern: 'peony', safetyDistance: 140 },
  { id: 'shell-17', name: 'Dahlia 6"', category: 'morteiros', type: 'firework', color: '#DA70D6', duration: 5, cost: 38, icon: '🌸', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'dahlia', safetyDistance: 175 },
  { id: 'shell-18', name: 'Strobe Shell 4"', category: 'morteiros', type: 'firework', color: '#FFFFFF', duration: 4, cost: 22, icon: '⚡', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'strobe', safetyDistance: 100 },
  { id: 'shell-19', name: 'Multi-Break 6"', category: 'morteiros', type: 'firework', color: '#FF4500', duration: 6, cost: 45, icon: '💥', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'peony', safetyDistance: 175, numDevices: 3 },
  { id: 'shell-20', name: 'Tourbillion 3"', category: 'morteiros', type: 'firework', color: '#00FFFF', duration: 4, cost: 18, icon: '🌀', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'crossette', safetyDistance: 70 },
  { id: 'mburst-01', name: 'Triple Burst 3"', category: 'morteiros', type: 'firework', color: '#FF6347', duration: 3.5, cost: 22, icon: '🎆', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5 },
  { id: 'mburst-02', name: 'Penta Burst 5"', category: 'morteiros', type: 'firework', color: '#9400D3', duration: 5, cost: 40, icon: '💥', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5 },
  // Removed non-real effects: Ground/Aerial Shockwave, Signal Flares (not standard pyro show devices)
  { id: 'fan-01', name: 'Fan Spread 90°', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 2, cost: 15, icon: '🪭', partType: 'fan', caliber: 3, heightMeters: 60, prefire: 1.5 },
  { id: 'fan-02', name: 'Wide Fan 180°', category: 'morteiros', type: 'firework', color: '#00FF7F', duration: 2.5, cost: 20, icon: '🌈', partType: 'fan', caliber: 3, heightMeters: 60, prefire: 1.5 },

  // ── Peônias & Efeitos Aéreos ──────────────────────────────
  { id: 'peon-01', name: 'Red Peony', category: 'peonias', type: 'firework', color: '#FF0000', duration: 2, cost: 10, icon: '🔴', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'peony' },
  { id: 'peon-02', name: 'Blue Peony', category: 'peonias', type: 'firework', color: '#0088FF', duration: 2, cost: 10, icon: '🔵', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'peony' },
  { id: 'peon-03', name: 'Green Peony', category: 'peonias', type: 'firework', color: '#00FF88', duration: 2, cost: 10, icon: '🟢', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'peony' },
  { id: 'peon-04', name: 'Purple Dahlia', category: 'peonias', type: 'firework', color: '#9B30FF', duration: 2.5, cost: 14, icon: '🟣', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'chrysanthemum' },
  { id: 'peon-05', name: 'Silver Glitter', category: 'peonias', type: 'firework', color: '#C0C0C0', duration: 3, cost: 12, icon: '🪩', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'kamuro' },
  { id: 'peon-06', name: 'Gold Strobing', category: 'peonias', type: 'firework', color: '#FFD700', duration: 2.5, cost: 14, icon: '⚡', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'peony' },
  { id: 'peon-07', name: 'Crackling Stars', category: 'peonias', type: 'firework', color: '#FFA07A', duration: 3, cost: 11, icon: '✨', partType: 'shell', caliber: 3, heightMeters: 60, prefire: 1.5, pattern: 'crossette' },
  { id: 'peon-08', name: 'Falling Leaves', category: 'peonias', type: 'firework', color: '#FF8C00', duration: 4, cost: 16, icon: '🍂', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'willow' },
  { id: 'comet-01', name: 'Rising Comet', category: 'peonias', type: 'firework', color: '#00FFFF', duration: 1.5, cost: 6, icon: '☄️', partType: 'comet', caliber: 2, heightMeters: 50, prefire: 0.8 },
  { id: 'comet-02', name: 'Falling Comet Trail', category: 'peonias', type: 'firework', color: '#FFA07A', duration: 2, cost: 8, icon: '🌠', partType: 'comet', caliber: 2, heightMeters: 50, prefire: 0.8 },

  // ── Mines ──────────────────────────────────────────────────
  { id: 'mine-01', name: 'Silver Mine', category: 'mines', type: 'firework', color: '#C0C0C0', duration: 1.5, cost: 8, icon: '⛏️', partType: 'mine', caliber: 3, heightMeters: 30, safetyDistance: 25 },
  { id: 'mine-02', name: 'Gold Mine', category: 'mines', type: 'firework', color: '#FFD700', duration: 1.5, cost: 10, icon: '💛', partType: 'mine', caliber: 3, heightMeters: 30, safetyDistance: 25 },
  { id: 'mine-03', name: 'Crackling Mine', category: 'mines', type: 'firework', color: '#FFA500', duration: 2, cost: 12, icon: '💫', partType: 'mine', caliber: 4, heightMeters: 35, safetyDistance: 30 },
  { id: 'mine-04', name: 'Color Star Mine', category: 'mines', type: 'firework', color: '#FF69B4', duration: 1.8, cost: 14, icon: '🌸', partType: 'mine', caliber: 3, heightMeters: 30, safetyDistance: 25 },
  { id: 'mine-05', name: 'Titanium Mine', category: 'mines', type: 'firework', color: '#E8E8E8', duration: 1.2, cost: 16, icon: '⚪', partType: 'mine', caliber: 4, heightMeters: 35, safetyDistance: 30 },
  { id: 'mine-06', name: 'Whistling Mine', category: 'mines', type: 'firework', color: '#FF4500', duration: 2, cost: 11, icon: '📢', partType: 'mine', caliber: 3, heightMeters: 30, safetyDistance: 25 },

  // ── Roman Candles ─────────────────────────────────────────
  { id: 'rc-01', name: 'Roman Candle 5-shot', category: 'roman_candles', type: 'firework', color: '#FF4444', duration: 5, cost: 6, icon: '🕯️', partType: 'candle', caliber: 1, heightMeters: 40, shotCount: 5 },
  { id: 'rc-02', name: 'Roman Candle 10-shot', category: 'roman_candles', type: 'firework', color: '#4488FF', duration: 10, cost: 10, icon: '🕯️', partType: 'candle', caliber: 1, heightMeters: 40, shotCount: 10 },
  { id: 'rc-03', name: 'Roman Candle Multi-Color', category: 'roman_candles', type: 'firework', color: '#FF69B4', duration: 8, cost: 12, icon: '🌈', partType: 'candle', caliber: 1, heightMeters: 40, shotCount: 8 },
  { id: 'rc-04', name: 'Giant Roman 25mm', category: 'roman_candles', type: 'firework', color: '#FFD700', duration: 12, cost: 18, icon: '🔥', partType: 'candle', caliber: 1, heightMeters: 50, shotCount: 6 },
  { id: 'rc-05', name: 'Comet Roman Candle', category: 'roman_candles', type: 'firework', color: '#00FFFF', duration: 6, cost: 8, icon: '☄️', partType: 'candle', caliber: 1, heightMeters: 45, shotCount: 5 },

  // ── Waterfalls / Cascatas ─────────────────────────────────
  { id: 'wf-01', name: 'Silver Waterfall 3m', category: 'waterfalls', type: 'firework', color: '#C0C0C0', duration: 15, cost: 20, icon: '🌊', partType: 'waterfall', heightMeters: 3 },
  { id: 'wf-02', name: 'Gold Waterfall 5m', category: 'waterfalls', type: 'firework', color: '#FFD700', duration: 20, cost: 35, icon: '🏞️', partType: 'waterfall', heightMeters: 5 },
  { id: 'wf-03', name: 'Waterfall Curtain 10m', category: 'waterfalls', type: 'firework', color: '#E8E8E8', duration: 25, cost: 80, icon: '🪟', partType: 'waterfall', heightMeters: 10 },
  { id: 'wf-04', name: 'Color-Changing Waterfall', category: 'waterfalls', type: 'firework', color: '#FF69B4', duration: 18, cost: 45, icon: '🌈', partType: 'waterfall', heightMeters: 5 },

  // ── Cakes & Batteries ─────────────────────────────────────
  { id: 'cake-01', name: 'Cake 25-Shot Z Pattern', category: 'cakes_batteries', type: 'firework', color: '#FF4500', duration: 15, cost: 25, icon: '🎂', partType: 'cake', caliber: 2, heightMeters: 45, shotCount: 25 },
  { id: 'cake-02', name: 'Cake 49-Shot Fan', category: 'cakes_batteries', type: 'firework', color: '#FFD700', duration: 20, cost: 40, icon: '🎇', partType: 'cake', caliber: 2, heightMeters: 50, shotCount: 49 },
  { id: 'cake-03', name: 'Cake 100-Shot Finale', category: 'cakes_batteries', type: 'firework', color: '#FF1493', duration: 30, cost: 65, icon: '🏆', partType: 'cake', caliber: 1.5, heightMeters: 40, shotCount: 100 },
  { id: 'cake-04', name: 'Cake 16-Shot Brocade', category: 'cakes_batteries', type: 'firework', color: '#FFE4B5', duration: 12, cost: 22, icon: '🧁', partType: 'cake', caliber: 2, heightMeters: 45, shotCount: 16 },
  { id: 'cake-05', name: 'Multi-Break Battery', category: 'cakes_batteries', type: 'firework', color: '#9400D3', duration: 25, cost: 55, icon: '🔋', partType: 'cake', caliber: 3, heightMeters: 60, shotCount: 36 },

  // ── SFX (Efeitos Especiais) ───────────────────────────────
  { id: 'sfx-01', name: 'CO2 Jet Vertical', category: 'sfx', type: 'sfx', color: '#FFFFFF', duration: 3, cost: 15, icon: '💨', partType: 'sfx', heightMeters: 6 },
  { id: 'sfx-02', name: 'CO2 Cannon Horizontal', category: 'sfx', type: 'sfx', color: '#E0E0E0', duration: 2, cost: 20, icon: '🌬️', partType: 'sfx', heightMeters: 8 },
  { id: 'sfx-03', name: 'Cold Sparks Fountain', category: 'sfx', type: 'sfx', color: '#FFD700', duration: 10, cost: 12, icon: '✳️', partType: 'gerb', heightMeters: 4 },
  { id: 'sfx-04', name: 'Flame Projector Red', category: 'sfx', type: 'sfx', color: '#FF4500', duration: 3, cost: 25, icon: '🔥', partType: 'flame', heightMeters: 8 },
  { id: 'sfx-05', name: 'Flame Projector Blue', category: 'sfx', type: 'sfx', color: '#0088FF', duration: 3, cost: 28, icon: '🔵', partType: 'flame', heightMeters: 8 },
  { id: 'sfx-06', name: 'Confetti Cannon', category: 'sfx', type: 'sfx', color: '#FF69B4', duration: 2, cost: 8, icon: '🎊', partType: 'sfx', heightMeters: 8 },
  { id: 'sfx-07', name: 'Streamer Launcher', category: 'sfx', type: 'sfx', color: '#00FF88', duration: 3, cost: 10, icon: '🎉', partType: 'sfx', heightMeters: 10 },
  { id: 'sfx-08', name: 'Fog Machine Low', category: 'sfx', type: 'sfx', color: '#808080', duration: 30, cost: 5, icon: '🌫️', partType: 'sfx' },
  { id: 'sfx-09', name: 'Haze Machine', category: 'sfx', type: 'sfx', color: '#A0A0A0', duration: 60, cost: 3, icon: '☁️', partType: 'sfx' },
  { id: 'sfx-10', name: 'Snow Machine', category: 'sfx', type: 'sfx', color: '#F0F0FF', duration: 30, cost: 8, icon: '❄️', partType: 'sfx' },
  { id: 'sfx-11', name: 'Bubble Machine', category: 'sfx', type: 'sfx', color: '#87CEEB', duration: 30, cost: 4, icon: '🫧', partType: 'sfx' },
  { id: 'sfx-12', name: 'Spark Waterfall', category: 'sfx', type: 'sfx', color: '#FFD700', duration: 15, cost: 18, icon: '⚜️', partType: 'waterfall', heightMeters: 5 },
  { id: 'spark-01', name: 'Silver Spark Fountain', category: 'sfx', type: 'sfx', color: '#C0C0C0', duration: 3, cost: 8, icon: '✳️', partType: 'gerb', heightMeters: 3 },
  { id: 'spark-02', name: 'Gold Spark Jet', category: 'sfx', type: 'sfx', color: '#FFD700', duration: 4, cost: 10, icon: '⚜️', partType: 'gerb', heightMeters: 4 },

  // ── Lasers ────────────────────────────────────────────────
  { id: 'laser-01', name: 'Green Laser 5W', category: 'lasers', type: 'laser', color: '#00FF00', duration: 30, cost: 50, icon: '🟢', partType: 'laser', laserPattern: 'single' },
  { id: 'laser-02', name: 'Red Laser 3W', category: 'lasers', type: 'laser', color: '#FF0000', duration: 30, cost: 40, icon: '🔴', partType: 'laser', laserPattern: 'single' },
  { id: 'laser-03', name: 'Blue Laser 8W', category: 'lasers', type: 'laser', color: '#0044FF', duration: 30, cost: 60, icon: '🔵', partType: 'laser', laserPattern: 'single' },
  { id: 'laser-04', name: 'RGB Laser ILDA 20W', category: 'lasers', type: 'laser', color: '#FFFFFF', duration: 60, cost: 120, icon: '🌈', partType: 'laser', laserPattern: 'cone' },
  { id: 'laser-05', name: 'Laser Fan Array x8', category: 'lasers', type: 'laser', color: '#00FF88', duration: 30, cost: 80, icon: '🪭', partType: 'laser', laserPattern: 'fan' },
  { id: 'laser-06', name: 'Sky Laser 40W', category: 'lasers', type: 'laser', color: '#00FFFF', duration: 60, cost: 200, icon: '🏔️', partType: 'laser', laserPattern: 'single' },
  { id: 'laser-07', name: 'Laser Harp', category: 'lasers', type: 'laser', color: '#00FF00', duration: 30, cost: 90, icon: '🎵', partType: 'laser', laserPattern: 'harp' },
  { id: 'laser-08', name: 'Laser Tunnel', category: 'lasers', type: 'laser', color: '#FF00FF', duration: 20, cost: 70, icon: '🕳️', partType: 'laser', laserPattern: 'tunnel' },
  { id: 'laser-09', name: 'Laser Wave x12', category: 'lasers', type: 'laser', color: '#00FFFF', duration: 30, cost: 95, icon: '🌊', partType: 'laser', laserPattern: 'wave' },
  { id: 'laser-10', name: 'Laser Grid 4×4', category: 'lasers', type: 'laser', color: '#FF8800', duration: 30, cost: 110, icon: '📐', partType: 'laser', laserPattern: 'grid' },
  { id: 'laser-11', name: 'RGB Laser Wall 20W', category: 'lasers', type: 'laser', color: '#FFFFFF', duration: 60, cost: 150, icon: '🧱', partType: 'laser', laserPattern: 'harp', beamCount: 16 },
  { id: 'laser-12', name: 'Laser Vortex Cone', category: 'lasers', type: 'laser', color: '#00FF88', duration: 30, cost: 85, icon: '🌀', partType: 'laser', laserPattern: 'cone' },
  { id: 'laser-13', name: 'UV Laser 405nm', category: 'lasers', type: 'laser', color: '#8800FF', duration: 30, cost: 65, icon: '🟣', partType: 'laser', laserPattern: 'single' },
  { id: 'laser-14', name: 'Yellow Laser 577nm', category: 'lasers', type: 'laser', color: '#FFDD00', duration: 30, cost: 75, icon: '🟡', partType: 'laser', laserPattern: 'single' },

  // ── Iluminação ────────────────────────────────────────────
  { id: 'light-01', name: 'Moving Head Spot 300W', category: 'iluminacao', type: 'light', color: '#FFFFFF', duration: 60, cost: 30, icon: '🔦', partType: 'light', beamType: 'spot' },
  { id: 'light-02', name: 'Moving Head Wash 600W', category: 'iluminacao', type: 'light', color: '#FF8800', duration: 60, cost: 45, icon: '💡', partType: 'light', beamType: 'wash' },
  { id: 'light-03', name: 'Beam 230W Sharpy', category: 'iluminacao', type: 'light', color: '#FFFFFF', duration: 60, cost: 35, icon: '🌟', partType: 'light', beamType: 'beam' },
  { id: 'light-04', name: 'LED Par 18x10W RGBW', category: 'iluminacao', type: 'light', color: '#FF4488', duration: 60, cost: 8, icon: '🎨', partType: 'light', beamType: 'wash' },
  { id: 'light-05', name: 'Strobe 1500W DMX', category: 'iluminacao', type: 'light', color: '#FFFFFF', duration: 30, cost: 12, icon: '⚡', partType: 'strobe' },
  { id: 'light-06', name: 'LED Strip 5m RGBW', category: 'iluminacao', type: 'light', color: '#00FFFF', duration: 60, cost: 6, icon: '🌊', partType: 'light' },
  { id: 'light-07', name: 'Sky Searchlight 4kW', category: 'iluminacao', type: 'light', color: '#FFFFFF', duration: 60, cost: 80, icon: '🔭', partType: 'light', beamType: 'beam' },
  { id: 'light-08', name: 'Blinder 2x650W', category: 'iluminacao', type: 'light', color: '#FFF8DC', duration: 30, cost: 15, icon: '😎', partType: 'light', beamType: 'wash' },
  { id: 'light-09', name: 'LED Matrix Panel', category: 'iluminacao', type: 'light', color: '#FFFFFF', duration: 60, cost: 25, icon: '📺', partType: 'light' },
  { id: 'light-10', name: 'Follow Spot 1200W', category: 'iluminacao', type: 'light', color: '#FFFAF0', duration: 60, cost: 40, icon: '🎯', partType: 'light', beamType: 'spot' },

  // ── Drones ────────────────────────────────────────────────
  { id: 'drone-01', name: 'Single LED Point', category: 'drones', type: 'drone', color: '#00FFFF', duration: 10, cost: 0.5, icon: '💡', partType: 'drone' },
  { id: 'drone-02', name: 'RGB Cluster x4', category: 'drones', type: 'drone', color: '#FFFFFF', duration: 10, cost: 2, icon: '✨', partType: 'drone' },
  { id: 'drone-03', name: 'Strobe Unit', category: 'drones', type: 'drone', color: '#FFFFFF', duration: 5, cost: 1, icon: '⚡', partType: 'drone' },
  { id: 'drone-04', name: 'Pyro Drone (Spark)', category: 'drones', type: 'drone', color: '#FFD700', duration: 8, cost: 5, icon: '🎆', partType: 'drone' },
  { id: 'drone-05', name: 'Smoke Trail Drone', category: 'drones', type: 'drone', color: '#808080', duration: 15, cost: 4, icon: '💨', partType: 'drone' },
  { id: 'drone-06', name: 'Banner Drone', category: 'drones', type: 'drone', color: '#FF4500', duration: 30, cost: 8, icon: '🏳️', partType: 'drone' },

  // ── Formações de Drones ───────────────────────────────────
  { id: 'form-01', name: 'Heart Formation', category: 'formacoes', type: 'drone', color: '#FF69B4', duration: 15, cost: 50, icon: '❤️', partType: 'formation' },
  { id: 'form-02', name: 'Star Formation', category: 'formacoes', type: 'drone', color: '#FFD700', duration: 15, cost: 50, icon: '⭐', partType: 'formation' },
  { id: 'form-03', name: 'Wave Pattern', category: 'formacoes', type: 'drone', color: '#00BFFF', duration: 12, cost: 40, icon: '🌊', partType: 'formation' },
  { id: 'form-04', name: 'Spiral Ascent', category: 'formacoes', type: 'drone', color: '#FF4500', duration: 20, cost: 60, icon: '🌀', partType: 'formation' },
  { id: 'aring-01', name: 'Saturn Ring', category: 'formacoes', type: 'drone', color: '#FFD700', duration: 12, cost: 45, icon: '💍', partType: 'formation' },
  { id: 'aring-02', name: 'Neon Halo', category: 'formacoes', type: 'drone', color: '#00FFFF', duration: 10, cost: 35, icon: '⭕', partType: 'formation' },
  { id: 'form-05', name: 'DNA Helix', category: 'formacoes', type: 'drone', color: '#00FF88', duration: 18, cost: 55, icon: '🧬', partType: 'formation' },
  { id: 'form-06', name: 'Galaxy Spiral', category: 'formacoes', type: 'drone', color: '#9B30FF', duration: 20, cost: 65, icon: '🌌', partType: 'formation' },
  { id: 'form-07', name: 'Phoenix Wings', category: 'formacoes', type: 'drone', color: '#FF4500', duration: 20, cost: 70, icon: '🦅', partType: 'formation' },
  { id: 'form-08', name: 'Countdown 3-2-1', category: 'formacoes', type: 'drone', color: '#FFFFFF', duration: 12, cost: 40, icon: '🔟', partType: 'formation' },

  // ── Niagara-Inspired Effects (UE5 Particle Systems) ───────
  { id: 'niagara-01', name: 'Ns Blue Peony 5"', category: 'morteiros', type: 'firework', color: '#0066FF', duration: 3.5, cost: 28, icon: '🔵', partType: 'shell', caliber: 5, heightMeters: 100, prefire: 2.5, pattern: 'peony', safetyDistance: 140 },
  { id: 'niagara-02', name: 'Ns Gold Kamuro 6"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 5.0, cost: 38, icon: '🌟', partType: 'shell', caliber: 6, heightMeters: 120, prefire: 3.0, pattern: 'kamuro', safetyDistance: 175 },
  { id: 'niagara-03', name: 'Ns Pink Multi-Break 4"', category: 'morteiros', type: 'firework', color: '#FF69B4', duration: 3.0, cost: 32, icon: '💖', partType: 'shell', caliber: 4, heightMeters: 80, prefire: 2.0, pattern: 'crossette', safetyDistance: 100, numDevices: 3 },
];

export const useProjectStore = create<ProjectState>((set) => ({
  projectName: 'Untitled Show',
  isPlaying: false,
  activeLockouts: [],
  setActiveLockouts: (lockouts) => set({ activeLockouts: lockouts }),
  toggleLockout: (riskGroup) => set((s) => ({
    activeLockouts: s.activeLockouts.includes(riskGroup)
      ? s.activeLockouts.filter(r => r !== riskGroup)
      : [...s.activeLockouts, riskGroup],
  })),
  currentTime: 0,
  duration: 120,
  timelineItems: [],
  selectedEffectId: null,
  selectedTimelineItemId: null,
  selectedTimelineItemIds: [],
  positions: [],
  selectedPositionId: null,
  selectedPositionIds: [],
  editorMode: 'select',
  selectionMode: 'both',
  linkedTimelineItemIds: [],
  trajectories: [],
  selectedTrajectoryId: null,
  selectedWaypointId: null,
  showTrajectories: true,
  drawHeight: 10,
  waypointUndoStack: [],
  audioUrl: null,
  bpm: null,
  snapToBeat: false,
  playbackSpeed: 1,
  projectId: null,
  cameraKeyframes: [],
  cameraAnimationEnabled: false,
  wind: { enabled: false, direction: 0, speed: 3, gustStrength: 0.3 },
  droneFormations: [],
  selectedFormationId: null,
  selectedTrajectoryIds: [],
  showFormations: true,
  cueMarkers: [],
  videoChoreoResult: null,
  depthLayers: [],
  gpsOrigin: { lat: -23.5505, lng: -46.6333, heading: 0, altitude: 0 },
  locationName: null,
  timeZoneId: null,
  timeZoneOffset: null,
  terrainElevation: null,
  staticMapUrl: null,
  setGpsOrigin: (origin) => set({ gpsOrigin: origin }),
  setGeoIntelligence: (data) => set({
    ...(data.locationName !== undefined && { locationName: data.locationName }),
    ...(data.timeZoneId !== undefined && { timeZoneId: data.timeZoneId }),
    ...(data.timeZoneOffset !== undefined && { timeZoneOffset: data.timeZoneOffset }),
    ...(data.terrainElevation !== undefined && { terrainElevation: data.terrainElevation }),
    ...(data.staticMapUrl !== undefined && { staticMapUrl: data.staticMapUrl }),
  }),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  addTimelineItem: (item) => set((s) => ({ timelineItems: [...s.timelineItems, item] })),
  removeTimelineItem: (id) => set((s) => {
    const removed = s.timelineItems.find(i => i.id === id);
    const nextTimeline = s.timelineItems.filter(i => i.id !== id);
    // Auto-clean orphaned positions
    let nextPositions = s.positions;
    if (removed?.positionId) {
      const stillReferenced = nextTimeline.some(i => i.positionId === removed.positionId);
      if (!stillReferenced) {
        nextPositions = s.positions.filter(p => p.id !== removed.positionId);
      }
    }
    return {
      timelineItems: nextTimeline,
      positions: nextPositions,
      selectedTimelineItemId: s.selectedTimelineItemId === id ? null : s.selectedTimelineItemId,
    };
  }),
  removeMultipleTimelineItems: (ids) => set((s) => {
    const removedItems = s.timelineItems.filter(i => ids.includes(i.id));
    const nextTimeline = s.timelineItems.filter(i => !ids.includes(i.id));
    // Auto-clean orphaned positions
    const posIdsToCheck = [...new Set(removedItems.map(i => i.positionId).filter(Boolean))] as string[];
    const orphanedIds = posIdsToCheck.filter(pId => !nextTimeline.some(i => i.positionId === pId));
    const nextPositions = orphanedIds.length > 0 ? s.positions.filter(p => !orphanedIds.includes(p.id)) : s.positions;
    return {
      timelineItems: nextTimeline,
      positions: nextPositions,
      selectedTimelineItemId: ids.includes(s.selectedTimelineItemId || '') ? null : s.selectedTimelineItemId,
      selectedTimelineItemIds: [],
    };
  }),
  updateTimelineItem: (id, updates) => set((s) => ({
    timelineItems: s.timelineItems.map((i) => i.id === id ? { ...i, ...updates } : i),
  })),
  selectEffect: (id) => set({ selectedEffectId: id }),
  selectTimelineItem: (id) => set({ selectedTimelineItemId: id, selectedTimelineItemIds: [] }),
  toggleTimelineItemSelection: (id) => set((s) => {
    const ids = s.selectedTimelineItemIds.includes(id)
      ? s.selectedTimelineItemIds.filter((i) => i !== id)
      : [...s.selectedTimelineItemIds, id];
    return { selectedTimelineItemIds: ids, selectedTimelineItemId: ids[ids.length - 1] ?? null };
  }),
  clearTimelineItemSelection: () => set({ selectedTimelineItemIds: [], selectedTimelineItemId: null }),
  duplicateTimelineItems: (ids) => set((s) => {
    const newItems = ids.map((id) => {
      const item = s.timelineItems.find((i) => i.id === id);
      if (!item) return null;
      return {
        ...item,
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startTime: item.startTime + 0.5,
      };
    }).filter(Boolean) as TimelineItem[];
    return { timelineItems: [...s.timelineItems, ...newItems] };
  }),
  setProjectName: (name) => set({ projectName: name }),
  addPosition: (pos) => set((s) => ({ positions: [...s.positions, pos] })),
  updatePosition: (id, updates) => set((s) => ({
    positions: s.positions.map((p) => p.id === id ? { ...p, ...updates } : p),
  })),
  removePosition: (id) => set((s) => ({
    positions: s.positions.filter((p) => p.id !== id),
    selectedPositionId: s.selectedPositionId === id ? null : s.selectedPositionId,
  })),
  selectPosition: (id) => set({ selectedPositionId: id, selectedPositionIds: id ? [id] : [] }),
  togglePositionSelection: (id) => set((s) => {
    const ids = s.selectedPositionIds.includes(id)
      ? s.selectedPositionIds.filter((i) => i !== id)
      : [...s.selectedPositionIds, id];
    return { selectedPositionIds: ids, selectedPositionId: ids[ids.length - 1] ?? null };
  }),
  selectMultiplePositions: (ids) => set({ selectedPositionIds: ids, selectedPositionId: ids[ids.length - 1] ?? null }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  selectPositionAndLinkedEvents: (positionId) => set((s) => {
    const linkedItems = s.selectionMode !== 'positions'
      ? s.timelineItems.filter(i => i.positionId === positionId || i.positionIds?.includes(positionId)).map(i => i.id)
      : [];
    return {
      selectedPositionId: positionId,
      selectedPositionIds: [positionId],
      linkedTimelineItemIds: linkedItems,
    };
  }),
  selectMultiplePositionsAndLinkedEvents: (ids) => set((s) => {
    const linkedItems = s.selectionMode !== 'positions'
      ? s.timelineItems.filter(i => ids.includes(i.positionId || '') || i.positionIds?.some(pid => ids.includes(pid))).map(i => i.id)
      : [];
    return {
      selectedPositionIds: ids,
      selectedPositionId: ids[ids.length - 1] ?? null,
      linkedTimelineItemIds: linkedItems,
    };
  }),
  selectTimelineItemAndLinkedPosition: (itemId) => set((s) => {
    const item = s.timelineItems.find(i => i.id === itemId);
    if (!item) return { selectedTimelineItemId: itemId, selectedTimelineItemIds: [] };
    const posIds = s.selectionMode !== 'events'
      ? [item.positionId, ...(item.positionIds || [])].filter(Boolean) as string[]
      : [];
    return {
      selectedTimelineItemId: itemId,
      selectedTimelineItemIds: [],
      selectedPositionIds: posIds,
      selectedPositionId: posIds[0] ?? s.selectedPositionId,
      linkedTimelineItemIds: [],
    };
  }),

  addTrajectory: (traj) => set((s) => ({ trajectories: [...s.trajectories, traj] })),
  batchImportVVIZ: (positions, trajectories, projectName, duration) => set((s) => ({
    positions: [...s.positions, ...positions],
    trajectories: [...s.trajectories, ...trajectories],
    ...(projectName && projectName !== 'Import Error' ? { projectName } : {}),
    ...(duration && duration > 0 ? { duration } : {}),
  })),
  updateTrajectory: (id, updates) => set((s) => ({
    trajectories: s.trajectories.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeTrajectory: (id) => set((s) => ({
    trajectories: s.trajectories.filter((t) => t.id !== id),
    selectedTrajectoryId: s.selectedTrajectoryId === id ? null : s.selectedTrajectoryId,
  })),
  selectTrajectory: (id) => set({ selectedTrajectoryId: id }),
  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  addWaypoint: (trajectoryId, waypoint) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId ? { ...t, waypoints: [...t.waypoints, waypoint] } : t
    ),
    waypointUndoStack: [...s.waypointUndoStack, { trajectoryId, waypoint }],
  })),
  updateWaypoint: (trajectoryId, waypointId, updates) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId
        ? { ...t, waypoints: t.waypoints.map((w) => w.id === waypointId ? { ...w, ...updates } : w) }
        : t
    ),
  })),
  removeWaypoint: (trajectoryId, waypointId) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId
        ? { ...t, waypoints: t.waypoints.filter((w) => w.id !== waypointId) }
        : t
    ),
  })),
  setShowTrajectories: (show) => set({ showTrajectories: show }),
  setDrawHeight: (h) => set({ drawHeight: h }),
  undoLastWaypoint: () => set((s) => {
    if (s.waypointUndoStack.length === 0) return s;
    const last = s.waypointUndoStack[s.waypointUndoStack.length - 1];
    return {
      waypointUndoStack: s.waypointUndoStack.slice(0, -1),
      trajectories: s.trajectories.map((t) =>
        t.id === last.trajectoryId
          ? { ...t, waypoints: t.waypoints.filter((w) => w.id !== last.waypoint.id) }
          : t
      ),
    };
  }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setBpm: (bpm) => set({ bpm }),
  setSnapToBeat: (snap) => set({ snapToBeat: snap }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setProjectId: (id) => set({ projectId: id }),

  combineAsChain: (itemIds, gap = 0) => set((s) => {
    if (itemIds.length < 2) return s;
    const chainRef = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const items = itemIds
      .map((id) => s.timelineItems.find((i) => i.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.startTime - b!.startTime) as TimelineItem[];
    return {
      timelineItems: s.timelineItems.map((item) => {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx === -1) return item;
        return { ...item, chainRef, chainGap: idx === 0 ? 0 : gap || Math.round((items[idx].startTime - items[idx - 1].startTime) * 1000) };
      }),
    };
  }),

  breakChain: (chainRef) => set((s) => ({
    timelineItems: s.timelineItems.map((item) =>
      item.chainRef === chainRef ? { ...item, chainRef: undefined, chainGap: undefined } : item
    ),
  })),

  addCameraKeyframe: (kf) => set((s) => ({
    cameraKeyframes: [...s.cameraKeyframes, kf].sort((a, b) => a.time - b.time),
  })),
  updateCameraKeyframe: (id, updates) => set((s) => ({
    cameraKeyframes: s.cameraKeyframes.map((kf) => kf.id === id ? { ...kf, ...updates } : kf).sort((a, b) => a.time - b.time),
  })),
  removeCameraKeyframe: (id) => set((s) => ({
    cameraKeyframes: s.cameraKeyframes.filter((kf) => kf.id !== id),
  })),
  setCameraAnimationEnabled: (enabled) => set({ cameraAnimationEnabled: enabled }),

  setWind: (updates) => set((s) => ({ wind: { ...s.wind, ...updates } })),

  addDroneFormation: (formation) => set((s) => ({
    droneFormations: [...s.droneFormations, formation],
  })),
  updateDroneFormation: (id, updates) => set((s) => ({
    droneFormations: s.droneFormations.map((f) => f.id === id ? { ...f, ...updates } : f),
  })),
  removeDroneFormation: (id) => set((s) => ({
    droneFormations: s.droneFormations.filter((f) => f.id !== id),
    selectedFormationId: s.selectedFormationId === id ? null : s.selectedFormationId,
  })),
  selectFormation: (id) => set({ selectedFormationId: id }),
  materializeFormation: (formation) => set((s) => {
    const existingPadCount = s.positions.filter(p => p.type === 'drone-pad').length;
    const isReuse = existingPadCount >= formation.droneCount;
    const existingPadIds = isReuse
      ? s.positions.filter(p => p.type === 'drone-pad').map(p => p.id).slice(0, formation.droneCount)
      : undefined;
    const { positions: newPads, trajectories: newTrajs } = materialize(
      formation, s.droneFormations.length, existingPadIds,
    );
    return {
      positions: isReuse ? s.positions : [...s.positions, ...newPads],
      trajectories: [...s.trajectories, ...newTrajs],
    };
  }),

  toggleTrajectorySelection: (id) => set((s) => {
    const ids = s.selectedTrajectoryIds.includes(id)
      ? s.selectedTrajectoryIds.filter((i) => i !== id)
      : [...s.selectedTrajectoryIds, id];
    return { selectedTrajectoryIds: ids };
  }),
  selectAllFormationTrajectories: (formationIndex) => set((s) => {
    const pads = s.positions.filter(p => p.type === 'drone-pad');
    const formation = s.droneFormations[formationIndex];
    if (!formation) return s;
    const padIds = pads.slice(0, formation.droneCount).map(p => p.id);
    const trajIds = s.trajectories.filter(t => padIds.includes(t.positionId)).map(t => t.id);
    return { selectedTrajectoryIds: trajIds };
  }),
  clearTrajectorySelection: () => set({ selectedTrajectoryIds: [] }),
  batchOffsetWaypoints: (trajectoryIds, offset) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      trajectoryIds.includes(t.id)
        ? {
          ...t,
          waypoints: t.waypoints.map((w) => ({
            ...w,
            position: {
              x: Math.round((w.position.x + offset.x) * 10) / 10,
              y: Math.max(0.1, Math.round((w.position.y + offset.y) * 10) / 10),
              z: Math.round((w.position.z + offset.z) * 10) / 10,
            },
          })),
        }
        : t
    ),
  })),
  batchScaleWaypoints: (trajectoryIds, scale) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      trajectoryIds.includes(t.id)
        ? {
          ...t,
          waypoints: t.waypoints.map((w) => ({
            ...w,
            position: {
              x: Math.round(w.position.x * scale * 10) / 10,
              y: Math.max(0.1, Math.round(w.position.y * scale * 10) / 10),
              z: Math.round(w.position.z * scale * 10) / 10,
            },
          })),
        }
        : t
    ),
  })),
  setShowFormations: (show) => set({ showFormations: show }),

  reorderDroneFormation: (fromIndex, toIndex) => set((s) => {
    const arr = [...s.droneFormations];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    // Recalculate start times sequentially
    let time = 0;
    const updated = arr.map(f => {
      const newF = { ...f, startTime: time };
      time += f.transitionDuration + f.holdDuration;
      return newF;
    });
    return { droneFormations: updated };
  }),

  duplicateDroneFormation: (id) => set((s) => {
    const src = s.droneFormations.find(f => f.id === id);
    if (!src) return s;
    const lastEnd = s.droneFormations.reduce((t, f) => Math.max(t, f.startTime + f.transitionDuration + f.holdDuration), 0);
    const dup: DroneFormation = {
      ...src,
      id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      startTime: lastEnd,
    };
    return { droneFormations: [...s.droneFormations, dup] };
  }),

  clearAllFormations: () => set({
    droneFormations: [],
    selectedFormationId: null,
  }),

  recalculateFormationTimings: () => set((s) => {
    let time = 0;
    const updated = s.droneFormations.map(f => {
      const newF = { ...f, startTime: time };
      time += f.transitionDuration + f.holdDuration;
      return newF;
    });
    return { droneFormations: updated };
  }),

  addCueMarker: (marker) => set((s) => ({ cueMarkers: [...s.cueMarkers, marker].sort((a, b) => a.time - b.time) })),
  removeCueMarker: (id) => set((s) => ({ cueMarkers: s.cueMarkers.filter((c) => c.id !== id) })),
  updateCueMarker: (id, updates) => set((s) => ({
    cueMarkers: s.cueMarkers.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),
  clearCueMarkers: () => set({ cueMarkers: [] }),
  setVideoChoreoResult: (result) => set({ videoChoreoResult: result }),
  setDepthLayers: (layers) => set({ depthLayers: layers }),
}));

/**
 * effectWorldOrientation: Computes world Euler rotation by combining
 * Position (heading/pitch/roll) with Effect (pan/tilt/spin).
 * Position: R = RotY(heading) × RotX(pitch) × RotZ(roll)  — Mortar rack model
 * Effect:   R = RotY(pan) × RotX(tilt) × RotY(spin)       — Moving-head model
 * Returns combined Euler angles (in degrees) for the effect's world orientation.
 */
export function effectWorldOrientation(
  position: Position,
  item: { pan?: number; tilt?: number; spin?: number }
): { heading: number; pitch: number; roll: number } {
  const toRad = (d: number) => (d || 0) * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;

  // Position quaternion: YXZ order (heading × pitch × roll)
  const euler1 = { x: toRad(position.pitch), y: toRad(position.heading), z: toRad(position.roll) };
  const cy1 = Math.cos(euler1.y / 2), sy1 = Math.sin(euler1.y / 2);
  const cx1 = Math.cos(euler1.x / 2), sx1 = Math.sin(euler1.x / 2);
  const cz1 = Math.cos(euler1.z / 2), sz1 = Math.sin(euler1.z / 2);

  // YXZ quaternion
  const qw1 = cy1 * cx1 * cz1 + sy1 * sx1 * sz1;
  const qx1 = cy1 * sx1 * cz1 + sy1 * cx1 * sz1;
  const qy1 = sy1 * cx1 * cz1 - cy1 * sx1 * sz1;
  const qz1 = cy1 * cx1 * sz1 - sy1 * sx1 * cz1;

  // Effect pan/tilt/spin — simplified: treat as additional YXZ
  const pan = toRad(item.pan || 0);
  const tilt = toRad(item.tilt || 0);
  const spin = toRad(item.spin || 0);
  const cy2 = Math.cos((pan + spin) / 2), sy2 = Math.sin((pan + spin) / 2);
  const cx2 = Math.cos(tilt / 2), sx2 = Math.sin(tilt / 2);

  const qw2 = cy2 * cx2;
  const qx2 = cy2 * sx2;
  const qy2 = sy2 * cx2;
  const qz2 = -sy2 * sx2;

  // Multiply q1 × q2
  const w = qw1 * qw2 - qx1 * qx2 - qy1 * qy2 - qz1 * qz2;
  const x = qw1 * qx2 + qx1 * qw2 + qy1 * qz2 - qz1 * qy2;
  const y = qw1 * qy2 - qx1 * qz2 + qy1 * qw2 + qz1 * qx2;
  const z = qw1 * qz2 + qx1 * qy2 - qy1 * qx2 + qz1 * qw2;

  // Extract YXZ Euler from quaternion
  const sinP = 2 * (w * x - y * z);
  const outPitch = toDeg(Math.asin(Math.max(-1, Math.min(1, sinP))));
  const outHeading = toDeg(Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)));
  const outRoll = toDeg(Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)));

  return { heading: outHeading, pitch: outPitch, roll: outRoll };
}
