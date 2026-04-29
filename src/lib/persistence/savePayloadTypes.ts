/**
 * RPC payload contracts for `save_project_atomic`.
 *
 * These mirror the `jsonb` arguments the SQL function consumes. They are
 * intentionally narrower than the in-memory store types: the store may carry
 * derived/UI-only fields (selection state, cached previews, etc.) that
 * should never reach the database. By converting to these types in
 * `useProjectPersistence.saveProject`, we get a type-checked boundary
 * between client state and persisted state.
 *
 * Field names use snake_case to match what the SQL function reads via
 * `jsonb_array_elements(...)->>'field'`.
 */

export interface ProjectSavePayload {
  name: string;
  duration: number;
  audio_url: string | null;
  bpm: number | null;
  playback_speed: number;
}

export interface PositionSavePayload {
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  color: string;
  sort_order: number;
}

export interface TimelineItemSavePayload {
  effect_id: string;
  start_time: number;
  track_index: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  position_id: string | null;
  position_name: string | null;
  notes: string | null;
}

export interface WaypointSavePayload {
  x: number;
  y: number;
  z: number;
  time_seconds: number;
  sort_order: number;
}

export interface TrajectorySavePayload {
  /** Optional client-side UUID. RPC will gen_random_uuid() when null. */
  id: string | null;
  name: string;
  position_id: string | null;
  waypoints: WaypointSavePayload[];
}
