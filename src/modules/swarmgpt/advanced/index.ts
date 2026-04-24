/**
 * SwarmGPT Advanced — public surface.
 */
// Nível 1
export * from './poissonSampling';
export * from './trajectoryOptimizer';
export * from './beatSync';
export * from './generateOptimizedFormation';

// Nível 2 — asset adapters, weighted sampling, transition diagnostics, fidelity
export * from './svg/svgPathToPoints';
export * from './gaussian/gaussianToPointCloud';
export * from './realityscan/realityScanAdapter';
export * from './sampling/weightedPoissonSampling';
export * from './motion/hungarianLite';
export * from './motion/optimizeDroneTransition';
export * from './scoring/scoreFormationFidelity';

// Nível 3 — 3D model → formation
export * from './model3d';
