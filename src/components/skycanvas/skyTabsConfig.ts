/**
 * skyTabsConfig — canonical tab specs for SkyCanvas dock panels.
 *
 * Round 7: extracted from `pages/SkyCanvas.tsx` to keep the page shell lean
 * and to allow other surfaces (lab, demos) to mount the same lazy chunks
 * without redefining the dynamic-import map.
 *
 * Each tab is a `DockTabSpec` whose `load` returns a dynamic `import()` —
 * never a static import — so the chunk only enters the bundle when the
 * tab is actually opened. Order here is the visual order in the UI.
 */
import type { DockTabSpec } from './TabbedDockPanel';

export const LIBRARY_TABS: DockTabSpec[] = [
  { value: 'effects',     label: 'Efeitos',     load: () => import('./tabs/LibraryEffectsTab') },
  { value: 'fixtures',    label: 'Fixtures',    load: () => import('./tabs/LibraryFixturesTab') },
  { value: 'models',      label: 'Modelos',     load: () => import('./tabs/LibraryModelsTab') },
  { value: 'templates',   label: 'Templates',   load: () => import('./tabs/LibraryTemplatesTab') },
  { value: 'catalog',     label: 'Catálogo',    load: () => import('./tabs/LibraryCatalogTab') },
  { value: 'marketplace', label: 'Marketplace', load: () => import('./tabs/LibraryMarketplaceTab') },
  { value: 'geo',         label: 'Local',       load: () => import('./tabs/LibraryGeoTab') },
];

export const INSPECTOR_TABS: DockTabSpec[] = [
  { value: 'cue',          label: 'Cue',          load: () => import('./tabs/InspectorCueTab') },
  { value: 'scene',        label: 'Cena',         load: () => import('./tabs/InspectorSceneTab') },
  { value: 'sceneEditor',  label: 'Cena+',        load: () => import('./tabs/InspectorSceneEditorTab') },
  { value: 'effect',       label: 'Efeito',       load: () => import('./tabs/InspectorEffectTab') },
  { value: 'generative',   label: 'Generative',   load: () => import('./tabs/InspectorGenerativeTab') },
  { value: 'chain',        label: 'Chain',        load: () => import('./tabs/InspectorChainTab') },
  { value: 'light',        label: 'Light',        load: () => import('./tabs/InspectorLightTab') },
  { value: 'laser',        label: 'Laser',        load: () => import('./tabs/InspectorLaserTab') },
  { value: 'boids',        label: 'Boids',        load: () => import('./tabs/InspectorBoidsTab') },
  { value: 'particle',     label: 'Particle',     load: () => import('./tabs/InspectorParticleTab') },
  { value: 'trajectory',   label: 'Trajectory',   load: () => import('./tabs/InspectorTrajectoryTab') },
  { value: 'transition',   label: 'Transition',   load: () => import('./tabs/InspectorTransitionTab') },
  { value: 'synesthesia',  label: 'Synesthesia',  load: () => import('./tabs/InspectorSynesthesiaTab') },
  { value: 'render',       label: 'Render',       load: () => import('./tabs/InspectorRenderTab') },
  { value: 'hardware',     label: 'Hardware',     load: () => import('./tabs/HardwareObserverTab') },
  { value: 'strategy',     label: 'Strategy',     load: () => import('./tabs/StrategyContextTab') },
];

export const TIMELINE_TABS: DockTabSpec[] = [
  { value: 'cues',       label: 'Cues',       load: () => import('./tabs/TimelineCuesTab') },
  { value: 'waveform',   label: 'Waveform',   load: () => import('./tabs/TimelineWaveformTab') },
  { value: 'storyboard', label: 'Storyboard', load: () => import('./tabs/TimelineStoryboardTab') },
  { value: 'preview',    label: 'Preview',    load: () => import('./tabs/TimelinePreviewTab') },
  { value: 'scripting',  label: 'Scripting',  load: () => import('./tabs/TimelineScriptingTab') },
  { value: 'export',     label: 'Export',     load: () => import('./tabs/TimelineExportTab') },
  { value: 'smpte',      label: 'SMPTE',      load: () => import('./tabs/TimelineSmpteTab') },
  { value: 'validation', label: 'Validation', load: () => import('./tabs/TimelineValidationTab') },
];
