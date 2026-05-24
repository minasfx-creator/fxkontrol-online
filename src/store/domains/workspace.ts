/**
 * Workspace Domain — Re-exports all workspace/editor-related stores.
 * Consolidation layer for Project, Scene, Viewport, Display, Rack, Inventory, Undo.
 *
 * Usage: import { useProjectStore, useSceneStore } from '@/store/domains/workspace';
 */
export { useProjectStore } from '@/store/useProjectStore';
export { useSceneStore } from '@/store/useSceneStore';
export { useViewportStore } from '@/store/useViewportStore';
export { useDisplayStore } from '@/store/useDisplayStore';
export { useRackStore } from '@/store/useRackStore';
export { useInventoryStore } from '@/store/useInventoryStore';
export { useUndoStore } from '@/store/useUndoStore';

// Re-export key types
export type { ProjectState } from '@/store/useProjectStore';
export type { ViewportInteractionState, ViewPreset, ProjectionMode } from '@/store/useViewportStore';
export type { Rack, RackTube, RackType, RackTemplate } from '@/store/useRackStore';
export type { InventoryItem } from '@/store/useInventoryStore';
