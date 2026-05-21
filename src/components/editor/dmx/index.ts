/**
 * DMX Module — Barrel exports
 * 
 * Organized hierarchy:
 * - DMXPanel: Main control panel (patching, universes, output)
 * - DMXMonitorPanel: 512-channel signal analyzer
 * - DMXMonitorGrid: Visual channel grid (sub-component of DMXPanel)
 * - DMXOutputPanel: Wired USB-C/Lightning DMX output
 * - DMXBezierEditor: Cubic Bézier curve editor for smooth DMX transitions
 */
export { default as DMXPanel } from './DMXPanel';
export { default as DMXMonitorPanel } from './DMXMonitorPanel';
export { default as DMXMonitorGrid } from './DMXMonitorGrid';
export { default as DMXOutputPanel } from './DMXOutputPanel';
export { default as DMXBezierEditor } from './DMXBezierEditor';
export type { BezierPoint, DMXCurve } from './DMXBezierEditor';
