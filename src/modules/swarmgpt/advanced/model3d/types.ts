/**
 * SwarmGPT Advanced — 3D model → drone formation types.
 * Module receives an already-parsed mesh (vertices + optional indices). The
 * UI/glTF adapter lives outside this module so the pipeline stays DOM-free.
 */
import type { Vec3 } from '../../types';
import type { FormationFidelityScore } from '../scoring/scoreFormationFidelity';

export interface MeshLike {
  /** World-space or local-space vertex positions (caller's choice). */
  vertices: Vec3[];
  /** Optional triangle indices — enables area-weighted surface sampling. */
  indices?: number[];
  name?: string;
}

export type SamplingStrategy = 'weighted' | 'poisson' | 'poisson+fps';

export interface ExtractFromMeshOptions {
  droneCount: number;
  minDistance: number;
  /** Target diameter (max extent) in meters. Default 60. */
  scale?: number;
  /** Formation center in world space. Default { x:0, y:50, z:0 }. */
  center?: Vec3;
  /** Mesh is Y-up (default true). When false, swaps Y↔Z to match world Y-up. */
  yUp?: boolean;
  /** Surface-only sampling (default true). When false, uses raw vertex cloud. */
  hollow?: boolean;
  /** Cap candidate count before Poisson sampling. Default 20000. */
  maxCandidates?: number;
  /**
   * Reduction strategy from candidate cloud → drone count.
   * Default 'weighted' (existing behavior). 'poisson+fps' requires the
   * `swarmgpt_fps_sampling` flag to be enabled or it falls back to weighted.
   */
  samplingStrategy?: SamplingStrategy;
}

export interface ModelExtractionReport {
  points: Vec3[];
  candidateCount: number;
  fidelity: FormationFidelityScore;
  boundingBox: { min: Vec3; max: Vec3 };
}
