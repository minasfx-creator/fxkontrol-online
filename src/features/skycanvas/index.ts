/**
 * ─── /features/skycanvas barrel ──────────────────────────────────
 * Canonical entry for `/skycanvas` (editor 3D / coreografias).
 *
 * Pareia com `src/features/command/index.ts`. O guard test
 * `commandSkycanvasFirewall.guard.spec.ts` proíbe imports cruzados
 * entre as duas superfícies.
 *
 * READ-ONLY: zero arquivo movido fisicamente.
 */
export { default as SkyCanvasMount } from '@/components/editor/SkyCanvasMount';
export { default as SkyCanvasDiagnosticsPanel } from '@/components/editor/SkyCanvasDiagnosticsPanel';
export { default as SkyFallback2D } from '@/components/skycanvas/SkyFallback2D';
export { default as MobilePanelSwitcher } from '@/components/skycanvas/MobilePanelSwitcher';
export { default as TabbedDockPanel } from '@/components/skycanvas/TabbedDockPanel';
export { TimelineCuesProvider } from '@/components/skycanvas/tabs/TimelineCuesTab';
