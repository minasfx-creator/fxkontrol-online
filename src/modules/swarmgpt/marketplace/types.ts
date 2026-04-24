/**
 * SwarmGPT Marketplace — Shared types.
 *
 * An "Effect Package" is a small bundle that ships an entry function which,
 * given an input context, returns an effect descriptor (typically a
 * VectorField factory or a DroneFormation generator). Packages are sandboxed
 * at execution time and never granted access to hardware command paths.
 */

export type EffectPackageType = "field" | "formation" | "composite";

export type EffectPackageManifest = {
  /** Globally unique reverse-DNS-style id (e.g. "beam.ultra"). */
  id: string;
  name: string;
  /** Semver: MAJOR.MINOR.PATCH. */
  version: string;
  author: string;
  description: string;
  tags: string[];
  type: EffectPackageType;
  /** Module path resolvable by `import()` (local file URL or bundled path). */
  entry: string;
  /** Optional preview image path (webp/png). */
  preview?: string;
  engine: {
    /** Minimum SwarmGPT engine version required, semver. */
    minVersion: string;
  };
};

export type InstalledEffectPackage = {
  manifest: EffectPackageManifest;
  entryPath: string;
  installedAt: number;
};

/**
 * Input passed to an effect's `default` export at runtime.
 * Effects are pure and must NOT touch the DOM, network, or hardware buses.
 */
export type EffectRuntimeInput = {
  time: number;
  duration: number;
  center?: { x: number; y: number; z: number };
  scale?: number;
  droneCount?: number;
  /** Free-form parameters specific to the effect. */
  params?: Record<string, unknown>;
};

export type EffectRuntimeOutput = {
  metadata?: Record<string, unknown>;
  /** Optional point cloud emitted by `formation` packages. */
  points?: { x: number; y: number; z: number }[];
};

export type EffectFunction = (input: EffectRuntimeInput) => EffectRuntimeOutput | Promise<EffectRuntimeOutput>;
