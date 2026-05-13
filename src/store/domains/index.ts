/**
 * Store Domain Index — 4 consolidated domains for FX KONTROL state management.
 *
 * Domains:
 *   Hardware   — MAVLink, SMPTE, USB, Fleet, Addressing
 *   Simulation — Boids, Laser, LiveSFX, SFX Channels, Generative
 *   Workspace  — Project, Scene, Viewport, Display, Rack, Inventory, Undo
 *   AI         — CoPilot
 */
export * from './hardware';
export * from './simulation';
export * from './workspace';
export * from './ai';
