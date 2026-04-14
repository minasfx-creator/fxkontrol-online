/**
 * Simulation Domain — Re-exports all simulation-related stores.
 * Consolidation layer for Boids, Laser, LiveSFX, SFX Channels, and Generative.
 *
 * Usage: import { useBoidsStore, useLaserPreviewStore } from '@/store/domains/simulation';
 */
export { useBoidsStore } from '@/store/useBoidsStore';
export { useLaserPreviewStore } from '@/store/useLaserPreviewStore';
export { useLiveSfxStore } from '@/store/useLiveSfxStore';
export { useSfxChannelStore } from '@/store/useSfxChannelStore';
export { default as useGenerativeStore } from '@/store/useGenerativeStore';

// Re-export types
export type { LiveSfxInstance } from '@/store/useLiveSfxStore';
export type { LaserSource } from '@/store/useLaserPreviewStore';
