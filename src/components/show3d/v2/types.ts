/**
 * SkyCanvas 2.0 — shared types
 *
 * Plano: Show Plane (presentation only). NÃO toca CommandBus, FieldBus,
 * SafetyStateMachine ou workMode. NÃO arma, NÃO dispara.
 */
export type Vec3 = [number, number, number];

export interface ActiveDrone {
  id: string;
  position: Vec3;
  color: string;
  active: boolean;
}

export interface ActiveExplosion {
  id: string;
  origin: Vec3;
  color: string;
  /** Seconds since burst start (>=0). */
  age: number;
  /** Total burst duration (s). */
  life: number;
  /** Apex height (m), defines spread radius. */
  height: number;
}

export interface SkyCanvas2Props {
  dpr?: [number, number];
  cameraPosition?: Vec3;
  cameraTarget?: Vec3;
  /** Hide ground grid (e.g. for cinematic captures). */
  hideGrid?: boolean;
  /** Disable star field. */
  hideStars?: boolean;
  /** Hide the stage (deck + truss + panels + beams). Default false. */
  hideStage?: boolean;
  /** Stage variant: 'arch' (full) or 'minimal' (deck only). Default 'arch'. */
  stageVariant?: 'arch' | 'minimal';
  className?: string;
}
