/**
 * Shared type for mobile dock tabs — extracted to break circular dependency
 * between MobileTabBar ↔ DockContextMenu.
 */
export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'mobilelink' | 'controllers' | 'fieldmap' | 'radio' | 'remote' | 'more';
